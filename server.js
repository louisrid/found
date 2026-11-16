/* FOUND server: serves the game, keeps profiles and runs every party over one WebSocket per player.
   Plain Node (22), two dependencies (ws, postgres), no build step. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { openStore } from './src/store.js';
import * as P from './src/profiles.js';
import { Party, newCode } from './src/game.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url)), PUB = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const TEST_FAST = process.env.FOUND_TEST_FAST === '1';   // tests only: short rounds

const store = await openStore();
const parties = new Map(), online = new Map();   // code -> Party, profile id -> connection

/* ---------------- static files ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const BUILD = crypto.createHash('sha1').update(fs.readdirSync(PUB, { recursive: true }).map(f => { try { return f + fs.statSync(path.join(PUB, f)).mtimeMs; } catch (e) { return f; } }).join('|')).digest('hex').slice(0, 10);
const cache = new Map();
function asset(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const file = path.join(PUB, rel); if (!file.startsWith(PUB + path.sep)) return null;
  let buf; try { if (!fs.statSync(file).isFile()) return null; buf = fs.readFileSync(file); } catch (e) { return null; }
  const ext = path.extname(file).toLowerCase(), type = MIME[ext] || 'application/octet-stream';
  if (ext === '.html') buf = Buffer.from(buf.toString('utf8').replace(/__V__/g, BUILD));
  const text = /^(text|application\/(json|manifest)|image\/svg)/.test(type);
  const a = { buf, gz: text && buf.length > 1024 ? zlib.gzipSync(buf, { level: 9 }) : null, type, etag: '"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '"', html: ext === '.html' };
  cache.set(rel, a); return a;
}
const json = (res, code, o) => { const b = Buffer.from(JSON.stringify(o)); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': b.length, 'Cache-Control': 'no-store' }); res.end(b); };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/ping') return json(res, 200, { ok: true, build: BUILD, store: store.kind, online: online.size, parties: parties.size });
  if (url.pathname.startsWith('/api/')) return json(res, 404, { message: 'Not found.' });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, ''); if (!rel || rel.endsWith('/')) rel += 'index.html';
  const a = asset(rel) || (path.extname(rel) ? null : asset('index.html'));
  if (!a) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  const h = { 'Content-Type': a.type, ETag: a.etag, 'Cache-Control': a.html ? 'no-cache' : url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' };
  if (req.headers['if-none-match'] === a.etag) { res.writeHead(304, h); return res.end(); }
  const gz = a.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gz) { h['Content-Encoding'] = 'gzip'; h.Vary = 'Accept-Encoding'; }
  const body = gz ? a.gz : a.buf; h['Content-Length'] = body.length; res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : body);
});

/* ---------------- parties ---------------- */
const send = (c, m) => { if (c && c.ws.readyState === 1) c.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
const io = {
  all(party, m) { const s = JSON.stringify(m); for (const p of party.players.values()) send(p.conn, s); },
  one(p, m) { send(p.conn, m); },
  me(p) { send(p.conn, { t: 'me', me: P.privateOf(p.prof, Date.now()) }); },
  saved() { store.touch(); }
};
const partyOpts = TEST_FAST ? { cfg: { pickMs: 1500, hideMs: 1500, soloHideMs: 500, seekMs: 12000, resultsMs: 1500, swapMs: 1000, readyMs: 500, tagCooldownMs: 50, fixedSeed: 0 } } : {};
function leave(c) {
  const party = c.party; if (!party) return; c.party = null;
  party.remove(c.prof.id);
  if (!party.players.size) parties.delete(party.code);
}
function join(c, party) {
  if (c.party && c.party !== party) leave(c);
  c.party = party; party.add(c.prof, c);
}

const handlers = {
  create(c) { const party = new Party(newCode(new Set(parties.keys())), io, partyOpts); parties.set(party.code, party); join(c, party); },
  join(c, b) {
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!/^[A-Z]{4}$/.test(code)) throw new Error('Party codes are 4 letters.');
    const party = parties.get(code); if (!party) throw new Error('No party with the code ' + code + '.');
    join(c, party);
  },
  leave(c) { leave(c); send(c, { t: 'left' }); },
  start(c) { need(c).start(c.prof.id); },
  ready(c, b) { const party = need(c); party.setReady(party.players.get(c.prof.id), b.v); },
  choose(c, b) { const party = need(c); party.choose(party.players.get(c.prof.id), String(b.obj)); },
  mv(c, b) { const party = c.party; if (party) party.move(party.players.get(c.prof.id), b); },
  grab(c, b) { const party = need(c); party.grab(party.players.get(c.prof.id), String(b.item)); },
  tag(c, b) { const party = need(c); party.tag(party.players.get(c.prof.id), String(b.id)); },
  map(c, b) { const party = need(c); party.setMap(party.players.get(c.prof.id), String(b.id)); },
  rule(c, b) { const party = need(c); party.setRule(party.players.get(c.prof.id), String(b.k), Number(b.v)); },
  stake(c, b) { const party = need(c); party.setStake(party.players.get(c.prof.id), Number(b.n)); },
  emote(c, b) { const party = need(c), e = String(b.e); if (['wave', 'cheer', 'dance', 'spin', 'bow', 'floss'].includes(e)) io.all(party, { t: 'emote', id: c.prof.id, e }); },
  lobby(c) { const party = need(c); if (party.phase === 'results' && c.prof.id === party.host) party.toLobby(); },
  equip(c, b) { P.equip(c.prof, b); store.touch(c.prof.id); me(c); if (c.party) c.party.sync(); },
  open(c) { const r = P.openBox(c.prof); store.touch(c.prof.id); send(c, { t: 'opened', r }); me(c); },
  buy(c, b) { const r = P.buyItem(c.prof, String(b.item)); store.touch(c.prof.id); send(c, { t: 'bought', r }); me(c); },
  buybox(c) { P.buyBox(c.prof); store.touch(c.prof.id); me(c); },
  idle(c) { const n = P.claimIdle(c.prof, Date.now()); store.touch(c.prof.id); send(c, { t: 'got', coins: n, why: 'idle' }); me(c); },
  spin(c) { const prize = P.spin(c.prof, Date.now()); store.touch(c.prof.id); send(c, { t: 'got', coins: prize.coins || 0, box: prize.box || 0, why: 'spin' }); me(c); },
  /* odd one out: the server builds the board and keeps the answer */
  mini(c) { const O = globalThis.FOUND_OBJECTS.LIST.map(o => o.id), a = O[Math.floor(Math.random() * O.length)]; let b = a; while (b === a) b = O[Math.floor(Math.random() * O.length)];
    const n = 16, at = Math.floor(Math.random() * n); c.mini = { at, until: Date.now() + P.MINI.ms }; send(c, { t: 'mini', cells: Array.from({ length: n }, (_, i) => i === at ? b : a), ms: P.MINI.ms, left: P.miniLeft(c.prof, Date.now()) }); },
  minipick(c, b) { const g = c.mini; c.mini = null; if (!g) return; const win = Number(b.i) === g.at && Date.now() <= g.until + 500, coins = win ? P.miniWin(c.prof, Date.now()) : 0; if (coins) store.touch(c.prof.id); send(c, { t: 'minires', win, coins, at: g.at }); me(c); },
  gift(c, b) { const party = need(c), to = party.players.get(String(b.to)); if (!to) throw new Error('They left.'); P.giveCoins(c.prof, to.prof, Number(b.n)); store.touch(c.prof.id); store.touch(to.prof.id); me(c); send(c, { t: 'sent', n: Number(b.n), to: to.prof.name }); if (to.conn) { send(to.conn, { t: 'gifted', from: c.prof.name, n: Number(b.n) }); me(to.conn); } },
  daily(c) { P.claimDaily(c.prof, Date.now()); store.touch(c.prof.id); me(c); }
};
function need(c) { if (!c.party) throw new Error('Join a party first.'); return c.party; }
const me = c => send(c, { t: 'me', me: P.privateOf(c.prof, Date.now()) });

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', ws => {
  const c = { ws, prof: null, party: null, bucket: 40, last: Date.now() };
  ws.on('message', raw => {
    const now = Date.now(); c.bucket = Math.min(60, c.bucket + (now - c.last) / 1000 * 40); c.last = now;
    if (--c.bucket < 0) return;   // flood: drop
    let b; try { b = JSON.parse(raw); } catch (e) { return; }
    if (!b || typeof b.t !== 'string') return;
    try {
      if (b.t === 'auth') return auth(c, b);
      if (!c.prof) return send(c, { t: 'err', m: 'Not signed in.' });
      const h = handlers[b.t]; if (h) h(c, b);
    } catch (e) { send(c, { t: 'err', m: e.message || 'Something went wrong.', of: b.t }); }
  });
  ws.on('close', () => {
    if (!c.prof) return;
    if (online.get(c.prof.id) === c) online.delete(c.prof.id);
    const party = c.party; if (party) { const p = party.players.get(c.prof.id); if (p && p.conn === c) { p.conn = null; p.gone = Date.now(); party.sync(); } }
  });
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
});
function auth(c, b) {
  const id = String(b.id || ''), key = String(b.key || '');
  if (!/^[a-z0-9]{16,40}$/.test(id) || key.length < 16 || key.length > 80) return send(c, { t: 'authfail' });
  let prof = store.profiles.get(id);
  if (prof && prof.kh !== P.hashKey(key)) return send(c, { t: 'authfail' });
  if (!prof) { prof = P.newProfile(id, key, Date.now()); store.profiles.set(id, prof); store.touch(id); }
  const old = online.get(id); if (old && old !== c) { send(old, { t: 'replaced' }); old.ws.close(4000, 'replaced'); }
  c.prof = prof; online.set(id, c);
  send(c, { t: 'me', me: P.privateOf(prof, Date.now()), build: BUILD });
  /* back into the party this player was in (reconnects, refreshes) */
  const code = String(b.code || '').toUpperCase();
  if (/^[A-Z]{4}$/.test(code) && parties.has(code)) join(c, parties.get(code));
}

/* positions out 15 times a second; the clock 5 times a second; dead sockets out every 20 s */
setInterval(() => { for (const party of parties.values()) party.sendPositions(); }, 66).unref();
setInterval(() => { const now = Date.now(); for (const [code, party] of parties) { try { party.tick(); } catch (e) { console.error('tick', code, e); } if (!party.players.size || [...party.players.values()].every(p => !p.conn && now - p.gone > 60000)) parties.delete(code); } }, 200).unref();
setInterval(() => { wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) {} }); }, 20000).unref();

server.listen(PORT, () => console.log(`FOUND on http://localhost:${PORT} (store: ${store.kind}, build ${BUILD})`));
const bye = async () => { try { await store.close(); } catch (e) {} process.exit(0); };
process.on('SIGTERM', bye); process.on('SIGINT', bye);
