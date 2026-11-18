/* Unit tests: the shop and Mystery Box, looks, and prop hunt rounds (roles, decoys, tagging, modes, scoring). */
import assert from 'node:assert/strict';
import * as P from '../src/profiles.js';
const OBJm = id => globalThis.FOUND_OBJECTS.TIERS[globalThis.FOUND_OBJECTS.BY[id].tier].mult;
import { Party, newCode, CFG, MAPCFG, modeFor, mapFor } from '../src/game.js';
import { analyse } from './curve.mjs';
const G0 = globalThis.FOUND_GUNS, C = globalThis.FOUND_CATALOG, OBJ = globalThis.FOUND_OBJECTS, LAY = globalThis.FOUND_LAYOUT, D = globalThis.FOUND_AVATAR_DATA;
let n = 0; const test = (name, fn) => { fn(); n++; console.log('  ok', name); };
const seeded = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
/* most tests want the old small purse, so the helper resets it; the real starting purse is checked in the migration test */
const prof = (ch, r) => { const p = P.newProfile(String(ch).repeat(20), 'k'.repeat(48), 0, r); p.coins = 300; return p; };

function party(nPlayers, rnd, cfg) {
  const sent = []; let t = 1_000_000; const io = { all: (pa, m) => sent.push(['all', m]), one: (p, m) => sent.push([p.id, m]), me() {}, saved() {}, touch() {} };
  const pa = new Party('TEST', io, { now: () => t, rnd: rnd || seeded(7), cfg: Object.assign({ payCoins: 0 }, cfg || {}) }); const ps = [];
  for (let i = 0; i < nPlayers; i++) ps.push(pa.add(prof(i), { fake: 1 }));
  const adv = ms => { t += ms; pa.tick(); };
  const toSeek = () => { pa.start(); for (const p of ps) if (p.role === 'hider') pa.choose(p, p.offer[0]); adv(CFG.pickMs + 10); adv(pa.mc.hideMs + 10); };
  return { pa, ps, sent, adv, toSeek, seeker: () => ps.find(p => p.orig === 'seeker'), hiders: () => ps.filter(p => p.orig === 'hider') };
}
console.log('catalogue and data');
test('every cosmetic renders from the merged avatar data', () => {
  for (const [id, slot] of C.ITEMS) {
    if (slot === 'outfit') assert.ok(D.OUTC[id], id);
    if (slot === 'hat') assert.ok(D.HATV[id] || ['beanie', 'cap', 'party', 'cowboy', 'wizard', 'headband', 'chefhat', 'pirate', 'halo', 'crown'].includes(id), id);
    if (slot === 'acc') assert.ok(D.ACCV[id] || ['glasses', 'scarf', 'cape', 'wings', 'phoenix'].includes(id), id);
    if (slot === 'pet') assert.ok(D.PETV[id] || ['pig', 'penguin', 'dragon', 'bird'].includes(id), id);
    if (slot === 'aura') assert.ok(globalThis.FOUND_AURAS.BY[id], id);
  }
  assert.ok(C.ITEMS.length >= 250);
  for (const a of globalThis.FOUND_AURAS.LIST) { assert.equal(C.BY[a.id].slot, 'aura'); assert.equal(C.BY[a.id].rarity, a.rarity, a.id); assert.ok(a.parts.length >= 1); }
  /* every new hat, extra, outfit, costume and pet has at least one voxel and valid flags */
  const flags = new Set([undefined, 'g', 'G', 'o', 'b', 'w', 'f', 'p', 't', 's', 'n']), okSpec = (id, spec) => { assert.ok(Array.isArray(spec) && spec.length, id); for (const q of spec) { assert.ok(q.length >= 7 && q.slice(0, 3).every(v => v > 0) && q.slice(4, 7).every(Number.isFinite), id + ' ' + JSON.stringify(q)); assert.ok(flags.has(q[7]), id + ' flag ' + q[7]); } };
  for (const id in D.HATV) okSpec(id, D.HATV[id]); for (const id in D.PETV) okSpec(id, D.PETV[id]); for (const id in D.ACCV) okSpec(id, [].concat(D.ACCV[id].h || [], D.ACCV[id].b || [])); for (const id in D.FULLV) { okSpec(id, D.FULLV[id].h || [{}].slice(1).concat([[1, 1, 1, '#fff', 0, 0, 0]])); }
  for (const r of C.RARITY) assert.ok(C.RCOL[r] && C.RNAME[r] && C.PRICE[r] >= 0, r);
  assert.deepEqual(C.RARITY.slice(-2), ['celestial', 'cosmic']); assert.ok(C.PRICE.cosmic > C.PRICE.celestial && C.PRICE.celestial > C.PRICE.mythic);
  for (const r of ['celestial', 'cosmic']) for (const slot of ['outfit', 'hat', 'acc', 'pet', 'aura', 'gun']) assert.ok(C.ITEMS.some(i => i[1] === slot && i[3] === r), r + ' ' + slot);
});
test('box odds add up to 100 and every rarity has a price', () => { assert.equal(Object.values(C.BOX.odds).reduce((a, b) => a + b, 0), 100); for (const r of C.RARITY) assert.ok(C.PRICE[r] >= 0); });
test('27 props, nine per size', () => { assert.equal(OBJ.LIST.length, 27); for (const t of ['easy', 'medium', 'hard']) assert.equal(OBJ.ofTier(t).length, 9); });
test('all three maps have plenty of floor spots and clear spawns', () => {
  for (const id of LAY.maps) { const H = LAY.map(id); assert.ok(H.spots.filter(s => s.y < 0.1).length >= 30, id);
    for (const s of H.spawns) { const [x, z] = LAY.collide(H, s.x, s.z, 0.6); assert.ok(Math.hypot(x - s.x, z - s.z) < 0.01, id); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, px = H.center[0] + Math.sin(a) * 3, pz = H.center[1] + Math.cos(a) * 3, [x, z] = LAY.collide(H, px, pz, 0.6); assert.ok(Math.hypot(x - px, z - pz) < 0.01, id + ' hider spawn ' + i); } }
});

test('rearranged maps: every seed is walkable, nothing overlaps, spawns are clear, and layouts differ', () => {
  for (const id of LAY.maps) { const base = LAY.map(id, 0); assert.ok(LAY.sound(base), id); let changed = 0;
    for (let s = 1; s <= 25; s++) { const H = LAY.map(id, s * 104729); assert.ok(LAY.sound(H), id + ' ' + s); if (H.seed) changed++; assert.ok(H.spots.filter(q => q.y < 0.1).length >= 25, id);
      const sol = H.furniture.filter(f => !H.T[f.type].walk).map(f => { const o = f.r % 2 === 1, w = o ? f.d : f.w, d = o ? f.w : f.d; return [f.x - w / 2, f.x + w / 2, f.z - d / 2, f.z + d / 2]; });
      for (let a = 0; a < sol.length; a++) for (let b = a + 1; b < sol.length; b++) assert.ok(!(Math.min(sol[a][1], sol[b][1]) - Math.max(sol[a][0], sol[b][0]) > 0.06 && Math.min(sol[a][3], sol[b][3]) - Math.max(sol[a][2], sol[b][2]) > 0.06), id + ' overlap seed ' + s);
      if (H.seed) assert.ok(H.furniture.length > base.furniture.length, 'clutter added'); }
    assert.ok(changed >= 22, id + ' mostly rearranged'); assert.deepEqual(LAY.map(id, 5).furniture.map(f => [f.type, f.x, f.z, f.r]), LAY.map(id, 5).furniture.map(f => [f.type, f.x, f.z, f.r])); }
});
test('each round gets its own arrangement', () => { const { pa } = party(2); pa.start(); const s1 = pa.seed; assert.ok(s1 > 0); pa.toLobby(); pa.start(); assert.notEqual(pa.seed, s1); });

