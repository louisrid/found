/* FOUND armour: stats (server and client). Worn armour adds health and cuts the damage you take; most pieces also have an ability.
   Row: id, name, rarity, hp (bonus health), red (damage taken is cut by this much, 0.1 = 10%), ability fields, then two colours for the voxel plates.
   Abilities: thorns (hits give back this share of the damage to the shooter), regen (hp a second once you have not been hit for 4 s), dodge (chance to take no damage),
   berserk (+40% damage while below a third of your health), last (once a life, a killing blow leaves you on 1 hp with a short shield), ward (longer shield after you respawn).
   The shop row for every piece lives in catalog.js; the ids here must match. */
(function (root) {
  'use strict';
  const defs = [];
  const ab = o => [o.thorns && `Thorns: gives back ${Math.round(o.thorns * 100)}% of damage taken`, o.regen && `Regen: +${o.regen} hp a second out of combat`, o.dodge && `Dodge: ${Math.round(o.dodge * 100)}% of shots miss you`, o.berserk && 'Berserk: +40% damage when low on health', o.last && 'Last stand: survive one killing blow per life', o.ward && `Ward: +${o.ward / 1000}s shield after respawn`].filter(Boolean);
  const arm = (id, name, rarity, hp, red, o, c1, c2) => defs.push(Object.assign({ id, name, rarity, hp, red, c1, c2, thorns: 0, regen: 0, dodge: 0, berserk: 0, last: 0, ward: 0 }, o, { abilities: ab(o) }));
  arm('a_vest', 'Padded Vest', 'common', 20, 0.05, {}, '#6b7a8f', '#2a2733');
  arm('a_scrap', 'Scrap Plate', 'common', 25, 0.04, { ward: 1000 }, '#8a7a5a', '#3a3328');
  arm('a_jacket', 'Riot Jacket', 'uncommon', 30, 0.08, {}, '#3b5bdb', '#0b0b0f');
  arm('a_kevlar', 'Kevlar Vest', 'uncommon', 25, 0.1, {}, '#2f3b4a', '#ffc61a');
  arm('a_chain', 'Chain Mail', 'rare', 40, 0.12, { thorns: 0.15 }, '#b8c2cc', '#4a5560');
  arm('a_shell', 'Turtle Shell', 'rare', 50, 0.1, { regen: 2 }, '#2fa84a', '#7a4a1a');
  arm('a_knight', 'Knight Plate', 'epic', 55, 0.16, { regen: 3 }, '#d5dbe3', '#7a52ff');
  arm('a_ninja', 'Shadow Suit', 'epic', 40, 0.14, { dodge: 0.1 }, '#23232b', '#ff2d55');
  arm('a_phantom', 'Phantom Cloak', 'legendary', 45, 0.14, { dodge: 0.15 }, '#6a5acd', '#cfe7ff');
  arm('a_guard', 'Guardian Plate', 'legendary', 65, 0.2, { thorns: 0.2 }, '#e0b030', '#fff6d0');
  arm('a_berserk', 'Berserker Plate', 'mythic', 70, 0.2, { berserk: 1 }, '#c0302a', '#2a0b0b');
  arm('a_dragon', 'Dragon Scale', 'mythic', 75, 0.2, { regen: 4, thorns: 0.1 }, '#ff7a1a', '#7a1a0b');
  arm('a_aegis', 'Aegis Armour', 'celestial', 90, 0.25, { last: 1, ward: 1500 }, '#fff2a8', '#ffffff');
  arm('a_void', 'Void Armour', 'cosmic', 120, 0.3, { thorns: 0.25, regen: 5 }, '#12e0ff', '#a06bff');
  /* shop-only premium armour at very high prices (prices are in catalog.js) */
  arm('a_royal', 'Royal Guard', 'mythic', 100, 0.24, { ward: 2000, regen: 4, thorns: 0.12 }, '#ffd60a', '#7a52ff');
  arm('a_titan', 'Titan Suit', 'cosmic', 160, 0.34, { thorns: 0.3, last: 1, regen: 3 }, '#ff2d55', '#ffd60a');
  const BY = {}; defs.forEach(d => { BY[d.id] = d; });
  const NONE = Object.freeze({ id: '', name: 'No armour', hp: 0, red: 0, thorns: 0, regen: 0, dodge: 0, berserk: 0, last: 0, ward: 0, abilities: [] });
  root.FOUND_ARMOR = Object.freeze({ LIST: defs, BY, NONE, of: id => BY[id] || NONE });
})(globalThis);
