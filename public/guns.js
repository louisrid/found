/* FOUND guns: stats (server and client) and chunky voxel models (client).
   A model is a list of voxel boxes [w, h, d, colour, x, y, z, flag] in gun space: the grip is at the origin and the barrel points along +z.
   Flags: 'g' glows, 'r' cycles through the rainbow, 'n' has no outline, 's' spins round the barrel, 'o' orbits the gun, 'f' flickers. Stats: dmg per pellet, ms between shots, range, pellets, spread (radians).
   The shop row for every gun lives in catalog.js; the ids here must match. */
(function (root) {
  'use strict';
  /* the plain gun every one of them starts from: grip, body, barrel, a stripe and a sight */
  const base = o => { const L = o.L || 0.5, B = o.B || 0.18, th = o.th || 0.18, bw = o.bw || 0.09;
    return [[0.12, 0.24, 0.12, o.grip || '#2a2733', 0, -0.13, 0], [th, th, L, o.body, 0, 0.04, L / 2 - 0.08], [bw, bw, B, o.barrel || o.trim, 0, 0.05, L - 0.08 + B / 2],
      [th + 0.01, 0.05, L * 0.5, o.trim, 0, 0.075, L * 0.4], [0.05, 0.05, 0.05, o.trim, 0, 0.16, L * 0.75]]; };
  const mzOf = o => (o.L || 0.5) - 0.08 + (o.B || 0.18);
  const defs = [];
  const gun = (id, name, rarity, st, o, extra, ab) => defs.push({ id, name, rarity, dmg: st[0], ms: st[1], range: st[2], pellets: st[3] || 1, spread: st[4] || 0.02, col: st[5], ab: ab || '', mz: mzOf(o), spec: base(o).concat(extra || []) });

  /* special abilities a gun can carry (the server does the work, see game.js shoot) */
  const AB = { vamp: ['Lifesteal', 'Heals you for 30% of the damage you deal'], chain: ['Chain lightning', 'Arcs to a second player near your target'], burn: ['Burn', 'Sets targets on fire for 3 seconds'], pierce: ['Pierce', 'Shots go through up to 3 players'],
    splash: ['Splash', 'Hurts everyone near your target'], crit: ['Critical', '20% of shots deal double damage'] };
  /* starter */
  gun('g_pop', 'Pop Pistol', 'starter', [12, 320, 40, 1, 0.02, '#ffffff'], { L: 0.4, B: 0.1, body: '#ffffff', trim: '#0b0b0f' }, [[0.08, 0.08, 0.04, '#ff2d55', 0, 0.06, 0.34, 'g']]);
  /* common: plain, honest guns */
  gun('g_pistol', 'Service Pistol', 'common', [15, 300, 42, 1, 0.03, '#d8d8e0'], { L: 0.42, B: 0.12, body: '#4a4f5c', trim: '#c8ccd6' });
  gun('g_revolver', 'Six Shooter', 'common', [28, 560, 48, 1, 0.025, '#e8c39a'], { L: 0.36, B: 0.26, th: 0.2, body: '#7a5a3a', trim: '#c9a46a', barrel: '#3a3a44' }, [[0.2, 0.2, 0.16, '#3a3a44', 0, 0.04, 0.2]]);
  gun('g_smg', 'Mini SMG', 'common', [7, 110, 36, 1, 0.06, '#ffe14a'], { L: 0.5, B: 0.14, body: '#2f3340', trim: '#ffc61a' }, [[0.1, 0.3, 0.1, '#1d1d24', 0, -0.2, 0.26]]);
  /* uncommon */
  gun('g_carbine', 'Carbine', 'uncommon', [10, 160, 50, 1, 0.03, '#7ad8ff'], { L: 0.7, B: 0.2, body: '#2f4a6a', trim: '#7ad8ff' }, [[0.12, 0.12, 0.2, '#1d1d24', 0, 0.0, -0.12]]);
  gun('g_pump', 'Pump Shotgun', 'uncommon', [9, 800, 28, 6, 0.2, '#ff9f1c'], { L: 0.7, B: 0.3, th: 0.2, bw: 0.14, body: '#5a3b24', trim: '#ff9f1c', barrel: '#2a2733' }, [[0.22, 0.16, 0.2, '#8a5a34', 0, -0.03, 0.4]]);
  gun('g_heavy', 'Heavy Pistol', 'uncommon', [34, 520, 50, 1, 0.02, '#c9b6ff'], { L: 0.5, B: 0.2, th: 0.22, body: '#3a3050', trim: '#c9b6ff' });
  /* rare */
  gun('g_rifle', 'Assault Rifle', 'rare', [11, 140, 56, 1, 0.025, '#6fe35a'], { L: 0.85, B: 0.25, body: '#35502f', trim: '#6fe35a' }, [[0.1, 0.3, 0.12, '#1d1d24', 0, -0.2, 0.34], [0.14, 0.14, 0.2, '#1d1d24', 0, 0.0, -0.14]]);
  gun('g_tac', 'Tactical SMG', 'rare', [7, 85, 40, 1, 0.05, '#ff4b3e'], { L: 0.55, B: 0.2, body: '#1d1d24', trim: '#ff4b3e' }, [[0.1, 0.34, 0.1, '#2a2733', 0, -0.22, 0.28], [0.07, 0.07, 0.2, '#ff4b3e', 0, 0.2, 0.3]]);
  gun('g_marks', 'Marksman Rifle', 'rare', [38, 480, 70, 1, 0.01, '#b8e0ff'], { L: 0.95, B: 0.3, th: 0.16, body: '#3a4658', trim: '#b8e0ff' }, [[0.08, 0.08, 0.32, '#0b0b0f', 0, 0.2, 0.46], [0.1, 0.1, 0.1, '#7ad8ff', 0, 0.2, 0.62, 'g']]);
  /* epic */
  gun('g_lmg', 'Light Machine Gun', 'epic', [10, 100, 56, 1, 0.05, '#ffc61a'], { L: 0.95, B: 0.3, th: 0.24, body: '#3b3b2a', trim: '#ffc61a' }, [[0.28, 0.24, 0.26, '#1d1d24', 0, -0.12, 0.3], [0.04, 0.2, 0.04, '#ffc61a', 0.1, -0.04, 0.8], [0.04, 0.2, 0.04, '#ffc61a', -0.1, -0.04, 0.8]]);
  gun('g_dbl', 'Double Barrel', 'epic', [13, 900, 30, 8, 0.22, '#ff7a1a'], { L: 0.7, B: 0.34, th: 0.24, bw: 0.1, body: '#6a3b1a', trim: '#ffc61a', barrel: '#1d1d24' }, [[0.1, 0.1, 0.34, '#1d1d24', 0.07, 0.05, 0.78], [0.1, 0.1, 0.34, '#1d1d24', -0.07, 0.05, 0.78]]);
  gun('g_sniper', 'Sniper Rifle', 'epic', [62, 1100, 90, 1, 0.004, '#9bff6a'], { L: 1.2, B: 0.4, th: 0.15, body: '#2a3b2a', trim: '#9bff6a' }, [[0.1, 0.1, 0.4, '#0b0b0f', 0, 0.2, 0.55], [0.12, 0.12, 0.12, '#9bff6a', 0, 0.2, 0.78, 'g']]);
  gun('g_leech', 'Leech SMG', 'epic', [8, 90, 40, 1, 0.045, '#ff2d55'], { L: 0.6, B: 0.18, body: '#3a0b16', trim: '#ff2d55' }, [[0.16, 0.16, 0.12, '#ff2d55', 0, 0.06, 0.22, 'g'], [0.08, 0.3, 0.08, '#1d1d24', 0, -0.22, 0.3]], 'vamp');
  /* legendary */
  gun('g_arc', 'Arc Thrower', 'legendary', [14, 140, 52, 1, 0.03, '#12e0ff'], { L: 0.7, B: 0.3, body: '#14304a', trim: '#12e0ff', barrel: '#12e0ff' }, [[0.22, 0.22, 0.1, '#12e0ff', 0, 0.05, 0.5, 'g'], [0.06, 0.06, 0.06, '#ffffff', 0.15, 0.2, 0.7, 'o'], [0.06, 0.06, 0.06, '#7af0ff', -0.15, 0.1, 0.9, 'o']], 'chain');
  gun('g_auto', 'Battle Rifle', 'legendary', [14, 125, 60, 1, 0.02, '#e0b030'], { L: 0.9, B: 0.3, body: '#4a3b1a', trim: '#e0b030' }, [[0.1, 0.3, 0.12, '#1d1d24', 0, -0.2, 0.36], [0.08, 0.08, 0.3, '#e0b030', 0, 0.17, 0.5]]);
  gun('g_combat', 'Combat Shotgun', 'legendary', [10, 540, 30, 7, 0.18, '#ff4b3e'], { L: 0.85, B: 0.3, th: 0.22, bw: 0.13, body: '#2a2733', trim: '#ff4b3e' }, [[0.2, 0.2, 0.3, '#1d1d24', 0, -0.05, 0.5]]);
  gun('g_warden', 'Warden Revolver', 'legendary', [40, 440, 56, 1, 0.012, '#fff6d0'], { L: 0.4, B: 0.34, th: 0.2, body: '#e0b030', trim: '#fff6d0', barrel: '#fff6d0' }, [[0.22, 0.22, 0.18, '#fff6d0', 0, 0.04, 0.22, 'g']], 'crit');
  /* mythic */
  gun('g_inferno', 'Inferno Rifle', 'mythic', [12, 110, 56, 1, 0.025, '#ff7a1a'], { L: 0.9, B: 0.3, body: '#4a1a0b', trim: '#ff7a1a', barrel: '#ffc61a' }, [[0.2, 0.2, 0.12, '#ff5a1a', 0, 0.05, 0.55, 'f'], [0.08, 0.08, 0.08, '#ffd60a', 0.12, 0.25, 0.7, 'o']], 'burn');
  gun('g_hyper', 'Hyper SMG', 'mythic', [9, 62, 42, 1, 0.05, '#a06bff'], { L: 0.6, B: 0.2, body: '#2a1a4a', trim: '#a06bff' }, [[0.1, 0.34, 0.1, '#1d1d24', 0, -0.22, 0.3], [0.2, 0.2, 0.08, '#a06bff', 0, 0.05, 0.4, 'g']]);
  gun('g_gilded', 'Gilded Revolver', 'mythic', [46, 380, 58, 1, 0.01, '#ffd60a'], { L: 0.4, B: 0.4, th: 0.22, body: '#ffd60a', trim: '#ffffff', barrel: '#ffc61a' }, [[0.24, 0.24, 0.2, '#ffc61a', 0, 0.04, 0.24, 'g'], [0.06, 0.06, 0.06, '#ffffff', 0.1, 0.28, 0.3, 'o']], 'crit');
  /* celestial */
  gun('g_rail', 'Rail Piercer', 'celestial', [50, 330, 90, 1, 0.004, '#7af0ff'], { L: 1.0, B: 0.5, th: 0.16, body: '#e8f4ff', trim: '#7af0ff', barrel: '#7af0ff' }, [[0.22, 0.22, 0.06, '#7af0ff', 0, 0.05, 0.6, 'g'], [0.22, 0.22, 0.06, '#7af0ff', 0, 0.05, 0.85, 'g']], 'pierce');
  gun('g_havoc', 'Havoc Minigun', 'celestial', [9, 55, 48, 1, 0.07, '#fff2a8'], { L: 0.8, B: 0.5, th: 0.28, bw: 0.22, body: '#2a2733', trim: '#fff2a8', barrel: '#fff2a8' }, [[0.3, 0.3, 0.1, '#fff2a8', 0, 0.05, 0.9, 's'], [0.3, 0.26, 0.3, '#1d1d24', 0, -0.16, 0.3]]);
  /* cosmic */
  gun('g_nova', 'Nova Cannon', 'cosmic', [46, 290, 70, 1, 0.01, 'rainbow'], { L: 0.9, B: 0.4, th: 0.26, bw: 0.2, body: '#14102a', trim: '#ffffff', barrel: '#a06bff' }, [[0.3, 0.3, 0.3, '#ffffff', 0, 0.05, 1.2, 'r'], [0.1, 0.1, 0.1, '#ffffff', 0.4, 0.3, 0.6, 'o']], 'splash');
  gun('g_oblit', 'Obliterator', 'cosmic', [12, 650, 36, 7, 0.16, 'rainbow'], { L: 0.9, B: 0.4, th: 0.3, bw: 0.24, body: '#1d1d24', trim: '#ff2d55', barrel: '#ff2d55' }, [[0.34, 0.34, 0.3, '#ff2d55', 0, 0.05, 1.1, 'r'], [0.1, 0.1, 0.1, '#ffd60a', 0.4, 0.2, 0.6, 'o']], 'splash');
  gun('g_judge', 'Judgement', 'cosmic', [74, 700, 100, 1, 0.003, 'rainbow'], { L: 1.3, B: 0.6, th: 0.18, body: '#0b0b0f', trim: '#ffffff', barrel: '#ffffff' }, [[0.12, 0.12, 0.5, '#ffffff', 0, 0.22, 0.6, 'r'], [0.24, 0.24, 0.08, '#ffffff', 0, 0.05, 1.0, 'r'], [0.08, 0.08, 0.08, '#ffffff', 0.35, 0.3, 0.7, 'o']], 'pierce');

  /* aim, by rarity. assist: how wide a cone (radians) the game helps you aim in (weak, and only for the weakest guns), pull: how much of the turn it does for you,
     lock: how hard it pulls once you are already aimed right at someone (better guns lock harder), jit: random wobble on every shot (radians). */
  const AIM = { starter: { assist: 0.16, pull: 0.30, lock: 0.35, jit: 0.080 }, common: { assist: 0.12, pull: 0.25, lock: 0.40, jit: 0.090 }, uncommon: { assist: 0.08, pull: 0.20, lock: 0.50, jit: 0.055 },
    rare: { assist: 0, pull: 0, lock: 0.60, jit: 0.033 }, epic: { assist: 0, pull: 0, lock: 0.70, jit: 0.020 }, legendary: { assist: 0, pull: 0, lock: 0.78, jit: 0.011 }, mythic: { assist: 0, pull: 0, lock: 0.85, jit: 0.006 },
    celestial: { assist: 0, pull: 0, lock: 0.90, jit: 0.003 }, cosmic: { assist: 0, pull: 0, lock: 0.95, jit: 0 } };
  defs.forEach(d => { Object.assign(d, AIM[d.rarity] || AIM.common); d.abName = d.ab ? AB[d.ab][0] : ''; d.abText = d.ab ? AB[d.ab][1] : ''; });
  const BY = {}; defs.forEach(d => { BY[d.id] = d; });
  /* default health; armour adds to it (see armor.js) */
  root.FOUND_GUNS = Object.freeze({ LIST: defs, BY, AB, HP: 150, START: 'g_pop' });
})(globalThis);