console.log('coins, shop and Mystery Box');
test('a new profile has a starter look, 200,000 coins, one box, white skin and a cool lowercase word for a name', () => { const p = P.newProfile('b'.repeat(20), 'k'.repeat(48), 0, seeded(1)); assert.ok(['tee', 'hoodie'].includes(p.look.outfit)); assert.equal(p.boxes, 1); assert.equal(p.coins, 200000); assert.equal(p.look.skin, 0); assert.match(p.name, /^[a-z]+$/); assert.ok(P.WORDS.includes(p.name)); assert.equal(p.mig, P.MIGRATION); });
test('the one-time update renames everyone to a unique lowercase word, makes them white-skinned and gives 200,000 coins, once', () => {
  const ps = []; for (let i = 0; i < 40; i++) { const p = P.newProfile(String(i).padStart(2, '0').repeat(10), 'k'.repeat(48), 0, seeded(i + 1)); p.mig = 0; p.name = 'Bean' + i; p.coins = 1000 + i; p.look.skin = 3; ps.push(p); }
  const used = P.usedNames(new Map(ps.map(p => [p.id, p]))), seen = new Set(); let changed = 0; for (const p of ps) if (P.migrate(p, used, seeded(99 + changed++))) { assert.match(p.name, /^[a-z]+$/); seen.add(p.name); assert.equal(p.look.skin, 0); assert.equal(p.mig, P.MIGRATION); }
  assert.equal(seen.size, 40, 'every name is different while there are words left'); ps.forEach((p, i) => assert.equal(p.coins, 200000 + 1000 + i));
  const c0 = ps[0].coins, n0 = ps[0].name; assert.ok(!P.migrate(ps[0], used)); assert.equal(ps[0].coins, c0); assert.equal(ps[0].name, n0);
  const old = P.newProfile('z'.repeat(20), 'k'.repeat(48), 0, seeded(5)); old.mig = undefined; old.season = 1; old.coins = 50; assert.ok(P.migrate(old, used)); assert.equal(old.coins, 200300, 'an old-season save is reset first, then given the 200,000');
});
test('guns: aim help is weak and only on weak guns; better guns lock harder and wobble less', () => {
  const L = G0.LIST, on = L.filter(g => g.assist > 0);
  assert.ok(on.length < L.length / 2, 'wide aim help is on for only a few guns (' + on.length + ' of ' + L.length + ')'); assert.ok(on.every(g => ['starter', 'common', 'uncommon'].includes(g.rarity)));
  assert.ok(L.every(g => g.assist <= 0.16 && g.pull <= 0.3), 'what is left is a narrow cone and a gentle pull');
  const by = (r, f, k) => Math[k](...L.filter(g => g.rarity === r).map(f)), order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial', 'cosmic'];
  for (let i = 1; i < order.length; i++) { assert.ok(by(order[i], g => g.jit, 'max') < by(order[i - 1], g => g.jit, 'min'), 'better guns are truer: ' + order[i]); assert.ok(by(order[i], g => g.lock, 'min') > by(order[i - 1], g => g.lock, 'max'), 'better guns lock harder: ' + order[i]); } assert.equal(by('cosmic', g => g.jit, 'max'), 0);
  /* the wobble is real: the same gun at range hits sometimes and misses sometimes */
  const { pa, ps, adv } = party(2, seeded(11)), [a, b] = ps; a.prof.own.push('g_pistol'); a.prof.gun = 'g_pistol'; let hits = 0; for (let i = 0; i < 60; i++) { a.x = 20; a.z = 0; b.x = 20; b.z = 30; b.hp = 150; b.deadAt = 0; b.shield = 0; adv(300); pa.shoot(a, { ry: 0 }); if (b.hp < 150) hits++; }
  assert.ok(hits > 8 && hits < 56, 'a common gun at 30 m is unreliable but not hopeless: ' + hits + ' of 60');
});
test('the shop sells an item once at its price', () => {
  const p = prof('b'); p.coins = 10000; const r = P.buyItem(p, C.ITEMS.find(i => i[3] === 'rare')[0]); assert.equal(p.coins, 10000 - r.price); assert.ok(P.owns(p, r.item));
  assert.throws(() => P.buyItem(p, r.item), /already/); p.coins = 0; assert.throws(() => P.buyItem(p, C.ITEMS.find(i => i[3] === 'mythic')[0]), /Not enough/); assert.throws(() => P.buyItem(p, 'nope'), /No such/);
});
test('boxes never repeat an item, and pay coins back only when you own everything', () => {
  const cos = C.ITEMS.filter(i => i[1] !== 'gun' && i[1] !== 'armor'), p = prof('c'), rr = seeded(9), seen = new Set(); p.boxes = cos.length + 5; let back = 0;
  for (let i = 0; i < cos.length + 5; i++) { const r = P.openBox(p, rr); if (r.item) { assert.ok(!seen.has(r.item)); seen.add(r.item); } else back += r.coins; }
  assert.equal(seen.size, cos.length - cos.filter(i => i[3] === 'starter').length); assert.ok(back > 0); assert.throws(() => P.openBox(p), /No Mystery Box/);
});
test('buying a box costs coins; the daily box is once a day', () => {
  const p = prof('d'); p.coins = C.BOX.price + 100; P.buyBox(p); assert.equal(p.coins, 100); assert.equal(p.boxes, 2); assert.throws(() => P.buyBox(p), /Not enough/);
  const t0 = Date.UTC(2026, 10, 16, 12); P.claimDaily(p, t0); assert.equal(p.boxes, 3); assert.throws(() => P.claimDaily(p, t0 + 3600000), /tomorrow/); P.claimDaily(p, t0 + 86400000); assert.equal(p.boxes, 4);
});
test('old three-kind box saves become one count', () => { const p = prof('e'); p.boxes = { paper: 2, ink: 1, gold: 1 }; assert.equal(P.privateOf(p, 0).boxes, 4); });
test('equip only allows owned items and real styles', () => {
  const p = prof('f'); P.equip(p, { look: { outfit: 'x_void', hat: 'crown', hair: 'afro', hc: 2, skin: 9 }, pet: 'dragon', name: '<b>Zed</b>' });
  assert.notEqual(p.look.outfit, 'x_void'); assert.notEqual(p.look.hat, 'crown'); assert.equal(p.look.hair, 'afro'); assert.notEqual(p.look.skin, 9); assert.equal(p.pet, ''); assert.equal(p.name, 'bZedb');
  p.own.push('x_void', 'dragon'); P.equip(p, { look: { outfit: 'x_void' }, pet: 'dragon' }); assert.equal(p.look.outfit, 'x_void'); assert.equal(p.pet, 'dragon');
});

