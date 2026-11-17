/* Parties and prop hunt. A party has a 4-letter code and moves through
   lobby -> pick -> hide -> seek -> results -> (next round or lobby).
   One player seeks. Everyone else picks an object to hide as and moves around the house as that object.
   The map also holds ordinary copies of every hider's object, plus lots of other objects, as decoys.
   Modes by head count: 1 = practice (you seek computer-placed hiders), 2 = 1v1 (two rounds, swap sides),
   3 to 12 = party (one round, the seeker rotates; two seekers from 7 players).
   Three maps (cabin, house, mansion) picked by head count unless the host chooses. A caught hider is out for the round.
   The server owns the clock, who is what, the decoys and every tag. */
import '../public/objects.js';
import '../public/layout.js';
import '../public/guns.js';
import { publicOf, addBox, owns } from './profiles.js';
const OBJ = globalThis.FOUND_OBJECTS, LAY = globalThis.FOUND_LAYOUT, GUNS = globalThis.FOUND_GUNS;

export const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CFG = { maxPlayers: 12, pickMs: 8000, soloHideMs: 3000, resultsMs: 9000, swapMs: 5000, readyMs: 3000,
  copies: 3, bots: 3, reach: 4.2, tagCooldownMs: 1000, missPenaltyMs: 10000, maxStake: 500,
  findPts: 250, allFoundBonus: 300, survivePts: 400, perSecond: 3, maxSpeed: 64,
  /* hints: in the last 30% of the seek the seeker is told which objects are still hidden. Moving: hiders earn a bonus for changing spot */
  /* hint 1 (last 30%): which objects; hint 2 (last 15%): which rooms. A hider who stays within 2 m for 20 s starts twitching */
  /* every player earns 1,000 coins a minute (100 every 6 s). Guns (admin switch, lobby only): 100 hp, 150 coins a kill, back after 3 s with 2 s of shield */
  payMs: 6000, payCoins: 100, killCoins: 150, respawnMs: 3000, shieldMs: 2000,
  hintAt: 0.3, hint2At: 0.15, moveBonus: 40, moveDist: 8, moveEveryMs: 10000, moveMax: 5, restlessMs: 20000, stillDist: 2 };
/* each map: how long hiders get, how long seekers get, how many other objects and gift boxes are scattered */
export const MAPCFG = {
  cabin: { hideMs: 12000, seekMs: 60000, filler: 22, gifts: 0 },
  house: { hideMs: 18000, seekMs: 90000, filler: 40, gifts: 0 },
  mansion: { hideMs: 21000, seekMs: 108000, filler: 60, gifts: 0 }
};
export const STAKES = [0, 100, 250, 500];
/* host-editable rules: every option list is the set of values the server accepts; the first listed value is NOT the default (see RULES0) */
export const RULE_OPTS = { hide: [0.6, 1, 1.5], seek: [0.6, 1, 1.5], penalty: [5, 10, 20], copies: [2, 3, 5], seekers: [0, 1, 2], hints: [0, 1] };
export const RULES0 = { hide: 1, seek: 1, penalty: 10, copies: 3, seekers: 0, hints: 1 };
export const modeFor = n => n <= 1 ? 'solo' : n === 2 ? 'duel' : 'party';
export const mapFor = n => n <= 2 ? 'cabin' : n <= 6 ? 'house' : 'mansion';

const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const r2 = n => Math.round(n * 100) / 100;
const multOf = type => OBJ.TIERS[OBJ.BY[type].tier].mult;

