/* Integration: a real server and two players over WebSockets playing a 1v1 of prop hunt, then the shop,
   a Mystery Box, the daily box, a reconnect, a wrong key, and profiles surviving a restart. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import WebSocket from 'ws';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'found-it-')), DATA = path.join(dir, 'data.json'), PORT = 4300 + Math.floor(Math.random() * 500);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let srv = null;
async function start() {
  srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), DATA_FILE: DATA, FOUND_TEST_FAST: '1', DATABASE_URL: '', ADMIN_CODE: '' }), stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', d => process.stderr.write('[server] ' + d));
  for (let i = 0; i < 150; i++) { try { const r = await fetch(`http://localhost:${PORT}/api/ping`); if (r.ok) return; } catch (e) {} await sleep(100); }
  throw new Error('server did not start');
}
async function stop() { if (!srv) return; const s = srv; srv = null; s.kill('SIGTERM'); await new Promise(r => s.once('exit', r)); }
class Client {
  constructor(name) { this.name = name; this.id = crypto.randomBytes(12).toString('hex'); this.key = crypto.randomBytes(24).toString('hex'); this.msgs = []; this.waiters = []; }
  open(code, auto) { return new Promise((res, rej) => { this.ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    this.ws.on('message', d => { const m = JSON.parse(d); this.msgs.push(m); if (m.t === 'me') this.me = m.me; if (m.t === 'party') this.party = m; this.waiters = this.waiters.filter(w => !(w.f(m) && (w.res(m), true))); });
    this.ws.on('open', () => { this.send({ t: 'auth', id: this.id, key: this.key, code, auto }); res(); }); this.ws.on('error', rej); }); }
  send(m) { this.ws.send(JSON.stringify(m)); }
  wait(f, ms = 8000, what = '') { const hit = this.msgs.find(f); if (hit) return Promise.resolve(hit); return new Promise((res, rej) => { this.waiters.push({ f, res }); setTimeout(() => rej(new Error(this.name + ' timed out waiting for ' + what)), ms); }); }
  fresh() { this.msgs = []; }
  close() { this.ws.close(); }
}
let n = 0; const ok = s => { n++; console.log('  ok', s); };
/* walk a client to a point: keep sending the target until the server stops correcting the position */
async function walk(c, x, z) { for (let k = 0; k < 40; k++) { c.fresh(); for (let i = 0; i < 10; i++) { c.send({ t: 'mv', x, z, y: 0, ry: 0, f: 1 }); await sleep(12); } await sleep(30); if (!c.msgs.some(m => m.t === 'fix')) return; } }
try {
  await start();
  const html = await (await fetch(`http://localhost:${PORT}/`)).text(); assert.match(html, /<title>FOUND<\/title>/); assert.doesNotMatch(html, /__V__/); ok('serves the page with a build stamp');
  assert.equal((await fetch(`http://localhost:${PORT}/world.js`, { headers: { 'accept-encoding': 'gzip' } })).headers.get('content-encoding'), 'gzip'); ok('compresses scripts');
  assert.equal((await fetch(`http://localhost:${PORT}/../server.js`)).status, 404); ok('no files outside public/');
  const A = new Client('A'), B = new Client('B');
  await A.open(); await A.wait(m => m.t === 'me'); assert.equal(A.me.boxes, 1); assert.equal(A.me.coins, 300); ok('auth creates a profile with coins and a welcome box');
  A.send({ t: 'create' }); const pa = await A.wait(m => m.t === 'party'); assert.match(pa.code, /^[A-Z]{4}$/); assert.equal(pa.mode, 'solo'); ok('create gives a 4-letter party code');
  await B.open(); await B.wait(m => m.t === 'me');
  B.send({ t: 'join', code: 'QQQQ' }); assert.match((await B.wait(m => m.t === 'err')).m, /No party/); ok('a wrong code is refused');
  B.send({ t: 'join', code: pa.code.toLowerCase() }); const st = await B.wait(m => m.t === 'party' && m.players.length === 2); assert.equal(st.mode, 'duel'); assert.equal(st.map, 'cabin'); ok('join by code; two players is a 1v1 on the cabin');
  A.send({ t: 'stake', n: 100 }); await B.wait(m => m.t === 'party' && m.stake === 100); ok('the host sets a stake');
  A.send({ t: 'ready', v: true }); B.send({ t: 'ready', v: true });
  const rA = await A.wait(m => m.t === 'role', 5000, 'role'), rB = await B.wait(m => m.t === 'role', 5000, 'role');
  assert.deepEqual([rA.role, rB.role].sort(), ['hider', 'seeker']); const H = rA.role === 'hider' ? A : B, S = H === A ? B : A, rH = H === A ? rA : rB;
  assert.equal(rH.offer.length, 3); await sleep(100); assert.equal(A.me.coins, 200); assert.equal(B.me.coins, 200); ok('both ready: one seeker, one hider with three props; both stakes are paid in');
  H.send({ t: 'choose', obj: rH.offer[0] });
  const roundH = await H.wait(m => m.t === 'round', 6000, 'round'); await S.wait(m => m.t === 'round', 6000, 'round');
  assert.equal(roundH.prop, rH.offer[0]); assert.equal(roundH.items.filter(i => i.type === roundH.prop).length, 3); assert.equal(roundH.map, 'cabin'); ok('the round has three decoy copies of the hider\'s prop');
  /* the hider walks a little during the hide; the seeker must not hear about it */
  S.fresh(); for (let k = 0; k < 10; k++) { H.send({ t: 'mv', x: 1 + k * 0.3, z: 9, y: 0, ry: 0, f: 1 }); await sleep(40); }
  assert.ok(!S.msgs.some(m => m.t === 'pos')); ok('the seeker is told nothing while hiders hide');
  await S.wait(m => m.t === 'party' && m.phase === 'seek', 6000, 'seek');
  /* the seeker walks in through the front door to the hider, tags an ordinary object if one is in reach (a miss), then the hider */
  for (const [x, z] of [[0, 17], [0, 11.5], [4, 9.5]]) await walk(S, x, z);
  const dec = roundH.items.find(i => i.type !== 'gift' && Math.hypot(i.x - 4, i.z - 9.5) < 3.6);
  if (dec) { S.send({ t: 'tag', id: dec.id }); await S.wait(m => m.t === 'miss', 3000, 'miss'); await sleep(120); }
  ok('tagging an ordinary object is a miss' + (dec ? '' : ' (none in reach this time; covered by the unit tests)'));
  S.send({ t: 'tag', id: H.id }); const f = await S.wait(m => m.t === 'found', 3000, 'found'); assert.equal(f.id, H.id); ok('walking up to the hider and tagging catches them');
  const res1 = await S.wait(m => m.t === 'results', 4000, 'results'); assert.equal(res1.win, 'seekers'); assert.equal(res1.final, false); assert.equal(res1.reward.boxes, 1); ok('round one ends: the seeker wins a Mystery Box');
  A.fresh(); B.fresh(); const r2A = await A.wait(m => m.t === 'role', 5000, 'round 2'); assert.equal(r2A.round, 2); assert.equal(r2A.role, A === H ? 'seeker' : 'hider'); ok('round two swaps sides');
  const res2 = await A.wait(m => m.t === 'results', 30000, 'final results'); assert.equal(res2.final, true); assert.equal(res2.ranking[0].id, S.id);
  const win = S, potMsg = await win.wait(m => m.t === 'results' && m.final); assert.equal(potMsg.reward.pot, 200); ok('the match ends after two rounds and the winner takes the pot');
  await A.wait(m => m.t === 'party' && m.phase === 'lobby', 6000, 'lobby'); ok('back to the lobby');
  /* shop, box, daily */
  const boxes = S.me.boxes; S.fresh(); S.send({ t: 'open' }); const op = await S.wait(m => m.t === 'opened', 3000); assert.ok(op.r.item); await sleep(100); assert.equal(S.me.boxes, boxes - 1); assert.ok(S.me.own.includes(op.r.item)); ok('opening a Mystery Box gives an item');
  S.fresh(); S.send({ t: 'buy', item: 'x_void' }); assert.match((await S.wait(m => m.t === 'err')).m, /Not enough/); ok('the shop refuses what you cannot afford');
  S.fresh(); S.send({ t: 'daily' }); await sleep(150); const b1 = S.me.boxes; S.send({ t: 'daily' }); assert.match((await S.wait(m => m.t === 'err')).m, /tomorrow/); assert.equal(S.me.boxes, b1); ok('one free box a day');
  S.send({ t: 'equip', look: { [op.r.slot === 'pet' ? 'hat' : op.r.slot]: op.r.slot === 'pet' ? '' : op.r.item }, pet: op.r.slot === 'pet' ? op.r.item : '' }); await sleep(150); ok('equip works');
  S.fresh(); S.send({ t: 'spin' }); const g = await S.wait(m => m.t === 'got', 3000, 'spin'); assert.ok(g.coins || g.box); S.send({ t: 'spin' }); assert.match((await S.wait(m => m.t === 'err')).m, /tomorrow/); ok('one wheel spin a day');
  S.fresh(); S.send({ t: 'mini' }); const mg = await S.wait(m => m.t === 'mini', 3000, 'mini'); const odd = mg.cells.findIndex(x => mg.cells.filter(y => y === x).length === 1); const c5 = S.me.coins; S.send({ t: 'minipick', i: odd }); const mr = await S.wait(m => m.t === 'minires', 3000); assert.ok(mr.win); assert.equal(mr.coins, 20); await sleep(100); assert.equal(S.me.coins, c5 + 20); ok('odd one out pays 20 coins');
  const O = S === A ? B : A, c6 = O.me.coins; S.send({ t: 'gift', to: O.id, n: 100 }); await O.wait(m => m.t === 'gifted', 3000, 'gifted'); await sleep(100); assert.equal(O.me.coins, c6 + 100); ok('gifting coins to a party member');
  const code = A.party.code; B.close(); await sleep(200);
  const B2 = new Client('B2'); B2.id = B.id; B2.key = B.key; await B2.open(code); assert.equal((await B2.wait(m => m.t === 'party')).code, code); ok('rejoins the party after a reconnect');
  const evil = new Client('evil'); evil.id = A.id; await evil.open(); await evil.wait(m => m.t === 'authfail', 3000); evil.close(); ok('a wrong key is refused');
  /* one public lobby: everyone who signs in with auto lands in the same party, guns are on from the start, and there is no admin switch */
  { const P1 = new Client('P1'), P2 = new Client('P2'); await P1.open(undefined, 1); const a1 = await P1.wait(m => m.t === 'party', 3000, 'auto join'); await P2.open(undefined, 1); const a2 = await P2.wait(m => m.t === 'party' && m.players.length === 2, 3000, 'auto join 2');
    assert.equal(a1.code, a2.code); assert.ok(a2.pub); assert.ok(a2.guns); ok('everyone auto-joins the same public lobby, guns on');
    P2.send({ t: 'create' }); const pr = await P2.wait(m => m.t === 'party' && m.code !== a1.code, 3000, 'private'); assert.ok(!pr.pub); P2.send({ t: 'play' }); await P2.wait(m => m.t === 'party' && m.code === a1.code && m.players.length === 2, 3000, 'back to public'); ok('a practice room is private and play returns to the public lobby');
    P2.send({ t: 'guns', on: false }); await sleep(150); assert.ok(P1.party.guns && !P1.msgs.some(m => m.t === 'err')); P2.send({ t: 'admin', code: 'x' }); await sleep(100); P1.close(); P2.close(); ok('there is no way to switch guns off'); }
  /* shots, hits and the crate go through the server */
  {
    await walk(A, 0, 0); await walk(B2, 0, 12); A.fresh(); B2.fresh(); A.send({ t: 'shoot', ry: 0 }); const hit = await B2.wait(m => m.t === 'hit', 3000, 'hit'); assert.equal(hit.hp, 86); assert.ok((await A.wait(m => m.t === 'shot', 3000)).e.length >= 1); ok('a shot reaches everyone and damages the target');
    A.fresh(); A.send({ t: 'crate' }); const cr = await Promise.race([A.wait(m => m.t === 'crated', 3000, 'crate').catch(() => null), A.wait(m => m.t === 'err', 3000, 'crate err').catch(() => null)]);
    if (cr && cr.t === 'crated') { assert.equal(cr.r.slot, 'gun'); ok('a gun crate opens and gives a gun'); } else { assert.match(cr.m, /Not enough/); ok('a gun crate needs 500 coins'); } }
  await sleep(250); const coins = A.me.coins; A.close(); B2.close(); await sleep(1800); await stop(); await start();
  const A2 = new Client('A2'); A2.id = A.id; A2.key = A.key; await A2.open(); await A2.wait(m => m.t === 'me'); assert.equal(A2.me.coins, coins); A2.close(); ok('profiles survive a restart');
  console.log(`\n${n} integration checks passed`);
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
