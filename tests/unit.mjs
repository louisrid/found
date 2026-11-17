/* Unit tests: the shop and Mystery Box, looks, and prop hunt rounds (roles, decoys, tagging, modes, scoring). */
import assert from 'node:assert/strict';
import * as P from '../src/profiles.js';
const OBJm = id => globalThis.FOUND_OBJECTS.TIERS[globalThis.FOUND_OBJECTS.BY[id].tier].mult;
import { Party, newCode, CFG, MAPCFG, modeFor, mapFor } from '../src/game.js';
const C = globalThis.FOUND_CATALOG, OBJ = globalThis.FOUND_OBJECTS, LAY = globalThis.FOUND_LAYOUT, D = globalThis.FOUND_AVATAR_DATA;
let n = 0; const test = (name, fn) => { fn(); n++; console.log('  ok', name); };
const seeded = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const prof = (ch, r) => P.newProfile(String(ch).repeat(20), 'k'.repeat(48), 0, r);

function party(nPlayers, rnd) {
  const sent = []; let t = 1_000_000; const io = { all: (pa, m) => sent.push(['all', m]), one: (p, m) => sent.push([p.id, m]), me() {}, saved() {} };
  const pa = new Party('TEST', io, { now: () => t, rnd: rnd || seeded(7) }); const ps = [];
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
  }
  assert.ok(C.ITEMS.length >= 150);
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
test('a new profile has a starter look, some coins and one box', () => { const p = prof('a', seeded(1)); assert.ok(['tee', 'hoodie'].includes(p.look.outfit)); assert.equal(p.boxes, 1); assert.equal(p.coins, 300); });
test('the shop sells an item once at its price', () => {
  const p = prof('b'); p.coins = 1000; const r = P.buyItem(p, C.ITEMS.find(i => i[3] === 'rare')[0]); assert.equal(p.coins, 1000 - r.price); assert.ok(P.owns(p, r.item));
  assert.throws(() => P.buyItem(p, r.item), /already/); p.coins = 0; assert.throws(() => P.buyItem(p, C.ITEMS.find(i => i[3] === 'mythic')[0]), /Not enough/); assert.throws(() => P.buyItem(p, 'nope'), /No such/);
});
test('boxes never repeat an item, and pay coins back only when you own everything', () => {
  const p = prof('c'), rr = seeded(9), seen = new Set(); p.boxes = C.ITEMS.length + 5; let back = 0;
  for (let i = 0; i < C.ITEMS.length + 5; i++) { const r = P.openBox(p, rr); if (r.item) { assert.ok(!seen.has(r.item)); seen.add(r.item); } else back += r.coins; }
  assert.equal(seen.size, C.ITEMS.length - C.STARTER.length); assert.ok(back > 0); assert.throws(() => P.openBox(p), /No Mystery Box/);
});
test('buying a box costs coins; the daily box is once a day', () => {
  const p = prof('d'); p.coins = 700; P.buyBox(p); assert.equal(p.coins, 100); assert.equal(p.boxes, 2); assert.throws(() => P.buyBox(p), /Not enough/);
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
  const s = party(1); s.toSeek(); const c0 = s.ps[0].prof.coins, b0 = s.ps[0].prof.boxes; s.adv(s.pa.mc.seekMs + 10); assert.equal(s.pa.phase, 'results'); assert.equal(s.ps[0].prof.boxes, b0); assert.ok(s.ps[0].prof.coins - c0 <= 12);
  const a = party(3); a.pa.setRule(a.ps[0], 'seek', 1.5); a.toSeek(); a.adv(Math.round(a.pa.mc.seekMs * 1.5) + 10); const h = a.hiders()[0]; assert.equal(h.score, Math.round(a.pa.mc.seekMs / 1000 * CFG.perSecond * OBJm(h.prop)) + CFG.survivePts);
});
test('idle, wheel, mini game and gifting', () => {
  const now = Date.UTC(2026, 0, 5, 12), a = P.newProfile('a'.repeat(24), 'k', now, () => 0.5), b = P.newProfile('b'.repeat(24), 'k', now, () => 0.5);
  assert.equal(P.idleOf(a, now), 0); assert.throws(() => P.claimIdle(a, now)); assert.equal(P.idleOf(a, now + 2 * 3600000), 60); assert.equal(P.idleOf(a, now + 50 * 3600000), 240, 'capped at 8 hours');
  a.own.push('x'); assert.equal(P.idleRate(a), 32); a.own.pop(); const c0 = a.coins; assert.equal(P.claimIdle(a, now + 3600000), 30); assert.equal(a.coins, c0 + 30); assert.equal(P.idleOf(a, now + 3600000), 0);
  const c1 = a.coins, pr = P.spin(a, now, () => 0); assert.deepEqual(pr, { coins: 50 }); assert.equal(a.coins, c1 + 50); assert.throws(() => P.spin(a, now + 1000), /tomorrow/); P.spin(a, now + 86400000, () => 0.95); assert.equal(a.boxes, 2, '0.95 lands on the box');
  let paid = 0; for (let i = 0; i < 12; i++) paid += P.miniWin(a, now); assert.equal(paid, 200); assert.equal(P.miniLeft(a, now), 0); assert.equal(P.miniLeft(a, now + 86400000), 10);
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
console.log(`\n${n} unit tests passed`);