console.log('prop hunt');
const reach = (pa, p, x, z) => { p.x = x; p.z = z; };
test('party codes are four letters; modes follow the head count', () => { for (let i = 0; i < 30; i++) assert.match(newCode(new Set()), /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/); assert.deepEqual([1, 2, 3, 6, 12].map(modeFor), ['solo', 'duel', 'party', 'party', 'party']); assert.deepEqual([1, 2, 3, 6, 7, 12].map(mapFor), ['cabin', 'cabin', 'house', 'house', 'mansion', 'mansion']); });
test('everyone in the ready ring starts; one seeker, the rest get three props to pick from', () => {
  const { pa, ps, adv } = party(4); ps.forEach(p => pa.setReady(p, true)); adv(CFG.readyMs + 10); assert.equal(pa.phase, 'pick'); assert.equal(pa.mode, 'party');
  assert.equal(ps.filter(p => p.role === 'seeker').length, 1); for (const p of ps.filter(q => q.role === 'hider')) assert.deepEqual(p.offer.map(id => OBJ.BY[id].tier), ['easy', 'medium', 'hard']);
  assert.throws(() => pa.choose(ps.find(p => p.role === 'seeker'), 'teddy'), /three/);
});
test('seven or more players get two seekers; the seeker rotates between matches', () => {
  const a = party(7); a.pa.start(); assert.equal(a.ps.filter(p => p.role === 'seeker').length, 2);
  const b = party(3), seen = new Set(); for (let i = 0; i < 3; i++) { b.pa.start(); seen.add(b.seeker().id); b.pa.toLobby(); } assert.equal(seen.size, 3);
});
test('hide: three floor copies of each prop in different rooms, other objects, gifts, nothing sharing a spot', () => {
  const { pa, ps, adv, hiders } = party(3); pa.start(); const hs = hiders(); hs[1].offer[0] = hs[0].offer[0] === 'teddy' ? 'duck' : 'teddy'; hs.forEach(p => pa.choose(p, p.offer[0])); adv(CFG.pickMs + 10);
  assert.equal(pa.phase, 'hide'); const items = [...pa.round.items.values()]; assert.equal(new Set(items.map(i => i.spot)).size, items.length);
  for (const h of hs) { const c = items.filter(i => i.type === h.prop); assert.equal(c.length, CFG.copies); assert.ok(c.every(i => i.y < 0.1)); assert.equal(new Set(c.map(i => i.room)).size, CFG.copies); }
  assert.equal(pa.mapId, 'house'); assert.equal(items.filter(i => i.type === 'gift').length, MAPCFG.house.gifts); assert.ok(items.length >= CFG.copies * 2 + MAPCFG.house.filler);
  for (const h of hs) assert.ok(Math.hypot(h.x, h.z) < 4, 'hiders start in the middle');
});
test('while hiders hide the seeker cannot move and is sent no positions', () => {
  const { pa, ps, adv, sent, seeker, hiders } = party(2); pa.start(); pa.choose(hiders()[0], hiders()[0].offer[1]); adv(CFG.pickMs + 10);
  const s = seeker(), h = hiders()[0], x0 = s.x; adv(200); pa.move(s, { x: x0 + 3, z: s.z, y: 0, ry: 0 }); assert.equal(s.x, x0);
  sent.length = 0; adv(200); pa.move(h, { x: h.x + 1, z: h.z, y: 0, ry: 0 }); pa.sendPositions();
  assert.ok(sent.some(m => m[0] === h.id && m[1].t === 'pos')); assert.ok(!sent.some(m => m[1].t === 'pos' && (m[0] === s.id || m[0] === 'all')));
  assert.equal(pa.tag(s, h.id).why, 'not now');
});
test('tagging: must be the seeker, close, and off cooldown; a decoy costs 10 seconds; a caught hider is out', () => {
  const { pa, toSeek, seeker, hiders, adv } = party(3); toSeek(); assert.equal(pa.phase, 'seek');
  const s = seeker(), [h1, h2] = hiders(), decoy = [...pa.round.items.values()].find(i => i.type === h1.prop);
  assert.equal(pa.tag(h1, h2.id).why, 'not now'); reach(pa, h1, 10, 30); reach(pa, s, -30, -30); assert.equal(pa.tag(s, h1.id).why, 'too far');
  reach(pa, s, decoy.x, decoy.z); const end0 = pa.round.endAt; assert.ok(pa.tag(s, decoy.id).miss); assert.equal(pa.round.endAt, end0 - CFG.missPenaltyMs);
  reach(pa, s, 10, 31); assert.equal(pa.tag(s, h1.id).why, 'too soon'); adv(CFG.tagCooldownMs + 10);
  assert.ok(pa.tag(s, h1.id).found); assert.equal(h1.found, true); assert.equal(s.finds, 1); assert.equal(pa.left(), 1); assert.equal(pa.phase, 'seek');
  adv(CFG.tagCooldownMs + 10); reach(pa, h2, 0, 0); reach(pa, h1, 1, 0); assert.equal(pa.tag(h1, h2.id).why, 'not now', 'a caught hider is out'); reach(pa, s, 1, 1); assert.ok(pa.tag(s, h2.id).found); assert.equal(pa.phase, 'results');
});
test('time running out: hidden hiders win, score for surviving, and get a Mystery Box', () => {
  const { pa, toSeek, seeker, hiders, adv, sent } = party(3); toSeek(); const b0 = hiders()[0].prof.boxes; adv(pa.mc.seekMs + 10); assert.equal(pa.phase, 'results');
  const res = sent.filter(m => m[1].t === 'results').pop()[1]; assert.equal(res.win, 'hiders'); assert.ok(res.final);
  assert.ok(hiders()[0].total >= CFG.survivePts); assert.equal(hiders()[0].prof.boxes, b0 + 1); assert.equal(seeker().total, 0);
  adv(CFG.resultsMs + 10); assert.equal(pa.phase, 'lobby');
});
test('1v1: two rounds, sides swap, scores add up, then the lobby', () => {
  const { pa, ps, toSeek, seeker, hiders, adv } = party(2); toSeek(); assert.equal(pa.mode, 'duel'); const s1 = seeker(), h1 = hiders()[0];
  assert.equal(pa.mapId, 'cabin'); reach(pa, h1, 5, 20); reach(pa, s1, 6, 20); assert.ok(pa.tag(s1, h1.id).found); assert.equal(pa.phase, 'results'); const t1 = s1.total; assert.ok(t1 >= CFG.findPts + CFG.allFoundBonus);
  adv(CFG.swapMs + 10); assert.equal(pa.phase, 'pick'); assert.equal(pa.matchRound, 2); assert.equal(h1.role, 'seeker'); assert.equal(s1.role, 'hider');
  pa.choose(s1, s1.offer[2]); adv(CFG.pickMs + 10); adv(pa.mc.hideMs + 10); adv(pa.mc.seekMs + 10); assert.equal(pa.phase, 'results'); assert.ok(s1.total > t1);
  adv(CFG.resultsMs + 10); assert.equal(pa.phase, 'lobby');
});
test('practice: alone you seek three computer-placed hiders that look like ordinary objects', () => {
  const { pa, ps, adv, sent } = party(1); pa.start(); assert.equal(pa.mode, 'solo'); assert.equal(ps[0].role, 'seeker'); adv(CFG.pickMs + 10); adv(CFG.soloHideMs + 10); assert.equal(pa.phase, 'seek');
  assert.equal(pa.left(), CFG.bots); const msg = sent.filter(m => m[1].t === 'round').pop()[1]; assert.ok(msg.items.every(i => i.bot === undefined));
  for (const it of [...pa.round.items.values()].filter(i => i.bot)) { reach(pa, ps[0], it.x, it.z); assert.ok(pa.tag(ps[0], it.id).found); adv(CFG.tagCooldownMs + 10); }
  assert.equal(pa.phase, 'results');
});
test('no gift boxes lie around the maps; boxes come from winning, the daily box and the shop', () => {
  for (const n of [1, 2, 3, 8]) { const a = party(n); a.toSeek(); assert.equal([...a.pa.round.items.values()].filter(i => i.type === 'gift').length, 0); }
  const { pa, toSeek, hiders, adv } = party(2); toSeek(); const h = hiders()[0], b0 = h.prof.boxes; adv(pa.mc.seekMs + 10); assert.equal(h.prof.boxes, b0 + 1, 'the winner still gets a box');
});
test('a round ends if the seeker leaves or the last hider leaves; late joiners watch', () => {
  const a = party(3); a.toSeek(); const late = a.pa.add(prof('z'), { fake: 1 }); assert.equal(late.spec, true); a.pa.remove(a.seeker().id); assert.equal(a.pa.phase, 'results');
  const b = party(2); b.toSeek(); b.pa.remove(b.hiders()[0].id); assert.equal(b.pa.phase, 'results');
});
test('moves are clamped to a sane speed and pushed out of walls', () => {
  const { pa, ps, adv } = party(1); const p = ps[0], x0 = p.x; adv(100); pa.move(p, { x: x0 + 500, z: p.z, y: 0, ry: 0 }); assert.ok(p.x - x0 < CFG.maxSpeed * 0.1 * 1.6 + 1.6);
  pa.setMap(p, 'mansion'); pa.start(); adv(CFG.pickMs + 10); adv(CFG.soloHideMs + 10); p.x = 10; p.z = 41.6; adv(100); pa.move(p, { x: 10, z: 40.0, y: 0, ry: 0 }); assert.ok(p.z > 40.6);
});
test('the host picks the map; changing it un-readies everyone', () => {
  const { pa, ps } = party(3); ps.forEach(p => pa.setReady(p, true)); pa.setMap(ps[1], 'cabin'); assert.equal(pa.mapPick, 'auto'); pa.setMap(ps[0], 'mansion'); assert.equal(pa.mapPick, 'mansion'); assert.ok(ps.every(p => !p.ready)); pa.start(); assert.equal(pa.mapId, 'mansion');
});
test('1v1 wager: both pay in, the winner takes the pot; leaving early refunds it', () => {
  const a = party(2); a.ps.forEach(p => { p.prof.coins = 1000; }); a.pa.setStake(a.ps[0], 250); a.toSeek(); assert.deepEqual(a.ps.map(p => p.prof.coins), [750, 750]);
  const s1 = a.seeker(), h1 = a.hiders()[0]; reach(a.pa, h1, 5, 20); reach(a.pa, s1, 6, 20); a.pa.tag(s1, h1.id); a.adv(CFG.swapMs + 10); a.pa.choose(s1, s1.offer[0]); a.adv(CFG.pickMs + 10); a.adv(a.pa.mc.hideMs + 10);
  reach(a.pa, s1, -5, 20); reach(a.pa, h1, -6, 20); a.adv(40000); a.pa.tag(h1, s1.id); assert.equal(a.pa.phase, 'results');
  const win = a.ps.slice().sort((x, y) => y.total - x.total)[0], lose = a.ps.find(p => p !== win); assert.equal(win.reward.pot, 500); assert.equal(lose.reward.pot, undefined); assert.ok(win.prof.coins >= 750 + 500); assert.equal(a.pa.pot, null);
  const b = party(2); b.ps.forEach(p => { p.prof.coins = 300; }); b.pa.setStake(b.ps[0], 500); b.toSeek(); assert.deepEqual(b.ps.map(p => p.prof.coins), [0, 0]); b.pa.remove(b.ps[1].id); assert.equal(b.ps[0].prof.coins >= 300, true);
});
test('host rules: only the host, only listed values, applied to the round', () => {
  const a = party(3); const [h, g] = a.ps; assert.equal(a.pa.host, h.id);
  a.pa.setRule(g, 'copies', 5); assert.equal(a.pa.rules.copies, 3, 'non-host ignored'); a.pa.setRule(h, 'copies', 4); assert.equal(a.pa.rules.copies, 3, 'unlisted value ignored'); a.pa.setRule(h, 'bogus', 1);
  a.pa.setRule(h, 'copies', 5); a.pa.setRule(h, 'penalty', 20); a.pa.setRule(h, 'hide', 1.5); a.pa.setRule(h, 'seek', 0.6); a.pa.setRule(h, 'seekers', 2);
  a.toSeek(); const R = a.pa.round; assert.equal(R.hideEnds - R.hideEnds + a.hiders().length, 1, 'two seekers of three leaves one hider'); assert.equal(a.ps.filter(p => p.role === 'seeker').length, 2);
  const h1 = a.hiders()[0]; assert.equal([...R.items.values()].filter(i => i.type === h1.prop).length, 5);
  assert.equal(R.endAt - R.hideEnds, Math.round(a.pa.mc.seekMs * 0.6));
});
test('economy: practice pays a quarter and no win box; longer rounds do not pay more', () => {
  const s = party(1); s.toSeek(); const c0 = s.ps[0].prof.coins, b0 = s.ps[0].prof.boxes; s.adv(s.pa.mc.seekMs + 10); assert.equal(s.pa.phase, 'results'); assert.equal(s.ps[0].prof.boxes, b0); assert.ok(s.ps[0].prof.coins - c0 <= 80);
  const a = party(3); a.pa.setRule(a.ps[0], 'seek', 1.5); a.toSeek(); a.adv(Math.round(a.pa.mc.seekMs * 1.5) + 10); const h = a.hiders()[0]; assert.equal(h.score, Math.round(a.pa.mc.seekMs / 1000 * CFG.perSecond * OBJm(h.prop)) + CFG.survivePts);
});
test('idle, wheel, mini game and gifting', () => {
  const now = Date.UTC(2026, 0, 5, 12), a = P.newProfile('a'.repeat(24), 'k', now, () => 0.5), b = P.newProfile('b'.repeat(24), 'k', now, () => 0.5);
  assert.equal(P.idleOf(a, now), 0); assert.throws(() => P.claimIdle(a, now)); assert.equal(P.idleOf(a, now + 2 * 3600000), 500); assert.equal(P.idleOf(a, now + 50 * 3600000), 2000, 'capped at 8 hours');
  a.own.push('x'); assert.equal(P.idleRate(a), 265); a.own.pop(); const c0 = a.coins; assert.equal(P.claimIdle(a, now + 3600000), 250); assert.equal(a.coins, c0 + 250); assert.equal(P.idleOf(a, now + 3600000), 0);
  const c1 = a.coins, pr = P.spin(a, now, () => 0); assert.deepEqual(pr, { coins: 400 }); assert.equal(a.coins, c1 + 400); assert.throws(() => P.spin(a, now + 1000), /tomorrow/); P.spin(a, now + 86400000, () => 0.95); assert.equal(a.boxes, 2, '0.95 lands on the box');
  let paid = 0; for (let i = 0; i < 12; i++) paid += P.miniWin(a, now); assert.equal(paid, 1500); assert.equal(P.miniLeft(a, now), 0); assert.equal(P.miniLeft(a, now + 86400000), 10);
  const ca = a.coins, cb = b.coins; P.giveCoins(a, b, 100); assert.equal(a.coins, ca - 100); assert.equal(b.coins, cb + 100); assert.throws(() => P.giveCoins(a, b, 7)); assert.throws(() => P.giveCoins(a, a, 50)); a.coins = 10; assert.throws(() => P.giveCoins(a, b, 50), /Not enough/);
});
test('a new season wipes coins, boxes and items but keeps the name and face', () => {
  const p = P.newProfile('c'.repeat(24), 'k', 1, () => 0.5); p.season = 1; p.coins = 9999; p.own = ['x_void']; p.boxes = 7; p.look.outfit = 'x_void'; p.look.hat = 'pirate'; const name = p.name, skin = p.look.skin;
  const v = P.privateOf(p, Date.now()); assert.equal(v.coins, 300); assert.deepEqual(v.own, []); assert.equal(v.boxes, 1); assert.equal(p.look.outfit, 'tee'); assert.equal(p.look.hat, ''); assert.equal(p.name, name); assert.equal(p.look.skin, skin);
  p.coins = 500; P.privateOf(p, Date.now()); assert.equal(p.coins, 500, 'only once');
  for (const id of ['s2_seeker', 'bp_straw', 'bp_captain']) assert.ok(globalThis.FOUND_CATALOG.BY[id]); assert.ok(globalThis.FOUND_AVATAR_DATA.OUTC.s2_lava && globalThis.FOUND_AVATAR_DATA.HATV.bp_straw);
});
test('seeker hint: in the last 30% of the seek the seeker is told which objects are still hidden (host can turn it off)', () => {
  const a = party(3); a.toSeek(); const R = a.pa.round, len = R.seekLen; assert.ok(len > 0);
  a.adv(Math.round(len * 0.69)); assert.equal(a.pa.roundInfo().hint, null, 'no hint before 70%');
  a.adv(Math.round(len * 0.02)); const h = a.pa.roundInfo().hint, names = a.hiders().map(p => globalThis.FOUND_OBJECTS.BY[p.prop].name);
  assert.deepEqual([...h].sort(), [...new Set(names)].sort()); assert.ok(a.sent.some(([to, m]) => to === 'all' && m.t === 'hint'));
  const b = party(3); b.pa.setRule(b.ps[0], 'hints', 0); b.toSeek(); b.adv(Math.round(b.pa.round.seekLen * 0.9)); assert.equal(b.pa.roundInfo().hint, null);
});
test('move bonus: a hider who changes spot (8 m, 10 s apart) earns 40, up to 5 times a round', () => {
  const a = party(3); a.toSeek(); const h = a.hiders()[0], s0 = h.score, D = CFG.moveDist;
  h.x += D / 2; a.adv(CFG.moveEveryMs + 10); assert.equal(h.score, s0, 'half the distance is not a new spot');
  h.x += D / 2 + 0.5; a.adv(200); assert.equal(h.score, s0 + CFG.moveBonus); assert.ok(a.sent.some(([to, m]) => to === h.id && m.t === 'bonus' && m.left === CFG.moveMax - 1));
  h.x += D + 1; a.adv(200); assert.equal(h.score, s0 + CFG.moveBonus, 'not again so soon');
  for (let i = 0; i < 6; i++) { h.x += (i % 2 ? -1 : 1) * (D + 1); a.adv(CFG.moveEveryMs + 10); } assert.equal(a.pa.phase, 'seek'); assert.equal(h.score, s0 + CFG.moveBonus * CFG.moveMax, 'capped');
});
test('second hint names the rooms; a hider who keeps still for 20 s twitches (flag 32 in positions) until they move', () => {
  const a = party(3); a.toSeek(); const h = a.hiders()[0], len = a.pa.round.seekLen;
  a.adv(CFG.restlessMs + 10); assert.equal(h.restless, true); assert.ok(a.sent.some(([to, m]) => to === h.id && m.t === 'restless' && m.on));
  a.sent.length = 0; a.pa.sendPositions(); const pos = a.sent.find(([, m]) => m.t === 'pos'); assert.ok(pos && pos[1].p.some(r => r[0] === h.id && (r[5] & 32)));
  h.x += CFG.stillDist + 1; a.adv(200); assert.equal(h.restless, false);
  a.adv(Math.round(len * 0.86) - CFG.restlessMs); const rooms = a.pa.roundInfo().rooms; assert.ok(rooms && rooms.length >= 1 && rooms.every(r => typeof r === 'string'));
});
test('standing on furniture: you can stand on a top below your feet, step onto low things, never onto walls', () => {
  const L = globalThis.FOUND_LAYOUT, m = { colliders: [{ x0: 0, x1: 2, z0: 0, z1: 2, h: 1 }, { x0: 5, x1: 5.2, z0: -5, z1: 5, h: 9 }, { x0: -3, x1: -2, z0: 0, z1: 1, h: 0.3 }], bounds: { x0: -20, x1: 20, z0: -20, z1: 20 } };
  assert.notDeepEqual(L.collide(m, 1, -0.2, 0.5, 1, -2, 0), [1, -0.2], 'blocked on the floor');
  assert.deepEqual(L.collide(m, 1, -0.2, 0.5, 1, -2, 1.05), [1, -0.2], 'above the table it does not block');
  assert.equal(L.groundAt(m, 1, 1, 1.4), 1); assert.equal(L.groundAt(m, 1, 1, 0), 0, 'too high to step onto from the floor'); assert.equal(L.groundAt(m, -2.5, 0.5, 0), 0.3, 'low things are a step');
  assert.deepEqual(L.collide(m, -2.5, -0.3, 0.5, -2.5, -2, 0), [-2.5, -0.3], 'walk onto a low thing');
  assert.notDeepEqual(L.collide(m, 5.1, 0, 0.5, 4, 0, 6), [5.1, 0], 'walls stop you at any height');
  const house = L.map('house', 0), sofa = house.furniture.find(f => f.type === 'sofa'); assert.ok(L.T.sofa.h < 11 * 11 / 52, 'a jump clears a sofa');
});

