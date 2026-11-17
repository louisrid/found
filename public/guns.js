/* FOUND guns: stats (server and client) and chunky voxel models (client).
   A model is a list of voxel boxes [w, h, d, colour, x, y, z, flag] in gun space: the grip is at the origin and the barrel points along +z.
   Flags: 'g' glows, 'r' cycles through the rainbow, 'n' has no outline. Stats: dmg per pellet, ms between shots, range, pellets, spread (radians).
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
  gun('g_ketchup', 'Ketchup Squirt', 'common', [11, 260, 40, 1, 0.03, '#ff3b30'], { L: 0.46, B: 0.26, bw: 0.07, th: 0.22, body: '#ff3b30', trim: '#ffffff', barrel: '#ffd23f' },
    [[0.12, 0.1, 0.12, '#ffd23f', 0, 0.2, 0.05], [0.07, 0.07, 0.1, '#ff3b30', 0, 0.05, 0.62, 'g']]);
  gun('g_slime', 'Slime Squirter', 'common', [13, 300, 40, 1, 0.04, '#b35cff'], { L: 0.5, B: 0.16, th: 0.22, body: '#b35cff', trim: '#7dff5a' },
    [[0.1, 0.3, 0.1, '#7dff5a', 0.11, -0.05, 0.28, 'g'], [0.1, 0.2, 0.1, '#7dff5a', -0.11, 0.0, 0.1, 'g'], [0.14, 0.08, 0.14, '#7dff5a', 0, -0.08, 0.5, 'g']]);

  /* uncommon */
  gun('g_zap', 'Zap SMG', 'uncommon', [8, 95, 40, 1, 0.05, '#ffe14a'], { L: 0.6, B: 0.18, th: 0.2, body: '#2f7bff', trim: '#ffe14a', barrel: '#0b0b0f' },
    [[0.1, 0.3, 0.1, '#0b0b0f', 0, -0.2, 0.3], [0.04, 0.12, 0.3, '#ffe14a', 0.11, 0.08, 0.3, 'g'], [0.04, 0.12, 0.3, '#ffe14a', -0.11, 0.08, 0.3, 'g'], [0.1, 0.1, 0.1, '#ffe14a', 0, 0.05, 0.92, 'g']]);
  gun('g_bubble', 'Bubble Blaster', 'uncommon', [7, 420, 30, 3, 0.16, '#7ad8ff'], { L: 0.45, B: 0.16, bw: 0.2, th: 0.24, body: '#ff7ad9', trim: '#ffffff', barrel: '#7ad8ff' },
    [[0.12, 0.12, 0.12, '#bfeaff', 0.1, 0.22, 0.72, 'g'], [0.09, 0.09, 0.09, '#ffffff', -0.1, 0.3, 0.62, 'g'], [0.14, 0.14, 0.14, '#bfeaff', -0.02, 0.4, 0.8, 'g']]);
  gun('g_banana', 'Banana Blaster', 'uncommon', [22, 380, 46, 1, 0.02, '#ffe14a'], { L: 0.5, B: 0.2, th: 0.2, body: '#ffe14a', trim: '#ffcf1a', barrel: '#7a4a1e' },
    [[0.16, 0.16, 0.18, '#ffe14a', 0, 0.1, -0.12], [0.12, 0.12, 0.14, '#7a4a1e', 0, 0.2, -0.2], [0.14, 0.1, 0.2, '#ffcf1a', 0, 0.0, 0.52], [0.08, 0.08, 0.06, '#7a4a1e', 0, 0.05, 0.84]]);

  /* rare */
  gun('g_taco', 'Taco Cannon', 'rare', [40, 780, 46, 1, 0.03, '#ffa11a'], { L: 0.55, B: 0.2, bw: 0.2, th: 0.3, body: '#ffc24a', trim: '#e8962a', barrel: '#ffc24a' },
    [[0.28, 0.08, 0.5, '#4fe35a', 0, 0.2, 0.2], [0.12, 0.1, 0.12, '#ff3b30', 0.06, 0.27, 0.12], [0.12, 0.1, 0.12, '#ff3b30', -0.06, 0.27, 0.3], [0.2, 0.2, 0.06, '#ff7a1a', 0, 0.05, 0.69, 'g']]);
  gun('g_lava', 'Lava Laser', 'rare', [14, 140, 50, 1, 0.02, '#ff5a1a'], { L: 0.62, B: 0.2, th: 0.2, body: '#2a2733', trim: '#ff7a1a', barrel: '#ff7a1a' },
    [[0.12, 0.12, 0.4, '#ff5a1a', 0, 0.17, 0.3, 'g'], [0.1, 0.1, 0.1, '#ffd23f', 0, 0.2, 0.18, 'g'], [0.1, 0.1, 0.1, '#ffd23f', 0, 0.2, 0.42, 'g'], [0.22, 0.04, 0.12, '#0b0b0f', 0, 0.12, 0.6]]);
  gun('g_pizza', 'Pizza Piercer', 'rare', [28, 420, 56, 1, 0.015, '#ff4a3a'], { L: 0.6, B: 0.34, bw: 0.06, th: 0.14, body: '#ffd84a', trim: '#e8a64a', barrel: '#c98a2e' },
    [[0.3, 0.06, 0.34, '#ffd84a', 0, 0.14, 0.12], [0.3, 0.07, 0.07, '#e8a64a', 0, 0.14, -0.06], [0.07, 0.08, 0.07, '#d6322a', 0.07, 0.19, 0.14], [0.07, 0.08, 0.07, '#d6322a', -0.07, 0.19, 0.24], [0.07, 0.08, 0.07, '#d6322a', 0.0, 0.19, 0.06]]);

  /* epic */
  gun('g_rail', 'Rainbow Railgun', 'epic', [75, 1200, 90, 1, 0.005, 'rainbow'], { L: 0.8, B: 0.3, th: 0.2, body: '#f4f4ff', trim: '#b8b8ff', barrel: '#ffffff' },
    [[0.06, 0.06, 0.8, '#ffffff', 0.12, 0.05, 0.5, 'r'], [0.06, 0.06, 0.8, '#ffffff', -0.12, 0.05, 0.5, 'r'], [0.3, 0.3, 0.06, '#ffffff', 0, 0.05, 0.3, 'r'], [0.28, 0.28, 0.06, '#ffffff', 0, 0.05, 0.6, 'r'], [0.12, 0.12, 0.12, '#ffffff', 0, 0.05, 1.05, 'g']]);
  gun('g_cactus', 'Cactus Shotgun', 'epic', [11, 800, 30, 6, 0.26, '#9bff6a'], { L: 0.55, B: 0.3, bw: 0.14, th: 0.24, body: '#2fb84a', trim: '#1f8a2e', barrel: '#2fb84a' },
    [[0.1, 0.26, 0.1, '#2fb84a', 0.18, 0.2, 0.2], [0.1, 0.08, 0.1, '#2fb84a', 0.13, 0.12, 0.2], [0.1, 0.2, 0.1, '#2fb84a', -0.18, 0.16, 0.34], [0.1, 0.08, 0.1, '#2fb84a', -0.13, 0.1, 0.34], [0.12, 0.12, 0.12, '#ff7ad9', 0, 0.26, 0.3, 'g'],
      [0.03, 0.03, 0.03, '#ffffff', 0.13, 0.22, 0.6], [0.03, 0.03, 0.03, '#ffffff', -0.13, 0.1, 0.52]]);
  gun('g_disco', 'Disco Minigun', 'epic', [7, 65, 44, 1, 0.08, 'rainbow'], { L: 0.55, B: 0.4, bw: 0.08, th: 0.26, body: '#1a1a20', trim: '#ffffff', barrel: '#8a8a99' },
    [[0.08, 0.08, 0.4, '#8a8a99', 0.1, 0.0, 0.7], [0.08, 0.08, 0.4, '#8a8a99', -0.1, 0.0, 0.7], [0.08, 0.08, 0.4, '#8a8a99', 0, 0.12, 0.7], [0.2, 0.2, 0.2, '#ffffff', 0, 0.3, 0.2, 'r'], [0.07, 0.07, 0.07, '#ffffff', 0.12, 0.34, 0.2, 'g'], [0.07, 0.07, 0.07, '#ffffff', -0.12, 0.26, 0.2, 'g']]);

  /* legendary */
  gun('g_dragon', 'Dragon Breath', 'legendary', [7, 220, 26, 4, 0.2, '#ff7a1a'], { L: 0.55, B: 0.26, bw: 0.18, th: 0.26, body: '#ff3b30', trim: '#ffe14a', barrel: '#d62a22' },
    [[0.06, 0.18, 0.06, '#ffe14a', 0.08, 0.26, 0.4], [0.06, 0.18, 0.06, '#ffe14a', -0.08, 0.26, 0.4], [0.06, 0.06, 0.06, '#ffffff', 0.14, 0.14, 0.62, 'g'], [0.06, 0.06, 0.06, '#ffffff', -0.14, 0.14, 0.62, 'g'],
      [0.04, 0.26, 0.3, '#ff7a1a', 0.17, 0.2, 0.0], [0.04, 0.26, 0.3, '#ff7a1a', -0.17, 0.2, 0.0], [0.16, 0.16, 0.12, '#ffb01a', 0, 0.05, 0.9, 'g'], [0.1, 0.1, 0.1, '#ffffff', 0, 0.05, 1.0, 'g']]);
  gun('g_galaxy', 'Galaxy Cannon', 'legendary', [52, 520, 70, 1, 0.01, '#a06bff'], { L: 0.6, B: 0.3, bw: 0.16, th: 0.26, body: '#2a1b5e', trim: '#a06bff', barrel: '#1a1040' },
    [[0.05, 0.05, 0.05, '#ffffff', 0.12, 0.15, 0.2, 'g'], [0.05, 0.05, 0.05, '#7ad8ff', -0.12, 0.1, 0.4, 'g'], [0.05, 0.05, 0.05, '#ffffff', 0.12, -0.02, 0.5, 'g'], [0.05, 0.05, 0.05, '#ff7ad9', -0.12, 0.2, 0.1, 'g'],
      [0.34, 0.04, 0.34, '#ffffff', 0, 0.05, 0.3, 'r'], [0.12, 0.12, 0.12, '#a06bff', 0, 0.05, 1.0, 'g']]);

  /* mythic */
  gun('g_duck', 'Rubber Duck Doomsday', 'mythic', [30, 400, 60, 2, 0.06, '#ffe14a'], { L: 0.5, B: 0.22, bw: 0.14, th: 0.3, body: '#ffe14a', trim: '#ffcf1a', barrel: '#ff8a00' },
    [[0.24, 0.2, 0.24, '#ffe14a', 0, 0.28, 0.1], [0.07, 0.07, 0.06, '#0b0b0f', 0.1, 0.34, 0.24], [0.07, 0.07, 0.06, '#0b0b0f', -0.1, 0.34, 0.24], [0.26, 0.05, 0.08, '#0b0b0f', 0, 0.36, 0.26], [0.12, 0.06, 0.12, '#ff8a00', 0, 0.2, 0.72],
      [0.34, 0.04, 0.34, '#ffffff', 0, 0.56, 0.1, 'r'], [0.18, 0.18, 0.06, '#ff8a00', 0, 0.05, 0.64, 'g']]);
  gun('g_cosmic', 'Cosmic Chaos Cannon', 'mythic', [16, 300, 60, 3, 0.14, 'rainbow'], { L: 0.7, B: 0.3, bw: 0.18, th: 0.28, body: '#ffffff', trim: '#ffffff', barrel: '#ffffff' },
    [[0.28, 0.28, 0.5, '#ffffff', 0, 0.04, 0.3, 'r'], [0.12, 0.34, 0.12, '#ffffff', 0, 0.28, 0.1, 'g'], [0.1, 0.24, 0.1, '#7ad8ff', 0.18, 0.2, 0.4, 'g'], [0.1, 0.24, 0.1, '#ff7ad9', -0.18, 0.2, 0.5, 'g'], [0.1, 0.18, 0.1, '#ffe14a', 0.12, -0.12, 0.6, 'g'],
      [0.22, 0.22, 0.2, '#ffffff', 0, 0.05, 1.0, 'r'], [0.12, 0.12, 0.12, '#ffffff', 0, 0.05, 1.12, 'g']]);

  const BY = {}; defs.forEach(d => { BY[d.id] = d; });
  root.FOUND_GUNS = Object.freeze({ LIST: defs, BY, HP: 100, START: 'g_pop' });
})(globalThis);
