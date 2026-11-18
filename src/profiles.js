/* Profiles: looks, what you own, coins and Mystery Boxes. Everything that gives or spends happens here, on the server.
   Coins come from rounds. The shop sells any item at a fixed price. A Mystery Box gives a random item you don't own. */
import crypto from 'node:crypto';
import '../public/catalog.js';
import '../public/avatar-data.js';
import '../public/guns.js';
import '../public/armor.js';
import '../public/extra-items.js';
import '../public/auras.js';
const C = globalThis.FOUND_CATALOG, D = globalThis.FOUND_AVATAR_DATA, G = globalThis.FOUND_GUNS;

export const hashKey = k => crypto.createHash('sha256').update('found:' + String(k)).digest('hex');
export const today = now => new Date(now).toISOString().slice(0, 10);
/* every player is named one cool lowercase word (they can still change it in the menu) */
export const WORDS = ['ember', 'nova', 'vortex', 'zephyr', 'glitch', 'blaze', 'onyx', 'pixel', 'comet', 'frost', 'shadow', 'turbo', 'neon', 'raven', 'storm', 'echo', 'flux', 'pulse', 'quartz', 'rogue', 'saber', 'titan', 'viper', 'wraith', 'zenith', 'apex', 'bolt', 'cipher', 'dagger', 'eclipse', 'falcon', 'ghost', 'havoc', 'iris', 'jinx', 'karma', 'lynx', 'mirage', 'nebula', 'omen', 'phantom', 'quasar', 'riot', 'spark', 'tempest', 'umbra', 'vandal', 'warp', 'xenon', 'yeti',
  'zero', 'arc', 'blitz', 'cobalt', 'drift', 'enigma', 'fable', 'gale', 'halo', 'inferno', 'jolt', 'kraken', 'lotus', 'maverick', 'nimbus', 'oblivion', 'pyro', 'quill', 'rift', 'sable', 'thorn', 'ultra', 'valor', 'whisper', 'axiom', 'basalt', 'cinder', 'dusk', 'ember', 'fury', 'glacier', 'harbor', 'ion', 'jade', 'kestrel', 'lunar', 'magma', 'nomad', 'orbit', 'prism', 'quake', 'radiant', 'solar', 'talon', 'unity', 'vector', 'wolf', 'xylo', 'yonder', 'zinc',
  'aurora', 'bandit', 'chaos', 'delta', 'ethos', 'fang', 'gravity', 'hex', 'indigo', 'jester', 'knight', 'laser', 'meteor', 'nitro', 'omega', 'pandemonium', 'quartzite', 'razor', 'static', 'tundra', 'vapor', 'warden', 'zodiac', 'ash', 'blink', 'crux', 'dynamo', 'elixir', 'flare', 'glint', 'haze', 'inkwell', 'jinxed', 'kilo', 'lava', 'mystic', 'nexus', 'opal', 'plasma', 'rune', 'spectre', 'tracer', 'umber', 'volt', 'wisp', 'zap'];
/* the lightest skin is the default for everyone */
export const WHITE_SKIN = 0;
/* every new player, and every player the first time they connect after this update, gets this many coins */
export const START_COINS = 200000, MIGRATION = 1;
export function cleanName(n) { return String(n || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14); }
const pick = (a, r) => a[Math.floor(r() * a.length)];
/* older saves kept three kinds of box; they are all one kind now */
/* nothing a player owns is ever wiped or taken away. If an item ever leaves the catalogue the player keeps it in their save and it just stops being worn. */
const gone = (p) => { if (p.gun && !C.BY[p.gun]) p.gun = ''; if (p.look && p.look.armor && !C.BY[p.look.armor]) p.look.armor = ''; };
export const SEASON = 2;   // only a marker now: it used to wipe saves when bumped, and it never will again
const fix = p => { gone(p); p.season = SEASON; if (typeof p.boxes !== 'number') p.boxes = Object.values(p.boxes || {}).reduce((a, b) => a + (b | 0), 0); if (!p.daily) p.daily = { last: '' }; if (!p.own) p.own = []; if (!p.stats) p.stats = {}; if (!p.idleAt) p.idleAt = Date.now(); return p; };