console.log('guns, crates and pay');
test('every gun has a shop row, stats and a model', () => {
  const G = globalThis.FOUND_GUNS; assert.equal(G.LIST.length, C.ITEMS.filter(i => i[1] === 'gun').length); assert.ok(C.STARTER.includes(G.START));
  for (const g of G.LIST) { assert.equal(C.BY[g.id].slot, 'gun'); assert.equal(C.BY[g.id].rarity, g.rarity); assert.ok(g.spec.length >= 5 && g.dmg > 0 && g.ms >= 50 && g.range > 10 && g.mz > 0.2, g.id); }
  const rank = r => C.RARITY.indexOf(r), dps = g => g.dmg * g.pellets * 1000 / g.ms, byR = {}; for (const g of G.LIST.filter(g => !C.BY[g.id].price)) byR[g.rarity] = Math.max(byR[g.rarity] || 0, dps(g));
  for (let i = 2; i < C.RARITY.length; i++) assert.ok(byR[C.RARITY[i]] > byR[C.RARITY[i - 1]], 'rarer guns are stronger: ' + C.RARITY[i]);
  for (const r of C.RARITY.filter(r => r !== 'starter')) assert.ok(C.CRATE.odds[r] > 0 && C.PRICE[r] > 0, r); assert.equal(Object.values(C.CRATE.odds).reduce((a, b) => a + b, 0), 100);
});
test('the gun crate rolls by its odds, gives guns you lack, refunds a tenth of the shop price for duplicates, and stops at all of them', () => {
  const p = prof('g'), rr = seeded(5), guns = C.ITEMS.filter(i => i[1] === 'gun' && i[3] !== 'starter' && !i[4]); p.coins = 1e9; const seen = new Set(); let dups = 0, crates = 0;
  assert.equal(P.privateOf(p, 0).gun, 'g_pop');
  while (seen.size < guns.length && crates < 5000) { const before = p.coins, had = P.owns(p, 'x'), r = P.openCrate(p, rr); crates++; assert.equal(r.slot, 'gun');
    if (r.dup) { dups++; assert.ok(seen.has(r.item), 'a duplicate is a gun you own'); assert.equal(r.coins, Math.round(C.PRICE[r.rarity] * C.CRATE.dup)); assert.equal(p.coins, before - C.CRATE.price + r.coins); assert.ok(!r.equipped); }
    else { assert.ok(!seen.has(r.item), 'a new gun is new'); seen.add(r.item); assert.ok(P.owns(p, r.item)); assert.equal(p.coins, before - C.CRATE.price); assert.equal(r.left, guns.length - seen.size); } }
  assert.equal(seen.size, guns.length, 'every gun can be won'); assert.ok(dups > 0 && crates < 5000); assert.throws(() => P.openCrate(p), /own every gun/); const c0 = p.coins; assert.throws(() => P.openCrate(p), /own every gun/); assert.equal(p.coins, c0);
  assert.equal(C.BY[p.gun].rarity, 'cosmic', 'the best gun you won ends up in your hand');
  const q = prof('h'); q.coins = 100; assert.throws(() => P.openCrate(q), /Not enough/); assert.equal(q.coins, 100);
  assert.ok(G0.LIST.some(g => C.BY[g.id].price > 1e6) && C.ITEMS.some(i => i[1] === 'armor'), 'premium guns and armour exist');
  const o = prof('i'); P.equip(o, { gun: 'g_nova' }); assert.equal(o.gun, undefined); o.own.push('g_nova'); P.equip(o, { gun: 'g_nova' }); assert.equal(o.gun, 'g_nova'); assert.equal(P.publicOf(o).gun, 'g_nova');
  const m = prof('j'); m.boxes = 200; for (let i = 0; i < 200; i++) { const r = P.openBox(m); assert.ok(!r.item || r.slot !== 'gun'); }
  /* the odds really are the odds: 20,000 rolls into a fresh player each time land within a point or so of them */
  const hit = {}; for (let i = 0; i < 20000; i++) { const z = prof('z'); z.coins = 5000; const r = P.openCrate(z, rr); hit[r.rarity] = (hit[r.rarity] || 0) + 1; }
  for (const r in C.CRATE.odds) assert.ok(Math.abs(hit[r] / 200 - C.CRATE.odds[r]) < Math.max(0.35, C.CRATE.odds[r] * 0.35), r + ' rolled ' + hit[r] / 200 + '% not ' + C.CRATE.odds[r] + '%');
});
test('the power curve: each rarity hits harder and kills faster, and takes longer to earn', () => {
  const R = analyse(60), T = R.tiers, rank = Object.fromEntries(C.RARITY.map((r, i) => [r, i]));
  assert.deepEqual(T.map(t => t.rarity), C.RARITY.filter(r => G0.LIST.some(g => g.rarity === r)));
  for (let i = 1; i < T.length; i++) { const a = T[i - 1], b = T[i];
    assert.ok(b.avg > a.avg, `${b.rarity} beats ${a.rarity} on average`); assert.ok(b.max > a.max, `${b.rarity} tops ${a.rarity}`);
    assert.ok(b.avg / a.avg >= 1.04 && b.avg / a.avg <= 2, `${a.rarity} to ${b.rarity} is a ${(b.avg / a.avg).toFixed(2)}x step`); }
  assert.ok(T[0].ttkMin >= 2 && G0.LIST.every(g => g.dmg * g.pellets < G0.HP * 0.7 && (g.pellets > 1 || g.dmg * 2 < G0.HP)), 'a starter pistol needs 2 s+, and no gun one-shots you (single shots not even with a rage orb)');
  assert.ok(T.at(-1).avg / T[0].avg >= 2.5 && T.at(-1).avg / T[0].avg <= 8, 'cosmic is a few times a starter');
  /* earning them */
  const med = Object.fromEntries(R.pace.map(x => [x.rarity, x.median])); let prev = 0; for (const x of R.pace) { assert.ok(x.median >= prev - 3, x.rarity + ' not sooner than the tier below'); prev = Math.max(prev, x.median); }
  assert.ok(med.common <= 6 && med.rare <= 12 && med.legendary <= 30, 'the early tiers come quickly even with no kills: ' + JSON.stringify(med)); assert.ok(med.cosmic >= 100 && med.cosmic <= 600, 'a cosmic gun is a long chase: ' + med.cosmic + ' min');
  assert.ok(R.complete.median >= 100 && R.complete.median <= 800, 'all the guns take hours, not minutes: ' + R.complete.median);
  /* the crate never prints money: even a player who already owns everything but one gun loses coins on average */
  const ev = C.RARITY.filter(r => C.CRATE.odds[r]).reduce((s, r) => s + C.CRATE.odds[r] / 100 * C.PRICE[r] * C.CRATE.dup, 0); assert.ok(ev < C.CRATE.price * 0.6, 'refund value per crate ' + ev.toFixed(0));
  assert.equal(Object.values(C.BOX.odds).reduce((a, b) => a + b, 0), 100); assert.equal(Object.values(C.CRATE.odds).reduce((a, b) => a + b, 0), 100);
  for (let i = 2; i < C.RARITY.length; i++) assert.ok(C.PRICE[C.RARITY[i]] > C.PRICE[C.RARITY[i - 1]], 'prices climb');
});
test('everyone connected earns 2,000 coins a minute', () => {
  const { pa, ps, adv } = party(3, null, { payCoins: 200 }); const c0 = ps.map(p => p.prof.coins);
  for (let i = 0; i < 60; i++) adv(1000); ps.forEach((p, i) => assert.equal(p.prof.coins - c0[i], 2000));
  ps[1].conn = null; for (let i = 0; i < 60; i++) adv(1000); assert.equal(ps[1].prof.coins - c0[1], 2000); assert.equal(ps[0].prof.coins - c0[0], 4000);
});
test('guns: shooting, health, kills, respawn, and only when switched on in the lobby', () => {
  const { pa, ps, sent, adv } = party(3, () => 0.5), [a, b, c] = ps;   /* a steady rnd: no wobble, so these hits are exact */ for (const p of ps) { p.x = 20; p.z = 0; }   /* the spawn is a safe zone, so the fights happen out on the lawn */
  const place = () => { a.x = 20; a.z = 0; b.x = 20; b.z = 10; c.x = 50; c.z = 0; };
  assert.ok(pa.state().guns, 'a party is a free for all from the start'); pa.setGuns(false); assert.ok(!pa.state().guns);
  place(); pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 150); assert.ok(!sent.some(m => m[1].t === 'shot'), 'guns are off');
  pa.setGuns(true); assert.ok(pa.state().guns); assert.equal(pa.state().players[1].hp, 150);
  place(); a.prof.gun = 'g_pop'; pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 138); assert.equal(c.hp, 150); const sh = sent.filter(m => m[1].t === 'shot').pop()[1]; assert.equal(sh.id, a.id); assert.equal(sh.e[0][2], b.id);
  pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 138, 'too soon: the gun is still cooling'); adv(400);
  pa.shoot(a, { ry: Math.PI }); assert.equal(b.hp, 138, 'shooting the other way misses'); adv(400); pa.shoot(a, { ry: Math.PI / 2 }); assert.equal(c.hp, 138, 'c is 30 away along +x, inside the pistol range of 42'); c.hp = 150; c.x = 80; adv(400); pa.shoot(a, { ry: Math.PI / 2 }); assert.equal(c.hp, 150, 'out of range'); c.x = 50;
  /* the kill pays, the dead cannot move or shoot, then they come back with a shield */
  const coins = a.prof.coins; let n = 0; while (!b.deadAt && n++ < 20) { adv(400); pa.shoot(a, { ry: 0 }); } assert.ok(b.deadAt && b.hp === 0); assert.equal(CFG.killCoins, 12000); assert.equal(a.prof.coins, coins + 12000, 'a kill pays 12,000'); assert.equal(b.prof.coins, 0, 'the victim lost what they had, up to 4,000 (they had 300)'); assert.ok(sent.some(m => m[1].t === 'kill' && m[1].id === b.id));
  const bx = b.x; pa.move(b, { x: 5, z: 5, y: 0, ry: 0 }); assert.equal(b.x, bx); adv(400); pa.shoot(b, { ry: 0 }); assert.ok(a.hp === 150);
  adv(CFG.respawnMs + 50); assert.ok(!b.deadAt && b.hp === 150 && b.shield > 0); assert.ok(sent.some(m => m[1].t === 'spawned' && m[1].id === b.id));
  place(); b.shield = 0; a.prof.gun = 'g_pump'; a.prof.own.push('g_pump'); adv(400); pa.shoot(a, { ry: 0 }); { const g = G0.BY.g_pump; assert.ok(b.hp < 150 && b.hp >= 150 - g.dmg * g.pellets, 'a spread gun lands some or all pellets: ' + b.hp); }
  a.prof.gun = 'g_rail'; adv(1500); place(); b.hp = 150; pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 138, 'a gun you do not own fires as the starter pistol (12)');
  pa.setGuns(false); assert.ok(!pa.state().guns);
});
test('free for all: a kill pays 12,000, dying costs 4,000, the same victim twice in 20 s pays once, and pickups spawn and heal', () => {
  const { pa, ps, sent, adv } = party(3), [a, b, c] = ps; pa.setGuns(true); a.prof.gun = 'g_pop';
  const place = () => { a.x = 20; a.z = 0; b.x = 20; b.z = 10; c.x = 50; c.z = 0; }, kill = v => { let n = 0; while (!v.deadAt && n++ < 40) { adv(400); pa.shoot(a, { ry: v === b ? 0 : Math.PI / 2 }); } assert.ok(v.deadAt); };
  b.prof.coins = 5000; place(); const a0 = a.prof.coins; kill(b); assert.equal(a.prof.coins, a0 + 12000); assert.equal(b.prof.coins, 1000, 'lost 4,000'); const k1 = sent.filter(m => m[1].t === 'kill').pop()[1]; assert.equal(k1.coins, 12000); assert.equal(k1.lost, 4000);
  adv(CFG.respawnMs + 50); place(); b.shield = 0; kill(b); assert.equal(a.prof.coins, a0 + 12000, 'the same victim again within 20 s pays nothing'); assert.equal(sent.filter(m => m[1].t === 'kill').pop()[1].coins, 0); assert.equal(b.prof.coins, 0, 'but they still lose coins, down to nothing');
  adv(25000); place(); c.shield = 0; kill(c); assert.equal(a.prof.coins, a0 + 24000, 'a different victim pays');
  /* pickups */
  adv(CFG.respawnMs + 50); for (const p of ps) { p.x = 0; p.z = 0; p.shield = 0; p.hp = 150; } pa.pickups = []; pa.pickAt = 0; adv(10); assert.equal(pa.pickups.length, 1); assert.deepEqual(Object.keys(pa.state().pk[0]).length, 4);
  for (let i = 0; i < 30; i++) adv(CFG.pickupMs + 10); assert.ok(pa.pickups.length <= CFG.pickupMax && pa.pickups.length >= 5, 'they keep spawning up to a limit: ' + pa.pickups.length);
  const k = { id: 99, kind: 'heal', x: 3, z: 3 }; pa.pickups.push(k); b.x = 3; b.z = 3; b.hp = 150; adv(100); assert.ok(pa.pickups.includes(k), 'a full-health player leaves a heart'); b.hp = 30; adv(100); assert.ok(!pa.pickups.includes(k) && b.hp === 90, 'a heart heals 60');
  const cn = { id: 100, kind: 'coins', x: 3, z: 3 }; pa.pickups.push(cn); const c0 = b.prof.coins; adv(100); assert.equal(b.prof.coins, c0 + 5000);
  const rg = { id: 101, kind: 'rage', x: 3, z: 3 }; pa.pickups.push(rg); adv(100); assert.ok(b.rageUntil > pa.now()); b.x = 20; b.z = 10; a.x = 20; a.z = 0; c.x = 50; c.z = 30; a.hp = 150; adv(400); pa.shoot(b, { ry: Math.PI }); assert.equal(a.hp, 150 - 12 * 2, 'rage doubles damage');
  const sh = { id: 102, kind: 'shield', x: 3, z: 3 }; pa.pickups.push(sh); b.x = 3; b.z = 3; adv(100); assert.ok(b.shield > pa.now(), 'a shield pickup'); pa.setGuns(false); assert.equal(pa.pickups.length, 0, 'switching guns off clears them');
});
test('a barrel roll dodges shots, lasts under half a second and cannot be spammed', () => {
  const { pa, ps, adv, sent } = party(2), [a, b] = ps; pa.setGuns(true); a.x = 20; a.z = 0; b.x = 20; b.z = 9; a.prof.gun = 'g_pop';
  pa.move(b, { x: 20, z: 9, y: 0, ry: 0, f: 9 }); assert.equal(b.f & 8, 8); pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 150, 'a rolling player dodges');
  adv(500); pa.move(b, { x: 20, z: 9, y: 0, ry: 0, f: 9 }); assert.equal(b.f & 8, 0, 'the roll flag runs out after 0.45 s'); pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 138);
  adv(400); pa.move(b, { x: 20, z: 9, y: 0, ry: 0, f: 1 }); adv(400); pa.move(b, { x: 20, z: 9, y: 0, ry: 0, f: 9 }); assert.equal(b.f & 8, 8, 'a new roll after the cooldown'); adv(100); pa.move(b, { x: 20, z: 9, y: 0, ry: 0, f: 1 });
  adv(200); pa.move(b, { x: 20, z: 9, y: 0, ry: 0, f: 9 }); assert.equal(b.f & 8, 0, 'rolling again straight away is ignored');
});
test('the golden safe zone at the spawn: nobody shoots from it, nobody is hurt in it, pickups stay out, and respawns land inside', () => {
  const { pa, ps, sent, adv } = party(3), [a, b, c] = ps, S = globalThis.FOUND_LAYOUT.lobby.safe; a.prof.gun = 'g_pop'; b.prof.gun = 'g_pop';
  assert.ok(S && S.r >= 6, 'the lobby has a safe zone'); for (const sp of globalThis.FOUND_LAYOUT.lobby.spawns) assert.ok(Math.hypot(sp.x - S.x, sp.z - S.z) < S.r - 1, 'every spawn point is well inside it');
  c.x = 40; c.z = 40;
  a.x = S.x; a.z = S.z - 30; b.x = S.x; b.z = S.z - 20;          /* both outside, b in front of a */
  pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 138, 'outside the zone shots land'); adv(400);
  b.z = S.z - 2; b.hp = 150; a.z = S.z - 12; pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 150, 'a player standing in the zone cannot be hurt'); adv(400);
  b.hp = 150; b.z = S.z; a.z = S.z + 1; a.x = S.x; pa.shoot(b, { ry: Math.PI }); assert.equal(a.hp, 150, 'and cannot shoot from inside it'); assert.ok(!sent.slice(-3).some(m => m[1].t === 'shot' && m[1].id === b.id));
  a.x = S.x + S.r + 0.5; a.z = S.z; b.x = S.x + S.r + 0.5; b.z = S.z + 12; adv(400); pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 138, 'one step outside the edge it is a fight again');
  pa.pickups = []; for (let i = 0; i < 200; i++) pa.spawnPickup(0); assert.ok(pa.pickups.length > 0 && pa.pickups.every(k => Math.hypot(k.x - S.x, k.z - S.z) >= S.r + 2), 'pickups never spawn in the zone');
  b.hp = 0; b.deadAt = pa.now(); adv(CFG.respawnMs + 50); assert.ok(!b.deadAt && Math.hypot(b.x - S.x, b.z - S.z) < S.r, 'a respawn lands inside the safe zone');
});

