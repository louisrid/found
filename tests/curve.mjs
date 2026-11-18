/* The power curve: how strong each rarity of gun is, how fast it kills, and how long a player takes to earn it at 2,000 coins a minute.
   `node tests/curve.mjs` prints the tables; the unit tests import analyse() and assert the shape of the curve. */
import * as P from '../src/profiles.js';
const C = globalThis.FOUND_CATALOG, G = globalThis.FOUND_GUNS;

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const seeded = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

/* damage a second if every pellet lands, and the time to kill a player (150 hp) from point blank */
export const dps = g => g.dmg * g.pellets * 1000 / g.ms;
export const shotsToKill = g => Math.ceil(G.HP / (g.dmg * g.pellets));
export const ttk = g => (shotsToKill(g) - 1) * g.ms / 1000;

export function analyse(trials = 200) {
  const rows = G.LIST.map(g => ({ id: g.id, name: g.name, rarity: g.rarity, dps: Math.round(dps(g)), shots: shotsToKill(g), ttk: +ttk(g).toFixed(2), range: g.range, price: C.price(g.id) }));
  const tiers = C.RARITY.filter(r => rows.some(x => x.rarity === r)).map(r => { const list = rows.filter(x => x.rarity === r && !C.BY[x.id].price), d = list.map(x => x.dps);
    return { rarity: r, n: list.length, min: Math.min(...d), max: Math.max(...d), avg: Math.round(d.reduce((a, b) => a + b, 0) / d.length), ttkMin: Math.min(...list.map(x => x.ttk)), ttkMax: Math.max(...list.map(x => x.ttk)) }; });
  /* a player who does nothing but open Gun Crates as soon as they can afford one, earning 2,000 coins a minute, no kills */
  const rarities = C.RARITY.filter(r => r !== 'starter' && rows.some(x => x.rarity === r)), first = {}, all = [];
  rarities.forEach(r => { first[r] = []; });
  for (let t = 0; t < trials; t++) {
    const rnd = seeded(1000 + t * 7919), p = P.newProfile('p' + t, 'k' + t, 0, rnd); p.coins = 0; p.own = []; let minute = 0, crates = 0;
    const left = () => G.LIST.some(g => g.rarity !== 'starter' && !C.BY[g.id].price && !P.owns(p, g.id)), got = new Set();
    while (left() && minute < 5000) { minute++; p.coins += 2000; while (p.coins >= C.CRATE.price && left()) { const r = P.openCrate(p, rnd); crates++; if (!got.has(r.rarity)) { got.add(r.rarity); first[r.rarity].push(minute); } } }
    all.push({ minute, crates });
  }
  const pace = rarities.map(r => ({ rarity: r, median: median(first[r]), p90: pct(first[r], 0.9) }));
  const guns = C.ITEMS.filter(i => i[1] === 'gun' && i[3] !== 'starter' && !i[4]);
  const store = C.ITEMS.filter(i => i[3] !== 'starter'), cost = list => list.reduce((a, i) => a + C.price(i[0]), 0);
  return { rows, tiers, pace, complete: { median: median(all.map(x => x.minute)), p90: pct(all.map(x => x.minute), 0.9), crates: median(all.map(x => x.crates)), guns: guns.length }, shopTotal: cost(store), shopMinutes: Math.round(cost(store) / 2000), items: store.length };
}

if (process.argv[1] && process.argv[1].endsWith('curve.mjs')) {
  const r = analyse(300);
  console.log('\nDAMAGE A SECOND BY RARITY'); console.table(r.tiers);
  console.log('\nEVERY GUN'); console.table(r.rows.sort((a, b) => a.dps - b.dps));
  console.log('\nMINUTES TO FIRST GUN OF A RARITY (crates only, 2,000 coins a minute and no kills, 300 players)'); console.table(r.pace);
  console.log('\nALL ' + r.complete.guns + ' GUNS: median ' + r.complete.median + ' min (' + r.complete.crates + ' crates), 90% done by ' + r.complete.p90 + ' min');
  console.log('BUY EVERYTHING in the shop (' + r.items + ' items): ' + r.shopTotal.toLocaleString() + ' coins = ' + r.shopMinutes + ' minutes of play');
}