export function randomWord(rnd = Math.random, used) { const free = used ? WORDS.filter(w => !used.has(w)) : WORDS, list = free.length ? free : WORDS; return pick(list, rnd); }
export function newProfile(id, key, now, rnd = Math.random, used) {
  const hairs = D.HAIRS.map(h => h[0]).filter(h => h !== 'none');
  return { id, kh: hashKey(key), created: now, name: randomWord(rnd, used), mig: MIGRATION,
    look: { skin: WHITE_SKIN, hair: pick(hairs, rnd), hc: Math.floor(rnd() * 4), outfit: pick(['tee', 'hoodie'], rnd), hat: '', acc: '', aura: '' },
    pet: '', col: Math.floor(rnd() * 8), season: SEASON, idleAt: now, coins: START_COINS, own: [], boxes: 1, daily: { last: '' }, stats: { games: 0, wins: 0, finds: 0 } };
}
/* once per player: a cool lowercase name, white skin, and 200,000 coins to make up for the resets. Returns true when it changed anything. */
export function migrate(p, used, rnd = Math.random) {
  if ((p.mig || 0) >= MIGRATION) return false;
  fix(p); p.mig = MIGRATION; p.name = randomWord(rnd, used); if (used) used.add(p.name);
  if (p.look) p.look.skin = WHITE_SKIN; p.coins = (p.coins || 0) + START_COINS; return true;
}
export const usedNames = profiles => new Set([...profiles.values()].map(p => p.name));
export const owns = (p, id) => !id || C.STARTER.includes(id) || (p.own || []).includes(id);
export function publicOf(p) { return { id: p.id, name: p.name, look: p.look, pet: p.pet, col: p.col, gun: p.gun || G.START }; }
export function privateOf(p, now) { fix(p); return { id: p.id, name: p.name, look: p.look, pet: p.pet, col: p.col, gun: p.gun || G.START, admin: !!p.admin, coins: p.coins, own: p.own, boxes: p.boxes, stats: p.stats, daily: p.daily.last !== today(now),
  idle: idleOf(p, now), idleRate: idleRate(p), spin: p.daily.spin !== today(now), miniLeft: miniLeft(p, now) }; }

/* change looks: only owned items, real hairstyles and colours */
export function equip(p, b) {
  const L = b.look || {}, out = Object.assign({}, p.look);
  if (Number.isInteger(L.skin) && L.skin >= 0 && L.skin < D.SKIN.length) out.skin = L.skin;
  if (Number.isInteger(L.hc) && L.hc >= 0 && L.hc < D.HAIRC.length) out.hc = L.hc;
  if (typeof L.hair === 'string' && D.HAIRS.some(h => h[0] === L.hair)) out.hair = L.hair;
  for (const slot of ['outfit', 'hat', 'acc', 'aura', 'armor']) if (typeof L[slot] === 'string') {
    const id = L[slot]; if (id === '' && slot !== 'outfit') out[slot] = '';
    else if (C.BY[id] && C.BY[id].slot === slot && owns(p, id)) out[slot] = id;
  }
  if (typeof b.pet === 'string' && (b.pet === '' || (C.BY[b.pet] && C.BY[b.pet].slot === 'pet' && owns(p, b.pet)))) p.pet = b.pet;
  if (typeof b.gun === 'string' && C.BY[b.gun] && C.BY[b.gun].slot === 'gun' && owns(p, b.gun)) p.gun = b.gun;
  if (Number.isInteger(b.col) && b.col >= 0 && b.col < 8) p.col = b.col;
  if (typeof b.name === 'string') { const n = cleanName(b.name); if (n.length >= 2) p.name = n; }
  p.look = out; return p;
}
/* the shop: buy one item at its price */
export function buyItem(p, id) {
  const it = C.BY[id]; if (!it) throw new Error('No such item.'); if (owns(p, id)) throw new Error('You already own that.');
  const price = C.price(id); if (p.coins < price) throw new Error('Not enough coins.');
  p.coins -= price; p.own.push(id); return { item: id, slot: it.slot, name: it.name, rarity: it.rarity, price };
}
export function buyBox(p) { fix(p); if (p.coins < C.BOX.price) throw new Error('Not enough coins.'); p.coins -= C.BOX.price; p.boxes++; }
export function addBox(p, n = 1) { fix(p); p.boxes += n; }
/* open a Mystery Box: roll a rarity, then a random item of it you don't own (the nearest rarity that still has one) */
export function openBox(p, rnd = Math.random) {
  fix(p); if (!p.boxes) throw new Error('No Mystery Box to open.');
  p.boxes--; const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial', 'cosmic'];
  let r = rnd() * 100, at = 0; for (let i = 0; i < order.length; i++) { at = i; const o = C.BOX.odds[order[i]]; if (r < o) break; r -= o; }
  const pool = k => C.ITEMS.filter(i => i[3] === order[k] && i[1] !== 'gun' && i[1] !== 'armor' && !owns(p, i[0]));
  let list = []; for (let d = 0; d < order.length && !list.length; d++) for (const k of [at - d, at + d]) if (k >= 0 && k < order.length && !list.length) list = pool(k);
  if (!list.length) { p.coins += C.BOX.price; return { coins: C.BOX.price }; }   // you own everything: your coins back
  const it = list[Math.floor(rnd() * list.length)]; p.own.push(it[0]);
  return { item: it[0], slot: it[1], name: it[2], rarity: it[3] };
}
/* the gun crate and the armour box: cost coins and roll a rarity by their odds (so the rare ones stay rare), then give a piece of that rarity you don't own yet.
   Shop-only premium pieces (those with their own price) are never in a crate. If you already own every piece of the rarity it rolled, it is a duplicate and pays back a tenth of that rarity's shop price.
   A better gun or armour is worn for you. */
