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
  const gun = (id, name, rarity, st, o, extra) => defs.push({ id, name, rarity, dmg: st[0], ms: st[1], range: st[2], pellets: st[3] || 1, spread: st[4] || 0.02, col: st[5], mz: mzOf(o), spec: base(o).concat(extra || []) });

  /* starter and common */
  gun('g_pop', 'Pop Pistol', 'starter', [14, 340, 42, 1, 0.02, '#ffffff'], { L: 0.4, B: 0.1, body: '#ffffff', trim: '#0b0b0f' }, [[0.08, 0.08, 0.04, '#ff2d55', 0, 0.06, 0.34, 'g']]);
  gun('g_pea', 'Pea Shooter', 'common', [7, 150, 38, 1, 0.03, '#6fe35a'], { L: 0.5, B: 0.22, th: 0.2, body: '#6fe35a', trim: '#1f8a2e' },
    [[0.14, 0.1, 0.3, '#2fb84a', 0, 0.17, 0.22], [0.08, 0.08, 0.08, '#c8ff8a', 0, 0.26, 0.12], [0.08, 0.08, 0.08, '#c8ff8a', 0, 0.26, 0.24], [0.08, 0.08, 0.08, '#c8ff8a', 0, 0.26, 0.36]]);
  gun('g_water', 'Water Pistol', 'common', [6, 120, 36, 1, 0.05, '#7af0ff'], { L: 0.42, B: 0.14, body: '#2f9bff', trim: '#ffffff', barrel: '#7af0ff' },
    [[0.2, 0.26, 0.2, '#bfeaff', 0, 0.24, 0.1], [0.1, 0.1, 0.1, '#2f9bff', 0, 0.4, 0.1], [0.05, 0.09, 0.05, '#7af0ff', 0, 0.0, 0.52, 'g']]);
  gun('g_ketchup', 'Ketchup Squirt', 'common', [11, 260, 40, 1, 0.03, '#ff3b30'], { L: 0.46, B: 0.26, bw: 0.07, th: 0.22, body: '#ff3b30', trim: '#ffffff', barrel: '#ffd23f' },
    [[0.12, 0.1, 0.12, '#ffd23f', 0, 0.2, 0.05], [0.07, 0.07, 0.1, '#ff3b30', 0, 0.05, 0.62, 'g']]);
  gun('g_slime', 'Slime Squirter', 'common', [13, 300, 40, 1, 0.04, '#b35cff'], { L: 0.5, B: 0.16, th: 0.22, body: '#b35cff', trim: '#7dff5a' },
    [[0.1, 0.3, 0.1, '#7dff5a', 0.11, -0.05, 0.28, 'g'], [0.1, 0.2, 0.1, '#7dff5a', -0.11, 0.0, 0.1, 'g'], [0.14, 0.08, 0.14, '#7dff5a', 0, -0.08, 0.5, 'g']]);

  /* uncommon */
  gun('g_zap', 'Zap SMG', 'uncommon', [8, 95, 40, 1, 0.05, '#ffe14a'], { L: 0.6, B: 0.18, th: 0.2, body: '#2f7bff', trim: '#ffe14a', barrel: '#0b0b0f' },
    [[0.1, 0.3, 0.1, '#0b0b0f', 0, -0.2, 0.3], [0.04, 0.12, 0.3, '#ffe14a', 0.11, 0.08, 0.3, 'g'], [0.04, 0.12, 0.3, '#ffe14a', -0.11, 0.08, 0.3, 'g'], [0.1, 0.1, 0.1, '#ffe14a', 0, 0.05, 0.92, 'g']]);
  gun('g_bubble', 'Bubble Blaster', 'uncommon', [9, 420, 30, 3, 0.16, '#7ad8ff'], { L: 0.45, B: 0.16, bw: 0.2, th: 0.24, body: '#ff7ad9', trim: '#ffffff', barrel: '#7ad8ff' },
    [[0.12, 0.12, 0.12, '#bfeaff', 0.1, 0.22, 0.72, 'g'], [0.09, 0.09, 0.09, '#ffffff', -0.1, 0.3, 0.62, 'g'], [0.14, 0.14, 0.14, '#bfeaff', -0.02, 0.4, 0.8, 'g']]);
  gun('g_banana', 'Banana Blaster', 'uncommon', [26, 380, 46, 1, 0.02, '#ffe14a'], { L: 0.5, B: 0.2, th: 0.2, body: '#ffe14a', trim: '#ffcf1a', barrel: '#7a4a1e' },
    [[0.16, 0.16, 0.18, '#ffe14a', 0, 0.1, -0.12], [0.12, 0.12, 0.14, '#7a4a1e', 0, 0.2, -0.2], [0.14, 0.1, 0.2, '#ffcf1a', 0, 0.0, 0.52], [0.08, 0.08, 0.06, '#7a4a1e', 0, 0.05, 0.84]]);

  /* rare */
  gun('g_taco', 'Taco Cannon', 'rare', [62, 780, 46, 1, 0.03, '#ffa11a'], { L: 0.55, B: 0.2, bw: 0.2, th: 0.3, body: '#ffc24a', trim: '#e8962a', barrel: '#ffc24a' },
    [[0.28, 0.08, 0.5, '#4fe35a', 0, 0.2, 0.2], [0.12, 0.1, 0.12, '#ff3b30', 0.06, 0.27, 0.12], [0.12, 0.1, 0.12, '#ff3b30', -0.06, 0.27, 0.3], [0.2, 0.2, 0.06, '#ff7a1a', 0, 0.05, 0.69, 'g']]);
  gun('g_lava', 'Lava Laser', 'rare', [14, 140, 50, 1, 0.02, '#ff5a1a'], { L: 0.62, B: 0.2, th: 0.2, body: '#2a2733', trim: '#ff7a1a', barrel: '#ff7a1a' },
    [[0.12, 0.12, 0.4, '#ff5a1a', 0, 0.17, 0.3, 'g'], [0.1, 0.1, 0.1, '#ffd23f', 0, 0.2, 0.18, 'g'], [0.1, 0.1, 0.1, '#ffd23f', 0, 0.2, 0.42, 'g'], [0.22, 0.04, 0.12, '#0b0b0f', 0, 0.12, 0.6]]);
  gun('g_pizza', 'Pizza Piercer', 'rare', [36, 420, 56, 1, 0.015, '#ff4a3a'], { L: 0.6, B: 0.34, bw: 0.06, th: 0.14, body: '#ffd84a', trim: '#e8a64a', barrel: '#c98a2e' },
    [[0.3, 0.06, 0.34, '#ffd84a', 0, 0.14, 0.12], [0.3, 0.07, 0.07, '#e8a64a', 0, 0.14, -0.06], [0.07, 0.08, 0.07, '#d6322a', 0.07, 0.19, 0.14], [0.07, 0.08, 0.07, '#d6322a', -0.07, 0.19, 0.24], [0.07, 0.08, 0.07, '#d6322a', 0.0, 0.19, 0.06]]);

  /* epic */
  gun('g_rail', 'Rainbow Railgun', 'epic', [100, 1000, 90, 1, 0.005, 'rainbow'], { L: 0.8, B: 0.3, th: 0.2, body: '#f4f4ff', trim: '#b8b8ff', barrel: '#ffffff' },
    [[0.06, 0.06, 0.8, '#ffffff', 0.12, 0.05, 0.5, 'r'], [0.06, 0.06, 0.8, '#ffffff', -0.12, 0.05, 0.5, 'r'], [0.3, 0.3, 0.06, '#ffffff', 0, 0.05, 0.3, 'r'], [0.28, 0.28, 0.06, '#ffffff', 0, 0.05, 0.6, 'r'], [0.12, 0.12, 0.12, '#ffffff', 0, 0.05, 1.05, 'g']]);
  gun('g_cactus', 'Cactus Shotgun', 'epic', [14, 800, 30, 6, 0.26, '#9bff6a'], { L: 0.55, B: 0.3, bw: 0.14, th: 0.24, body: '#2fb84a', trim: '#1f8a2e', barrel: '#2fb84a' },
    [[0.1, 0.26, 0.1, '#2fb84a', 0.18, 0.2, 0.2], [0.1, 0.08, 0.1, '#2fb84a', 0.13, 0.12, 0.2], [0.1, 0.2, 0.1, '#2fb84a', -0.18, 0.16, 0.34], [0.1, 0.08, 0.1, '#2fb84a', -0.13, 0.1, 0.34], [0.12, 0.12, 0.12, '#ff7ad9', 0, 0.26, 0.3, 'g'],
      [0.03, 0.03, 0.03, '#ffffff', 0.13, 0.22, 0.6], [0.03, 0.03, 0.03, '#ffffff', -0.13, 0.1, 0.52]]);
  gun('g_disco', 'Disco Minigun', 'epic', [7, 65, 44, 1, 0.08, 'rainbow'], { L: 0.55, B: 0.4, bw: 0.08, th: 0.26, body: '#1a1a20', trim: '#ffffff', barrel: '#8a8a99' },
    [[0.08, 0.08, 0.4, '#8a8a99', 0.1, 0.0, 0.7, 's'], [0.08, 0.08, 0.4, '#8a8a99', -0.1, 0.0, 0.7, 's'], [0.08, 0.08, 0.4, '#8a8a99', 0, 0.12, 0.7, 's'], [0.2, 0.2, 0.2, '#ffffff', 0, 0.3, 0.2, 'r'], [0.07, 0.07, 0.07, '#ffffff', 0.12, 0.34, 0.2, 'g'], [0.07, 0.07, 0.07, '#ffffff', -0.12, 0.26, 0.2, 'g']]);

  /* legendary */
  gun('g_dragon', 'Dragon Breath', 'legendary', [9, 220, 26, 4, 0.2, '#ff7a1a'], { L: 0.55, B: 0.26, bw: 0.18, th: 0.26, body: '#ff3b30', trim: '#ffe14a', barrel: '#d62a22' },
    [[0.06, 0.18, 0.06, '#ffe14a', 0.08, 0.26, 0.4], [0.06, 0.18, 0.06, '#ffe14a', -0.08, 0.26, 0.4], [0.06, 0.06, 0.06, '#ffffff', 0.14, 0.14, 0.62, 'g'], [0.06, 0.06, 0.06, '#ffffff', -0.14, 0.14, 0.62, 'g'],
      [0.04, 0.26, 0.3, '#ff7a1a', 0.17, 0.2, 0.0], [0.04, 0.26, 0.3, '#ff7a1a', -0.17, 0.2, 0.0], [0.16, 0.16, 0.12, '#ffb01a', 0, 0.05, 0.9, 'g'], [0.1, 0.1, 0.1, '#ffffff', 0, 0.05, 1.0, 'g']]);
  gun('g_galaxy', 'Galaxy Cannon', 'legendary', [85, 550, 70, 1, 0.01, '#a06bff'], { L: 0.6, B: 0.3, bw: 0.16, th: 0.26, body: '#2a1b5e', trim: '#a06bff', barrel: '#1a1040' },
    [[0.05, 0.05, 0.05, '#ffffff', 0.12, 0.15, 0.2, 'g'], [0.05, 0.05, 0.05, '#7ad8ff', -0.12, 0.1, 0.4, 'g'], [0.05, 0.05, 0.05, '#ffffff', 0.12, -0.02, 0.5, 'g'], [0.05, 0.05, 0.05, '#ff7ad9', -0.12, 0.2, 0.1, 'g'],
      [0.34, 0.04, 0.34, '#ffffff', 0, 0.05, 0.3, 'r'], [0.12, 0.12, 0.12, '#a06bff', 0, 0.05, 1.0, 'g']]);

  /* mythic */
  gun('g_duck', 'Rubber Duck Doomsday', 'mythic', [45, 400, 60, 2, 0.06, '#ffe14a'], { L: 0.5, B: 0.22, bw: 0.14, th: 0.3, body: '#ffe14a', trim: '#ffcf1a', barrel: '#ff8a00' },
    [[0.24, 0.2, 0.24, '#ffe14a', 0, 0.28, 0.1], [0.07, 0.07, 0.06, '#0b0b0f', 0.1, 0.34, 0.24], [0.07, 0.07, 0.06, '#0b0b0f', -0.1, 0.34, 0.24], [0.26, 0.05, 0.08, '#0b0b0f', 0, 0.36, 0.26], [0.12, 0.06, 0.12, '#ff8a00', 0, 0.2, 0.72],
      [0.34, 0.04, 0.34, '#ffffff', 0, 0.56, 0.1, 'r'], [0.18, 0.18, 0.06, '#ff8a00', 0, 0.05, 0.64, 'g']]);
  gun('g_cosmic', 'Cosmic Chaos Cannon', 'mythic', [22, 300, 60, 3, 0.14, 'rainbow'], { L: 0.7, B: 0.3, bw: 0.18, th: 0.28, body: '#ffffff', trim: '#ffffff', barrel: '#ffffff' },
    [[0.28, 0.28, 0.5, '#ffffff', 0, 0.04, 0.3, 'r'], [0.12, 0.34, 0.12, '#ffffff', 0, 0.28, 0.1, 'g'], [0.1, 0.24, 0.1, '#7ad8ff', 0.18, 0.2, 0.4, 'g'], [0.1, 0.24, 0.1, '#ff7ad9', -0.18, 0.2, 0.5, 'g'], [0.1, 0.18, 0.1, '#ffe14a', 0.12, -0.12, 0.6, 'g'],
      [0.22, 0.22, 0.2, '#ffffff', 0, 0.05, 1.0, 'r'], [0.12, 0.12, 0.12, '#ffffff', 0, 0.05, 1.12, 'g']]);

  /* more guns: s = spins round the barrel, o = orbits the gun, f = flickers */
  gun('g_confetti', 'Confetti Cannon', 'uncommon', [6, 300, 24, 4, 0.3, '#ff4bd8'], { L: 0.4, B: 0.22, bw: 0.22, th: 0.22, body: '#7a3cff', trim: '#ffe14a', barrel: '#ff4bd8' },
    [[0.28, 0.28, 0.06, '#ffe14a', 0, 0.05, 0.64], [0.06, 0.06, 0.06, '#ff4bd8', 0.2, 0.05, 0.74, 's'], [0.06, 0.06, 0.06, '#7af0ff', -0.2, 0.05, 0.74, 's'], [0.06, 0.06, 0.06, '#7dff5a', 0, 0.25, 0.74, 's'], [0.06, 0.06, 0.06, '#ffe14a', 0, -0.15, 0.74, 's']]);
  gun('g_sonic', 'Sonic Boom Box', 'rare', [11, 330, 36, 3, 0.1, '#12e0ff'], { L: 0.5, B: 0.18, bw: 0.2, th: 0.3, body: '#2a2733', trim: '#12e0ff', barrel: '#2a2733' },
    [[0.18, 0.18, 0.04, '#12e0ff', 0.09, 0.06, 0.4, 'f'], [0.18, 0.18, 0.04, '#12e0ff', -0.09, 0.06, 0.4, 'f'], [0.04, 0.3, 0.04, '#8a8a99', 0.1, 0.34, 0.1], [0.3, 0.05, 0.2, '#2a2733', 0, 0.22, 0.2], [0.2, 0.2, 0.06, '#12e0ff', 0, 0.05, 0.62, 'g']]);
  gun('g_thunder', 'Thunder Cannon', 'epic', [22, 700, 40, 4, 0.1, '#ffe14a'], { L: 0.55, B: 0.3, bw: 0.14, th: 0.24, body: '#2a2733', trim: '#ffe14a', barrel: '#8a8a99' },
    [[0.28, 0.28, 0.05, '#ffe14a', 0, 0.05, 0.5, 'f'], [0.26, 0.26, 0.05, '#ffe14a', 0, 0.05, 0.66, 'f'], [0.06, 0.22, 0.05, '#ffe14a', 0.14, 0.2, 0.3, 'g'], [0.06, 0.22, 0.05, '#ffe14a', -0.14, 0.22, 0.1, 'g'], [0.12, 0.12, 0.12, '#ffffff', 0, 0.05, 0.98, 'g']]);
  gun('g_kraken', 'Kraken Launcher', 'legendary', [12, 380, 36, 5, 0.22, '#a06bff'], { L: 0.55, B: 0.2, bw: 0.2, th: 0.26, body: '#7a3cff', trim: '#ff4bd8', barrel: '#5a2da8' },
    [[0.1, 0.1, 0.36, '#a06bff', 0.17, 0.05, 0.62, 's'], [0.1, 0.1, 0.36, '#a06bff', -0.17, 0.05, 0.62, 's'], [0.1, 0.1, 0.36, '#a06bff', 0, 0.22, 0.62, 's'], [0.1, 0.1, 0.36, '#a06bff', 0, -0.12, 0.62, 's'],
      [0.08, 0.08, 0.08, '#ffffff', 0.1, 0.24, 0.3, 'g'], [0.08, 0.08, 0.08, '#ffffff', -0.1, 0.24, 0.3, 'g'], [0.05, 0.05, 0.05, '#0b0b0f', 0.1, 0.24, 0.35], [0.05, 0.05, 0.05, '#0b0b0f', -0.1, 0.24, 0.35]]);
  gun('g_unicorn', 'Unicorn Blaster', 'mythic', [18, 300, 56, 4, 0.12, 'rainbow'], { L: 0.6, B: 0.12, th: 0.24, body: '#ffffff', trim: '#ff8ad8', barrel: '#ffffff' },
    [[0.1, 0.26, 0.4, '#ffffff', 0, 0.28, 0.0, 'r'], [0.1, 0.18, 0.1, '#ffffff', 0, 0.2, 0.46, 'r'], [0.16, 0.16, 0.3, '#ffffff', 0, 0.05, 0.84, 'r'], [0.1, 0.1, 0.3, '#ffffff', 0, 0.05, 1.12, 'r'], [0.06, 0.06, 0.2, '#ffffff', 0, 0.05, 1.34, 'g'],
      [0.1, 0.1, 0.1, '#ff2d55', 0.16, 0.1, 0.2, 'g'], [0.08, 0.08, 0.08, '#ffffff', -0.2, 0.3, 0.5, 'o'], [0.08, 0.08, 0.08, '#ffe14a', 0.24, 0.24, 0.3, 'o']]);
  /* celestial */
  gun('g_halo', 'Halo Rifle', 'celestial', [55, 200, 80, 1, 0.005, '#fff2a8'], { L: 0.85, B: 0.3, bw: 0.1, th: 0.18, body: '#ffffff', trim: '#ffe14a', barrel: '#fff2a8' },
    [[0.06, 0.06, 0.7, '#ffe14a', 0.1, 0.05, 0.4, 'g'], [0.06, 0.06, 0.7, '#ffe14a', -0.1, 0.05, 0.4, 'g'], [0.1, 0.1, 0.1, '#ffffff', 0, 0.24, 0.4], [0.07, 0.07, 0.07, '#ffe14a', 0.24, 0.05, 1.1, 's'], [0.07, 0.07, 0.07, '#ffe14a', -0.24, 0.05, 1.1, 's'], [0.07, 0.07, 0.07, '#ffe14a', 0, 0.29, 1.1, 's'], [0.07, 0.07, 0.07, '#ffe14a', 0, -0.19, 1.1, 's'],
      [0.05, 0.05, 0.05, '#ffffff', 0.17, 0.22, 1.1, 's'], [0.05, 0.05, 0.05, '#ffffff', -0.17, -0.12, 1.1, 's']]);
  gun('g_sunburst', 'Sunburst Cannon', 'celestial', [16, 350, 44, 6, 0.3, '#ffe14a'], { L: 0.55, B: 0.2, bw: 0.18, th: 0.28, body: '#ffc61a', trim: '#ffffff', barrel: '#ffe14a' },
    [[0.1, 0.34, 0.06, '#fff2a8', 0, 0.05, 0.88, 's'], [0.34, 0.1, 0.06, '#fff2a8', 0, 0.05, 0.88, 's'], [0.1, 0.1, 0.06, '#ffffff', 0.2, 0.2, 0.88, 's'], [0.1, 0.1, 0.06, '#ffffff', -0.2, -0.1, 0.88, 's'], [0.2, 0.2, 0.12, '#ffffff', 0, 0.05, 0.84, 'f'], [0.1, 0.3, 0.1, '#ff8a00', 0, 0.3, 0.2, 'g']]);
  /* cosmic */
  gun('g_blackhole', 'Singularity Gun', 'cosmic', [170, 500, 90, 1, 0.004, 'rainbow'], { L: 0.7, B: 0.3, bw: 0.16, th: 0.26, body: '#0b0b0f', trim: '#a06bff', barrel: '#1a1040' },
    [[0.3, 0.3, 0.3, '#0b0b0f', 0, 0.05, 1.05], [0.08, 0.08, 0.08, '#ff4bd8', 0.3, 0.05, 1.05, 's'], [0.08, 0.08, 0.08, '#12e0ff', -0.3, 0.05, 1.05, 's'], [0.08, 0.08, 0.08, '#ffe14a', 0, 0.35, 1.05, 's'], [0.08, 0.08, 0.08, '#7dff5a', 0, -0.25, 1.05, 's'],
      [0.06, 0.06, 0.06, '#ffffff', 0.21, 0.26, 1.05, 's'], [0.06, 0.06, 0.06, '#a06bff', -0.21, -0.16, 1.05, 's'], [0.3, 0.04, 0.5, '#a06bff', 0, 0.24, 0.3, 'g'], [0.34, 0.34, 0.04, '#a06bff', 0, 0.05, 0.9, 'g']]);
  gun('g_bigbang', 'Big Bang Blaster', 'cosmic', [16, 400, 64, 9, 0.34, 'rainbow'], { L: 0.7, B: 0.3, bw: 0.2, th: 0.3, body: '#ffffff', trim: '#ffffff', barrel: '#ffffff' },
    [[0.3, 0.3, 0.5, '#ffffff', 0, 0.04, 0.3, 'r'], [0.2, 0.34, 0.2, '#ffffff', 0, 0.28, 0.1, 'r'], [0.34, 0.34, 0.1, '#ffffff', 0, 0.05, 1.0, 'r'], [0.1, 0.1, 0.1, '#ff2d55', 0.26, 0.05, 1.14, 's'], [0.1, 0.1, 0.1, '#ffe14a', -0.26, 0.05, 1.14, 's'], [0.1, 0.1, 0.1, '#2fd84a', 0, 0.31, 1.14, 's'], [0.1, 0.1, 0.1, '#2f7bff', 0, -0.21, 1.14, 's'],
      [0.22, 0.22, 0.22, '#ffffff', 0, 0.05, 1.18, 'f'], [0.08, 0.08, 0.08, '#ffffff', 0.4, 0.3, 0.4, 'o'], [0.08, 0.08, 0.08, '#7af0ff', -0.4, 0.2, 0.6, 'o'], [0.08, 0.08, 0.08, '#ff7ad9', 0.1, 0.45, 0.2, 'o']]);

  /* aim, by rarity. assist: how wide a cone (radians) the game helps you aim in, pull: how much of the turn it does for you, jit: random wobble on every shot (radians).
     Only the weakest guns get any help, and a gentle one; the better the gun the truer it shoots. */
  const AIM = { starter: { assist: 0.30, pull: 0.5, jit: 0.090 }, common: { assist: 0.25, pull: 0.4, jit: 0.100 }, uncommon: { assist: 0.18, pull: 0.3, jit: 0.060 },
    rare: { assist: 0, pull: 0, jit: 0.035 }, epic: { assist: 0, pull: 0, jit: 0.022 }, legendary: { assist: 0, pull: 0, jit: 0.012 }, mythic: { assist: 0, pull: 0, jit: 0.006 }, celestial: { assist: 0, pull: 0, jit: 0.003 }, cosmic: { assist: 0, pull: 0, jit: 0 } };
  defs.forEach(d => Object.assign(d, AIM[d.rarity] || AIM.common));
  const BY = {}; defs.forEach(d => { BY[d.id] = d; });
  root.FOUND_GUNS = Object.freeze({ LIST: defs, BY, HP: 100, START: 'g_pop' });
})(globalThis);