export class Party {
  constructor(code, io, opts = {}) {
    this.code = code; this.io = io; this.now = opts.now || Date.now; this.rnd = opts.rnd || Math.random; this.cfg = Object.assign({}, CFG, opts.cfg || {}); this.over = opts.cfg || {};
    this.players = new Map(); this.host = null; this.phase = 'lobby'; this.round = null; this.n = 0; this.readyAt = 0;
    this.guns = false; this.mode = 'solo'; this.matchRound = 0; this.matchRounds = 1; this.mapPick = 'auto'; this.mapId = 'cabin'; this.seed = 0; this.mc = this.mapCfg('cabin'); this.stake = 0; this.pot = null; this.rules = Object.assign({}, RULES0);
  }
  mapCfg(id) { return Object.assign({}, MAPCFG[id], this.over); }
  map() { return LAY.map(this.mapId, this.seed); }
  /* ---------- membership ---------- */
  get live() { return this.phase === 'hide' || this.phase === 'seek'; }
  active() { return [...this.players.values()].filter(p => !p.spec); }
  view(p) {
    const shown = this.live || this.phase === 'results';
    return Object.assign(publicOf(p.prof), { score: p.total + (this.phase === 'results' ? 0 : p.score), finds: p.finds, ready: p.ready, role: p.role, found: p.found, spec: !!p.spec,
      prop: shown ? p.prop : null, picked: !!p.prop, here: !!p.conn, hp: this.guns ? p.hp : 0, dead: !!p.deadAt, kills: p.kills || 0 });
  }
  state() {
    return { t: 'party', code: this.code, host: this.host, guns: this.guns, phase: this.phase, mode: this.phase === 'lobby' ? modeFor(this.players.size) : this.mode,
      map: this.phase === 'lobby' ? (this.mapPick === 'auto' ? mapFor(this.players.size) : this.mapPick) : this.mapId, mapPick: this.mapPick, stake: this.stake, rules: this.rules, times: (m => ({ hide: m.hideMs, seek: m.seekMs }))(this.phase === 'lobby' ? this.mapCfg(this.mapPick === 'auto' ? mapFor(this.players.size) : this.mapPick) : this.mc), pot: this.pot ? this.pot.amount * 2 : 0,
      players: [...this.players.values()].map(p => this.view(p)), round: this.roundInfo(), readyAt: this.readyAt || 0, max: this.cfg.maxPlayers, now: this.now() };
  }
  roundInfo() { const R = this.round; if (!R) return null; return { n: this.matchRound, of: this.matchRounds, pickEnds: R.pickEnds, hideEnds: R.hideEnds, endAt: R.endAt, resultsEnd: R.resultsEnd, left: this.live ? this.left() : 0, hint: R.hint ? this.hintList() : null, rooms: R.hint2 ? this.hintRooms() : null }; }
  hintRooms() { const R = this.round, map = this.map(), out = new Set(); for (const p of this.active()) if (p.role === 'hider' && !p.found) out.add(map.roomAt(p.x, p.z)); if (R.items) for (const it of R.items.values()) if (it.bot) out.add(map.roomAt(it.x, it.z)); return [...out]; }
  /* the objects still hidden, by name, for the seeker's hint */
  hintList() { const R = this.round, out = new Set(); for (const p of this.active()) if (p.role === 'hider' && !p.found && OBJ.BY[p.prop]) out.add(OBJ.BY[p.prop].name); if (R.items) for (const it of R.items.values()) if (it.bot) out.add(OBJ.BY[it.type].name); return [...out]; }
  sync() { this.io.all(this, this.state()); }
  inHouse() { return this.live || this.phase === 'results'; }
  spawn(p, i) {
    const house = this.inHouse(), map = house ? this.map() : LAY.lobby; let s = map.spawns[i % map.spawns.length];
    /* hiders start in the middle of the house so 30 seconds is enough to reach any room */
    if (this.phase === 'hide' && p.role === 'hider') { const a = i / Math.max(1, this.players.size) * Math.PI * 2, c = map.center; s = { x: r2(c[0] + Math.sin(a) * 3), z: r2(c[1] + Math.cos(a) * 3), ry: a }; }
    p.x = s.x; p.z = s.z; p.y = 0; p.ry = s.ry; p.at = this.now(); p.moved = true; this.io.one(p, { t: 'tp', x: p.x, z: p.z, ry: p.ry, map: map.kind, seed: house ? this.seed : 0 });
  }
  add(prof, conn) {
    let p = this.players.get(prof.id);
    if (p) { p.conn = conn; p.gone = 0; p.prof = prof; }
    else {
      if (this.players.size >= this.cfg.maxPlayers) throw new Error('That party is full.');
      /* joining mid-round: watch and wander until the next one */
      p = { id: prof.id, prof, conn, score: 0, total: 0, finds: 0, ready: false, role: null, orig: null, prop: null, offer: null, found: false, turns: 0, tagAt: 0,
        x: 0, z: 0, y: 0, ry: 0, at: this.now(), moved: true, gone: 0, spec: this.phase !== 'lobby', hp: GUNS.HP, deadAt: 0, kills: 0, shotAt: 0, shield: 0, payAt: this.now() + this.cfg.payMs };
      this.players.set(prof.id, p);
      this.spawn(p, this.players.size - 1);
    }
    if (!this.host || !this.players.has(this.host)) this.host = prof.id;
    for (const q of this.players.values()) q.moved = true;   // so the newcomer gets everyone's position
    this.io.one(p, { t: 'tp', x: p.x, z: p.z, ry: p.ry, map: this.inHouse() ? this.mapId : 'lobby', seed: this.inHouse() ? this.seed : 0 });
    this.checkReady(); this.sync();
    if (this.phase === 'pick' && !p.spec) this.io.one(p, this.roleMsg(p));
    if (this.inHouse() && this.round && this.round.items) this.io.one(p, this.roundMsg(p));
    return p;
  }
  remove(id) {
    if (this.pot && this.pot.ids.includes(id)) this.refundPot();
    if (!this.players.delete(id)) return;
    if (this.host === id) this.host = [...this.players.keys()][0] || null;
    this.io.all(this, { t: 'bye', id });
    if (this.players.size) this.checkRound();
    this.checkReady(); this.sync();
  }
  /* a round cannot go on without a seeker or without anyone left to find */
  checkRound() {
    if (this.phase === 'pick') { const a = this.active(); if (!a.some(p => p.role === 'seeker') || (this.mode !== 'solo' && !a.some(p => p.role === 'hider'))) this.toLobby(); }
    else if (this.live) { if (!this.active().some(p => p.role === 'seeker')) this.endRound('hiders'); else if (this.left() === 0) this.endRound('seekers'); }
  }
  /* ---------- lobby: the host's choices, and the ready ring ---------- */
  setMap(p, id) { if (this.phase !== 'lobby' || p.id !== this.host || (id !== 'auto' && !MAPCFG[id])) return; this.mapPick = id; this.unready(); }
  /* host rules: only values from RULE_OPTS are accepted; a change un-readies everyone so nobody starts under rules they have not seen */
  setRule(p, key, val) { if (this.phase !== 'lobby' || p.id !== this.host || !RULE_OPTS[key] || !RULE_OPTS[key].includes(val)) return; this.rules[key] = val; this.unready(); }
  /* a 1v1 stake: the host sets it; stepping into the ready ring again is how both players accept it */
  setStake(p, n) { if (this.phase !== 'lobby' || p.id !== this.host || !STAKES.includes(n) || n > this.cfg.maxStake) return; this.stake = n; this.unready(); }
  unready() { for (const q of this.players.values()) q.ready = false; this.readyAt = 0; this.io.all(this, { t: 'unready' }); this.sync(); }
  setReady(p, v) { if (this.phase !== 'lobby') return; p.ready = !!v; this.checkReady(); this.sync(); }
  checkReady() {
    if (this.phase !== 'lobby') { this.readyAt = 0; return; }
    const all = this.players.size > 0 && [...this.players.values()].every(p => p.ready);
    if (all && !this.readyAt) this.readyAt = this.now() + this.cfg.readyMs; else if (!all) this.readyAt = 0;
  }
  /* ---------- a match: one round, or two in a 1v1 ---------- */
  start(byId) {
    if (this.phase !== 'lobby') throw new Error('A round is already on.');
    if (byId && byId !== this.host) throw new Error('Only the host can start.');
    this.mode = modeFor(this.players.size); this.matchRounds = this.mode === 'duel' ? 2 : 1; this.matchRound = 0; this.readyAt = 0;
    this.mapId = this.mapPick === 'auto' ? mapFor(this.players.size) : this.mapPick; this.mc = this.mapCfg(this.mapId);
    /* the 1v1 pot: each player puts in the stake (or as much of it as the poorer one has) */
    this.pot = null;
    if (this.mode === 'duel' && this.stake > 0) { const ps = [...this.players.values()], amount = Math.min(this.stake, ...ps.map(p => p.prof.coins)); if (amount > 0) { for (const p of ps) { p.prof.coins -= amount; this.io.me(p); } this.pot = { amount, ids: ps.map(p => p.id) }; this.io.saved(); } }
    this.revive(); for (const p of this.players.values()) { p.total = 0; p.spec = false; }
    this.beginPick();
  }
  beginPick() {
    const now = this.now(), rnd = this.rnd, ps = [...this.players.values()];
    this.matchRound++; this.round = { n: ++this.n, pickEnds: now + this.cfg.pickMs }; this.phase = 'pick';
    /* every round the furniture is rearranged and the clutter rescattered */
    this.seed = this.cfg.fixedSeed != null ? this.cfg.fixedSeed : 1 + Math.floor(rnd() * 2147483646);
    /* who seeks: whoever has had the fewest turns; in a 1v1's second round, whoever hid in the first */
    let seekers;
    if (this.mode === 'duel' && this.matchRound === 2 && ps.length === 2 && ps.some(p => p.orig === 'hider')) seekers = ps.filter(p => p.orig === 'hider');
    else { const want = this.rules.seekers || (ps.length >= 7 ? 2 : 1), n = this.mode === 'solo' ? 1 : Math.max(1, Math.min(want, ps.length - 1)); seekers = shuffle(ps.slice(), rnd).sort((a, b) => a.turns - b.turns).slice(0, n); }
    for (const p of ps) {
      p.spec = false; p.ready = false; p.score = 0; p.finds = 0; p.found = false; p.prop = null; p.tagAt = 0;
      p.role = p.orig = seekers.includes(p) ? 'seeker' : 'hider'; if (p.role === 'seeker') p.turns++;
      p.offer = p.role === 'hider' ? ['easy', 'medium', 'hard'].map(t => { const ids = OBJ.ofTier(t); return ids[Math.floor(rnd() * ids.length)]; }) : null;
    }
    if (this.mode === 'solo') this.round.pickEnds = now + Math.min(this.cfg.pickMs, 2500);
    this.sync();
    for (const p of ps) this.io.one(p, this.roleMsg(p));
  }
  roleMsg(p) { return { t: 'role', role: p.role, offer: p.offer, picked: p.prop, ends: this.round.pickEnds, mode: this.mode, round: this.matchRound, of: this.matchRounds }; }
  choose(p, id) {
    if (this.phase !== 'pick' || p.role !== 'hider' || !p.offer || !p.offer.includes(id)) throw new Error('Pick one of your three.');
    p.prop = id; this.sync();
    if (this.active().filter(q => q.role === 'hider').every(q => q.prop)) this.round.pickEnds = Math.min(this.round.pickEnds, this.now() + 1200);
  }
  /* ---------- hide ---------- */
  beginHide() {
    const now = this.now(), R = this.round, H = this.map(), rnd = this.rnd, cfg = this.cfg, mc = this.mc;
    const hiders = this.active().filter(p => p.role === 'hider');
    for (const p of hiders) if (!p.prop) p.prop = p.offer[Math.floor(rnd() * 3)];
    const used = new Set(), items = []; let k = 0;
    const floor = s => s.y < 0.1;
    const take = (filter, type, perRoom) => {
      const rooms = {}; for (const it of items) if (it.type === type) rooms[it.room] = (rooms[it.room] || 0) + 1;
      const pool = shuffle(H.spots.filter(s => !used.has(s.i) && filter(s)), rnd);
      const s = pool.find(q => (rooms[q.room] || 0) < perRoom) || pool[0] || shuffle(H.spots.filter(q => !used.has(q.i)), rnd)[0];
      if (s) used.add(s.i); return s;
    };
    const put = (type, s, extra) => { const it = Object.assign({ id: 'i' + (k++), type, x: s.x, y: s.y, z: s.z, ry: r2(rnd() * Math.PI * 2), room: s.room, spot: s.i }, extra || {}); items.push(it); return it; };
    /* practice: computer-placed hiders, which are ordinary-looking objects standing on the floor */
    const types = new Set(hiders.map(p => p.prop));
    if (this.mode === 'solo') for (const type of shuffle(OBJ.LIST.map(o => o.id), rnd).slice(0, cfg.bots)) { types.add(type); const s = take(q => q.on === 'floor' || q.on === 'lawn', type, 1); if (s) put(type, s, { bot: 1 }); }
    /* decoy copies of everything someone is hiding as: on the floor like a hider would be, one room each */
    for (const type of types) for (let i = 0; i < this.rules.copies; i++) { const s = take(floor, type, 1); if (s) put(type, s); }
    /* and plenty of other objects on shelves, tables and floors */
    const others = shuffle(OBJ.LIST.map(o => o.id).filter(id => !types.has(id)), rnd);
    for (let i = 0; i < mc.filler && others.length; i++) { const type = others[i % others.length], s = take(() => true, type, 2); if (s) put(type, s); }
    for (let i = 0; i < mc.gifts; i++) { const s = take(q => q.sneak >= 1, 'gift', 1); if (s) put('gift', s, { id: 'g' + (k++), gift: 'box', ry: 0 }); }
    R.items = new Map(items.map(it => [it.id, it])); R.gifts = {};
    R.hideEnds = now + (this.mode === 'solo' ? Math.min(cfg.soloHideMs, mc.hideMs) : Math.round(mc.hideMs * this.rules.hide)); R.endAt = R.hideEnds + Math.round(mc.seekMs * this.rules.seek);
    this.phase = 'hide';
    let i = 0; for (const p of this.players.values()) this.spawn(p, i++);
    this.sync();
    for (const p of this.players.values()) this.io.one(p, this.roundMsg(p));
  }
  roundMsg(p) {
    const R = this.round, items = [...R.items.values()].map(it => ({ id: it.id, type: it.type, gift: it.gift, x: it.x, y: it.y, z: it.z, ry: it.ry }));
    return { t: 'round', items, role: p.role, prop: p.prop, hideEnds: R.hideEnds, endAt: R.endAt, mode: this.mode, map: this.mapId, seed: this.seed };
  }
  /* hiders still hidden, plus practice hiders not yet tagged */
  left() { const R = this.round; let n = this.active().filter(p => p.role === 'hider' && !p.found).length; if (R && R.items) for (const it of R.items.values()) if (it.bot) n++; return n; }
  move(p, b) {
    const now = this.now(); if (p.deadAt) return;
    let x = +b.x, z = +b.z, y = +b.y || 0, ry = +b.ry || 0;
    if (![x, z, y, ry].every(Number.isFinite)) return;
    if (this.phase === 'hide' && p.role === 'seeker') { x = p.x; z = p.z; }   // seekers wait at the gate
    const dt = Math.max(0.05, (now - p.at) / 1000), max = this.cfg.maxSpeed * dt * 1.6 + 1.5, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    let fixed = false; if (d > max) { x = p.x + dx / d * max; z = p.z + dz / d * max; fixed = true; }
    const map = this.inHouse() ? this.map() : LAY.lobby; y = Math.max(0, Math.min(6, y));
    /* checked in short steps so a fast move cannot pass through a thin wall */
    { const n = Math.max(1, Math.ceil(Math.hypot(x - p.x, z - p.z) / 0.5)); let cx = p.x, cz = p.z; for (let i = 1; i <= n; i++) { const r = LAY.collide(map, p.x + (x - p.x) * i / n, p.z + (z - p.z) * i / n, 0.55, cx, cz, y); if (i < n && (Math.abs(r[0] - (p.x + (x - p.x) * i / n)) > 1e-6 || Math.abs(r[1] - (p.z + (z - p.z) * i / n)) > 1e-6)) { cx = r[0]; cz = r[1]; break; } cx = r[0]; cz = r[1]; } x = cx; z = cz; }
    p.x = x; p.z = z; p.y = Math.max(0, Math.min(6, y)); p.ry = ry; p.at = now; /* barrel roll: the client says it is rolling; the server allows one roll (0.45 s, dodging shots) per 0.8 s */
    if ((b.f | 0) & 8) { if (!p.rolling && now - (p.rollStart || 0) >= 800) { p.rollStart = now; p.rolling = true; } if (p.rolling && now - p.rollStart > 450) p.rolling = false; } else p.rolling = false;
    p.f = ((b.f | 0) & 7) | (p.rolling ? 8 : 0); p.moved = true;
    if (fixed) this.io.one(p, { t: 'fix', x: r2(x), z: r2(z) });
  }
  /* ---------- guns: the admin switches them on in the lobby; everyone there can shoot ---------- */
  revive() { for (const q of this.players.values()) { q.hp = GUNS.HP; q.deadAt = 0; q.shield = 0; } }
  setGuns(on) { if (this.phase !== 'lobby') return; this.guns = !!on; this.revive(); this.io.all(this, { t: 'guns', on: this.guns }); this.sync(); }
  /* hitscan: each pellet goes out along the aim and hits the nearest player in its path (a generous width, because there is no crosshair) */
  shoot(p, b) {
    if (!this.guns || this.phase !== 'lobby' || p.deadAt || p.spec) return;
    const now = this.now(), id = owns(p.prof, p.prof.gun) && GUNS.BY[p.prof.gun] ? p.prof.gun : GUNS.START, g = GUNS.BY[id];
    if (now - p.shotAt < g.ms * 0.85) return; p.shotAt = now;
    const ry = Number.isFinite(+b.ry) ? +b.ry : p.ry; p.ry = ry;
    const rays = [], dmg = new Map();
    for (let k = 0; k < g.pellets; k++) {
      const a = ry + (g.pellets > 1 ? (k / (g.pellets - 1) - 0.5) * g.spread * 2 : 0) + (this.rnd() - 0.5) * (g.pellets > 1 ? g.spread * 0.4 : g.spread), sx = Math.sin(a), sz = Math.cos(a);
      let best = null, bd = g.range;
      for (const q of this.players.values()) {
        if (q === p || q.spec || q.deadAt || now < q.shield || (q.rolling && now - q.rollStart <= 450)) continue;   // a roll dodges
        const dx = q.x - p.x, dz = q.z - p.z, fwd = dx * sx + dz * sz, side = Math.abs(dx * sz - dz * sx);
        if (fwd > 0.3 && fwd <= bd && side <= 1.6 + fwd * 0.04) { best = q; bd = fwd; }
      }
      rays.push([r2(p.x + sx * bd), r2(p.z + sz * bd), best ? best.id : 0]);
      if (best) dmg.set(best, (dmg.get(best) || 0) + g.dmg);
    }
    this.io.all(this, { t: 'shot', id: p.id, g: id, ry: r2(ry), e: rays });
    for (const [q, d] of dmg) {
      q.hp = Math.max(0, q.hp - d); this.io.all(this, { t: 'hit', id: q.id, hp: q.hp, dmg: d, by: p.id });
      if (q.hp <= 0) {
        q.deadAt = now; q.kills = 0; p.kills = (p.kills || 0) + 1; p.prof.coins += this.cfg.killCoins; this.io.me(p); if (this.io.touch) this.io.touch(p);
        this.io.all(this, { t: 'kill', by: p.id, id: q.id, g: id, coins: this.cfg.killCoins }); this.sync();
      }
    }
  }
  respawns(now) {
    for (const q of this.players.values()) if (q.deadAt && now - q.deadAt >= this.cfg.respawnMs) {
      q.deadAt = 0; q.hp = GUNS.HP; q.shield = now + this.cfg.shieldMs; this.spawn(q, Math.floor(this.rnd() * 12));
      this.io.all(this, { t: 'spawned', id: q.id }); this.sync();
    }
  }
  /* positions: while hiders hide, seekers are told nothing */
  sendPositions() {
    const out = []; for (const p of this.players.values()) if (p.moved) { p.moved = false; out.push([p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.ry), (p.f | 0) | (p.restless && this.phase === 'seek' ? 32 : 0)]); }
    if (!out.length) return; const msg = { t: 'pos', p: out };
    if (this.phase === 'hide') { for (const p of this.players.values()) if (p.role !== 'seeker') this.io.one(p, msg); } else this.io.all(this, msg);
  }
  /* ---------- seek ---------- */
  beginSeek() { const now = this.now(), R = this.round; R.seekLen = R.endAt - now; this.phase = 'seek'; for (const p of this.players.values()) { p.moved = true; p.anchor = { x: p.x, z: p.z, t: now }; p.still = { x: p.x, z: p.z, t: now }; p.restless = false; p.moves = 0; } this.sync(); }
  /* a seeker tags something: a hider is caught and is out for the round, an ordinary object costs time */
  tag(p, id) {
    const R = this.round, now = this.now(), cfg = this.cfg;
    if (this.phase !== 'seek' || p.role !== 'seeker' || p.spec) return { ok: false, why: 'not now' };
    if (now - p.tagAt < cfg.tagCooldownMs) return { ok: false, why: 'too soon' };
    const v = this.players.get(id), it = v ? null : R.items.get(id);
    if (v) { if (v.role !== 'hider' || v.found || v.spec) return { ok: false, why: 'not a hider' }; if (Math.hypot(v.x - p.x, v.z - p.z) > cfg.reach) return { ok: false, why: 'too far' }; }
    else if (it) { if (it.type === 'gift') return { ok: false, why: 'gift' }; if (Math.hypot(it.x - p.x, it.z - p.z) > cfg.reach) return { ok: false, why: 'too far' }; }
    else return { ok: false, why: 'gone' };
    p.tagAt = now;
    if (it && !it.bot) { R.endAt = Math.max(now + 1000, R.endAt - this.rules.penalty * 1000); this.io.all(this, { t: 'miss', item: id, by: p.id, endAt: R.endAt }); this.sync(); return { ok: true, miss: true }; }
    p.score += cfg.findPts; p.finds++; p.prof.stats.finds = (p.prof.stats.finds || 0) + 1;
    if (v) { v.found = true; v.score += this.hidePts(v, now); v.moved = true; this.io.all(this, { t: 'found', id: v.id, by: p.id, prop: v.prop, pts: cfg.findPts }); }
    else { R.items.delete(id); this.io.all(this, { t: 'found', item: id, by: p.id, pts: cfg.findPts }); }
    this.sync();
    if (this.left() === 0) this.endRound('seekers');
    return { ok: true, found: true };
  }
  /* hiding points count seconds up to the standard seek length, so a host making rounds longer cannot make coins easier */
  hidePts(v, now) { const secs = Math.min(Math.max(0, now - this.round.hideEnds), this.mc.seekMs) / 1000; return Math.round(secs * this.cfg.perSecond * multOf(v.prop)); }
  /* gift boxes: anyone who walks up to one takes it */
  grab(p, itemId) {
    const R = this.round; if (!this.live || !R || p.spec || p.found) return { ok: false, why: 'not now' };
    const it = R.items.get(itemId); if (!it || it.type !== 'gift') return { ok: false, why: 'gone' };
    if (Math.hypot(it.x - p.x, it.z - p.z) > this.cfg.reach) return { ok: false, why: 'too far' };
    R.items.delete(itemId); R.gifts[p.id] = (R.gifts[p.id] || 0) + 1;
    this.io.all(this, { t: 'taken', item: itemId, by: p.id, gift: it.gift });
    return { ok: true, gift: it.gift };
  }
  /* ---------- results and rewards ---------- */
  endRound(win) {
    const R = this.round, now = this.now(), cfg = this.cfg, ps = this.active(), n = ps.length;
    for (const p of ps) {
      p.survived = p.role === 'hider' && !p.found;
      if (p.survived) p.score += this.hidePts(p, Math.min(now, R.endAt)) + cfg.survivePts;
      if (win === 'seekers' && p.orig === 'seeker') p.score += cfg.allFoundBonus;
      p.total += p.score;
    }
    const final = this.matchRound >= this.matchRounds;
    ps.sort((a, b) => b.total - a.total || b.finds - a.finds);
    const ranking = ps.map((p, i) => ({ id: p.id, name: p.prof.name, score: p.total, round: p.score, finds: p.finds, role: p.orig, prop: p.prop, survived: p.survived, place: i + 1 }));
    /* coins every round; a Mystery Box for winning (surviving, or catching everyone as the seeker) plus any found in the house */
    ps.forEach((p, i) => {
      const prof = p.prof, won = p.survived || (p.orig === 'seeker' && win === 'seekers'), solo = this.mode === 'solo', boxes = (R.gifts[p.id] || 0) + (won && !solo ? 1 : 0);
      /* practice against computer hiders pays a quarter, so it cannot out-earn playing with friends */
      const coins = Math.round((p.score / 2 + 40) * (solo ? 0.25 : 1));
      prof.coins += coins; addBox(prof, boxes);
      prof.stats.games = (prof.stats.games || 0) + 1; if (won && n > 1) prof.stats.wins = (prof.stats.wins || 0) + 1;
      p.reward = { coins, boxes, place: i + 1, won };
    });
    /* the 1v1 pot goes to whoever is ahead after both rounds; level scores get their stake back */
    let pot = 0;
    if (final && this.pot) { const a = this.pot.amount, [x, y] = ps; if (ps.length === 2 && x.total !== y.total) { x.prof.coins += a * 2; x.reward.pot = a * 2; pot = a * 2; } else for (const id of this.pot.ids) { const q = this.players.get(id); if (q) q.prof.coins += a; } this.pot = null; }
    this.io.saved();
    this.phase = 'results'; R.resultsEnd = now + (final ? cfg.resultsMs : cfg.swapMs); R.items = new Map();
    this.sync();
    for (const p of this.players.values()) { this.io.one(p, { t: 'results', ranking, reward: p.spec ? null : p.reward, ends: R.resultsEnd, win, final, round: this.matchRound, of: this.matchRounds, mode: this.mode }); this.io.me(p); }
  }
  toLobby() {
    this.refundPot(); this.phase = 'lobby'; this.readyAt = 0; this.round = null; this.revive();
    let i = 0; for (const p of this.players.values()) { p.ready = false; p.spec = false; p.role = p.orig = null; p.prop = null; p.offer = null; p.found = false; p.reward = null; p.score = 0; this.spawn(p, i++); }
    this.sync();
  }
  /* a match that stops early gives both stakes back */
  refundPot() { if (!this.pot) return; for (const id of this.pot.ids) { const q = this.players.get(id); if (q) { q.prof.coins += this.pot.amount; this.io.me(q); } } this.pot = null; this.io.saved(); }
  /* ---------- the clock: called a few times a second ---------- */
  tick() {
    const now = this.now(), R = this.round;
    for (const [id, p] of this.players) if (!p.conn && p.gone && now - p.gone > 20000) this.remove(id);
    /* everyone connected earns 1,000 coins a minute */
    for (const p of this.players.values()) if (p.conn && now >= p.payAt) { p.payAt = now + this.cfg.payMs; if (this.cfg.payCoins) { p.prof.coins += this.cfg.payCoins; this.io.me(p); if (this.io.touch) this.io.touch(p); } }
    if (this.guns) this.respawns(now);
    if (this.phase === 'lobby') { if (this.readyAt && now >= this.readyAt) { this.readyAt = 0; this.start(); } }
    else if (this.phase === 'pick') { if (now >= R.pickEnds) this.beginHide(); }
    else if (this.phase === 'hide') { if (now >= R.hideEnds) this.beginSeek(); }
    else if (this.phase === 'seek') {
      if (now >= R.endAt) return this.endRound('hiders');
      const cfg = this.cfg;
      if (!R.hint && this.rules.hints && now >= R.endAt - R.seekLen * cfg.hintAt) { R.hint = true; this.sync(); this.io.all(this, { t: 'hint', names: this.hintList() }); }
      if (!R.hint2 && this.rules.hints && now >= R.endAt - R.seekLen * cfg.hint2At) { R.hint2 = true; this.sync(); this.io.all(this, { t: 'hint', rooms: this.hintRooms() }); }
      /* stay put too long and your object starts to twitch, which the seeker can see */
      for (const p of this.active()) if (p.role === 'hider' && !p.found && p.still) {
        if (Math.hypot(p.x - p.still.x, p.z - p.still.z) > cfg.stillDist) p.still = { x: p.x, z: p.z, t: now };
        const r = now - p.still.t >= cfg.restlessMs; if (r !== p.restless) { p.restless = r; p.moved = true; this.io.one(p, { t: 'restless', on: r }); }
      }
      /* a hider who has moved to a new spot (6 m from where they last scored, at least 15 s ago) gets a bonus */
      for (const p of this.active()) if (p.role === 'hider' && !p.found && p.anchor && p.moves < cfg.moveMax && now - p.anchor.t >= cfg.moveEveryMs && Math.hypot(p.x - p.anchor.x, p.z - p.anchor.z) >= cfg.moveDist) {
        p.moves++; p.score += cfg.moveBonus; p.anchor = { x: p.x, z: p.z, t: now }; this.io.one(p, { t: 'bonus', n: cfg.moveBonus, left: cfg.moveMax - p.moves });
      }
    }
    else if (this.phase === 'results' && now >= R.resultsEnd) { if (this.matchRound < this.matchRounds && this.players.size === 2) this.beginPick(); else this.toLobby(); }
  }
}

export function newCode(taken, rnd = Math.random) {
  for (let k = 0; k < 50; k++) { let c = ''; for (let i = 0; i < 4; i++) c += AB[Math.floor(rnd() * AB.length)]; if (!taken.has(c)) return c; }
  throw new Error('Could not make a party code.');
}