export function openCrate(p, rnd = Math.random, kind = 'gun') {
  fix(p); const K = C.CRATES[kind]; if (!K) throw new Error('No such box.'); const slot = kind === 'armor' ? 'armor' : 'gun'; if (p.coins < K.price) throw new Error('Not enough coins.');
  const inBox = i => i[1] === slot && !C.BY[i[0]].price;
  const order = C.RARITY.filter(r => r !== 'starter' && C.ITEMS.some(i => inBox(i) && i[3] === r)), all = k => C.ITEMS.filter(i => inBox(i) && i[3] === order[k]), pool = k => all(k).filter(i => !owns(p, i[0]));
  const left = order.reduce((n, _, k) => n + pool(k).length, 0); if (!left) throw new Error(kind === 'armor' ? 'You own every armour!' : 'You own every gun!');
  p.coins -= K.price;
  let r = rnd() * 100, at = order.length - 1; for (let i = 0; i < order.length; i++) { const o = K.odds[order[i]] || 0; if (r < o) { at = i; break; } r -= o; }
  const fresh = pool(at);
  if (!fresh.length) { const it = all(at)[Math.floor(rnd() * all(at).length)], back = Math.round(C.PRICE[order[at]] * K.dup); p.coins += back; return { item: it[0], slot, name: it[2], rarity: it[3], dup: true, coins: back, left }; }
  const it = fresh[Math.floor(rnd() * fresh.length)]; p.own.push(it[0]);
  const rank = id => id ? C.RARITY.indexOf(C.BY[id].rarity) : -1;
  let equipped;
  if (slot === 'gun') { equipped = rank(it[0]) > rank(p.gun || G.START); if (equipped) p.gun = it[0]; }
  else { equipped = rank(it[0]) > rank(p.look.armor); if (equipped) p.look.armor = it[0]; }
  return { item: it[0], slot, name: it[2], rarity: it[3], dup: false, equipped, left: left - 1 };
}
/* one free Mystery Box a day (UTC) */
export function claimDaily(p, now) { fix(p); if (p.daily.last === today(now)) throw new Error('Come back tomorrow.'); p.daily.last = today(now); p.boxes++; }

/* idle earning: coins build up while you are away, 250 an hour plus 15 for every item you own, for up to 8 hours */
export const IDLE = { base: 250, perItem: 15, capH: 8 };
export const idleRate = p => IDLE.base + IDLE.perItem * (p.own || []).length;
export function idleOf(p, now) { fix(p); return Math.floor(Math.min(IDLE.capH, Math.max(0, now - p.idleAt) / 3600000) * idleRate(p)); }
export function claimIdle(p, now) { const n = idleOf(p, now); if (!n) throw new Error('Nothing to collect yet.'); p.coins += n; p.idleAt = now; return n; }
/* the daily wheel: one spin a day (UTC) */
export const WHEEL = [[30, { coins: 400 }], [30, { coins: 800 }], [20, { coins: 1600 }], [10, { coins: 3200 }], [9, { box: 1 }], [1, { coins: 8000 }]];
export function spin(p, now, rnd = Math.random) {
  fix(p); if (p.daily.spin === today(now)) throw new Error('One spin a day. Come back tomorrow.'); p.daily.spin = today(now);
  let r = rnd() * 100, prize = WHEEL[0][1]; for (const [w, pr] of WHEEL) { if (r < w) { prize = pr; break; } r -= w; }
  if (prize.coins) p.coins += prize.coins; else p.boxes += prize.box; return prize;
}
/* the menu game (odd one out): 150 coins a win, 10 paid wins a day */
export const MINI = { coins: 150, perDay: 10, ms: 12000 };
export function miniLeft(p, now) { fix(p); const m = p.daily.mini; return m && m.d === today(now) ? Math.max(0, MINI.perDay - m.n) : MINI.perDay; }
export function miniWin(p, now) { if (!miniLeft(p, now)) return 0; const m = p.daily.mini && p.daily.mini.d === today(now) ? p.daily.mini : (p.daily.mini = { d: today(now), n: 0 }); m.n++; p.coins += MINI.coins; return MINI.coins; }
/* gifting coins to someone in your party */
export const GIFTS = [50, 100, 250];
export function giveCoins(from, to, n) { if (!GIFTS.includes(n)) throw new Error('Gifts are 50, 100 or 250.'); if (from.id === to.id) throw new Error('Pick someone else.'); if (from.coins < n) throw new Error('Not enough coins.'); from.coins -= n; to.coins += n; }
