/* FOUND maps, shared by the server (hiding spots, spawns, colliders for move checks) and the browser (what to build).
   Two maps: the LOBBY (an open lawn with the ready ring) and the HOUSE (a cutaway house
   with low walls inside a fenced garden, so every room can be seen from above).
   Units: a player is about 3.3 tall. Furniture rot is in quarter turns; at rot 0 the front faces +z.
   A local offset (x, z) at rotation a lands at (x cos a + z sin a, -x sin a + z cos a), matching three.js rotation.y. */
(function (root) {
  'use strict';
  const WALL_H = 2.4, WALL_T = 0.5, FENCE_H = 1.4;
  /* furniture types: footprint w x d at rot 0, height h, solid for collisions, spots [dx, surfaceY, dz, sneak 0-2] */
  const T = {
    sofa: { w: 6, d: 2.4, h: 1.9, spots: [[-1.6, 0.95, 0.3, 1], [1.6, 0.95, 0.3, 1], [0.6, 0.02, -1.7, 2]] },
    coffeetable: { w: 3.2, d: 1.8, h: 0.9, spots: [[-0.8, 0.9, 0, 0], [0.9, 0.9, 0.2, 0], [0, 0.02, 0, 2]] },
    tvstand: { w: 5, d: 1.2, h: 1.0, spots: [[-2, 1.0, 0.1, 0], [2, 1.0, 0.1, 1]] },
    bookshelf: { w: 3, d: 1, h: 2.6, spots: [[-0.7, 0.92, 0.1, 1], [0.7, 1.72, 0.1, 1], [0.6, 0.12, 0.1, 1], [0, 2.6, 0, 2]] },
    armchair: { w: 2.4, d: 2.4, h: 1.6, spots: [[0, 0.8, 0.25, 1]] },
    sidetable: { w: 1.4, d: 1.4, h: 1.1, spots: [[0, 1.1, 0, 0]] },
    plant: { w: 1.3, d: 1.3, h: 2.8, spots: [[0.25, 1.0, 0.25, 2]] },
    lamp: { w: 1, d: 1, h: 3, spots: [[0.3, 0.12, 0.3, 1]] },
    bed: { w: 5, d: 7, h: 1.1, spots: [[1.2, 1.1, -2.3, 1], [-1.3, 1.1, 2.4, 0], [2.65, 0.02, 1.0, 2], [-2.65, 0.02, -1.4, 2]] },
    nightstand: { w: 1.5, d: 1.3, h: 1.2, spots: [[0, 1.2, 0, 0]] },
    wardrobe: { w: 4, d: 1.6, h: 3.4, spots: [[1, 3.4, 0, 2], [-1.2, 0.02, 1.1, 1]] },
    desk: { w: 4, d: 2, h: 1.3, spots: [[-1.2, 1.3, 0, 0], [1.2, 1.3, 0.2, 0], [0.2, 0.02, -0.2, 2]] },
    chair: { w: 1.5, d: 1.5, h: 0.9, spots: [[0, 0.9, 0.1, 1]] },
    dresser: { w: 3.2, d: 1.3, h: 1.5, spots: [[-1, 1.5, 0, 0], [1, 1.5, 0, 1]] },
    toybox: { w: 2.2, d: 1.5, h: 1.0, spots: [[0, 0.7, 0, 1]] },
    beanbag: { w: 2.2, d: 2.2, h: 1.0, spots: [[0, 0.95, 0, 1]] },
    kidtable: { w: 2.4, d: 2.4, h: 0.9, spots: [[0, 0.9, 0, 0], [0.5, 0.02, 0.5, 2]] },
    stool: { w: 1, d: 1, h: 0.6, spots: [[0, 0.6, 0, 1]] },
    counter6: { w: 6, d: 2, h: 1.5, spots: [[-2, 1.5, 0, 0], [0.4, 1.5, 0.3, 1], [2.2, 1.5, 0, 0]] },
    counter3: { w: 3, d: 2, h: 1.5, spots: [[0.6, 1.5, 0, 0]] },
    stove: { w: 2, d: 2, h: 1.5, spots: [[0.4, 1.5, 0.3, 0]] },
    fridge: { w: 2.2, d: 2.2, h: 3.8, spots: [[0.3, 3.8, 0, 2], [0.9, 0.02, 1.3, 1]] },
    island: { w: 5, d: 2.4, h: 1.5, spots: [[-1.6, 1.5, 0, 0], [1.6, 1.5, 0.3, 0], [0, 0.02, 1.45, 2]] },
    diningtable: { w: 5, d: 3, h: 1.3, spots: [[-1.5, 1.3, 0, 0], [1.5, 1.3, 0.4, 0], [0, 0.02, 0, 2]] },
    bin: { w: 1.1, d: 1.1, h: 1.3, spots: [[0, 1.3, 0, 1]] },
    bathtub: { w: 5, d: 2.6, h: 1.2, spots: [[-1.4, 0.45, 0, 1], [1.9, 1.2, 0.95, 0]] },
    toilet: { w: 1.4, d: 2, h: 1.9, spots: [[0, 1.9, -0.75, 0], [0.95, 0.02, 0.5, 2]] },
    vanity: { w: 2.6, d: 1.4, h: 1.5, spots: [[-0.9, 1.5, 0.1, 0], [0.9, 1.5, 0.1, 1]] },
    basket: { w: 1.3, d: 1.3, h: 1.0, spots: [[0, 0.85, 0, 1]] },
    consoletable: { w: 3, d: 1, h: 1.3, spots: [[-0.9, 1.3, 0, 0], [0.9, 1.3, 0, 0], [0, 0.02, 0, 2]] },
    shoerack: { w: 3, d: 1, h: 0.8, spots: [[0.8, 0.8, 0, 1], [-0.8, 0.45, 0.1, 2]] },
    bench: { w: 3.6, d: 1.3, h: 1.0, spots: [[1, 1.0, 0.1, 0], [-0.6, 0.02, 0, 2]] },
    coatstand: { w: 1, d: 1, h: 3.2, spots: [[0.35, 0.02, 0.35, 1]] },
    /* garden */
    tree: { w: 1.4, d: 1.4, h: 7, spots: [[0.95, 0.02, 0.6, 1], [-0.8, 0.02, -0.95, 2]] },
    bush: { w: 2.6, d: 2.2, h: 1.6, spots: [[0, 1.25, 0, 2]] },
    hedge: { w: 8, d: 1.4, h: 1.8, spots: [[-2, 1.5, 0, 2], [2, 0.02, 0.95, 1]] },
    flowerbed: { w: 8, d: 2, h: 0.5, spots: [[-2.5, 0.42, 0, 1], [2.6, 0.42, 0.2, 1], [0, 0.42, -0.2, 2]] },
    pond: { w: 8, d: 5, h: 0.3, spots: [[-2.7, 0.2, 1.3, 1], [2.6, 0.2, -1.2, 1]] },
    trampoline: { w: 5.4, d: 5.4, h: 1.2, spots: [[1.3, 1.2, 1.2, 0], [-1.7, 0.02, 1.7, 2]] },
    workbench: { w: 4, d: 1.4, h: 1.4, spots: [[-1.2, 1.4, 0, 0], [1.2, 1.4, 0.2, 1], [0, 0.02, 0, 2]] },
    veg: { w: 8, d: 4.4, h: 0.6, spots: [[-2.6, 0.5, -1, 1], [0, 0.5, 1.0, 2], [2.6, 0.5, -0.2, 1]] },
    bbq: { w: 1.8, d: 1.4, h: 1.6, spots: [[0.3, 1.6, 0, 0]] },
    blanket: { w: 4.4, d: 4.4, h: 0.05, walk: true, spots: [[-1, 0.06, -1, 0], [1.2, 0.06, 0.8, 0]] },
    doghouse: { w: 2.6, d: 3, h: 2.4, spots: [[0, 0.02, 0.8, 2]] },
    birdbath: { w: 1.2, d: 1.2, h: 1.4, spots: [[0, 1.3, 0, 1]] },
    mailbox: { w: 0.8, d: 0.8, h: 1.9, spots: [[0, 1.9, 0, 1]] },
    wheelbarrow: { w: 1.6, d: 3, h: 1.1, spots: [[0, 0.8, 0.3, 1]] },
    slide: { w: 2, d: 6, h: 3.6, spots: [[0, 3.0, -2.2, 1], [0, 0.02, 3.3, 0]] },
    lounger: { w: 1.8, d: 4, h: 0.8, spots: [[0, 0.8, 1, 0]] },
    parasol: { w: 3, d: 3, h: 1.3, spots: [[0.6, 1.3, 0, 0]] },
    rug: { w: 6, d: 4, h: 0.03, walk: true, spots: [] },
    /* the bigger house */
    fireplace: { w: 5, d: 1.6, h: 3.0, spots: [[-1.7, 2.62, 0.1, 1], [1.7, 2.62, 0.1, 0], [0, 0.32, 0.25, 2]] },
    piano: { w: 5, d: 2.6, h: 2.4, spots: [[1.6, 2.4, -0.5, 1], [-1.2, 0.95, 0.85, 1]] },
    pooltable: { w: 6, d: 3.4, h: 1.3, spots: [[-2.2, 1.36, -1.1, 0], [2.3, 1.36, 1.1, 0], [0, 0.02, 0, 2]] },
    arcade: { w: 1.8, d: 1.4, h: 3.0, spots: [[0, 3.0, -0.1, 2]] },
    pantryshelf: { w: 4, d: 1.2, h: 2.8, spots: [[-1, 1.02, 0.1, 1], [1.1, 1.92, 0.1, 1], [0.8, 0.14, 0.1, 1], [0, 2.8, 0, 2]] },
    crate: { w: 1.4, d: 1.4, h: 1.2, spots: [[0, 1.2, 0, 1]] },
    washer: { w: 1.8, d: 1.8, h: 2.0, spots: [[0, 2.0, 0, 0]] },
    treadmill: { w: 2, d: 4, h: 1.6, spots: [[0, 0.36, 0.7, 1]] },
    rack: { w: 4, d: 1, h: 1.2, spots: [[-1.2, 1.2, 0, 0], [1.3, 0.52, 0.1, 1]] },
    punchbag: { w: 1.4, d: 1.4, h: 3.4, spots: [[0.75, 0.02, 0.6, 1]] },
    ballpit: { w: 4, d: 4, h: 0.8, spots: [[-0.8, 0.72, 0.6, 2], [1.0, 0.72, -0.9, 2]] },
    clock: { w: 1.2, d: 0.9, h: 3.6, spots: [[0, 3.6, 0, 2]] },
    /* clutter: scattered differently every round */
    boxes: { w: 1.8, d: 1.6, h: 1.9, spots: [[0.2, 1.9, 0, 1]] },
    vase: { w: 1, d: 1, h: 1.9, spots: [] },
    speaker: { w: 1.2, d: 1, h: 2.2, spots: [[0, 2.2, 0, 1]] },
    suitcase: { w: 1.6, d: 0.9, h: 1.2, spots: [[0, 1.2, 0, 0]] },
    guitar: { w: 1, d: 0.9, h: 2.4, spots: [] },
    blocks: { w: 1.7, d: 1.7, h: 1.1, spots: [] },
    cushions: { w: 1.6, d: 1.6, h: 0.8, spots: [[0, 0.8, 0, 0]] },
    bookpile: { w: 1, d: 1, h: 0.9, spots: [[0, 0.9, 0, 0]] },
    globe: { w: 1, d: 1, h: 1.9, spots: [] },
    fan: { w: 1, d: 1, h: 2.4, spots: [] },
    rock: { w: 2, d: 1.6, h: 1.1, spots: [[0, 1.1, 0, 1]] },
    logs: { w: 2.4, d: 1.4, h: 1.2, spots: [[0, 1.2, 0, 1]] },
    barrel: { w: 1.2, d: 1.2, h: 1.5, spots: [[0, 1.5, 0, 0]] },
    cone: { w: 0.9, d: 0.9, h: 1.2, spots: [] },
    scarecrow: { w: 1.2, d: 1, h: 3.4, spots: [] },
    sandbox: { w: 4, d: 4, h: 0.4, spots: [[-0.8, 0.3, 0.6, 1], [1, 0.3, -0.9, 1]] }
  };
  /* what may be scattered where */
  const POOL = {
    cosy: ['vase', 'speaker', 'cushions', 'bookpile', 'globe', 'fan', 'guitar', 'plant', 'lamp', 'suitcase', 'sidetable', 'basket'],
    store: ['boxes', 'crate', 'barrel', 'bin', 'vase', 'plant', 'stool', 'basket', 'boxes'],
    play: ['blocks', 'cushions', 'beanbag', 'toybox', 'stool', 'bookpile', 'guitar', 'blocks'],
    wash: ['basket', 'plant', 'vase', 'stool'],
    gym: ['boxes', 'speaker', 'fan', 'cone', 'barrel', 'suitcase'],
    hall: ['vase', 'plant', 'suitcase', 'bookpile'],
    out: ['rock', 'logs', 'barrel', 'cone', 'scarecrow', 'sandbox', 'bush', 'tree', 'bench', 'birdbath', 'wheelbarrow', 'rock', 'bush']
  };
  const poolOf = id => /^(hall|corr)/.test(id) ? 'hall' : /kitchen|dining|pantry|den|laundry/.test(id) ? 'store' : /kids|play/.test(id) ? 'play' : /bath|ensuite/.test(id) ? 'wash' : /gym/.test(id) ? 'gym' : 'cosy';
  /* small things that may shift a little each round */
  const LOOSE = new Set(['plant', 'lamp', 'sidetable', 'basket', 'crate', 'bin', 'stool', 'beanbag', 'toybox', 'coatstand', 'armchair']);
  const FIXED_OUT = new Set(['flowerbed', 'hedge', 'workbench', 'mailbox']);
  const mulberry = a => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rot = (x, z, r) => { const a = r * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)); return [x * c + z * s, -x * s + z * c]; };

  /* ---------------- the maps: three houses of three sizes, each in its own fenced garden ---------------- */
  /* rooms: id, x0, x1, z0, z1, name, floor [kind, colour a, colour b], wall colour. z0 is the back (north), z1 the front.
     walls: [axis, fixed, from, to, door gaps]; 'x' runs along x at z = fixed, 'z' runs along z at x = fixed.
     furn: [room, type, x, z, rot, extra]; x, z are measured from the room's north-west corner ('out' = garden, absolute).
     lawn: extra hiding spots on the grass [x, z, sneak]. half: the house is a square from -half to +half. */
  const DEFS = {
    /* SMALL: a log cabin, four rooms. 1v1 and practice. */
    cabin: { name: 'Cabin', size: 'Small', half: 14, out: '#c0661c', center: [0, 7], fence: { x0: -24, x1: 24, z0: -24, z1: 26, gate: [-3, 3] },
      rooms: [
        ['main', -14, 14, 0, 14, 'Living room', ['planks', '#e0862f', '#b05f14'], '#ffe1b0'],
        ['bed', -14, 0, -14, 0, 'Bedroom', ['carpet', '#ff2d55', '#ff2d55'], '#ffe0e6'],
        ['bath', 0, 14, -14, -5, 'Bathroom', ['tiles', '#35c8ff', '#12a5e0'], '#e0f6ff'],
        ['den', 0, 14, -5, 0, 'Pantry', ['tiles', '#ff5a36', '#d93d1c'], '#ffd2a8']
      ],
      walls: [['x', 14, -14, 14, [[-2.5, 2.5]]], ['x', -14, -14, 14, []], ['z', -14, -14, 14, []], ['z', 14, -14, 14, []],
        ['x', 0, -14, 14, [[-9, -5.5], [5, 8.5]]], ['z', 0, -14, 0, [[-11, -8]]], ['x', -5, 0, 14, [[9, 12.5]]]],
      furn: [
        ['main', 'tvstand', 6, 13.1, 2], ['main', 'sofa', 6, 6.4, 0, { c: '#7a3cff', c2: '#9a66ff' }], ['main', 'coffeetable', 6, 9.8, 0], ['main', 'rug', 6, 10, 0, { w: 8, d: 6, c: '#ff2d55', b: '#ffffff' }],
        ['main', 'armchair', 1.6, 10.2, 1, { c: '#00c26e' }], ['main', 'fireplace', 0.9, 3.6, 1], ['main', 'bookshelf', 11, 0.6, 0], ['main', 'lamp', 1.2, 13, 0],
        ['main', 'fridge', 26.6, 12.4, 3], ['main', 'counter6', 26.9, 7.6, 3], ['main', 'counter3', 26.9, 2.6, 3], ['main', 'diningtable', 21, 8, 0],
        ['main', 'chair', 19.5, 5.4, 0], ['main', 'chair', 22.5, 5.4, 0], ['main', 'chair', 19.5, 10.6, 2], ['main', 'chair', 22.5, 10.6, 2], ['main', 'plant', 10.4, 13, 0], ['main', 'plant', 17.6, 13, 0],
        ['main', 'rug', 14, 7, 0, { w: 5, d: 5, c: '#ffcc00', b: '#7a3a12' }],
        ['bed', 'bed', 4, 4.2, 0, { c: '#2f5bff', p: '#ffffff' }], ['bed', 'nightstand', 7.3, 1.1, 0], ['bed', 'wardrobe', 13, 9.4, 3], ['bed', 'dresser', 2.8, 13.2, 2], ['bed', 'desk', 10.6, 13, 2], ['bed', 'chair', 10.6, 10.2, 0],
        ['bed', 'rug', 7, 8.4, 0, { w: 6, d: 4, c: '#ffffff', b: '#2f5bff' }],
        ['bath', 'bathtub', 7, 1.4, 0], ['bath', 'toilet', 13, 5, 3], ['bath', 'vanity', 3.6, 8.2, 2], ['bath', 'basket', 1.3, 1.3, 0], ['bath', 'rug', 7, 5, 0, { w: 4, d: 2.6, c: '#ff8ad8', b: '#ffffff' }],
        ['den', 'pantryshelf', 4, 0.7, 0], ['den', 'crate', 13, 1, 0], ['den', 'crate', 13, 4, 0], ['den', 'washer', 1.1, 3.6, 1], ['den', 'basket', 10, 4.2, 0],
        ['out', 'flowerbed', -8.5, 16.4, 0], ['out', 'flowerbed', 8.5, 16.4, 0], ['out', 'tree', -19, 20, 0], ['out', 'tree', 19, 18, 0], ['out', 'tree', -20, -18, 0], ['out', 'tree', 18, -20, 0],
        ['out', 'bush', -9, 22, 0], ['out', 'bush', 10, 21, 0], ['out', 'bush', 20, 0, 0], ['out', 'bush', -20, 2, 0], ['out', 'bench', -18, 10, 1], ['out', 'pond', 0, -19.5, 0],
        ['out', 'mailbox', 6, 24.6, 0], ['out', 'wheelbarrow', 19, -8, 1], ['out', 'bbq', 12, -17, 0], ['out', 'blanket', -10, -19, 0], ['out', 'birdbath', 14, 22, 0]
      ],
      lawn: [[-22, 24, 1], [22, 24, 1], [-22, -22, 2], [22, -22, 1], [0, 19, 0], [-17, -9, 1], [17, 8, 1], [8, -21.5, 1], [-18, 16, 0], [6, 17.5, 0]] },
    /* MEDIUM: a family home, eight rooms off a hall. 3 to 6 players. */
    house: { name: 'House', size: 'Medium', half: 26, out: '#fff7e6', center: [0, 0], fence: { x0: -40, x1: 40, z0: -40, z1: 42, gate: [-3, 3] },
      rooms: [
        ['hall', -4, 4, -26, 26, 'Hallway', ['planks', '#ff9d2e', '#d9740a'], '#fff3d6'],
        ['living', 4, 26, 6, 26, 'Living room', ['planks', '#d9480f', '#a8320a'], '#ffe9a8'],
        ['study', 4, 26, -6, 6, 'Study', ['carpet', '#00c26e', '#00c26e'], '#ffd9a0'],
        ['bath', 4, 14, -26, -6, 'Bathroom', ['tiles', '#2ee6b8', '#14c79b'], '#e2fff7'],
        ['kids', 14, 26, -26, -6, 'Kids room', ['mat', '#ffe600', '#22e06a'], '#ffffff'],
        ['kitchen', -26, -4, 8, 26, 'Kitchen', ['checker', '#ffffff', '#b9c7ea'], '#ffffff'],
        ['dining', -26, -4, -8, 8, 'Dining room', ['planks', '#ffb020', '#e08e00'], '#ffe1b0'],
        ['bedroom', -26, -4, -26, -8, 'Bedroom', ['carpet', '#2f8bff', '#2f8bff'], '#fff0b8']
      ],
      walls: [['x', 26, -26, 26, [[-2.5, 2.5]]], ['x', -26, -26, 26, [[-2, 2]]], ['z', -26, -26, 26, []], ['z', 26, -26, 26, []],
        ['z', -4, -26, 26, [[15, 19], [-2, 2], [-19, -15]]], ['z', 4, -26, 26, [[14, 18], [-2, 2], [-18, -14]]],
        ['x', 8, -26, -4, [[-17, -13]]], ['x', -8, -26, -4, [[-17, -13]]], ['x', 6, 4, 26, [[17, 21]]], ['x', -6, 4, 26, [[7.5, 11], [18, 22]]], ['z', 14, -26, -6, [[-12, -8.5]]]],
      furn: [
        ['living', 'tvstand', 11, 19.1, 2], ['living', 'sofa', 11, 11.5, 0, { c: '#7a3cff', c2: '#9a66ff' }], ['living', 'coffeetable', 11, 15, 0], ['living', 'rug', 11, 14.6, 0, { w: 12, d: 8, c: '#ff2d55', b: '#ffffff' }],
        ['living', 'armchair', 3.5, 14.5, 1, { c: '#00c26e' }], ['living', 'armchair', 18.5, 14.5, 3, { c: '#00c26e' }], ['living', 'fireplace', 21.1, 7, 3], ['living', 'bookshelf', 21.4, 13.4, 3],
        ['living', 'piano', 6, 1.6, 0], ['living', 'plant', 1.4, 18.6, 0], ['living', 'plant', 20.6, 18.6, 0], ['living', 'lamp', 1.5, 1.5, 0], ['living', 'sidetable', 6.6, 11.5, 0], ['living', 'sidetable', 15.4, 11.5, 0],
        ['study', 'desk', 5, 10.9, 2], ['study', 'chair', 5, 8.6, 0], ['study', 'bookshelf', 10.5, 0.6, 0], ['study', 'bookshelf', 21.4, 6, 3], ['study', 'armchair', 18.6, 9.6, 3, { c: '#ff6a2a' }],
        ['study', 'rug', 11, 6, 0, { w: 7, d: 5, c: '#ffcc00', b: '#7a3a12' }], ['study', 'plant', 1.3, 10.7, 0], ['study', 'sidetable', 20.6, 1.2, 0],
        ['bath', 'bathtub', 5, 1.4, 0], ['bath', 'toilet', 9, 6, 3], ['bath', 'vanity', 9.2, 11, 3], ['bath', 'basket', 1.3, 4.5, 0], ['bath', 'washer', 1.1, 15.4, 1], ['bath', 'washer', 1.1, 17.6, 1],
        ['bath', 'rug', 5, 6, 0, { w: 4, d: 2.6, c: '#ff8ad8', b: '#ffffff' }], ['bath', 'plant', 8.8, 18.8, 0],
        ['kids', 'bed', 4, 4.2, 0, { c: '#ff8ad8', p: '#ffffff' }], ['kids', 'nightstand', 7.3, 1.1, 0], ['kids', 'toybox', 11.2, 9.4, 3], ['kids', 'kidtable', 7, 13, 0], ['kids', 'stool', 7, 11, 0], ['kids', 'stool', 9.1, 13, 3],
        ['kids', 'beanbag', 2.6, 10.6, 0, { c: '#16c47f' }], ['kids', 'bookshelf', 11.4, 15.4, 3], ['kids', 'rug', 7, 13, 0, { w: 6, d: 6, c: '#2f8bff', b: '#ffffff' }],
        ['kitchen', 'counter6', 4.5, 17, 2], ['kitchen', 'stove', 8.5, 17, 2], ['kitchen', 'counter6', 12.5, 17, 2], ['kitchen', 'fridge', 1.3, 13, 1], ['kitchen', 'island', 11, 10, 0],
        ['kitchen', 'stool', 9.5, 7.9, 0], ['kitchen', 'stool', 12.5, 7.9, 0], ['kitchen', 'bin', 20.8, 16.9, 0], ['kitchen', 'counter3', 2.5, 1.1, 0], ['kitchen', 'plant', 20.6, 1.4, 0],
        ['kitchen', 'rug', 11, 5, 0, { w: 6, d: 3, c: '#2f5bff', b: '#ffffff' }],
        ['dining', 'diningtable', 11, 8, 0], ['dining', 'chair', 9.5, 5.4, 0], ['dining', 'chair', 12.5, 5.4, 0], ['dining', 'chair', 9.5, 10.6, 2], ['dining', 'chair', 12.5, 10.6, 2], ['dining', 'chair', 7.4, 8, 1], ['dining', 'chair', 14.6, 8, 3],
        ['dining', 'rug', 11, 8, 0, { w: 10, d: 8, c: '#ff2d55', b: '#ffffff' }], ['dining', 'dresser', 4, 15.3, 2], ['dining', 'clock', 18, 1.0, 0], ['dining', 'bookshelf', 0.6, 8, 1], ['dining', 'plant', 1.4, 1.4, 0], ['dining', 'plant', 20.6, 14.6, 0],
        ['bedroom', 'bed', 8, 4.2, 0, { c: '#ff2d55', p: '#ffffff' }], ['bedroom', 'nightstand', 4.2, 1.2, 0], ['bedroom', 'nightstand', 11.8, 1.2, 0], ['bedroom', 'wardrobe', 1, 11, 1], ['bedroom', 'dresser', 17, 17.3, 2],
        ['bedroom', 'desk', 4.5, 17, 2], ['bedroom', 'chair', 4.5, 14.8, 0], ['bedroom', 'armchair', 19.6, 3, 3, { c: '#ffcc00' }], ['bedroom', 'rug', 9, 10, 0, { w: 10, d: 6, c: '#ffffff', b: '#2f5bff' }], ['bedroom', 'lamp', 20.6, 12.6, 0],
        ['hall', 'rug', 4, 39.5, 0, { w: 3.4, d: 21, c: '#ff2d55', b: '#ffffff' }], ['hall', 'rug', 4, 12.5, 0, { w: 3.4, d: 21, c: '#ff2d55', b: '#ffffff' }],
        ['hall', 'consoletable', 7.1, 36, 3], ['hall', 'shoerack', 0.9, 48.6, 1], ['hall', 'coatstand', 1, 37, 0], ['hall', 'plant', 7, 50.6, 0], ['hall', 'bench', 7.1, 3.6, 3], ['hall', 'clock', 0.7, 20, 1], ['hall', 'plant', 1, 1.2, 0],
        ['out', 'flowerbed', -12, 28.6, 0], ['out', 'flowerbed', 12, 28.6, 0], ['out', 'tree', -32, 34, 0], ['out', 'tree', 32, 32, 0], ['out', 'tree', -18, 38, 0], ['out', 'tree', 23, 39, 0], ['out', 'mailbox', 8, 40.6, 0],
        ['out', 'bench', -25, 37, 2], ['out', 'bush', -12, 34, 0], ['out', 'bush', 10, 33, 0], ['out', 'bush', -34, 26, 0], ['out', 'bush', 34, 22, 0], ['out', 'birdbath', 17, 35, 0],
        ['out', 'slide', 34, 6, 0], ['out', 'doghouse', 35, -10, 3], ['out', 'wheelbarrow', -34, 4, 1], ['out', 'veg', -34, -12, 1], ['out', 'tree', 35, -24, 0], ['out', 'tree', -35, 20, 0],
        ['out', 'pond', -14, -34, 0], ['out', 'trampoline', 16, -34, 0], ['out', 'bbq', 6, -29.4, 0], ['out', 'lounger', -3, -31, 1], ['out', 'blanket', -28, -33, 0], ['out', 'tree', 31, -35, 0], ['out', 'tree', -36, -36, 0], ['out', 'hedge', 0, -39, 0]
      ],
      lawn: [[-38, 40, 1], [38, 40, 1], [-38, -38, 2], [38, -38, 1], [-10, 33, 0], [20, 30, 0], [30, -4, 1], [-30, -2, 1], [8, -36.5, 1], [26, -30, 0], [-22, -28.5, 0], [-31, 14, 1], [31, 14, 1], [-5, 30, 0]] },
    /* LARGE: the mansion, seventeen rooms off a + shaped hall. 7 to 12 players. */
    mansion: { name: 'Mansion', size: 'Large', half: 40, out: '#fff7e6', center: [0, 0], fence: { x0: -58, x1: 58, z0: -62, z1: 62, gate: [-3, 3] },
      shed: [-54, -46, -60, -53], patio: [6, -43.7, 26, 7], sideSteps: true,
      rooms: [
    ['hall', -5, 5, -40, 40, 'Hallway', ['planks', '#ff9d2e', '#d9740a'], '#fff3d6'],
    ['corrW', -40, -5, -4, 4, 'Hallway', ['planks', '#ff9d2e', '#d9740a'], '#fff3d6'],
    ['corrE', 5, 40, -4, 4, 'Hallway', ['planks', '#ff9d2e', '#d9740a'], '#fff3d6'],
    ['living', 5, 40, 16, 40, 'Living room', ['planks', '#d9480f', '#a8320a'], '#ffe9a8'],
    ['study', 5, 22, 4, 16, 'Study', ['carpet', '#00c26e', '#00c26e'], '#ffd9a0'],
    ['games', 22, 40, 4, 16, 'Games room', ['carpet', '#3b4cff', '#3b4cff'], '#d7dcff'],
    ['kitchen', -25, -5, 18, 40, 'Kitchen', ['checker', '#ffffff', '#b9c7ea'], '#ffffff'],
    ['dining', -40, -25, 18, 40, 'Dining room', ['planks', '#ffb020', '#e08e00'], '#ffe1b0'],
    ['pantry', -40, -22, 4, 18, 'Pantry', ['tiles', '#ff5a36', '#d93d1c'], '#ffd2a8'],
    ['laundry', -22, -5, 4, 18, 'Laundry', ['tiles', '#35c8ff', '#12a5e0'], '#e0f6ff'],
    ['gym', 5, 40, -16, -4, 'Gym', ['rubber', '#34343f', '#34343f'], '#dfe3ea'],
    ['master', 18, 40, -40, -16, 'Bedroom', ['carpet', '#ff2d55', '#ff2d55'], '#ffe0e6'],
    ['ensuite', 5, 18, -40, -27, 'Ensuite', ['tiles', '#5ce1ff', '#22b8e6'], '#e6fbff'],
    ['closet', 5, 18, -27, -16, 'Closet', ['planks', '#a855f7', '#8b3fe0'], '#f1e3ff'],
    ['kids', -40, -20, -40, -20, 'Kids room', ['carpet', '#2f8bff', '#2f8bff'], '#fff0b8'],
    ['playroom', -40, -20, -20, -4, 'Playroom', ['mat', '#ffe600', '#22e06a'], '#ffffff'],
    ['bath', -20, -5, -40, -26, 'Bathroom', ['tiles', '#2ee6b8', '#14c79b'], '#e2fff7'],
    ['guest', -20, -5, -26, -4, 'Guest room', ['carpet', '#ff8a00', '#ff8a00'], '#ffe8cc']
  ],
      walls: [
    /* outside */ ['x', 40, -40, 40, [[-2.5, 2.5]]], ['x', -40, -40, 40, [[-2, 2]]], ['z', -40, -40, 40, [[-2, 2]]], ['z', 40, -40, 40, [[-2, 2]]],
    /* the + shaped hall */ ['z', -5, 4, 40, [[26, 30], [9, 13]]], ['z', -5, -40, -4, [[-16, -12], [-35, -31]]], ['z', 5, 4, 40, [[26, 30], [8, 12]]], ['z', 5, -40, -4, [[-12, -8], [-22.5, -19]]],
    ['x', 4, -40, -5, [[-34, -30]]], ['x', 4, 5, 40, [[12, 16], [30, 34]]], ['x', -4, -40, -5, [[-32, -28], [-14, -10]]], ['x', -4, 5, 40, [[20, 24], [33, 37]]],
    /* front right: living, study, games */ ['x', 16, 5, 40, [[11.5, 15], [29, 33]]], ['z', 22, 4, 16, [[8, 12]]],
    /* front left: kitchen, dining, pantry, laundry */ ['x', 18, -40, -5, [[-34, -30], [-16, -12]]], ['z', -25, 18, 40, [[22, 36]]], ['z', -22, 4, 18, [[9, 13]]],
    /* back right: gym, bedroom, ensuite, closet */ ['x', -16, 5, 40, [[30, 34]]], ['z', 18, -40, -16, [[-22.5, -19], [-35, -31]]], ['x', -27, 5, 18, [[10, 13.5]]],
    /* back left: kids, playroom, bathroom, guest */ ['z', -20, -40, -4, [[-34, -30], [-14, -10]]], ['x', -20, -40, -20, [[-32, -28]]], ['x', -26, -20, -5, [[-19, -15.5]]],
    /* garden shed, open on its +x side */ ['x', -53, -54, -46, []], ['x', -60, -54, -46, []], ['z', -54, -60, -53, []], ['z', -46, -60, -53, [[-58.3, -54.7]]]
  ],
      furn: [
    ['living', 'tvstand', 17, 23.1, 2], ['living', 'sofa', 17, 14.6, 0, { c: '#7a3cff', c2: '#9a66ff' }], ['living', 'coffeetable', 17, 18.8, 0], ['living', 'rug', 17, 18.4, 0, { w: 12, d: 8, c: '#ff2d55', b: '#ffffff' }],
    ['living', 'armchair', 8.6, 18.6, 1, { c: '#00c26e' }], ['living', 'armchair', 25.4, 18.6, 3, { c: '#00c26e' }], ['living', 'fireplace', 34.1, 12, 3], ['living', 'bookshelf', 34.4, 4, 3], ['living', 'bookshelf', 34.4, 20.5, 3],
    ['living', 'plant', 1.4, 22.6, 0], ['living', 'plant', 32, 22.8, 0], ['living', 'piano', 17, 1.6, 0], ['living', 'lamp', 2.5, 2.5, 0], ['living', 'sidetable', 12.6, 14.6, 0], ['living', 'sidetable', 21.4, 14.6, 0], ['living', 'plant', 2, 7, 0],
    ['study', 'desk', 13.8, 10.9, 2], ['study', 'chair', 13.8, 8.6, 0], ['study', 'bookshelf', 3, 0.6, 0], ['study', 'bookshelf', 14, 0.6, 0], ['study', 'armchair', 3, 10, 1, { c: '#ff6a2a' }],
    ['study', 'plant', 16.2, 2.8, 0], ['study', 'rug', 8.5, 6, 0, { w: 7, d: 5, c: '#ffcc00', b: '#7a3a12' }], ['study', 'sidetable', 5.6, 10.4, 0],
    ['games', 'pooltable', 9, 6.2, 0], ['games', 'arcade', 16.9, 2.2, 3], ['games', 'arcade', 16.9, 4.6, 3, { c: '#ff4b3e' }], ['games', 'arcade', 16.9, 7.0, 3, { c: '#16c47f' }],
    ['games', 'sofa', 14.6, 10.8, 2, { c: '#ff6a2a', c2: '#ff8a52' }], ['games', 'beanbag', 3, 10.4, 0, { c: '#3fa9ff' }], ['games', 'plant', 1.4, 1.4, 0],
    ['kitchen', 'counter6', 4.5, 21, 2], ['kitchen', 'stove', 8.5, 21, 2], ['kitchen', 'counter6', 12.5, 21, 2], ['kitchen', 'counter3', 17, 21, 2], ['kitchen', 'fridge', 18.6, 18.3, 3],
    ['kitchen', 'island', 10, 12.5, 0], ['kitchen', 'stool', 8.5, 10.4, 0], ['kitchen', 'stool', 11.5, 10.4, 0], ['kitchen', 'counter3', 2.5, 1.1, 0], ['kitchen', 'bin', 5.4, 1, 0], ['kitchen', 'plant', 18.6, 1.4, 0],
    ['kitchen', 'rug', 10, 6.5, 0, { w: 6, d: 3, c: '#2f5bff', b: '#ffffff' }],
    ['dining', 'diningtable', 7.5, 12, 1], ['dining', 'chair', 5.0, 10.6, 1], ['dining', 'chair', 5.0, 13.4, 1], ['dining', 'chair', 10.0, 10.6, 3], ['dining', 'chair', 10.0, 13.4, 3], ['dining', 'chair', 7.5, 8.3, 0], ['dining', 'chair', 7.5, 15.7, 2],
    ['dining', 'rug', 7.5, 12, 0, { w: 8, d: 9, c: '#ff2d55', b: '#ffffff' }], ['dining', 'dresser', 7.5, 21.3, 2], ['dining', 'plant', 1.4, 20.6, 0], ['dining', 'plant', 1.4, 1.4, 0], ['dining', 'bookshelf', 0.6, 12, 1], ['dining', 'clock', 13.8, 1.0, 0],
    ['pantry', 'pantryshelf', 0.7, 3.5, 1], ['pantry', 'pantryshelf', 0.7, 10.5, 1], ['pantry', 'pantryshelf', 14, 13.3, 2], ['pantry', 'pantryshelf', 14, 0.7, 0],
    ['pantry', 'crate', 4, 1, 0], ['pantry', 'crate', 4, 12.9, 0], ['pantry', 'crate', 16.6, 11, 0], ['pantry', 'basket', 9, 7, 0],
    ['laundry', 'washer', 2.2, 1.1, 0], ['laundry', 'washer', 4.4, 1.1, 0], ['laundry', 'counter3', 8.2, 1.1, 0], ['laundry', 'basket', 11, 1, 0], ['laundry', 'coatstand', 15.8, 1.2, 0],
    ['laundry', 'shoerack', 2, 13.4, 2], ['laundry', 'basket', 15.8, 12.9, 0], ['laundry', 'bench', 12, 13.2, 2],
    ['gym', 'treadmill', 4, 2.2, 0], ['gym', 'treadmill', 7, 2.2, 0], ['gym', 'rack', 13, 0.6, 0], ['gym', 'bench', 13, 4, 0], ['gym', 'rug', 22, 6, 0, { w: 6, d: 4, c: '#3fa9ff', b: '#ffffff' }],
    ['gym', 'punchbag', 32, 6.5, 0], ['gym', 'plant', 34, 1.2, 0], ['gym', 'bin', 20, 0.8, 0],
    ['master', 'bed', 11, 4.2, 0, { c: '#2f5bff', p: '#ffffff' }], ['master', 'nightstand', 7.2, 1.2, 0], ['master', 'nightstand', 14.8, 1.2, 0], ['master', 'rug', 11, 7.5, 0, { w: 10, d: 8, c: '#fff3d0', b: '#7a3a12' }],
    ['master', 'wardrobe', 21.1, 12, 3], ['master', 'dresser', 5, 23.3, 2], ['master', 'armchair', 20, 21, 3, { c: '#ffcc00' }], ['master', 'plant', 20.6, 1.4, 0], ['master', 'lamp', 2, 13, 0], ['master', 'sidetable', 2.2, 1.4, 0],
    ['ensuite', 'bathtub', 6.5, 1.4, 0], ['ensuite', 'toilet', 0.9, 9, 1], ['ensuite', 'vanity', 11, 12.2, 2], ['ensuite', 'basket', 1.2, 1.4, 0], ['ensuite', 'rug', 6.5, 5, 0, { w: 4, d: 2.6, c: '#2f5bff', b: '#ffffff' }], ['ensuite', 'plant', 12, 1.2, 0],
    ['closet', 'wardrobe', 3, 10.2, 2], ['closet', 'wardrobe', 10, 10.2, 2, { c: '#7a3a12' }], ['closet', 'shoerack', 11, 0.6, 0], ['closet', 'coatstand', 1.2, 1.2, 0], ['closet', 'rug', 6.5, 6.2, 0, { w: 5, d: 3, c: '#ffcc00', b: '#7a3a12' }], ['closet', 'basket', 1.4, 3, 0],
    ['kids', 'bed', 4, 4.2, 0, { c: '#ff8ad8', p: '#ffffff' }], ['kids', 'nightstand', 7.3, 1.1, 0], ['kids', 'toybox', 15, 1.2, 0], ['kids', 'kidtable', 13, 13, 0], ['kids', 'stool', 13, 11, 0], ['kids', 'stool', 15.1, 13, 3],
    ['kids', 'bookshelf', 0.6, 13, 1], ['kids', 'beanbag', 4, 17.6, 0, { c: '#16c47f' }], ['kids', 'rug', 13, 13, 0, { w: 6, d: 6, c: '#ffd60a', b: '#ff4b3e' }], ['kids', 'plant', 18.6, 18.6, 0],
    ['playroom', 'slide', 3, 8, 0], ['playroom', 'ballpit', 15.5, 12.5, 0], ['playroom', 'toybox', 16, 1.2, 0], ['playroom', 'beanbag', 6.5, 14.2, 0, { c: '#9b4dff' }], ['playroom', 'basket', 1.4, 1.4, 0], ['playroom', 'plant', 1.4, 14.6, 0],
    ['bath', 'bathtub', 7.5, 1.4, 0], ['bath', 'toilet', 13.9, 2.5, 3], ['bath', 'vanity', 9, 13.3, 2], ['bath', 'basket', 1.3, 1.3, 0], ['bath', 'rug', 7.5, 6.5, 0, { w: 4, d: 2.6, c: '#ff8ad8', b: '#ffffff' }], ['bath', 'plant', 13.6, 12.6, 0],
    ['guest', 'bed', 9, 4.6, 0, { c: '#00c26e', p: '#ffffff' }], ['guest', 'nightstand', 5.2, 1.2, 0], ['guest', 'nightstand', 12.8, 1.2, 0], ['guest', 'dresser', 14.3, 18, 3], ['guest', 'desk', 1.0, 19, 1], ['guest', 'chair', 3.1, 19, 3],
    ['guest', 'rug', 9, 11, 0, { w: 7, d: 5, c: '#ff6a2a', b: '#ffffff' }], ['guest', 'plant', 14.2, 3, 0],
    ['hall', 'rug', 5, 62, 0, { w: 3.4, d: 32, c: '#ff2d55', b: '#ffffff' }], ['hall', 'rug', 5, 18, 0, { w: 3.4, d: 32, c: '#ff2d55', b: '#ffffff' }],
    ['hall', 'consoletable', 9.1, 59, 3], ['hall', 'shoerack', 0.9, 61, 1], ['hall', 'coatstand', 1, 76.5, 0], ['hall', 'plant', 1.2, 78.6, 0], ['hall', 'plant', 8.8, 78.6, 0],
    ['hall', 'bench', 9, 10, 3], ['hall', 'clock', 9.3, 3, 3], ['hall', 'plant', 1.2, 1.4, 0], ['hall', 'consoletable', 0.9, 30, 1],
    ['corrW', 'consoletable', 18, 7.3, 2], ['corrW', 'plant', 1.4, 7.2, 0], ['corrW', 'plant', 1.4, 0.8, 0], ['corrW', 'sidetable', 20, 0.9, 0],
    ['corrE', 'consoletable', 17, 7.3, 2], ['corrE', 'sidetable', 8, 0.9, 0], ['corrE', 'plant', 33.6, 7.2, 0], ['corrE', 'plant', 23, 0.8, 0],
    /* front garden */
    ['out', 'flowerbed', -14, 42.6, 0], ['out', 'flowerbed', -28, 42.6, 0], ['out', 'flowerbed', 14, 42.6, 0], ['out', 'flowerbed', 28, 42.6, 0],
    ['out', 'tree', -46, 54, 0], ['out', 'tree', 46, 50, 0], ['out', 'tree', -30, 57, 0], ['out', 'tree', 34, 58, 0], ['out', 'mailbox', 9, 60.6, 0], ['out', 'bench', -20, 57, 2], ['out', 'birdbath', 20, 54, 0],
    ['out', 'bush', -9, 57, 0], ['out', 'bush', 11, 50, 0], ['out', 'bush', -38, 47, 0], ['out', 'bush', 40, 45, 0], ['out', 'hedge', -45, 59.6, 0], ['out', 'hedge', 45, 59.6, 0],
    /* sides */
    ['out', 'slide', 50, 12, 0], ['out', 'doghouse', 53, -16, 3], ['out', 'tree', 50, 30, 0], ['out', 'tree', 52, -32, 0], ['out', 'bush', 55, 0, 0], ['out', 'lounger', 50, 22, 1],
    ['out', 'wheelbarrow', -50, 10, 1], ['out', 'veg', -50, -16, 1], ['out', 'tree', -52, 28, 0], ['out', 'bush', -55, 0, 0], ['out', 'bush', -46, 34, 0], ['out', 'birdbath', -48, -30, 0],
    /* back */
    ['out', 'pond', -22, -51, 0], ['out', 'trampoline', 22, -52, 0], ['out', 'bbq', 8, -43.2, 0], ['out', 'parasol', 14, -46.5, 0], ['out', 'lounger', -6, -47, 1], ['out', 'blanket', -34, -49, 0],
    ['out', 'workbench', -50, -59.1, 0], ['out', 'tree', 44, -56, 0], ['out', 'tree', 38, -46, 0], ['out', 'tree', -42, -46, 0], ['out', 'hedge', -8, -61, 0], ['out', 'hedge', 8, -61, 0],
    ['out', 'bush', -30, -60, 0], ['out', 'bush', 50, -46, 0], ['out', 'bush', 0, -55, 0]
  ],
      lawn: [[-55, 59, 1], [55, 59, 1], [-55, -59, 2], [55, -59, 1], [-44, 3, 1], [44, -3, 1], [-12, 50, 0], [24, 47, 0], [-25, 48, 0], [30, -42, 1], [-14, -43, 0], [0, -58, 1],
    [44, 20, 1], [-44, -8, 1], [45, -25, 1], [-47, 22, 1], [-36, -56, 1], [-49.5, -55, 1], [56, 36, 2], [-56, 40, 2], [17, -58, 1], [-20, -58, 1]] }
  };
  const MAP_IDS = ['cabin', 'house', 'mansion'];
  /* Build one map. With a seed, the furniture is rearranged for this round: each room may be mirrored, small pieces
     shift, and clutter is scattered, always clear of doors, spawns and each other. Server and browser run this same
     code with the same seed, so they agree exactly (only +, -, * and rounding are used on random numbers). */
  function buildMap(id, seed) {
    const def = DEFS[id], ROOMS = def.rooms, FENCE = def.fence, SHED = def.shed || null, half = def.half, rnd = seed ? mulberry(seed) : null;
    const RB = {}; ROOMS.forEach(r => { RB[r[0]] = r; });
    const roomOf = (x, z) => { for (const r of ROOMS) if (x >= r[1] && x <= r[2] && z >= r[3] && z <= r[4]) return r; return null; };
    const roomAt = (x, z) => { const r = roomOf(x, z); if (r) return r[5]; if (SHED && x >= SHED[0] && x <= SHED[1] && z >= SHED[2] && z <= SHED[3]) return 'Shed'; return z > half ? 'Front garden' : z < -half ? 'Back garden' : x < 0 ? 'West garden' : 'East garden'; };
    const colliders = [], spots = [];
    const box = (x0, x1, z0, z1, h) => colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), h: h || 9 });
    const segs = [];
    for (const [ax, f, a, b, gaps] of def.walls) {
      let cur = a; const gs = gaps.slice().sort((p, q) => p[0] - q[0]);
      for (const g of gs) { if (g[0] > cur) segs.push([ax, f, cur, g[0]]); cur = g[1]; }
      if (b > cur) segs.push([ax, f, cur, b]);
    }
    const wallBoxes = segs.map(([ax, f, a, b]) => { const t = WALL_T / 2; return ax === 'x' ? { x0: a - t, x1: b + t, z0: f - t, z1: f + t } : { x0: f - t, x1: f + t, z0: a - t, z1: b + t }; });
    for (const w of wallBoxes) box(w.x0, w.x1, w.z0, w.z1, WALL_H);
    const fz = FENCE, ft = 0.2, fsegs = [['x', fz.z1, fz.x0, fz.gate[0]], ['x', fz.z1, fz.gate[1], fz.x1], ['x', fz.z0, fz.x0, fz.x1], ['z', fz.x0, fz.z0, fz.z1], ['z', fz.x1, fz.z0, fz.z1]];
    for (const [ax, f, a, b] of fsegs) { if (ax === 'x') box(a, b, f - ft, f + ft, FENCE_H); else box(f - ft, f + ft, a, b, FENCE_H); }
    /* the pieces, in world coordinates */
    let list = def.furn.map(q => { const R = RB[q[0]]; return { room: q[0], type: q[1], x: R ? R[1] + q[2] : q[2], z: R ? R[3] + q[3] : q[3], r: q[4], extra: q[5] || null }; });
    const fp = it => { const t = T[it.type], w = (it.extra && it.extra.w) || t.w, d = (it.extra && it.extra.d) || t.d, odd = it.r % 2 === 1, ww = odd ? d : w, dd = odd ? w : d; return { x0: it.x - ww / 2, x1: it.x + ww / 2, z0: it.z - dd / 2, z1: it.z + dd / 2 }; };
    const hit = (a, b, m) => a.x0 - (m || 0) < b.x1 && a.x1 + (m || 0) > b.x0 && a.z0 - (m || 0) < b.z1 && a.z1 + (m || 0) > b.z0;
    const solid = it => !T[it.type].walk;
    if (rnd) {
      /* keep clear: both sides of every door, the gate where seekers wait, the front path, the middle where hiders start */
      const keep = [{ x0: -10, x1: 10, z0: fz.z1 - 9, z1: fz.z1 }, { x0: -2.6, x1: 2.6, z0: half, z1: fz.z1 }, { x0: def.center[0] - 4.6, x1: def.center[0] + 4.6, z0: def.center[1] - 4.6, z1: def.center[1] + 4.6 }];
      for (const [ax, f, a, b, gaps] of def.walls) for (const g of gaps) keep.push(ax === 'x' ? { x0: g[0] - 0.3, x1: g[1] + 0.3, z0: f - 2.1, z1: f + 2.1 } : { x0: f - 2.1, x1: f + 2.1, z0: g[0] - 0.3, z1: g[1] + 0.3 });
      const free = (b, m) => !keep.some(k => hit(b, k)) && !wallBoxes.some(w => hit(b, w, m || 0));
      const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
      /* 1. each room may be mirrored left-right, front-back or both, if that keeps every doorway clear */
      for (const R of ROOMS) {
        const mine = list.filter(it => it.room === R[0]); if (!mine.length) continue;
        for (const [mx, mz] of shuffle([[0, 0], [1, 0], [0, 1], [1, 1]])) {
          if (!mx && !mz) break;
          const flip = it => ({ room: it.room, type: it.type, extra: it.extra, x: mx ? R[1] + R[2] - it.x : it.x, z: mz ? R[3] + R[4] - it.z : it.z, r: ((mz ? 2 - (mx ? 4 - it.r : it.r) : (mx ? 4 - it.r : it.r)) % 4 + 4) % 4 });
          const moved = mine.map(flip);
          if (moved.every(it => !solid(it) || !keep.some(k => hit(fp(it), k)))) { mine.forEach((it, i) => { it.x = moved[i].x; it.z = moved[i].z; it.r = moved[i].r; }); break; }
        }
      }
      /* 2. small free-standing pieces shift a little; garden pieces shift more */
      const boxes = () => list.filter(solid).map(it => ({ it, b: fp(it) }));
      for (const it of list) {
        const out = it.room === 'out'; if (!solid(it) || (out ? FIXED_OUT.has(it.type) || (SHED && it.x < SHED[1] + 1 && it.z < SHED[3] + 1) : !LOOSE.has(it.type))) continue;
        const k = out ? 3 : 0.9, nx = Math.round((it.x + (rnd() * 2 - 1) * k) * 10) / 10, nz = Math.round((it.z + (rnd() * 2 - 1) * k) * 10) / 10, was = [it.x, it.z];
        it.x = nx; it.z = nz; const b = fp(it), others = boxes().filter(o => o.it !== it);
        const inside = out ? (b.x0 > fz.x0 + 1.5 && b.x1 < fz.x1 - 1.5 && b.z0 > fz.z0 + 1.5 && b.z1 < fz.z1 - 1.5 && !hit(b, { x0: -half - 1.2, x1: half + 1.2, z0: -half - 1.2, z1: half + 1.2 })) : (b.x0 > RB[it.room][1] + 0.3 && b.x1 < RB[it.room][2] - 0.3 && b.z0 > RB[it.room][3] + 0.3 && b.z1 < RB[it.room][4] - 0.3);
        if (!inside || !free(b, 0.02) || others.some(o => hit(b, o.b, out ? 1.3 : 0.3))) { it.x = was[0]; it.z = was[1]; }
      }
      /* 3. clutter: a few extra things per room and around the garden, with walking room all round */
      const scatter = (pool, n, place) => {
        for (let k = 0; k < n; k++) for (let tries = 0; tries < 24; tries++) {
          const it = Object.assign({ type: pool[Math.floor(rnd() * pool.length)], extra: null }, place()), b = fp(it);
          it.x = Math.round(it.x * 10) / 10; it.z = Math.round(it.z * 10) / 10;
          if (free(fp(it), 0.02) && !boxes().some(o => hit(fp(it), o.b, 1.45))) { list.push(it); break; }
        }
      };
      for (const R of ROOMS) {
        const w = R[2] - R[1], d = R[4] - R[3], hall = /^(hall|corr)/.test(R[0]), n = hall ? (R[0] === 'hall' ? 2 : 1) : Math.max(1, Math.min(6, Math.round(w * d / 60)));
        scatter(POOL[poolOf(R[0])], n, () => {
          const u = rnd(), v = rnd(), side = Math.floor(rnd() * 5), type = null;
          /* mostly against a wall and facing into the room, sometimes out in the open */
          if (side === 0) return { room: R[0], x: R[1] + 1.5 + u * (w - 3), z: R[3] + 1.25, r: 0 };
          if (side === 1) return { room: R[0], x: R[1] + 1.5 + u * (w - 3), z: R[4] - 1.25, r: 2 };
          if (side === 2) return { room: R[0], x: R[1] + 1.25, z: R[3] + 1.5 + v * (d - 3), r: 1 };
          if (side === 3) return { room: R[0], x: R[2] - 1.25, z: R[3] + 1.5 + v * (d - 3), r: 3 };
          return { room: R[0], x: R[1] + 3 + u * Math.max(0, w - 6), z: R[3] + 3 + v * Math.max(0, d - 6), r: Math.floor(rnd() * 4) };
        });
      }
      const yard = { x0: -half - 1.6, x1: half + 1.6, z0: -half - 1.6, z1: half + 1.6 }, lw = fz.x1 - fz.x0 - 6, ld = fz.z1 - fz.z0 - 6;
      for (let k = 0, n = Math.round((lw * ld - 4 * half * half) / 260); k < n; k++) scatter(POOL.out, 1, () => {
        for (let q = 0; q < 20; q++) { const x = fz.x0 + 3 + rnd() * lw, z = fz.z0 + 3 + rnd() * ld; if (!hit({ x0: x - 2.2, x1: x + 2.2, z0: z - 2.2, z1: z + 2.2 }, yard)) return { room: 'out', x, z, r: Math.floor(rnd() * 4) }; }
        return { room: 'out', x: fz.x0 + 4, z: fz.z0 + 4, r: 0 };
      });
    }
    const furn = list.map((it, i) => {
      const { room, type, r, extra } = it, t = T[type], w = (extra && extra.w) || t.w, d = (extra && extra.d) || t.d, odd = r % 2 === 1, ww = odd ? d : w, dd = odd ? w : d;
      let x = it.x, z = it.z;
      /* pieces set against a wall sit flush with its face, not inside it */
      if (!t.walk) for (let k = 0; k < 2; k++) for (const [ax, f, a, b] of segs) {
        const hw = WALL_T / 2, wx0 = ax === 'x' ? a - hw : f - hw, wx1 = ax === 'x' ? b + hw : f + hw, wz0 = ax === 'x' ? f - hw : a - hw, wz1 = ax === 'x' ? f + hw : b + hw;
        const ox = Math.min(x + ww / 2, wx1) - Math.max(x - ww / 2, wx0), oz = Math.min(z + dd / 2, wz1) - Math.max(z - dd / 2, wz0);
        if (ox <= 0.001 || oz <= 0.001) continue;
        if (ax === 'x' && oz < 0.8) z += (z < f ? -1 : 1) * (oz + 0.03); else if (ax === 'z' && ox < 0.8) x += (x < f ? -1 : 1) * (ox + 0.03);
      }
      x = +x.toFixed(3); z = +z.toFixed(3);
      if (!t.walk) {
        if (type === 'tree') box(x - 0.6, x + 0.6, z - 0.6, z + 0.6, t.h);
        else if (type === 'punchbag' || type === 'scarecrow') box(x - 0.5, x + 0.5, z - 0.5, z + 0.5, t.h);
        else if (type === 'doghouse' || type === 'slide') box(x - ww / 2, x + ww / 2, z - dd / 2, z + dd / 2, t.h);
        else box(x - ww / 2 + 0.05, x + ww / 2 - 0.05, z - dd / 2 + 0.05, z + dd / 2 - 0.05, t.h);
      }
      for (const s of t.spots) { const [ox, oz] = rot(s[0], s[2], r); spots.push({ x: +(x + ox).toFixed(2), y: s[1], z: +(z + oz).toFixed(2), sneak: s[3], on: type }); }
      return { i, type, x, z, r, w, d, room, extra: extra || null };
    });
    /* room corners and marked lawn points, where nothing stands */
    const clear = (x, z, r) => colliders.every(c => { const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1)); return (x - cx) ** 2 + (z - cz) ** 2 >= r * r; });
    for (const R of ROOMS) for (const [x, z] of [[R[1] + 1.0, R[3] + 1.0], [R[2] - 1.0, R[3] + 1.0], [R[1] + 1.0, R[4] - 1.0], [R[2] - 1.0, R[4] - 1.0]]) if (clear(x, z, 0.45)) spots.push({ x, y: 0.02, z, sneak: 1, on: 'floor' });
    for (const [x, z, k] of def.lawn) if (!rnd || clear(x, z, 0.6)) spots.push({ x, y: 0.02, z, sneak: k, on: 'lawn' });
    spots.forEach((s, i) => { s.i = i; s.room = roomAt(s.x, s.z); });
    const spawns = []; for (let i = 0; i < 12; i++) spawns.push({ x: -7 + (i % 6) * 2.8, z: FENCE.z1 - 5.5 + Math.floor(i / 6) * 2.6, ry: Math.PI });
    const map = { kind: id, seed: seed || 0, name: def.name, size: def.size, half, center: def.center, rooms: ROOMS, outsideWall: def.out, shed: SHED, patio: def.patio || null, sideSteps: !!def.sideSteps, segs, fence: FENCE, furniture: furn, colliders, spots, spawns,
      bounds: { x0: FENCE.x0 + 0.8, x1: FENCE.x1 - 0.8, z0: FENCE.z0 + 0.8, z1: FENCE.z1 - 0.8 }, wallH: WALL_H, wallT: WALL_T, fenceH: FENCE_H, T, roomOf, roomAt };
    /* a rearranged map must still be fully walkable; if it somehow is not, use the standard arrangement */
    if (rnd && !sound(map)) return buildMap(id, 0);
    return map;
  }
  /* every spawn is clear and every room can be walked to from the gate */
  function sound(map) {
    const R = 0.6, step = 0.5, B = map.bounds, c = map.center;
    const free = (x, z) => { if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return false; for (const k of near(map, x, z)) { const cx = Math.max(k.x0, Math.min(x, k.x1)), cz = Math.max(k.z0, Math.min(z, k.z1)); if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < R * R) return false; } return true; };
    for (const s of map.spawns) if (!free(s.x, s.z)) return false;
    for (const k of map.colliders) { const cx = Math.max(k.x0, Math.min(c[0], k.x1)), cz = Math.max(k.z0, Math.min(c[1], k.z1)); if ((c[0] - cx) * (c[0] - cx) + (c[1] - cz) * (c[1] - cz) < 3.8 * 3.8) return false; }
    const nx = Math.ceil((B.x1 - B.x0) / step) + 1, nz = Math.ceil((B.z1 - B.z0) / step) + 1, seen = new Uint8Array(nx * nz), q = [];
    const si = Math.round((map.spawns[0].x - B.x0) / step), sj = Math.round((map.spawns[0].z - B.z0) / step); seen[si + sj * nx] = 1; q.push(si, sj);
    const count = new Map();
    while (q.length) { const j = q.pop(), i = q.pop(), x = B.x0 + i * step, z = B.z0 + j * step, r = map.roomOf(x, z); if (r) count.set(r[0], (count.get(r[0]) || 0) + 1);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz || seen[a + b * nx]) continue; seen[a + b * nx] = 1; if (free(B.x0 + a * step, B.z0 + b * step)) q.push(a, b); } }
    return map.rooms.every(r => (count.get(r[0]) || 0) >= 0.2 * (r[2] - r[1]) * (r[4] - r[3]) / (step * step));
  }

  /* ---------------- the lobby ---------------- */
  function buildLobby() {
    const colliders = [];
    const ring = { x: 0, z: -9, r: 4.2 };
    const spawns = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; spawns.push({ x: +(Math.sin(a) * 4.5).toFixed(2), z: +(8 + Math.cos(a) * 3).toFixed(2), ry: Math.PI }); }
    return { kind: 'lobby', ring, colliders, spawns, bounds: { r: 58 } };
  }
  /* push a circle (player) out of every box; returns the corrected position */
  const BK = 8;
  function near(map, x, z) {
    if (!map._b) { map._b = new Map(); for (const c of map.colliders) for (let i = Math.floor((c.x0 - 1) / BK); i <= Math.floor((c.x1 + 1) / BK); i++) for (let j = Math.floor((c.z0 - 1) / BK); j <= Math.floor((c.z1 + 1) / BK); j++) { const k = i + ',' + j; if (!map._b.has(k)) map._b.set(k, []); map._b.get(k).push(c); } }
    return map._b.get(Math.floor(x / BK) + ',' + Math.floor(z / BK)) || [];
  }
  /* px, pz: where the circle came from, so a fast step that lands inside a thin wall goes back the way it came */
  /* y is how high your feet are: anything whose top is below your feet (or a small step up) doesn't block you */
  const STEP = 0.35;
  function collide(map, x, z, rad, px, pz, y) {
    rad = rad || 0.7;
    for (let k = 0; k < 2; k++) for (const c of near(map, x, z)) {
      if (y != null && y + STEP >= (c.h == null ? 99 : c.h)) continue;
      const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1)), dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= rad * rad) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2), p = rad - d; x += dx / d * p; z += dz / d * p; }
      else {
        if (px != null && !(px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1)) {
          if (px <= c.x0) x = c.x0 - rad; else if (px >= c.x1) x = c.x1 + rad; else if (pz <= c.z0) z = c.z0 - rad; else z = c.z1 + rad;
        } else { const l = x - c.x0, r = c.x1 - x, b = z - c.z0, f = c.z1 - z, m = Math.min(l, r, b, f); if (m === l) x = c.x0 - rad; else if (m === r) x = c.x1 + rad; else if (m === b) z = c.z0 - rad; else z = c.z1 + rad; }
      }
    }
    const B = map.bounds;
    if (B.r) { const d = Math.hypot(x, z); if (d > B.r) { x *= B.r / d; z *= B.r / d; } }
    else { x = Math.max(B.x0, Math.min(B.x1, x)); z = Math.max(B.z0, Math.min(B.z1, z)); }
    return [x, z];
  }
  /* the height you stand at here: the highest top under you that is no more than a small step above your feet */
  function groundAt(map, x, z, y) {
    let g = 0; const E = 0.3;
    for (const c of near(map, x, z)) { const top = c.h == null ? 99 : c.h; if (top <= g || top > y + STEP) continue; if (x >= c.x0 - E && x <= c.x1 + E && z >= c.z0 - E && z <= c.z1 + E) g = top; }
    return g;
  }
  const built = new Map(); let Lb = null;
  /* a few recent maps are kept; the standard arrangements (no seed) stay for good */
  const map = (id, seed) => {
    id = DEFS[id] ? id : 'mansion'; seed = seed >>> 0; const key = id + ':' + seed; let m = built.get(key);
    if (!m) { m = buildMap(id, seed); built.set(key, m); if (built.size > 12) for (const k of built.keys()) { if (!k.endsWith(':0')) { built.delete(k); break; } } }
    return m;
  };
  root.FOUND_LAYOUT = {
    maps: MAP_IDS, map, info: id => ({ id, name: DEFS[id].name, size: DEFS[id].size, center: DEFS[id].center || [0, 0] }),
    get lobby() { return Lb || (Lb = buildLobby()); },
    get house() { return map('mansion'); },
    collide, groundAt, near, rot, T, sound
  };
})(globalThis);
