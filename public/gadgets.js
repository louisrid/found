/* FOUND gadgets: throwable accessories on the G key (and the grenade button). Stats (server and client) plus a chunky voxel model for the icons.
   kind: frag (damage in a blast), cluster (three smaller blasts), flash (stuns everyone near it so they cannot shoot), smoke (a cloud that blocks shots), med (heals everyone near it), fire (burns the ground).
   cd: cooldown (ms). range: how far it flies. fuse: ms in the air. r: blast radius. dmg: damage at the centre, down to 30% at the edge. The shop row for every gadget lives in catalog.js; the ids here must match. */
(function (root) {
  'use strict';
  const defs = [];
  const gad = (id, name, rarity, kind, o, c1, c2, text) => defs.push(Object.assign({ id, name, rarity, kind, cd: 10000, range: 20, fuse: 1300, r: 5, dmg: 0, c1, c2, text }, o));
  gad('gd_frag', 'Frag Grenade', 'starter', 'frag', { cd: 9000, r: 5.5, dmg: 70 }, '#3c8d3c', '#1d1d24', 'A blast that hurts everyone near it');
  gad('gd_flash', 'Flashbang', 'uncommon', 'flash', { cd: 12000, r: 9, stun: 2500 }, '#e8e8f0', '#ffd60a', 'Blinds everyone near it: they cannot shoot for 2.5 s');
  gad('gd_smoke', 'Smoke Bomb', 'uncommon', 'smoke', { cd: 14000, r: 7, dur: 7000 }, '#9aa0ab', '#4a4f5c', 'A cloud that blocks every shot for 7 s');
  gad('gd_med', 'Med Grenade', 'rare', 'med', { cd: 16000, r: 6, heal: 70 }, '#ff3b30', '#ffffff', 'Heals everyone near it (you too)');
  gad('gd_fire', 'Napalm', 'epic', 'fire', { cd: 14000, r: 5, dur: 5000, dmg: 9 }, '#ff7a1a', '#ffd60a', 'Sets the ground on fire for 5 s');
  gad('gd_cluster', 'Cluster Bomb', 'legendary', 'cluster', { cd: 15000, r: 4, dmg: 45 }, '#7a52ff', '#ffd60a', 'Three blasts in a row');
  gad('gd_mega', 'Mega Bomb', 'mythic', 'frag', { cd: 28000, r: 9, dmg: 110, range: 24, fuse: 1700 }, '#ff2d55', '#ffd60a', 'A huge blast');
  gad('gd_nuke', 'Mini Nuke', 'cosmic', 'frag', { cd: 40000, r: 13, dmg: 130, range: 26, fuse: 2200 }, '#12e0ff', '#ffffff', 'The biggest blast in the game');
  const BY = {}; defs.forEach(d => { BY[d.id] = d; });
  /* damage at a distance from the centre of a blast */
  const hurt = (g, dist) => g.dmg * (1 - 0.7 * Math.max(0, Math.min(1, dist / g.r)));
  root.FOUND_GADGETS = Object.freeze({ LIST: defs, BY, START: 'gd_frag', hurt });
})(globalThis);