console.log('armour, boxes and abilities');
test('three boxes: clothes, guns and armour. The armour box gives armour you lack, never the premium pieces, refunds duplicates, and wears the better piece', () => {
  const p = prof('ar'), rr = seeded(21), pool = C.ITEMS.filter(i => i[1] === 'armor' && !i[4]); p.coins = 1e9; const seen = new Set(); let n = 0;
  assert.equal(C.CRATES.armor.price, C.ARMORBOX.price); assert.ok(C.BOX.price < C.CRATES.gun.price && C.CRATES.armor.price > 0);
  while (seen.size < pool.length && n++ < 3000) { const r = P.openCrate(p, rr, 'armor'); assert.equal(r.slot, 'armor'); if (!r.dup) { assert.ok(!seen.has(r.item) && !C.BY[r.item].price, 'new, and never a premium piece'); seen.add(r.item); assert.ok(P.owns(p, r.item)); } }
  assert.equal(seen.size, pool.length); assert.throws(() => P.openCrate(p, rr, 'armor'), /every armour/); assert.equal(C.BY[p.look.armor].rarity, 'cosmic', 'the best armour you won is worn');
  const q = prof('aq'); q.coins = 5; assert.throws(() => P.openCrate(q, rr, 'armor'), /Not enough/); assert.throws(() => P.openCrate(q, rr, 'nope'), /No such box/);
  const m = prof('am'); m.boxes = 300; for (let i = 0; i < 300; i++) { const r = P.openBox(m); assert.ok(!r.item || (r.slot !== 'gun' && r.slot !== 'armor')); }
  const o = prof('ae'); P.equip(o, { look: { armor: 'a_titan' } }); assert.ok(!o.look.armor, 'only owned armour can be worn'); o.own.push('a_titan'); P.equip(o, { look: { armor: 'a_titan' } }); assert.equal(o.look.armor, 'a_titan'); assert.equal(P.publicOf(o).look.armor, 'a_titan');
  const pr = prof('ap'); pr.coins = 5e6; P.buyItem(pr, 'g_judge'); assert.equal(pr.coins, 5e6 - 2500000); assert.ok(C.price('a_titan') > C.price('a_aegis') && C.price('g_oblit') > C.price('g_nova'));
  const gone = prof('ag'); gone.own.push('g_pea', 'g_pop'); gone.gun = 'g_pea'; assert.equal(P.privateOf(gone, 0).gun, 'g_pop'); assert.ok(!gone.own.includes('g_pea'), 'guns that no longer exist are tidied away');
});
test('armour adds health and cuts damage; its abilities work (thorns, dodge, last stand, regen, berserk)', () => {
  const { pa, ps, adv } = party(2, () => 0.5), [a, b] = ps, AR = globalThis.FOUND_ARMOR; pa.setGuns(true);
  const wear = (p, id) => { if (!P.owns(p.prof, id)) p.prof.own.push(id); p.prof.look.armor = id; pa.fill(p); }, place = () => { a.x = 20; a.z = 0; b.x = 20; b.z = 10; a.shield = b.shield = 0; a.deadAt = b.deadAt = 0; };
  assert.equal(pa.mh(b), 150); wear(b, 'a_knight'); assert.equal(pa.mh(b), 150 + AR.BY.a_knight.hp); assert.equal(b.hp, pa.mh(b)); assert.equal(pa.state().players[1].mhp, pa.mh(b));
  place(); a.prof.gun = 'g_pop'; adv(400); pa.shoot(a, { ry: 0 }); assert.equal(b.hp, pa.mh(b) - Math.round(12 * (1 - AR.BY.a_knight.red)), 'armour cuts the hit');
  /* wearing other armour keeps your share of health */
  b.hp = Math.round(pa.mh(b) / 2); wear(b, 'a_vest'); b.hp = Math.round(pa.mh(b) / 2); pa.refit(b); assert.ok(b.hp >= 1 && b.hp <= pa.mh(b));
  /* thorns: the shooter is hurt too */
  wear(b, 'a_chain'); place(); a.hp = 150; adv(400); pa.shoot(a, { ry: 0 }); assert.ok(a.hp < 150, 'thorns give some back');
  /* last stand: one killing blow is survived per life */
  wear(b, 'a_aegis'); place(); b.hp = 3; adv(400); pa.shoot(a, { ry: 0 }); assert.equal(b.hp, 1); assert.ok(!b.deadAt && b.shield > pa.now(), 'last stand leaves you on 1 hp, shielded'); b.shield = 0; adv(400); pa.shoot(a, { ry: 0 }); assert.ok(b.deadAt, 'but only once');
  adv(CFG.respawnMs + 50); assert.equal(b.lastUsed, false); assert.ok(b.shield - pa.now() > CFG.shieldMs, 'ward gives a longer shield after respawn');
  /* dodge */
  const d = party(2, () => 0), [a2, b2] = d.ps; d.pa.setGuns(true); b2.prof.own.push('a_phantom'); b2.prof.look.armor = 'a_phantom'; d.pa.fill(b2); a2.x = 20; a2.z = 0; b2.x = 20; b2.z = 10; a2.shield = b2.shield = 0; d.adv(400); d.pa.shoot(a2, { ry: 0 }); assert.equal(b2.hp, d.pa.mh(b2), 'a dodge takes no damage');
  /* regen starts only after 4 s without being hit */
  const r = party(2, () => 0.5), [a3, b3] = r.ps; r.pa.setGuns(true); b3.prof.own.push('a_shell'); b3.prof.look.armor = 'a_shell'; r.pa.fill(b3); b3.hp = 50; b3.hurtAt = r.pa.now(); r.adv(2000); assert.equal(b3.hp, 50, 'not yet'); r.adv(4000); assert.ok(b3.hp > 50, 'then it heals: ' + b3.hp);
  /* berserk */
  const z = party(2, () => 0.5), [a4, b4] = z.ps; z.pa.setGuns(true); a4.prof.own.push('a_berserk'); a4.prof.look.armor = 'a_berserk'; z.pa.fill(a4); a4.prof.gun = 'g_pop'; a4.x = 20; a4.z = 0; b4.x = 20; b4.z = 10; a4.shield = b4.shield = 0; a4.hp = 20; z.adv(400); z.pa.shoot(a4, { ry: 0 }); assert.equal(b4.hp, 150 - Math.round(12 * 1.4), 'berserk: +40% when low');
});
test('gun abilities: lifesteal, burn, pierce, chain, splash, crit', () => {
  const mk = gun => { const s = party(4, () => 0.5), [a, b, c, d] = s.ps; s.pa.setGuns(true); a.prof.own.push(gun); a.prof.gun = gun; a.x = 20; a.z = 0; b.x = 20; b.z = 10; c.x = 20; c.z = 20; d.x = 26; d.z = 10; for (const q of s.ps) { q.shield = 0; q.hp = 150; } return Object.assign(s, { a, b, c, d }); };
  let s = mk('g_leech'); s.a.hp = 100; s.adv(400); s.pa.shoot(s.a, { ry: 0 }); assert.ok(s.a.hp > 100 && s.b.hp < 150, 'lifesteal heals the shooter');
  s = mk('g_inferno'); s.adv(400); s.pa.shoot(s.a, { ry: 0 }); const h0 = s.b.hp; s.adv(2200); assert.ok(s.b.hp < h0, 'burn keeps hurting: ' + h0 + ' -> ' + s.b.hp); s.adv(3000); const h1 = s.b.hp; s.adv(3000); assert.equal(s.b.hp, h1, 'and stops after 3 s');
  s = mk('g_rail'); s.adv(400); s.pa.shoot(s.a, { ry: 0 }); assert.ok(s.b.hp < 150 && s.c.hp < 150, 'pierce hits two players in a line');
  s = mk('g_arc'); s.adv(400); s.pa.shoot(s.a, { ry: 0 }); assert.ok(s.b.hp < 150 && s.d.hp < 150 && s.c.hp === 150, 'chain lightning arcs to the nearest other player only');
  s = mk('g_nova'); s.d.x = 23; s.adv(400); s.pa.shoot(s.a, { ry: 0 }); assert.ok(s.b.hp < 150 && s.d.hp < 150, 'splash hurts the neighbour, ' + s.d.hp);
  s = mk('g_gilded'); let crits = 0; for (let i = 0; i < 40; i++) { s.b.hp = 150; s.pa.rnd = () => (i % 5 === 0 ? 0.05 : 0.5); s.adv(500); s.pa.shoot(s.a, { ry: 0 }); if (150 - s.b.hp > 46) crits++; } assert.ok(crits >= 6 && crits <= 10, 'about one shot in five is a crit: ' + crits);
  assert.ok(G0.LIST.filter(g => g.ab).length >= 5 && G0.LIST.filter(g => g.ab).length <= 9, 'only a handful of special guns');
});

console.log(`\n${n} unit tests passed`);
