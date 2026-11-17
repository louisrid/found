/* FOUND auras: glowing effects that follow a player. Each aura is a list of parts the client draws (world.js):
   ring (a glowing circle on the floor), orbit (cubes circling), sparks (cubes rising and fading), flame (flickering tongues), halo (a ring over the head), bolts (flashing lightning).
   Shop rows are in catalog.js (slot 'aura'). 'rb' as a colour means it cycles through the rainbow. */
(function (root) {
  'use strict';
  const RB = ['#ff2d55', '#ff8a00', '#ffe14a', '#2fd84a', '#12e0ff', '#a06bff', '#ff4bd8'];
  const LIST = [
    { id: 'au_glow', name: 'Soft Glow', rarity: 'common', parts: [{ k: 'ring', r: 2.2, c: '#ffffff' }] },
    { id: 'au_mint', name: 'Mint Ring', rarity: 'common', parts: [{ k: 'ring', r: 2.4, c: '#5dffb0' }, { k: 'sparks', n: 5, c: ['#b6ffd9'] }] },
    { id: 'au_bubbles', name: 'Bubbles', rarity: 'uncommon', parts: [{ k: 'sparks', n: 12, c: ['#bfeaff', '#ffffff', '#7ad8ff'], size: 0.3, rise: 5.5, r: 1.9 }, { k: 'ring', r: 2.0, c: '#7ad8ff' }] },
    { id: 'au_hearts', name: 'Hearts', rarity: 'uncommon', parts: [{ k: 'sparks', n: 10, c: ['#ff4b8a', '#ff8ad8', '#ffb3c7'], size: 0.34, rise: 5, r: 1.7 }, { k: 'ring', r: 2.2, c: '#ff8ad8' }] },
    { id: 'au_embers', name: 'Embers', rarity: 'rare', parts: [{ k: 'ring', r: 2.2, c: '#ff7a1a' }, { k: 'sparks', n: 16, c: ['#ffb01a', '#ff5a1a', '#ffe14a'], size: 0.22, rise: 6, r: 1.6 }] },
    { id: 'au_frost', name: 'Frost', rarity: 'rare', parts: [{ k: 'ring', r: 2.4, c: '#bff4ff' }, { k: 'sparks', n: 16, c: ['#ffffff', '#7af0ff'], size: 0.2, rise: 4.5, r: 2.2 }, { k: 'orbit', n: 4, r: 2.3, y: 0.6, c: ['#ffffff'], size: 0.26, speed: 1.1 }] },
    { id: 'au_toxic', name: 'Toxic Cloud', rarity: 'rare', parts: [{ k: 'ring', r: 2.5, c: '#7dff5a' }, { k: 'sparks', n: 14, c: ['#7dff5a', '#c6ff3d', '#2f9d2a'], size: 0.34, rise: 3.2, r: 1.8 }] },
    { id: 'au_storm', name: 'Storm', rarity: 'epic', parts: [{ k: 'ring', r: 2.5, c: '#ffe14a' }, { k: 'bolts', n: 5, r: 2.0, c: '#fff6a8' }, { k: 'orbit', n: 3, r: 2.5, y: 4.4, c: ['#cfd6e6'], size: 0.5, speed: 1.6 }] },
    { id: 'au_neon', name: 'Neon Pulse', rarity: 'epic', parts: [{ k: 'ring', r: 2.2, c: '#12e0ff' }, { k: 'ring', r: 3.1, c: '#ff4bd8', pulse: 1.4 }, { k: 'orbit', n: 6, r: 2.7, y: 1.6, c: ['#12e0ff', '#ff4bd8'], size: 0.3, speed: 1.8 }] },
    { id: 'au_inferno', name: 'Inferno', rarity: 'legendary', parts: [{ k: 'ring', r: 2.5, c: '#ff3b30' }, { k: 'flame', n: 12, r: 1.9, c: ['#ff3b30', '#ff8a00', '#ffe14a'] }, { k: 'sparks', n: 14, c: ['#ffe14a', '#ff8a00'], size: 0.24, rise: 7, r: 1.4 }] },
    { id: 'au_aurora', name: 'Aurora', rarity: 'legendary', parts: [{ k: 'ring', r: 2.6, c: 'rb' }, { k: 'sparks', n: 18, c: ['#7af0ff', '#7dff5a', '#ff7ad9'], size: 0.26, rise: 7, r: 2.1 }, { k: 'orbit', n: 5, r: 2.9, y: 2.4, c: ['#7af0ff', '#7dff5a', '#ff7ad9'], size: 0.3, speed: 1.2 }] },
    { id: 'au_void', name: 'Void', rarity: 'mythic', parts: [{ k: 'ring', r: 2.6, c: '#a06bff' }, { k: 'ring', r: 1.5, c: '#0b0b0f', pulse: 1.2 }, { k: 'orbit', n: 8, r: 2.6, y: 2.0, c: ['#0b0b0f', '#a06bff'], size: 0.4, speed: 2.2 }, { k: 'sparks', n: 12, c: ['#a06bff', '#ff4bd8'], size: 0.24, rise: 6, r: 2.3 }] },
    { id: 'au_angelic', name: 'Angelic', rarity: 'celestial', parts: [{ k: 'ring', r: 2.8, c: '#fff2a8' }, { k: 'halo', y: 5.3, r: 1.0, c: '#ffe14a' }, { k: 'sparks', n: 20, c: ['#ffffff', '#fff2a8', '#7af0ff'], size: 0.24, rise: 8, r: 2.2 }, { k: 'orbit', n: 6, r: 3.0, y: 2.6, c: ['#ffffff', '#ffe14a'], size: 0.34, speed: 1.0 }] },
    { id: 'au_galaxy', name: 'Galaxy', rarity: 'cosmic', parts: [{ k: 'ring', r: 2.6, c: 'rb' }, { k: 'ring', r: 3.6, c: 'rb', pulse: 1.6 }, { k: 'orbit', n: 10, r: 3.1, y: 2.2, c: RB, size: 0.34, speed: 2.0 }, { k: 'orbit', n: 6, r: 1.9, y: 3.6, c: RB, size: 0.26, speed: -2.6 }, { k: 'sparks', n: 24, c: RB, size: 0.26, rise: 8, r: 2.6 }, { k: 'halo', y: 5.3, r: 1.0, c: 'rb' }] }
  ];
  const BY = {}; LIST.forEach(a => { BY[a.id] = a; });
  root.FOUND_AURAS = Object.freeze({ LIST, BY, RB });
})(globalThis);
