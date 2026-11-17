/* FOUND world: a white grid plain with soft shadows, the lobby (giant voxel letters, ready ring, the collection on
   plinths) and the house (low cutaway walls, furniture, fenced garden). You, your friends and their pets, the hidden
   objects and gift boxes. High third-person camera, WASD / arrows / tap-to-walk, drag to orbit, wheel to zoom.
   Static scenery is baked into a few vertex-coloured meshes so the whole house is a handful of draw calls. */
(function () {
  'use strict';
  const STYLE = globalThis.FOUND_STYLE = 'outline';
  const LAY = globalThis.FOUND_LAYOUT, OBJ = globalThis.FOUND_OBJECTS, AV = globalThis.FOUND_AVATAR;
  const W = { homeFrame: { side: -3.4, up: 1.2 }, ok: false, on: false, mode: 'home', me: null, others: new Map(), keys: {}, joy: { x: 0, y: 0 }, zoom: 1, map: 'lobby', items: new Map(), target: null,
    blocked: () => false, onGrab: null, onRing: null, onTouch: null, onBump: null, ring: false, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  let THREE, renderer, scene, cam, sun, hemi, canvas, sky, last = 0, t0 = 0, cAz = Math.PI, cEl = 0.46, cT = null, hidden = false, userHold = 0, yaw = 0;
  /* look settings, changed from the Settings panel: x and y are multipliers, dist scales how far back the camera sits */
  W.sens = { x: 1, y: 1, invY: false, dist: 1, fov: 52 };
  /* the camera always sits behind you: yaw is the way you face, the camera is at yaw + PI. Avatars face +Z at ry = 0. */
  const groups = {}; const anim = []; const fx = []; const fades = [];
  const PC = ['#ff4b3e', '#2f7bff', '#16c47f', '#ffb000', '#9b4dff', '#ff7a1a', '#ff4fa3', '#00b8d9'];
  W.PC = PC;
  const K = 0x0b0b0f;

  /* ---------------- materials and textures ---------------- */
  const mats = new Map();
  const lam = c => { const k = 'l' + c; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c })); return mats.get(k); };
  let VC, OUTM, GLOWM;
  function textPlane(text, w, h, opts) {
    opts = opts || {}; const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const g = c.getContext('2d');
    const draw = () => { g.clearRect(0, 0, c.width, c.height); g.fillStyle = opts.color || '#0b0b0f'; g.globalAlpha = opts.alpha == null ? 1 : opts.alpha; g.font = (opts.size || Math.round(c.height * 0.7)) + 'px "Fredoka Bold", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 4, c.width - 20); tex.needsUpdate = true; };
    const tex = new THREE.CanvasTexture(c); draw(); if (document.fonts) document.fonts.ready.then(draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 1; return m;
  }
  function label(text, opts) {
    opts = opts || {}; const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); const tex = new THREE.CanvasTexture(c);
    const draw = (txt) => { g.clearRect(0, 0, 512, 128); g.font = (opts.size || 50) + 'px "Fredoka Bold", system-ui, sans-serif'; const w = Math.min(500, g.measureText(txt).width + 50 + (opts.dot ? 34 : 0)), h = 76, y = 64 - h / 2;
      g.fillStyle = '#0b0b0f'; rr(g, 256 - w / 2 + 4, y + 6, w, h, 38); g.fill(); g.fillStyle = opts.bg || '#fff'; rr(g, 256 - w / 2, y, w, h, 38); g.fill(); g.lineWidth = 6; g.strokeStyle = '#0b0b0f'; g.stroke();
      if (opts.dot) { g.fillStyle = opts.dot; g.beginPath(); g.arc(256 - w / 2 + 34, 64, 12, 0, 7); g.fill(); }
      g.fillStyle = opts.fg || '#0b0b0f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 256 + (opts.dot ? 17 : 0), 66, 430); tex.needsUpdate = true; };
    draw(text); if (document.fonts) document.fonts.ready.then(() => draw(text));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true })); sp.scale.set(opts.w || 4, (opts.w || 4) / 4, 1); sp.renderOrder = 10; sp.userData.draw = draw; return sp;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  /* ---------------- batching boxes into one vertex-coloured mesh ---------------- */
  const FACES = [[[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]], [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
    [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]], [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]]];
  /* outlines: a thin hull round every box, plus a line along every edge of every face, so they total the same everywhere */
  const HULL = 0.02, LINE = 0.028;
  class Batch {
    constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.op = []; this.m = null; this.tmp = null; this.col = null; this.olw = HULL; }
    at(m) { this.m = m; return this; }
    box(w, h, d, color, x, y, z, ol, ry) {
      /* chunky mode (furniture): drop tiny details and fatten thin parts so everything reads as big cubes */
      if (this.chunky) { const mx = Math.max(w, h, d), mn = Math.min(w, h, d); if (mx < 0.42 || (mn <= 0.085 && mx < 1.0)) return this; const fat = v => v > 0.085 && v < 0.3 ? 0.3 : v; w = fat(w); h = fat(h); d = fat(d); }
      if (!this.tmp) { this.tmp = new THREE.Vector3(); this.col = new THREE.Color(); }
      const v = this.tmp, col = this.col.set(color === null ? 0 : color), m = this.m, cr = Math.cos(ry || 0), sr = Math.sin(ry || 0);
      const put = (arr, nArr, hw, hh, hd, withN) => {
        for (const [nn, quad] of FACES) {
          const idx = []; for (const q of quad) { let lx = q[0] * hw, lz = q[2] * hd; const rx = lx * cr + lz * sr, rz = -lx * sr + lz * cr; v.set(rx + x, q[1] * hh + y, rz + z); if (m) v.applyMatrix4(m); idx.push([v.x, v.y, v.z]); }
          for (const k of [0, 1, 2, 0, 2, 3]) { arr.push(idx[k][0], idx[k][1], idx[k][2]); if (withN) this.uv.push(k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0); }
          if (withN) { let nx = nn[0] * cr + nn[2] * sr, nz = -nn[0] * sr + nn[2] * cr; v.set(nx, nn[1], nz); if (m) v.transformDirection(m); for (let k = 0; k < 6; k++) { nArr.push(v.x, v.y, v.z); this.c.push(col.r, col.g, col.b); } }
        }
      };
      if (color !== null) put(this.p, this.n, w / 2, h / 2, d / 2, true);
      /* one outline width for everything: ol = 0 switches it off, any other value means on */
      const o = ol === 0 ? 0 : this.olw; if (o > 0) put(this.op, null, w / 2 + o, h / 2 + o, d / 2 + o, false);
      return this;
    }
    build(opts) {
      opts = opts || {}; const g = new THREE.Group();
      if (this.p.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, opts.mat || VC); mesh.castShadow = opts.shadow !== false; mesh.receiveShadow = true; g.add(mesh); g.userData.body = mesh; }
      if (this.op.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(this.op, 3)); geo.computeBoundingSphere(); const mesh = new THREE.Mesh(geo, opts.out || OUTM); g.add(mesh); g.userData.out = mesh; }
      return g;
    }
  }
  /* a voxel spec [w,h,d,col,x,y,z,flag] into a batch (flags g/f/p go to a glowing extra) */
  function specGroup(spec, scale, olw) {
    const b = new Batch(), glow = new Batch(), mm = new THREE.Matrix4().makeScale(scale, scale, scale); b.at(mm); glow.at(mm); b.olw = HULL / scale;
    const live = [];
    for (const q of spec) { const f = q[7]; if (f === 'g' || f === 'f' || f === 'p') { glow.box(q[0], q[1], q[2], q[3], q[4], q[5], q[6], 0); if (f !== 'g') live.push(q); } else b.box(q[0], q[1], q[2], q[3], q[4], q[5], q[6], f === 'n' ? 0 : olw == null ? 0.035 : olw); }
    const g = b.build(); if (glow.p.length) { const gg = glow.build({ mat: GLOWM, shadow: false }); g.add(gg); g.userData.glow = gg; }
    g.userData.live = live.length > 0; return g;
  }
  W.specGroup = (spec, scale) => specGroup(spec, scale);

  /* ---------------- hunt objects and gift boxes ---------------- */
  const GIFTC = { paper: ['#ffffff', '#0b0b0f'], ink: ['#1a1a20', '#ffffff'], gold: ['#ffc61a', '#0b0b0f'] };
  function giftSpec(kind) {
    const [a, b] = GIFTC[kind] || GIFTC.paper;
    return [[0.9, 0.7, 0.9, a, 0, 0.35, 0], [1.0, 0.22, 1.0, a, 0, 0.8, 0], [0.18, 0.71, 0.92, b, 0, 0.355, 0, 'n'], [0.92, 0.71, 0.18, b, 0, 0.355, 0, 'n'], [0.2, 0.23, 1.02, b, 0, 0.8, 0, 'n'], [1.02, 0.23, 0.2, b, 0, 0.8, 0, 'n'],
      [0.34, 0.22, 0.14, b, -0.19, 1.02, 0], [0.34, 0.22, 0.14, b, 0.19, 1.02, 0], [0.16, 0.16, 0.18, b, 0, 0.99, 0]];
  }
  W.giftSpec = giftSpec;
  const objCache = new Map();
  function objModel(type, gift) {
    const key = gift ? 'gift:' + gift : type;
    if (!objCache.has(key)) {
      const o = OBJ.BY[type], sc = gift ? 1.0 : OBJ.TIERS[o.tier].scale;
      objCache.set(key, specGroup(gift ? giftSpec(gift) : o.m, sc, gift ? 0.05 : 0.035 / sc * 1.0));
    }
    const src = objCache.get(key), g = new THREE.Group(); g.userData.live = !!src.userData.live;
    src.children.forEach(ch => { if (ch.isMesh) { const m = new THREE.Mesh(ch.geometry, ch.material); m.castShadow = ch.castShadow; m.receiveShadow = ch.receiveShadow; g.add(m); } else { const gg = new THREE.Group(); ch.children.forEach(c2 => gg.add(new THREE.Mesh(c2.geometry, c2.material))); g.add(gg); g.userData.glow = gg; } });
    return g;
  }
  W.objModel = objModel;

  /* ---------------- building the lobby ---------------- */
  const FONT = { F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'] };
  let ringMesh, ringFill, ringText, plinthItems = [];
  function buildLobby() {
    const L = LAY.lobby, g = new THREE.Group(); groups.lobby = g; scene.add(g);
    /* the plaza: pale pixel tiles in a circle, a chunky dark kerb, grass beyond */
    const PR = L.bounds.r + 3, pm = new THREE.MeshLambertMaterial({ color: 0xf6f4ee }); pm.userData.cell = [6, 3, 3]; pm.userData.edge = false;
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(PR, 96), pm); plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true; g.add(plaza);
    const kerb = new THREE.Mesh(new THREE.CylinderGeometry(PR + 0.9, PR + 0.9, 0.3, 96, 1, true), new THREE.MeshLambertMaterial({ color: 0x2a2733, side: THREE.DoubleSide })); kerb.position.y = 0.15; g.add(kerb);
    const kerbTop = new THREE.Mesh(new THREE.RingGeometry(PR, PR + 0.9, 96), new THREE.MeshLambertMaterial({ color: 0x3a3742 })); kerbTop.rotation.x = -Math.PI / 2; kerbTop.position.y = 0.3; kerbTop.receiveShadow = true; g.add(kerbTop);
    /* giant voxel letters, each bobbing a little out of step */
    const s = 1.1, word = 'FOUND';
    word.split('').forEach((ch, li) => {
      const b = new Batch(), rows = FONT[ch];
      rows.forEach((row, r) => row.split('').forEach((px, c) => { if (px === '1') b.box(s * 0.98, s * 0.98, s * 1.2, li === 1 ? '#0b0b0f' : '#0b0b0f', (c - 2) * s, (6 - r) * s + s / 2, 0, 0.05); }));
      if (ch === 'O') { /* the lens: a little cube inside and a handle, like the logo */
        b.box(s * 0.9, s * 0.9, s * 0.9, '#ffffff', 0, 3 * s + s / 2, 0, 0.05);
        b.box(s * 0.9, s * 0.9, s * 1.1, '#0b0b0f', -2.95, 0.98, 0, 0.05); b.box(s * 0.9, s * 0.9, s * 1.1, '#0b0b0f', -3.75, 0.45, 0, 0.05);
      }
      const lg = b.build(); const x = (li - 2) * 6 * s; lg.position.set(x, 0, L.word.z); g.add(lg);
      anim.push({ fn: t => { if (W.map !== 'lobby') return; lg.position.y = W.reduced ? 0 : Math.max(0, Math.sin(t * 1.6 - li * 0.6)) * 0.35; } });
    });
    /* ready ring */
    ringMesh = new THREE.Mesh(new THREE.RingGeometry(L.ring.r - 0.35, L.ring.r, 72), new THREE.MeshBasicMaterial({ color: K })); ringMesh.rotation.x = -Math.PI / 2; ringMesh.position.set(L.ring.x, 0.06, L.ring.z); g.add(ringMesh);
    ringFill = new THREE.Mesh(new THREE.CircleGeometry(L.ring.r - 0.35, 72), new THREE.MeshBasicMaterial({ color: K, transparent: true, opacity: 0.06 })); ringFill.rotation.x = -Math.PI / 2; ringFill.position.set(L.ring.x, 0.05, L.ring.z); g.add(ringFill);
    ringText = textPlane('READY', 5.2, 1.3, { alpha: 0.9 }); ringText.position.set(L.ring.x, 0.07, L.ring.z); g.add(ringText);
    const hint = textPlane('STAND HERE TO START', 7, 0.7, { alpha: 0.35 }); hint.position.set(L.ring.x, 0.07, L.ring.z + L.ring.r + 0.9); g.add(hint);
    anim.push({ fn: t => { if (W.map !== 'lobby') return; const k = W.ringK || 0; ringFill.material.opacity = 0.06 + k * 0.5 + (W.ring ? Math.sin(t * 5) * 0.03 + 0.05 : 0); ringFill.scale.setScalar(1); } });
    /* the collection: every hunt object on a white plinth */
    const pb = new Batch();
    L.plinths.forEach(p => { pb.box(1.7, 1.0, 1.7, '#ffffff', p.x, 0.5, p.z, 0.06, p.ry); const m = objModel(p.id); m.position.set(p.x, 1.0, p.z); m.rotation.y = p.ry; g.add(m); plinthItems.push({ m, p, ry: p.ry, lab: null }); });
    g.add(pb.build());
    anim.push({ fn: (t, dt) => { if (W.map !== 'lobby') return; const me = W.me; plinthItems.forEach((q, i) => { q.m.rotation.y = q.ry + (W.reduced ? 0 : Math.sin(t * 0.8 + i) * 0.5);
      const near = me && Math.hypot(me.x - q.p.x, me.z - q.p.z) < 4; if (near && !q.lab) { q.lab = label(OBJ.BY[q.p.id].name, { w: 3.2, size: 44 }); q.lab.position.set(q.p.x, 3.1, q.p.z); g.add(q.lab); } if (q.lab) q.lab.visible = near; }); } });
    /* a few decorative gifts by the spawn */
    [[6.5, 11, 'box', 0.4], [7.8, 11.8, 'box', -0.3], [-7, 12, 'box', 0.2]].forEach(q => { const m = objModel('gift', q[2]); m.position.set(q[0], 0, q[1]); m.rotation.y = q[3]; g.add(m); });
  }

  /* ---------------- building the house ---------------- */
  /* pixel textures: small canvases drawn pixel by pixel, shown with nearest filtering so they stay chunky */
  const texCache = new Map();
  function hexRgb(h) { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; }
  function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function pixTex(kind, a, b) {
    const key = kind + a + b; if (texCache.has(key)) return texCache.get(key);
    const n = kind === 'paving' ? 32 : 16, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), img = g.createImageData(n, n), r = seeded(key.length * 7919 + n);
    const A = hexRgb(a), B = hexRgb(b), put = (x, y, col, k) => { const i = (y * n + x) * 4; img.data[i] = Math.min(255, col[0] * k); img.data[i + 1] = Math.min(255, col[1] * k); img.data[i + 2] = Math.min(255, col[2] * k); img.data[i + 3] = 255; };
    /* flat colours and big simple shapes only: no noise */
    const joints = [3, 11, 7, 14], rowK = [1, 1.06, 0.96, 1.03];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (kind === 'planks') put(x, y, A, 1);
      else if (kind === 'paving') { const row = y >> 3, off = (row % 2) * 8, edge = y % 8 === 0 || (x + off) % 16 === 0; put(x, y, edge ? B : A, 1); }
      else if (kind === 'checker' || kind === 'mat' || kind === 'grass') put(x, y, ((x >> 3) + (y >> 3)) % 2 ? B : A, 1);
      else if (kind === 'tiles') put(x, y, A, 1);
      else put(x, y, A, 1);   /* carpet, rubber */
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.anisotropy = 1;   /* no mipmaps: big flat tiles stay crisp at low camera angles (mipmaps smeared them into dark blurry bands) */
    texCache.set(key, t); return t;
  }
  const TILE = { planks: 6, checker: 6, tiles: 3, carpet: 4, rubber: 4, mat: 6, grass: 12 };
  /* floor joints, as [length, width, stagger] in world units */
  const JOINT = { planks: [6, 1.5, 3], tiles: [3, 3, 0], checker: [3, 3, 0], mat: [3, 3, 0] };
  function texPlane(w, d, kind, a, b, x, y, z) {
    const t = pixTex(kind, a, b).clone(); t.needsUpdate = true; t.repeat.set(w / TILE[kind], d / TILE[kind]);
    const mat = new THREE.MeshLambertMaterial({ map: t }); if (JOINT[kind]) mat.userData.cell = JOINT[kind]; if (kind === 'grass') mat.userData.edge = false;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; return m;
  }
  const shade = (hex, k) => { const c = new THREE.Color(hex); c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k); return '#' + c.getHexString(); };
  const C = { cap: '#15151c', wood: '#e0862f', wood2: '#c0661c', wood3: '#7a3a12', oak: '#ffc266', white: '#ffffff', off: '#fff6e0', grey: '#dfe6f5', dark: '#2a2733', black: '#0b0b0f',
    mustard: '#ffcc00', leaf: '#16c94a', leaf2: '#4be36a', pot: '#ffffff', terra: '#ff6a2a', cab: '#2f5bff', counter: '#ffffff', stone: '#aab2c4', fire: '#ff7a1a' };
  const FURN = {
    sofa(b, e) { const c = e.c || '#7a3cff', c2 = e.c2 || '#9a66ff'; b.box(5.6, 0.5, 2.2, c, 0, 0.45, 0.1); [-1.2, 1.2].forEach(x => b.box(2.3, 0.25, 1.7, c2, x, 0.825, 0.3, 0.03)); b.box(6, 1.1, 0.6, c, 0, 1.25, -0.9); [-2.7, 2.7].forEach(x => b.box(0.6, 1.0, 2.4, c, x, 0.7, 0)); [[-2.6, 0.9], [2.6, 0.9], [-2.6, -0.9], [2.6, -0.9]].forEach(q => b.box(0.2, 0.2, 0.2, C.wood3, q[0], 0.1, q[1], 0)); b.box(1.0, 0.7, 0.3, C.mustard, -1.9, 1.15, -0.45, 0.03); b.box(0.9, 0.6, 0.3, '#ff2d55', 1.9, 1.12, -0.45, 0.03); },
    coffeetable(b) { b.box(3.2, 0.12, 1.8, C.oak, 0, 0.84, 0); [[-1.4, 0.7], [1.4, 0.7], [-1.4, -0.7], [1.4, -0.7]].forEach(q => b.box(0.14, 0.78, 0.14, C.black, q[0], 0.39, q[1], 0.03)); b.box(2.8, 0.06, 1.4, C.wood2, 0, 0.3, 0, 0.02); b.box(0.7, 0.12, 0.9, '#2f5bff', 0.2, 0.39, 0.1, 0.02); },
    tvstand(b) { b.box(5, 1.0, 1.2, C.wood2, 0, 0.5, 0); [-1.25, 1.25].forEach(x => b.box(2.3, 0.7, 0.02, C.wood3, x, 0.5, 0.61, 0)); b.box(3.4, 1.9, 0.14, '#16161c', 0, 2.1, -0.3); b.box(3.1, 1.6, 0.02, '#2b3550', 0, 2.1, -0.22, 0); b.box(0.4, 0.15, 0.4, C.dark, 0, 1.07, -0.3, 0); },
    bookshelf(b) { [-1.44, 1.44].forEach(x => b.box(0.12, 2.6, 1, C.wood2, x, 1.3, 0)); b.box(3, 2.6, 0.08, C.wood3, 0, 1.3, -0.46, 0.03); [0.08, 0.88, 1.68, 2.54].forEach(y => b.box(2.9, y > 2 ? 0.12 : 0.08, 0.95, C.wood2, 0, y, 0, 0.02));
      const books = (x0, x1, y) => { let x = x0, i = 0; const cs = ['#ff2d55', '#2f5bff', '#00c26e', '#ffcc00', '#f4f2ee', '#7a3cff', '#c8653a']; while (x < x1) { const w = 0.42 + ((i * 37) % 3) * 0.1, h = 0.5 + ((i * 53) % 3) * 0.08; b.box(w, h, 0.6, cs[i % cs.length], x + w / 2, y + h / 2, 0.05, 0.015); x += w + 0.02; i++; } };
      books(-0.05, 1.3, 0.92); books(-1.35, 0.15, 1.72); books(-1.35, -0.05, 0.12); },
    armchair(b, e) { const c = e.c || '#00c26e'; b.box(2.0, 0.6, 2.0, c, 0, 0.5, 0.1); b.box(1.8, 0.2, 1.5, shade(c, 1.18), 0, 0.9, 0.25, 0.03); b.box(2.4, 1.0, 0.5, c, 0, 1.1, -0.95); [-1.05, 1.05].forEach(x => b.box(0.35, 0.9, 2.3, c, x, 0.75, 0)); },
    sidetable(b) { b.box(1.4, 0.12, 1.4, C.oak, 0, 1.04, 0); b.box(0.2, 1.0, 0.2, C.black, 0, 0.5, 0, 0.03); b.box(0.9, 0.08, 0.9, C.black, 0, 0.04, 0, 0.02); },
    plant(b) { b.box(1.0, 1.0, 1.0, C.terra, 0, 0.5, 0); b.box(0.86, 0.04, 0.86, '#7a3a12', 0, 0.98, 0, 0); [[0, 1.8, 0, 0.5, 1.6], [-0.45, 1.6, 0.1, 0.45, 0.9], [0.45, 1.7, -0.15, 0.45, 1.0], [0.1, 2.5, -0.35, 0.6, 0.5], [-0.3, 2.3, 0.45, 0.45, 0.45]].forEach((q, i) => b.box(q[3], q[4], q[3], i % 2 ? C.leaf2 : C.leaf, q[0], q[1], q[2], 0.04)); },
    lamp(b) { b.box(0.8, 0.1, 0.8, C.black, 0, 0.05, 0, 0.03); b.box(0.12, 2.4, 0.12, C.black, 0, 1.25, 0, 0.02); b.box(0.9, 0.6, 0.9, '#fff27a', 0, 2.65, 0); },
    bed(b, e) { const c = e.c || '#2f5bff', p = e.p || C.white; b.box(5, 0.6, 7, C.wood2, 0, 0.3, 0); b.box(4.8, 0.4, 6.6, C.white, 0, 0.8, 0.1, 0.03); b.box(4.9, 0.1, 4.4, c, 0, 1.05, 1.2, 0.03); b.box(4.9, 0.3, 0.3, shade(c, 0.75), 0, 0.95, -1.0, 0.02); [-1.2, 1.2].forEach(x => b.box(1.7, 0.28, 0.9, p, x, 1.15, -2.85, 0.03)); b.box(5.2, 2.0, 0.3, C.wood3, 0, 1.0, -3.4); },
    nightstand(b) { b.box(1.5, 1.2, 1.3, C.wood2, 0, 0.6, 0); b.box(1.2, 0.4, 0.02, C.wood3, 0, 0.75, 0.66, 0); b.box(0.3, 0.06, 0.06, C.mustard, 0, 0.75, 0.68, 0); b.box(0.3, 0.5, 0.3, '#fff27a', -0.45, 1.45, -0.35, 0.03); },
    wardrobe(b, e) { const c = e.c || C.off; b.box(4, 3.4, 1.6, c, 0, 1.7, 0); b.box(0.04, 3.2, 0.02, shade(c, 0.7), 0, 1.7, 0.81, 0); [-0.3, 0.3].forEach(x => b.box(0.08, 0.5, 0.08, C.mustard, x, 1.8, 0.84, 0)); },
    desk(b) { b.box(4, 0.12, 2, C.wood2, 0, 1.24, 0); [-1.85, 1.85].forEach(x => b.box(0.15, 1.2, 1.8, C.wood3, x, 0.6, 0)); b.box(1.4, 0.9, 0.1, '#16161c', 0, 1.85, -0.6); b.box(0.2, 0.3, 0.2, C.dark, 0, 1.4, -0.6, 0); b.box(1.0, 0.04, 0.4, C.grey, 0, 1.32, 0.2, 0.02); },
    chair(b) { b.box(1.4, 0.12, 1.4, C.wood2, 0, 0.84, 0); [[-0.6, 0.6], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6]].forEach(q => b.box(0.12, 0.8, 0.12, C.wood3, q[0], 0.4, q[1], 0.02)); b.box(1.4, 1.0, 0.14, C.wood2, 0, 1.4, -0.63); },
    dresser(b) { b.box(3.2, 1.5, 1.3, C.wood, 0, 0.75, 0); [0.45, 1.05].forEach(y => b.box(2.9, 0.45, 0.02, C.wood2, 0, y, 0.66, 0)); [-0.8, 0.8].forEach(x => b.box(0.3, 0.06, 0.06, C.mustard, x, 1.05, 0.68, 0)); },
    toybox(b) { b.box(2.2, 0.3, 1.5, '#ff7a4a', 0, 0.15, 0); [-1.0, 1.0].forEach(x => b.box(0.2, 1.0, 1.5, '#ff7a4a', x, 0.5, 0)); [-0.65, 0.65].forEach(z => b.box(2.2, 1.0, 0.2, '#ff7a4a', 0, 0.5, z)); b.box(2.2, 1.2, 0.15, '#ffd60a', 0, 1.3, -0.95); [['#3fa9ff', -0.4, 0.4, 0.3], ['#ffd60a', 0.35, 0.45, -0.2], ['#16c47f', -0.1, 0.38, -0.3]].forEach(q => b.box(q[3] * 1.4, 0.3, 0.4, q[0], q[1], q[2], 0.1, 0.02)); },
    beanbag(b, e) { const c = e.c || '#ff9d6e'; b.box(2.0, 0.6, 2.0, c, 0, 0.3, 0); b.box(1.6, 0.35, 1.6, shade(c, 1.1), 0, 0.75, 0.05, 0.04); b.box(1.6, 0.6, 0.5, c, 0, 1.0, -0.75, 0.04); },
    kidtable(b) { b.box(2.4, 0.12, 2.4, '#ffd60a', 0, 0.84, 0); [[-1.05, 1.05], [1.05, 1.05], [-1.05, -1.05], [1.05, -1.05]].forEach(q => b.box(0.16, 0.8, 0.16, '#2f7bff', q[0], 0.4, q[1], 0.02)); b.box(0.5, 0.04, 0.7, C.white, -0.5, 0.92, -0.3, 0.02); },
    stool(b) { b.box(1, 0.12, 1, '#ff2d55', 0, 0.54, 0); [[-0.38, 0.38], [0.38, 0.38], [-0.38, -0.38], [0.38, -0.38]].forEach(q => b.box(0.1, 0.5, 0.1, C.black, q[0], 0.25, q[1], 0.02)); },
    counter6(b) { b.box(6, 1.4, 2, C.cab, 0, 0.7, 0); b.box(6.1, 0.1, 2.1, C.counter, 0, 1.45, 0); b.box(1.3, 0.04, 1.0, '#b8c4d8', -0.7, 1.5, 0.05, 0); b.box(0.12, 0.6, 0.12, C.grey, -0.7, 1.8, -0.75, 0.02); for (let i = 0; i < 4; i++) { b.box(1.3, 1.1, 0.02, '#5c7dff', -2.25 + i * 1.5, 0.7, 1.01, 0); b.box(0.3, 0.06, 0.04, C.mustard, -2.25 + i * 1.5, 1.15, 1.03, 0); } },
    counter3(b) { b.box(3, 1.4, 2, C.cab, 0, 0.7, 0); b.box(3.1, 0.1, 2.1, C.counter, 0, 1.45, 0); b.box(0.6, 0.5, 0.4, '#ff2d55', -0.8, 1.75, -0.5, 0.03); },
    stove(b) { b.box(2, 1.4, 2, C.white, 0, 0.7, 0); b.box(2.05, 0.1, 2.05, C.dark, 0, 1.45, 0); [[-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]].forEach(q => b.box(0.6, 0.04, 0.6, '#6a6680', q[0], 1.52, q[1], 0)); b.box(1.6, 0.8, 0.02, '#16161c', 0, 0.75, 1.01, 0); },
    fridge(b) { b.box(2.2, 3.8, 2.2, '#dfe6f5', 0, 1.9, 0); b.box(2.1, 0.03, 0.02, '#b8c4d8', 0, 2.6, 1.11, 0); [[0.8, 3.1], [0.8, 1.6]].forEach(q => b.box(0.08, 0.6, 0.08, C.dark, q[0], q[1], 1.14, 0)); [['#ff4b3e', -0.5, 3.2], ['#ffd60a', -0.2, 2.9], ['#2f7bff', -0.6, 1.8]].forEach(q => b.box(0.2, 0.2, 0.02, q[0], q[1], q[2], 1.12, 0)); },
    island(b) { b.box(4.8, 1.4, 2.2, C.cab, 0, 0.7, 0); b.box(5, 0.12, 2.4, C.oak, 0, 1.44, 0); b.box(0.9, 0.3, 0.9, C.white, 0.2, 1.65, -0.2, 0.03); [['#ff4b3e', 0.05, -0.1], ['#ffd60a', 0.35, -0.3], ['#16c47f', 0.3, 0]].forEach(q => b.box(0.24, 0.24, 0.24, q[0], q[1], 1.88, q[2], 0.02)); },
    diningtable(b) { b.box(5, 0.14, 3, C.oak, 0, 1.23, 0); [[-2.2, 1.2], [2.2, 1.2], [-2.2, -1.2], [2.2, -1.2]].forEach(q => b.box(0.18, 1.16, 0.18, C.wood3, q[0], 0.58, q[1], 0.03)); b.box(0.8, 0.2, 0.8, C.white, 0, 1.4, -0.3, 0.03); b.box(0.12, 0.6, 0.12, '#16c47f', 0, 1.7, -0.3, 0.02); b.box(0.3, 0.2, 0.3, '#ff8ad8', 0, 2.05, -0.3, 0.02); b.box(4.6, 0.02, 0.8, '#ff2d55', 0, 1.31, 0, 0); },
    bin(b) { b.box(1.0, 1.2, 1.0, '#6a6680', 0, 0.6, 0); b.box(1.1, 0.1, 1.1, C.black, 0, 1.25, 0); },
    bathtub(b) { b.box(5, 0.45, 2.6, C.white, 0, 0.225, 0); b.box(0.3, 1.2, 2.6, C.white, -2.35, 0.6, 0); b.box(0.9, 1.2, 2.6, C.white, 2.05, 0.6, 0); [-1.15, 1.15].forEach(z => b.box(3.8, 1.2, 0.3, C.white, -0.3, 0.6, z)); b.box(3.8, 0.02, 2.0, '#bfe9f4', -0.3, 0.46, 0, 0); b.box(0.2, 0.5, 0.2, C.grey, 2.1, 1.45, -0.9, 0.02); b.box(0.5, 0.12, 0.3, '#ffd60a', 1.9, 1.26, -0.4, 0.02); [-1.8, 1.8].forEach(x => b.box(0.3, 0.2, 0.3, C.mustard, x, 0.1, 1.0, 0)); },
    toilet(b) { b.box(1.1, 1.0, 1.4, C.white, 0, 0.5, 0.2); b.box(1.2, 0.1, 1.5, C.off, 0, 1.05, 0.2, 0.03); b.box(1.4, 0.9, 0.55, C.white, 0, 1.45, -0.75); b.box(0.3, 0.06, 0.1, C.grey, 0.4, 1.92, -0.6, 0); },
    vanity(b) { b.box(2.6, 1.4, 1.4, '#7a3cff', 0, 0.7, 0); b.box(2.7, 0.1, 1.5, C.white, 0, 1.45, 0); b.box(1.0, 0.04, 0.7, '#b8c4d8', 0, 1.51, 0.05, 0); b.box(2.2, 1.6, 0.1, '#cfe9f4', 0, 2.6, -0.65); b.box(2.4, 1.8, 0.06, C.mustard, 0, 2.6, -0.7, 0); },
    basket(b) { b.box(1.3, 0.2, 1.3, '#ffb347', 0, 0.1, 0); [-0.57, 0.57].forEach(x => b.box(0.16, 1.0, 1.3, '#ffb347', x, 0.5, 0)); [-0.57, 0.57].forEach(z => b.box(1.3, 1.0, 0.16, '#ffb347', 0, 0.5, z)); b.box(1.0, 0.5, 1.0, '#2f5bff', 0, 0.45, 0, 0.02); b.box(0.5, 0.3, 0.6, '#ff2d55', -0.2, 0.75, 0.15, 0.02); },
    consoletable(b) { b.box(3, 0.12, 1, C.wood2, 0, 1.24, 0); [-1.35, 1.35].forEach(x => b.box(0.14, 1.2, 0.9, C.wood3, x, 0.6, 0, 0.03)); b.box(2.6, 0.06, 0.8, C.wood3, 0, 0.4, 0, 0.02); },
    shoerack(b) { b.box(3, 0.08, 1, C.wood, 0, 0.76, 0); b.box(3, 0.06, 1, C.wood, 0, 0.42, 0, 0.02); [-1.45, 1.45].forEach(x => b.box(0.1, 0.8, 1, C.wood3, x, 0.4, 0, 0.02)); [[-1.0, '#ff4b3e'], [-0.4, '#2a2733'], [0.4, '#2f7bff']].forEach(q => b.box(0.35, 0.25, 0.7, q[1], q[0], 0.58, 0.05, 0.02)); [[0.2, '#ffd60a'], [1.0, '#16c47f']].forEach(q => b.box(0.35, 0.25, 0.7, q[1], q[0], 0.92, 0.05, 0.02)); },
    bench(b) { b.box(3.6, 0.14, 1.2, C.wood, 0, 0.93, 0.05); b.box(3.6, 0.8, 0.14, C.wood, 0, 1.5, -0.55); [-1.6, 1.6].forEach(x => { b.box(0.16, 0.86, 1.1, C.black, x, 0.43, 0, 0.02); }); },
    coatstand(b) { b.box(0.7, 0.1, 0.7, C.black, 0, 0.05, 0, 0.02); b.box(0.12, 3.0, 0.12, C.black, 0, 1.6, 0, 0.02); b.box(0.6, 1.2, 0.4, '#ff2d55', 0.2, 2.3, 0.15, 0.03); b.box(0.5, 0.9, 0.35, '#2f5bff', -0.25, 2.4, -0.1, 0.03); },
    fireplace(b) { b.box(5.6, 0.3, 1.9, '#8a92a6', 0, 0.15, 0.15); [-1.85, 1.85].forEach(x => b.box(1.3, 2.0, 1.4, C.stone, x, 1.3, 0)); b.box(5, 0.6, 1.4, C.stone, 0, 2.0, 0); b.box(2.4, 1.7, 0.3, '#16161c', 0, 1.15, -0.5); [0.1, -0.15].forEach((z, i) => b.box(1.5, 0.18, 0.28, C.wood3, i * 0.15, 0.4 + i * 0.16, z, 0.02)); b.box(1.0, 0.45, 0.3, C.fire, 0, 0.75, 0.0, 0); b.box(0.5, 0.35, 0.26, '#ffd60a', 0.1, 0.78, 0.05, 0); b.box(5.4, 0.14, 1.7, C.wood2, 0, 2.55, 0.05); b.box(0.4, 0.5, 0.2, C.mustard, 0, 2.87, -0.4, 0.02); },
    piano(b) { b.box(5, 2.4, 1.4, '#121216', 0, 1.2, -0.6); b.box(4.6, 0.12, 0.6, '#121216', 0, 1.35, 0.4); b.box(4.4, 0.05, 0.4, C.white, 0, 1.43, 0.45, 0); for (let i = 0; i < 12; i++) if (i % 7 !== 2 && i % 7 !== 6) b.box(0.12, 0.05, 0.22, '#121216', -2.0 + i * 0.36, 1.47, 0.36, 0); [-2.3, 2.3].forEach(x => b.box(0.2, 1.3, 0.2, '#121216', x, 0.65, 0.5, 0.02));
      b.box(2.4, 0.14, 0.9, '#121216', -0.8, 0.86, 0.85); [-1.9, 0.3].forEach(x => b.box(0.14, 0.8, 0.7, '#121216', x, 0.4, 0.85, 0.02)); b.box(0.4, 0.5, 0.06, C.white, 0.8, 2.05, 0.12, 0); },
    pooltable(b) { [[-2.6, 1.3], [2.6, 1.3], [-2.6, -1.3], [2.6, -1.3]].forEach(q => b.box(0.4, 0.9, 0.4, C.wood3, q[0], 0.45, q[1], 0.03)); b.box(6, 0.4, 3.4, C.wood2, 0, 1.1, 0); b.box(5.4, 0.06, 2.8, '#00c26e', 0, 1.32, 0, 0); [[-2.75, 1.45], [2.75, 1.45], [-2.75, -1.45], [2.75, -1.45], [0, 1.5], [0, -1.5]].forEach(q => b.box(0.3, 0.04, 0.3, C.black, q[0], 1.315, q[1], 0));
      [['#ffffff', 1.2, 0.2], ['#ffd60a', -0.4, 0.4], ['#ff2d55', -0.8, -0.2], ['#2f5bff', -0.3, -0.6], ['#121216', 0.4, 0.8]].forEach(q => b.box(0.22, 0.22, 0.22, q[0], q[1], 1.46, q[2], 0.02)); b.box(4.2, 0.06, 0.06, C.oak, 0.6, 1.4, 1.1, 0); },
    arcade(b, e) { const c = e.c || '#2f7bff'; b.box(1.6, 2.6, 1.2, '#1c1c22', 0, 1.3, 0); [-0.82, 0.82].forEach(x => b.box(0.06, 2.6, 1.22, c, x, 1.3, 0, 0)); b.box(1.6, 0.35, 1.2, c, 0, 2.82, 0); b.box(1.2, 0.85, 0.05, '#7ef9ff', 0, 2.05, 0.58, 0); b.box(1.6, 0.2, 0.5, '#2a2733', 0, 1.35, 0.6); [['#ff4b3e', -0.3], ['#ffd60a', 0.1], ['#16c47f', 0.4]].forEach(q => b.box(0.12, 0.06, 0.12, q[0], q[1], 1.48, 0.62, 0)); },
    pantryshelf(b) { [-1.94, 1.94].forEach(x => b.box(0.12, 2.8, 1.2, C.wood, x, 1.4, 0)); [0.07, 0.99, 1.89].forEach(y => b.box(3.9, 0.07, 1.15, C.wood, 0, y, 0, 0.02)); b.box(3.9, 0.12, 1.2, C.wood, 0, 2.74, 0, 0.02);
      const jars = (x0, x1, y) => { let x = x0, i = 0; const cs = ['#ff2d55', '#ffcc00', '#00c26e', '#f4f2ee', '#c8653a', '#2f5bff']; while (x < x1) { const w = 0.3 + (i % 3) * 0.08, h = 0.45 + (i % 2) * 0.2; b.box(w, h, 0.45, cs[i % cs.length], x + w / 2, y + h / 2, 0.1 + (i % 2) * 0.15, 0.015); x += w + 0.08; i++; } };
      jars(-1.8, -0.1, 0.14); jars(-0.4, 1.8, 1.02); jars(-1.8, 0.6, 1.92); },
    crate(b) { b.box(1.4, 1.2, 1.4, '#ffb347', 0, 0.6, 0); [0.3, 0.9].forEach(y => b.box(1.42, 0.06, 1.42, '#d9740a', 0, y, 0, 0)); },
    washer(b) { b.box(1.8, 2, 1.8, C.white, 0, 1, 0); b.box(1.1, 1.1, 0.05, '#9aa0a6', 0, 0.95, 0.92, 0); b.box(0.8, 0.8, 0.06, '#2f5bff', 0, 0.95, 0.93, 0); b.box(1.8, 0.25, 0.3, C.grey, 0, 1.88, -0.75, 0.02); },
    treadmill(b) { b.box(2, 0.3, 4, '#2a2733', 0, 0.15, 0.2); b.box(1.6, 0.05, 3.4, '#121216', 0, 0.32, 0.3, 0); [-0.85, 0.85].forEach(x => b.box(0.15, 1.4, 0.15, '#6a6680', x, 1.0, -1.6, 0.02)); b.box(2, 0.5, 0.4, '#2a2733', 0, 1.75, -1.6); b.box(0.8, 0.3, 0.05, '#7ef9ff', 0, 1.8, -1.38, 0); },
    rack(b) { b.box(4, 0.12, 1, '#2a2733', 0, 1.14, 0); b.box(4, 0.1, 1, '#2a2733', 0, 0.46, 0, 0.02); [-1.9, 1.9].forEach(x => b.box(0.12, 1.2, 1, '#2a2733', x, 0.6, 0, 0.02)); [0.2, 0.9, 1.6].forEach(x => { b.box(0.5, 0.18, 0.18, '#9aa0a6', x, 1.29, 0, 0.02); [-0.2, 0.2].forEach(d => b.box(0.14, 0.3, 0.3, '#121216', x + d, 1.32, 0, 0)); }); [-1.6, -0.9, -0.2].forEach(x => b.box(0.5, 0.25, 0.4, '#ff2d55', x, 0.64, 0, 0.02)); },
    punchbag(b) { b.box(1.4, 0.15, 1.4, '#2a2733', 0, 0.075, 0); b.box(0.15, 3.3, 0.15, '#2a2733', 0, 1.65, -0.6, 0.02); b.box(0.15, 0.15, 0.75, '#2a2733', 0, 3.3, -0.25, 0.02); b.box(0.06, 0.5, 0.06, '#9aa0a6', 0, 3.0, 0.1, 0); b.box(0.9, 1.9, 0.9, '#ff2d55', 0, 1.8, 0.1); b.box(0.92, 0.12, 0.92, C.black, 0, 2.5, 0.1, 0); },
    ballpit(b) { [-1.9, 1.9].forEach(x => b.box(0.2, 0.8, 4, '#2f7bff', x, 0.4, 0)); [-1.9, 1.9].forEach(z => b.box(3.6, 0.8, 0.2, '#ff4b3e', 0, 0.4, z)); b.box(3.6, 0.1, 3.6, '#f4f2ee', 0, 0.05, 0, 0);
      const cs = ['#ff4b3e', '#ffd60a', '#2f7bff', '#16c47f', '#ff8ad8', '#ffffff'], r = seeded(77); for (let i = 0; i < 70; i++) { const x = -1.6 + r() * 3.2, z = -1.6 + r() * 3.2; if (Math.hypot(x + 0.8, z - 0.6) < 0.55 || Math.hypot(x - 1.0, z + 0.9) < 0.55) continue; b.box(0.46, 0.46, 0.46, cs[i % cs.length], x, 0.3 + r() * 0.4, z, 0); } },
    clock(b) { b.box(1.2, 3.6, 0.9, C.wood2, 0, 1.8, 0); b.box(0.8, 0.8, 0.05, C.white, 0, 2.9, 0.46, 0); b.box(0.05, 0.3, 0.02, C.black, 0, 2.98, 0.49, 0); b.box(0.22, 0.05, 0.02, C.black, 0.08, 2.9, 0.49, 0); b.box(0.6, 1.3, 0.05, '#1c1c22', 0, 1.5, 0.46, 0); b.box(0.08, 0.8, 0.02, C.mustard, 0, 1.55, 0.49, 0); b.box(0.24, 0.24, 0.03, C.mustard, 0, 1.15, 0.5, 0); },
    boxes(b) { b.box(1.6, 1.0, 1.4, '#e0a25a', 0, 0.5, 0); b.box(0.3, 1.02, 1.42, '#c0661c', 0, 0.5, 0, 0); b.box(1.0, 0.9, 1.0, '#f0b872', 0.2, 1.45, 0.05); },
    vase(b) { b.box(0.8, 0.9, 0.8, '#2f5bff', 0, 0.45, 0); b.box(0.5, 0.45, 0.5, '#2f5bff', 0, 1.1, 0); b.box(0.8, 0.6, 0.8, C.leaf, 0, 1.6, 0); },
    speaker(b) { b.box(1.2, 2.2, 1.0, '#2a2733', 0, 1.1, 0); b.box(0.7, 0.7, 0.3, '#6a6680', 0, 1.5, 0.4, 0); b.box(0.5, 0.5, 0.3, '#6a6680', 0, 0.6, 0.4, 0); },
    suitcase(b) { b.box(1.6, 1.2, 0.8, '#ff2d55', 0, 0.6, 0); b.box(1.62, 0.3, 0.82, '#ffffff', 0, 0.6, 0, 0); },
    guitar(b) { b.box(0.9, 0.3, 0.8, '#2a2733', 0, 0.15, 0); b.box(0.9, 1.0, 0.3, '#ff8a00', 0, 0.8, 0); b.box(0.7, 0.5, 0.3, '#ff8a00', 0, 1.55, 0); b.box(0.3, 0.7, 0.3, '#7a3a12', 0, 2.1, 0); },
    blocks(b) { b.box(0.7, 0.7, 0.7, '#ff2d55', -0.4, 0.35, -0.3); b.box(0.7, 0.7, 0.7, '#2f5bff', 0.4, 0.35, 0.2); b.box(0.6, 0.6, 0.6, '#ffe600', -0.35, 0.3, 0.5); b.box(0.6, 0.6, 0.6, C.leaf, 0.05, 1.0, -0.05); },
    cushions(b) { b.box(1.5, 0.4, 1.5, '#7a3cff', 0, 0.2, 0); b.box(1.3, 0.4, 1.3, '#ff2d55', 0.1, 0.6, -0.05); },
    bookpile(b) { b.box(1.0, 0.3, 0.8, '#2f5bff', 0, 0.15, 0); b.box(0.9, 0.3, 0.7, '#ff2d55', 0.05, 0.45, 0); b.box(0.8, 0.3, 0.7, '#ffe600', -0.05, 0.75, 0.05); },
    globe(b) { b.box(0.7, 0.3, 0.7, C.wood3, 0, 0.15, 0); b.box(0.3, 0.6, 0.3, C.wood3, 0, 0.6, 0); b.box(0.9, 0.9, 0.9, '#2f8bff', 0, 1.4, 0); b.box(0.5, 0.45, 0.92, C.leaf, 0.1, 1.5, 0, 0); },
    fan(b) { b.box(0.8, 0.3, 0.8, '#2a2733', 0, 0.15, 0); b.box(0.3, 1.4, 0.3, '#2a2733', 0, 1.0, 0); b.box(1.0, 1.0, 0.4, '#dfe6f5', 0, 2.0, 0.1); },
    rock(b) { b.box(1.8, 1.1, 1.4, '#aab2c4', -0.05, 0.55, -0.05); b.box(1.0, 0.6, 0.8, '#8a92a6', 0.5, 0.3, 0.4); },
    logs(b) { b.box(2.4, 0.6, 0.6, '#a05a22', 0, 0.3, -0.35); b.box(2.4, 0.6, 0.6, '#a05a22', 0, 0.3, 0.35); b.box(2.4, 0.6, 0.6, '#c0661c', 0, 0.9, 0); },
    barrel(b) { b.box(1.1, 1.5, 1.1, '#c0661c', 0, 0.75, 0); b.box(1.14, 0.3, 1.14, '#2a2733', 0, 0.4, 0, 0); b.box(1.14, 0.3, 1.14, '#2a2733', 0, 1.1, 0, 0); },
    cone(b) { b.box(0.9, 0.3, 0.9, '#ff6a2a', 0, 0.15, 0); b.box(0.6, 0.5, 0.6, '#ff6a2a', 0, 0.55, 0); b.box(0.45, 0.45, 0.45, '#ffffff', 0, 1.0, 0); },
    scarecrow(b) { b.box(0.3, 2.2, 0.3, C.wood3, 0, 1.1, 0); b.box(2.0, 0.3, 0.3, C.wood3, 0, 2.05, 0); b.box(0.9, 0.9, 0.5, '#ff2d55', 0, 1.9, 0); b.box(0.7, 0.7, 0.7, '#ffe9a8', 0, 2.75, 0); b.box(1.0, 0.3, 1.0, C.wood3, 0, 3.2, 0); },
    sandbox(b) { [-1.85, 1.85].forEach(x => b.box(0.3, 0.4, 4, C.wood, x, 0.2, 0)); [-1.85, 1.85].forEach(z => b.box(3.4, 0.4, 0.3, C.wood, 0, 0.2, z)); b.box(3.4, 0.25, 3.4, '#ffe9a8', 0, 0.125, 0, 0); b.box(0.5, 0.5, 0.5, '#2f5bff', 1.0, 0.5, 1.0); },
    tree(b) { b.box(1.2, 3.4, 1.2, C.wood3, 0, 1.7, 0); [[0.7, 0.3, 0.5], [-0.6, 0.25, -0.6]].forEach(q => b.box(0.5, q[1], 0.5, C.wood3, q[0], q[1] / 2, q[2], 0.03)); },
    bush(b) { [[-0.65, -0.45], [0.65, -0.45], [-0.65, 0.5], [0.65, 0.5]].forEach((q, i) => b.box(1.25, 1.5 - (i % 2) * 0.2, 1.1, i % 2 ? C.leaf2 : C.leaf, q[0], 0.75 - (i % 2) * 0.1, q[1], 0.04)); b.box(1.2, 1.0, 1.0, '#10b040', 0, 0.5, 0, 0.03); [['#ff8ad8', -0.9, 1.55, 0.2], ['#ffffff', 0.8, 1.45, -0.5], ['#ff4b3e', 0.2, 1.5, 0.75]].forEach(q => b.box(0.18, 0.18, 0.18, q[0], q[1], q[2], q[3], 0.02)); },
    hedge(b) { b.box(8, 1.5, 1.4, '#16c94a', 0, 0.75, 0); for (let x = -3.5; x <= 3.5; x += 1.4) if (Math.abs(x + 2) > 0.8) b.box(1.2, 0.35, 1.2, C.leaf2, x, 1.65, 0, 0.03); },
    flowerbed(b) { b.box(8, 0.3, 2, '#8a4a1a', 0, 0.15, 0); b.box(8.2, 0.34, 0.15, C.wood2, 0, 0.17, 1.05, 0.03); b.box(8.2, 0.34, 0.15, C.wood2, 0, 0.17, -1.05, 0.03); const fc = ['#ff4b3e', '#ff8ad8', '#ffd60a', '#ffffff', '#9b4dff']; for (let i = 0; i < 18; i++) { const x = -3.6 + i * 0.42, z = ((i * 7) % 3 - 1) * 0.5; if (Math.abs(x + 2.5) < 0.45 || Math.abs(x - 2.6) < 0.45 || Math.abs(x) < 0.35) continue; if (i % 2) continue; b.box(0.44, 0.44, 0.44, fc[i % fc.length], x, 0.56, z, 0.03); } },
    pond(b) { b.box(8, 0.3, 0.5, '#aab2c4', 0, 0.15, 2.25); b.box(8, 0.3, 0.5, '#aab2c4', 0, 0.15, -2.25); b.box(0.5, 0.3, 4, '#aab2c4', 3.75, 0.15, 0); b.box(0.5, 0.3, 4, '#aab2c4', -3.75, 0.15, 0); b.box(7, 0.04, 4, '#18b6ff', 0, 0.02, 0, 0); [[-2.7, 1.3], [2.6, -1.2], [0.4, 0.6]].forEach(q => b.box(0.8, 0.04, 0.8, C.leaf, q[0], 0.17, q[1], 0.02)); b.box(0.2, 0.15, 0.2, '#ff8ad8', 0.5, 0.27, 0.7, 0.02); },
    trampoline(b) { [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]].forEach(q => b.box(0.2, 1.1, 0.2, C.dark, q[0], 0.55, q[1], 0.02)); [-2.45, 2.45].forEach(z => b.box(5.4, 0.16, 0.5, '#2f7bff', 0, 1.15, z, 0.03)); [-2.45, 2.45].forEach(x => b.box(0.5, 0.16, 4.4, '#2f7bff', x, 1.15, 0, 0.03)); b.box(4.4, 0.04, 4.4, '#16161c', 0, 1.14, 0, 0); },
    workbench(b) { b.box(4, 0.15, 1.4, C.wood, 0, 1.33, 0); [-1.8, 1.8].forEach(x => b.box(0.16, 1.26, 1.2, C.wood3, x, 0.63, 0, 0.03)); b.box(3.6, 0.08, 1.2, C.wood2, 0, 0.4, 0, 0.02); b.box(0.6, 0.3, 0.4, '#ff2d55', 0, 1.55, -0.3, 0.03); b.box(0.12, 0.12, 0.8, C.grey, 0.6, 1.47, -0.1, 0.02); },
    veg(b) { b.box(8, 0.5, 4.4, C.wood2, 0, 0.25, 0); b.box(7.6, 0.04, 4.0, '#7a3a12', 0, 0.5, 0, 0); for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) { const x = -3.4 + i * 0.85, z = -1.4 + r * 1.4; if (Math.hypot(x + 2.6, z + 1) < 0.6 || Math.hypot(x, z - 1.0) < 0.6 || Math.hypot(x - 2.6, z + 0.2) < 0.6) continue; if (r === 1) b.box(0.5, 0.35, 0.5, '#8be000', x, 0.68, z, 0.02); else { b.box(0.12, 0.3, 0.12, C.leaf, x, 0.66, z, 0); b.box(0.16, 0.08, 0.16, '#ff8a1f', x, 0.52, z, 0); } } },
    bbq(b) { b.box(1.6, 0.8, 1.2, C.dark, 0, 1.15, 0); [[-0.6, 0.4], [0.6, 0.4], [-0.6, -0.4], [0.6, -0.4]].forEach(q => b.box(0.1, 0.8, 0.1, C.dark, q[0], 0.4, q[1], 0.02)); b.box(1.5, 0.04, 1.1, '#6a6680', 0, 1.57, 0, 0); b.box(1.6, 0.7, 0.12, C.dark, 0, 1.9, -0.6); },
    blanket(b) { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) b.box(1.1, 0.04, 1.1, (i + j) % 2 ? '#ff2d55' : '#ffffff', -1.65 + i * 1.1, 0.02, -1.65 + j * 1.1, 0); b.box(1.0, 0.6, 0.7, C.wood, 0.3, 0.32, -0.2, 0.03); b.box(1.0, 0.1, 0.1, C.wood3, 0.3, 0.75, -0.2, 0.02); },
    doghouse(b) { [-1.2, 1.2].forEach(x => b.box(0.2, 1.8, 3, '#ff2d55', x, 0.9, 0)); b.box(2.6, 1.8, 0.2, '#ff2d55', 0, 0.9, -1.4); [-0.8, 0.8].forEach(x => b.box(0.8, 1.8, 0.2, '#ff2d55', x, 0.9, 1.4)); b.box(2.6, 0.5, 0.2, '#ff2d55', 0, 1.6, 1.4); b.box(1.6, 0.25, 3.4, C.dark, -0.7, 2.0, 0, 0.03, 0); b.box(1.6, 0.25, 3.4, C.dark, 0.7, 2.0, 0, 0.03, 0); b.box(0.5, 0.1, 0.8, '#ffd60a', 0.6, 0.06, 0.3, 0.02); },
    birdbath(b) { b.box(0.5, 1.0, 0.5, C.stone, 0, 0.5, 0); b.box(1.2, 0.3, 1.2, C.stone, 0, 1.15, 0); b.box(0.9, 0.04, 0.9, '#7ec4e0', 0, 1.29, 0, 0); },
    mailbox(b) { b.box(0.16, 1.4, 0.16, C.wood3, 0, 0.7, 0, 0.02); b.box(0.8, 0.5, 0.6, '#2f5bff', 0, 1.65, 0); b.box(0.06, 0.4, 0.06, '#ff4b3e', 0.43, 1.85, 0.1, 0.02); },
    wheelbarrow(b) { b.box(1.4, 0.15, 2.2, '#00c26e', 0, 0.65, 0); [-0.65, 0.65].forEach(x => b.box(0.12, 0.5, 2.2, '#00c26e', x, 0.9, 0)); [-1.05, 1.05].forEach(z => b.box(1.4, 0.5, 0.12, '#00c26e', 0, 0.9, z)); b.box(0.2, 0.5, 0.5, C.dark, 0, 0.25, 1.3, 0.03); [-0.5, 0.5].forEach(x => b.box(0.1, 0.1, 1.6, C.wood3, x, 0.6, -1.6, 0.02)); },
    slide(b) { [[-0.9, -2.9], [0.9, -2.9], [-0.9, -1.5], [0.9, -1.5]].forEach(q => b.box(0.18, 3.0, 0.18, '#ff4b3e', q[0], 1.5, q[1], 0.02)); b.box(2, 0.15, 1.6, C.wood, 0, 2.93, -2.2); for (let y = 0.5; y < 3; y += 0.6) b.box(1.6, 0.1, 0.12, C.wood, 0, y, -2.95, 0.02);
      const m = new THREE.Matrix4().makeRotationX(0.55); m.setPosition(0, 1.6, 0.6); const prev = b.m; const mm = prev ? prev.clone().multiply(m) : m; b.at(mm); b.box(1.6, 0.1, 4.4, '#ffd60a', 0, 0, 0); b.box(0.12, 0.4, 4.4, '#ffd60a', -0.8, 0.2, 0); b.box(0.12, 0.4, 4.4, '#ffd60a', 0.8, 0.2, 0); b.at(prev); },
    lounger(b) { b.box(1.8, 0.14, 4, C.white, 0, 0.73, 0.2); [[-0.8, 1.9], [0.8, 1.9], [-0.8, -1.5], [0.8, -1.5]].forEach(q => b.box(0.12, 0.7, 0.12, C.dark, q[0], 0.35, q[1], 0.02)); const m = new THREE.Matrix4().makeRotationX(-0.7); m.setPosition(0, 1.2, -1.9); const prev = b.m; b.at(prev ? prev.clone().multiply(m) : m); b.box(1.8, 0.14, 1.4, C.white, 0, 0, 0); b.at(prev); for (let i = 0; i < 4; i++) b.box(1.82, 0.02, 0.3, '#2f5bff', 0, 0.81, -0.9 + i * 0.9, 0); },
    parasol(b) { b.box(3, 0.1, 3, C.white, 0, 1.25, 0); b.box(0.2, 1.2, 0.2, C.dark, 0, 0.6, 0, 0.02); b.box(1.6, 0.08, 1.6, C.dark, 0, 0.04, 0, 0.02); b.box(0.12, 2.8, 0.12, C.dark, 0, 2.6, 0, 0.02); },
    rug(b, e) { const w = e.w, d = e.d, bc = e.b || '#ffffff'; b.box(w, 0.03, d, e.c, 0, 0.015, 0, 0); const i = 0.35, t = 0.14;
      b.box(w - 2 * i, 0.034, t, bc, 0, 0.017, d / 2 - i, 0); b.box(w - 2 * i, 0.034, t, bc, 0, 0.017, -d / 2 + i, 0); b.box(t, 0.034, d - 2 * i, bc, w / 2 - i, 0.017, 0, 0); b.box(t, 0.034, d - 2 * i, bc, -w / 2 + i, 0.017, 0, 0);
      if (w > 3 && d > 3) { const s = Math.min(w, d) * 0.22; b.box(s, 0.034, s, bc, 0, 0.017, 0, 0, Math.PI / 4); b.box(s * 0.55, 0.036, s * 0.55, e.c, 0, 0.018, 0, 0, Math.PI / 4); } }
  };

  function wallColour(x, z, H) {
    const S = H.shed; if (S && x >= S[0] && x <= S[1] && z >= S[2] && z <= S[3]) return '#b98d5f';
    const r = H.roomOf(x, z); return r ? r[7] : null;
  }
  /* a map is built the first time someone plays on it */
  function buildHouse(H, key) {
    const id = H.kind, g = new THREE.Group(), E = H.half + 1; groups[key] = g; g.visible = false; g.userData.canopies = []; scene.add(g);
    const b = new Batch();
    /* pixel grass inside the fence, a little wider so the fence stands on it */
    const F = H.fence;
    /* floors: each room its own pixel texture, and its name on the floor */
    for (const r of H.rooms) {
      const [id, x0, x1, z0, z1, name, fl] = r; g.add(texPlane(x1 - x0, z1 - z0, fl[0], fl[1], fl[2], (x0 + x1) / 2, 0.02, (z0 + z1) / 2));
      if (id === 'corrW' || id === 'corrE') continue;
      const c = new THREE.Color(fl[1]), dark = c.r * 0.3 + c.g * 0.59 + c.b * 0.11 < 0.45;
      const lab = textPlane(name.toUpperCase(), Math.min(11, (x1 - x0) * 0.75), 1.2, { alpha: dark ? 0.22 : 0.13, color: dark ? '#ffffff' : '#0b0b0f' });
      if (id === 'hall') { lab.rotation.z = Math.PI / 2; lab.position.set(0, 0.04, 22); } else lab.position.set((x0 + x1) / 2, 0.04, z1 - 1.4);
      g.add(lab);
    }
    /* grass tufts and little flowers scattered over the lawn (not in the house, not on paths, not under furniture) */
    const rnd = seeded(4242), greens = ['#27c93f', '#2fd84a', '#58a846'], petals = ['#ffffff', '#ffd60a', '#ff8ad8', '#ff4b3e'];
    for (let i = 0; i < 0; i++) {
      const x = F.x0 + 1 + rnd() * (F.x1 - F.x0 - 2), z = F.z0 + 1 + rnd() * (F.z1 - F.z0 - 2);
      if (Math.abs(x) < E && Math.abs(z) < E) continue; if (Math.abs(x) < 2.2 && z > H.half) continue;
      if (LAY.near(H, x, z).some(c => x > c.x0 - 0.4 && x < c.x1 + 0.4 && z > c.z0 - 0.4 && z < c.z1 + 0.4)) continue;
      if (H.furniture.some(f => H.T[f.type].walk && Math.abs(x - f.x) < f.w / 2 + 0.3 && Math.abs(z - f.z) < f.d / 2 + 0.3)) continue;
      const k = rnd(); if (k < 0.07) { b.box(0.06, 0.3, 0.06, C.leaf, x, 0.15, z, 0); b.box(0.2, 0.14, 0.2, petals[(rnd() * 4) | 0], x, 0.36, z, 0.02); continue; }
      const col = greens[(rnd() * greens.length) | 0], h = 0.22 + rnd() * 0.2; b.box(0.1, h, 0.1, col, x, h / 2, z, 0); b.box(0.1, h * 0.7, 0.1, col, x + 0.13, h * 0.35, z + 0.05, 0); b.box(0.1, h * 0.8, 0.1, shade(col, 1.15), x - 0.08, h * 0.4, z + 0.12, 0);
    }
    /* front path, patio by the back door, side door steps, shed floor, door mats */
    for (let z = H.half + 1.2; z < F.z1 - 0.2; z += 1.6) b.box(2.6, 0.06, 1.1, '#fff3d0', ((Math.round(z * 7)) % 2) * 0.3 - 0.15, 0.03, z, 0.03);
    if (H.patio) b.box(H.patio[2], 0.06, H.patio[3], '#fff3d0', H.patio[0], 0.03, H.patio[1], 0.03);
    if (H.sideSteps) { b.box(3, 0.06, 4.2, '#fff3d0', -E - 0.6, 0.03, 0, 0.03); b.box(3, 0.06, 4.2, '#fff3d0', E + 0.6, 0.03, 0, 0.03); }
    if (H.shed) b.box(H.shed[1] - H.shed[0], 0.06, H.shed[3] - H.shed[2], '#d9740a', (H.shed[0] + H.shed[1]) / 2, 0.03, (H.shed[2] + H.shed[3]) / 2, 0.03);
    b.box(4.6, 0.04, 1.4, C.black, 0, 0.03, H.half + 0.9, 0); b.box(4.2, 0.04, 0.9, '#ff2d55', 0, 0.05, H.half + 0.9, 0);
    /* walls: each face takes the colour of the room it faces, light greys and browns; skirting, a dark cap on top */
    const T2 = H.wallT / 2, WH = H.wallH;
    for (const [ax, f, a, c] of H.segs) {
      const piece = (p0, p1) => { const mid = (p0 + p1) / 2, len = p1 - p0;
        for (const side of [-1, 1]) {
          const px = ax === 'x' ? mid : f + side * 0.7, pz = ax === 'x' ? f + side * 0.7 : mid;
          const inside = wallColour(px, pz, H), col = inside || (Math.abs(f) < E ? H.outsideWall : '#ffb347');
          const skirt = inside ? shade(col, 0.62) : '#6f5e4c', sh = inside ? 0.28 : 0.5, o = side * T2 / 2;
          if (ax === 'x') b.box(len, WH, T2, col, mid, WH / 2, f + o, 0); else b.box(T2, WH, len, col, f + o, WH / 2, mid, 0);
        } };
      /* split the run where the room on either side changes, so every face gets its own colour */
      let s0 = a - T2, last = null;
      for (let p = a - T2; p < c + T2 - 1e-6; p += 0.5) {
        const q = Math.min(c + T2, p + 0.5), m = (p + q) / 2, k = [-1, 1].map(sd => wallColour(ax === 'x' ? m : f + sd * 0.7, ax === 'x' ? f + sd * 0.7 : m, H)).join('|');
        if (last !== null && k !== last) { piece(s0, p); s0 = p; } last = k;
      }
      piece(s0, c + T2);
      if (ax === 'x') { b.box(c - a + 2 * T2, WH, H.wallT, null, (a + c) / 2, WH / 2, f, 0.05); b.box(c - a + 2 * T2, 0.07, H.wallT + 0.02, C.cap, (a + c) / 2, WH + 0.035, f, 0); }
      else { b.box(H.wallT, WH, c - a + 2 * T2, null, f, WH / 2, (a + c) / 2, 0.05); b.box(H.wallT + 0.02, 0.07, c - a + 2 * T2, C.cap, f, WH + 0.035, (a + c) / 2, 0); }
    }
    /* picket fence */
    const fence = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.6)), ry = Math.atan2(x1 - x0, z1 - z0);
      for (let i = 0; i <= n; i++) { const k = i / n; b.box(0.26, H.fenceH, 0.26, C.white, x0 + (x1 - x0) * k, H.fenceH / 2, z0 + (z1 - z0) * k, 0.04); }
      [0.45, 1.05].forEach(y => b.box(0.14, 0.16, len, C.white, (x0 + x1) / 2, y, (z0 + z1) / 2, 0.03, ry)); };
    fence(F.x0, F.z1, F.gate[0], F.z1); fence(F.gate[1], F.z1, F.x1, F.z1); fence(F.x0, F.z0, F.x1, F.z0); fence(F.x0, F.z0, F.x0, F.z1); fence(F.x1, F.z0, F.x1, F.z1);
    [-3.2, 3.2].forEach(x => b.box(0.5, 2.2, 0.5, C.white, x, 1.1, F.z1, 0.05));
    /* furniture */
    b.chunky = true;
    for (const f of H.furniture) {
      const m = new THREE.Matrix4().makeRotationY(f.r * Math.PI / 2); m.setPosition(f.x, 0, f.z); b.at(m);
      (FURN[f.type] || (() => {}))(b, f.extra || {});
      if (f.type === 'tree') addCanopy(g, f);
      if (f.type === 'parasol') addParasol(g, f);
      b.at(null);
    }
    b.chunky = false;
    g.add(b.build());
    /* water shimmer on the pond */
    const water = new THREE.Mesh(new THREE.BoxGeometry(7, 0.06, 4), new THREE.MeshLambertMaterial({ color: 0x4fa6c8, transparent: true, opacity: 0.8 }));
    const pond = H.furniture.find(f => f.type === 'pond'); water.position.set(pond.x, 0.12, pond.z); g.add(water);
    anim.push({ once: true, fn: t => { if (g.userData.dead) return true; water.material.opacity = 0.74 + Math.sin(t * 1.5) * 0.06; } });
  }
  /* the world both maps sit in: pixel grass to the horizon and a loose ring of trees */
  function buildOutdoors() {
    const g = new THREE.Group(); groups.out = g; scene.add(g); const F = LAY.map('mansion', 0).fence;
    const grass = texPlane(2400, 2400, 'grass', '#ffffff', '#ececec', 0, 0, 0); grass.material.color.set('#2fd84a'); g.userData.grass = grass; Object.assign(grass.material, { polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 6 }); g.add(grass);
    /* the world goes on past the fence: a loose ring of trees out to the horizon */
    const far = new Batch(), fr = seeded(9091);
    for (let i = 0; i < 140; i++) {
      const a = fr() * Math.PI * 2, d = 78 + fr() * 190, x = Math.sin(a) * d, z = Math.cos(a) * d * 1.05; if (x > F.x0 - 10 && x < F.x1 + 10 && z > F.z0 - 10 && z < F.z1 + 10) continue;
      const s = 0.9 + fr() * 0.7, ry = fr() * 3; far.at(new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z));
      far.box(1.2 * s, 3.4 * s, 1.2 * s, C.wood3, 0, 1.7 * s, 0, 0.05);
      [[3.6, 2.2, 3.6, 0, 4.6, 0], [2.6, 1.6, 2.6, 0.5, 6.2, -0.3], [2.4, 1.4, 2.0, -1.1, 5.2, 0.9]].forEach((q, j) => far.box(q[0] * s, q[1] * s, q[2] * s, j % 2 ? C.leaf2 : C.leaf, q[3] * s, q[4] * s, q[5] * s, 0.06));
      if (fr() < 0.35) far.box(2.6 * s, 1.4 * s, 2.2 * s, C.leaf, 3 * s, 0.7 * s, 1 * s, 0.05);
    }
    far.at(null); g.add(far.build());
  }
  function addCanopy(g, f) {
    const b = new Batch(), sz = [[3.6, 2.2, 3.6, 0, 4.6, 0], [2.6, 1.6, 2.6, 0.5, 6.2, -0.3], [2.4, 1.4, 2.0, -1.1, 5.2, 0.9], [1.8, 1.2, 1.8, 1.3, 5.0, 1.0]];
    sz.forEach((q, i) => b.box(q[0], q[1], q[2], i % 2 ? C.leaf2 : C.leaf, q[3], q[4], q[5], 0.05));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 1 }), out = new THREE.MeshBasicMaterial({ color: K, side: THREE.BackSide, transparent: true, opacity: 1 });
    const c = b.build({ mat, out }); c.position.set(f.x, 0, f.z); c.rotation.y = f.r * Math.PI / 2 + f.x; g.add(c); g.userData.canopies.push({ c, mat, out, x: f.x, z: f.z, r: 4.2 });
  }
  function addParasol(g, f) {
    const b = new Batch(); for (let i = 0; i < 4; i++) b.box(4.2 - i * 0.9, 0.22, 4.2 - i * 0.9, i % 2 ? '#ffffff' : '#ff2d55', 0, 3.9 + i * 0.2, 0, 0.04);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true }), out = new THREE.MeshBasicMaterial({ color: K, side: THREE.BackSide, transparent: true });
    const c = b.build({ mat, out }); c.position.set(f.x, 0, f.z); g.add(c); g.userData.canopies.push({ c, mat, out, x: f.x, z: f.z, r: 3.6 });
  }

  /* ---------------- walkability grid and paths (tap to walk) ---------------- */
  const grids = {};
  function gridFor(map) {
    if (map._grid) return map._grid;
    const step = 0.5, R = 0.74, B = map.bounds.r ? { x0: -map.bounds.r, x1: map.bounds.r, z0: -map.bounds.r, z1: map.bounds.r } : map.bounds;
    const nx = Math.ceil((B.x1 - B.x0) / step) + 1, nz = Math.ceil((B.z1 - B.z0) / step) + 1, ok = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = B.x0 + i * step, z = B.z0 + j * step; let free = !map.bounds.r || Math.hypot(x, z) <= map.bounds.r;
      if (free) for (const c of LAY.near(map, x, z)) { const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1)); if ((x - cx) ** 2 + (z - cz) ** 2 < R * R) { free = false; break; } }
      ok[i + j * nx] = free ? 1 : 0; }
    return (map._grid = { B, step, nx, nz, ok, map });
  }
  function findPath(map, sx, sz, tx, tz) {
    const G = gridFor(map), { B, step, nx, nz, ok } = G;
    const cell = (x, z) => [Math.round((x - B.x0) / step), Math.round((z - B.z0) / step)];
    const inb = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz;
    let [si, sj] = cell(sx, sz), [ti, tj] = cell(tx, tz);
    const nearestFree = (i, j) => { if (inb(i, j) && ok[i + j * nx]) return [i, j]; for (let r = 1; r < 12; r++) for (let a = -r; a <= r; a++) for (const [di, dj] of [[a, -r], [a, r], [-r, a], [r, a]]) { const ii = i + di, jj = j + dj; if (inb(ii, jj) && ok[ii + jj * nx]) return [ii, jj]; } return null; };
    const s = nearestFree(si, sj), t = nearestFree(ti, tj); if (!s || !t) return null; [si, sj] = s; [ti, tj] = t;
    const N = nx * nz, gS = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), open = [];
    const h = (i, j) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const push = (k, f) => { open.push([f, k]); let c = open.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (open[p][0] <= open[c][0]) break; [open[p], open[c]] = [open[c], open[p]]; c = p; } };
    const pop = () => { const top = open[0], end = open.pop(); if (open.length) { open[0] = end; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === c) break; [open[m], open[c]] = [open[c], open[m]]; c = m; } } return top; };
    const sk = si + sj * nx, tk = ti + tj * nx; gS[sk] = 0; push(sk, h(si, sj)); let found = false, iter = 0;
    while (open.length && iter++ < 60000) { const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === tk) { found = true; break; } const i = k % nx, j = (k / nx) | 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (!inb(ii, jj)) continue; const kk = ii + jj * nx; if (!ok[kk] || closed[kk]) continue; if (di && dj && (!ok[ii + j * nx] || !ok[i + jj * nx])) continue;
        const gg = gS[k] + (di && dj ? 1.414 : 1); if (gg < gS[kk]) { gS[kk] = gg; from[kk] = k; push(kk, gg + h(ii, jj)); } } }
    if (!found) return null;
    const pts = []; for (let k = tk; k !== -1; k = from[k]) pts.push([B.x0 + (k % nx) * step, B.z0 + ((k / nx) | 0) * step]); pts.reverse();
    /* string-pull: keep only the corners we can't see past */
    const free = (x, z) => { for (const c of LAY.near(G.map, x, z)) { const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1)); if ((x - cx) ** 2 + (z - cz) ** 2 < 0.68 * 0.68) return false; } return true; };
    const clear = (a, c) => { const d = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.ceil(d / 0.25); for (let q = 1; q < n; q++) { const x = a[0] + (c[0] - a[0]) * q / n, z = a[1] + (c[1] - a[1]) * q / n, [i, j] = cell(x, z); if (!inb(i, j) || !ok[i + j * nx] || !free(x, z)) return false; } return true; };
    const out = [[sx, sz]]; let a = 0; while (a < pts.length - 1) { let c = pts.length - 1; while (c > a + 1 && !clear(a === 0 ? [sx, sz] : pts[a], pts[c])) c--; out.push(pts[c]); a = c; }
    out.shift(); if (!out.length) return [[tx, tz]]; if (Math.hypot(tx - out[out.length - 1][0], tz - out[out.length - 1][1]) < 0.8) out[out.length - 1] = [tx, tz];
    return out;
  }

  /* ---------------- players ---------------- */
  function makePlayer(info) {
    const g = new THREE.Group(), col = PC[info.col % PC.length] || PC[0];
    /* a hider in a round is just their object: no name, no shadow blob, nothing that gives them away */
    if (info.asProp) {
      const model = objModel(info.asProp); g.add(model);
      g.userData.av = { userData: { M: new THREE.Object3D(), emote() {}, anim(t, dt, o) { model.position.y = o.moving ? Math.abs(Math.sin(t * 12)) * 0.1 : 0; } } };
      g.userData.tag = new THREE.Sprite(new THREE.SpriteMaterial({ visible: false })); scene.add(g); return g;
    }
    const av = AV.make(THREE, info.look, col); g.add(av); g.userData.av = av;
    if (info.pet) { const pt = AV.pet(THREE, info.pet); pt.position.set(1.4, 0, -1.2); g.add(pt); g.userData.pet = pt; }
    const tag = label(info.name || 'Player', { dot: col, w: 3.6 }); tag.position.y = 4.6; g.add(tag); g.userData.tag = tag;
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color: K, transparent: true, opacity: 0.08, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; g.add(blob);
    scene.add(g); return g;
  }
  const lookKey = i => JSON.stringify([i.look, i.pet, i.col, i.name, i.asProp || 0]);
  W.setMe = function (info) {
    if (W.me && W.me.key === lookKey(info)) return;
    const prev = W.me; if (prev) scene.remove(prev.g);
    const g = makePlayer(info);
    W.me = Object.assign(prev || { x: 0, z: 8, y: 0, ry: Math.PI, vy: 0, grounded: true, path: null }, { id: info.id, g, key: lookKey(info), info });
    g.position.set(W.me.x, W.me.y, W.me.z); g.rotation.y = W.me.ry;
  };
  W.upsert = function (info) {
    if (W.me && info.id === W.me.id) return;
    let o = W.others.get(info.id);
    if (o && o.key === lookKey(info)) { o.info = info; o.g.userData.tag.material.opacity = info.here === false ? 0.4 : 1; return; }
    const prev = o; if (prev) scene.remove(prev.g);
    const g = makePlayer(info);
    o = Object.assign(prev || { x: 0, z: 8, y: 0, ry: 0, tx: 0, tz: 8, ty: 0, try: 0, lastAt: 0, moving: false, f: 0 }, { id: info.id, g, key: lookKey(info), info });
    W.others.set(info.id, o); g.position.set(o.x, o.y, o.z);
  };
  W.drop = id => { const o = W.others.get(id); if (o) { scene.remove(o.g); W.others.delete(id); } };
  W.keep = ids => { for (const id of [...W.others.keys()]) if (!ids.includes(id)) W.drop(id); };
  W.pos = function (list) {
    const now = performance.now();
    for (const [id, x, y, z, ry, f] of list) { if (W.me && id === W.me.id) continue; const o = W.others.get(id); if (!o) continue;
      if (Math.hypot(x - o.x, z - o.z) > 12) { o.x = x; o.z = z; } o.tx = x; o.ty = y; o.tz = z; o.try = ry; o.f = f; o.moving = !!(f & 1); o.lastAt = now; }
  };
  W.tp = function (x, z, ry) { const m = W.me; if (!m) return; m.x = x; m.z = z; m.ry = ry == null ? m.ry : ry; yaw = m.ry; cAz = yaw + Math.PI; m.y = 0; m.vy = 0; m.path = null; cT = null; if (marker) marker.visible = false; };
  W.fix = function (x, z) { const m = W.me; if (m) { m.x = x; m.z = z; } };
  W.emote = function (id, e) { const o = W.me && id === W.me.id ? W.me : W.others.get(id); if (o) o.g.userData.av.userData.emote(e); };
  W.jump = function () { const m = W.me; if (m && m.grounded) { m.vy = 9.5; m.grounded = false; } };

  /* ---------------- the map ---------------- */
  /* show the lobby or a map. Each round's map has its own arrangement (the seed), built when first shown; the old one is thrown away. */
  /* each map has its own season: cabin autumn, house summer, mansion winter */
  const GROUND = { lobby: '#2fd84a', cabin: '#f0a02c', house: '#2fd84a', mansion: '#eef4ff' };
  W.setMap = function (kind, seed) {
    if (groups.out && groups.out.userData.grass) groups.out.userData.grass.material.color.set(GROUND[kind] || GROUND.house);
    const key = kind === 'lobby' ? 'lobby' : 'm:' + kind + ':' + (seed >>> 0);
    if (kind !== 'lobby' && !groups[key]) {
      for (const k of Object.keys(groups)) if (k.startsWith('m:')) { const g = groups[k]; g.userData.dead = true; scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); delete groups[k]; }
      buildHouse(LAY.map(kind, seed), key);
    }
    W.map = kind; W.mapKey = key; W.mapObj = kind === 'lobby' ? LAY.lobby : LAY.map(kind, seed);
    groups.lobby.visible = kind === 'lobby'; for (const k in groups) if (k.startsWith('m:')) groups[k].visible = k === key;
    if (kind === 'lobby') W.clearItems();
    for (const o of W.others.values()) { o.x = o.tx; o.z = o.tz; }
  };

  /* ---------------- hunt items ---------------- */
  const itemG = () => groups.items || (groups.items = (() => { const g = new THREE.Group(); scene.add(g); return g; })());
  W.clearItems = function () { const g = itemG(); W.items.forEach(it => g.remove(it.m)); W.items.clear(); W.target = null; };
  W.setItems = function (list, target) {
    W.clearItems(); const g = itemG();
    for (const it of list) { const m = objModel(it.type, it.gift); m.position.set(it.x, it.y, it.z); m.rotation.y = it.ry; g.add(m);
      W.items.set(it.id, { id: it.id, type: it.type, gift: it.gift, x: it.x, y: it.y, z: it.z, ry: it.ry, m, pend: 0, wig: 0 }); }
  };
  W.take = function (id) {
    const it = W.items.get(id); if (!it) return; W.items.delete(id);
    const m = it.m, y0 = it.y, t0 = performance.now();
    anim.push({ once: true, fn: () => { const k = (performance.now() - t0) / 350; if (k >= 1) { itemG().remove(m); return true; } m.scale.setScalar(Math.max(0.001, 1 - k)); m.position.y = y0 + k * 0.8; } });
  };
  W.nope = function (id) { const it = W.items.get(id); if (it) { it.wig = 0.5; it.pend = performance.now() + 4000; } };
  /* seekers: the thing you would tag right now (nearest object or disguised hider within reach), and a ring under it */
  function tagCand() {
    const m = W.me; if (!m || W.role !== 'seeker' || !W.seeking) return null; let best = null, bs = 1e9;
    /* within reach, the one you are facing wins over the one that is merely nearest */
    const see = (id, x, y, z) => { const d = Math.hypot(x - m.x, z - m.z); if (d > 3.6) return; const a = Math.atan2(x - m.x, z - m.z) - m.ry, off = d < 0.6 ? 0 : Math.abs(Math.atan2(Math.sin(a), Math.cos(a))), sc = d + off * 2.2; if (sc < bs) { bs = sc; best = { id, x, y, z }; } };
    W.items.forEach(it => { if (!it.gift) see(it.id, it.x, it.y, it.z); });
    W.others.forEach(o => { if (o.info.asProp) see(o.id, o.x, 0, o.z); });
    return best;
  }
  W.tryTag = function () { const c = tagCand(); if (c && W.onTag) W.onTag(c.id); return !!c; };

  /* ---------------- effects ---------------- */
  let cubeGeo;
  function burst(x, y, z, cols, n) {
    if (!cubeGeo) cubeGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const parts = []; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(cubeGeo, lam(cols[i % cols.length])); m.position.set(x, y, z); scene.add(m); const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4; parts.push({ m, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 4 + Math.random() * 6, r: Math.random() * 6 }); }
    fx.push({ parts, t: 0 });
  }
  W.burst = (x, y, z, cols, n) => burst(x, y, z, cols || ['#0b0b0f', '#ffd60a', '#2f7bff', '#ff4b3e'], n || 30);
  function floatText(text, x, y, z, big) { const sp = label(text, { w: big ? 3.2 : 2.4, bg: big ? '#0b0b0f' : '#fff', fg: big ? '#fff' : '#0b0b0f' }); sp.position.set(x, y, z); scene.add(sp); const t0 = performance.now();
    anim.push({ once: true, fn: () => { const k = (performance.now() - t0) / 1300; if (k >= 1) { scene.remove(sp); return true; } sp.position.y = y + k * 1.6; sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; } }); }
  W.floatText = floatText;
  let marker = null;
  function showMarker(x, z) { return;   /* no click marker on the ground */
    if (!marker) { marker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 32), new THREE.MeshBasicMaterial({ color: K, transparent: true, depthWrite: false })); marker.rotation.x = -Math.PI / 2; scene.add(marker); } marker.position.set(x, 0.05, z); marker.visible = true; marker.userData.t0 = performance.now(); }

  /* ---------------- input ---------------- */
  const touch = matchMedia('(pointer: coarse)').matches; W.touch = touch;
  function bindInput() {
    addEventListener('keydown', e => { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; const k = e.key.toLowerCase(); if (W.blocked()) return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', ' ', 'shift'].includes(k)) { W.keys[k] = true; if (k.startsWith('arrow') || k === ' ') e.preventDefault(); if (W.me && 'wasd'.includes(k)) W.me.path = null; }
      if (k === ' ' && !e.repeat) W.jump(); });
    addEventListener('keyup', e => { W.keys[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => { W.keys = {}; });
    let drag = null;
    canvas.addEventListener('pointerdown', e => { if (W.blocked()) return; canvas.setPointerCapture(e.pointerId); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false }; });
    canvas.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true; if (drag.moved) { yaw -= dx * 0.006 * W.sens.x; cEl = Math.max(0.22, Math.min(0.95, cEl + dy * 0.0039 * W.sens.y * (W.sens.invY ? -1 : 1))); if (W.me) W.me.path = null; } });
    canvas.addEventListener('pointerup', e => { if (!drag || drag.id !== e.pointerId) return; const d = drag; drag = null; if (!d.moved && performance.now() - d.t < 400) tapTo(e.clientX, e.clientY); });
    canvas.addEventListener('wheel', e => { e.preventDefault(); W.zoom = Math.max(0.6, Math.min(1.7, W.zoom * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
    let pinch = null; canvas.addEventListener('touchmove', e => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) W.zoom = Math.max(0.6, Math.min(1.7, W.zoom * pinch / d)); pinch = d; drag = null; } }, { passive: true });
    canvas.addEventListener('touchend', () => { pinch = null; });
  }
  const ray = () => W._ray || (W._ray = new THREE.Raycaster());
  function tapTo(cx, cy) {
    const m = W.me; if (!m) return; const v = new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), r = ray(); r.setFromCamera(v, cam);
    /* tapped an item? walk next to it */
    const meshes = []; W.items.forEach(it => it.m.traverse(o => { if (o.isMesh) { o.userData.item = it; meshes.push(o); } }));
    W.others.forEach(o => { if (o.info.asProp) o.g.traverse(q => { if (q.isMesh) { q.userData.item = { id: o.id, x: o.x, z: o.z }; meshes.push(q); } }); });
    const hit = r.intersectObjects(meshes, false)[0];
    /* a seeker clicking something within reach tags it */
    if (hit && W.role === 'seeker' && W.seeking && !hit.object.userData.item.gift && Math.hypot(hit.object.userData.item.x - m.x, hit.object.userData.item.z - m.z) < 3.8) { if (W.onTag) W.onTag(hit.object.userData.item.id); return; }
    let tx, tz; if (hit) { tx = hit.object.userData.item.x; tz = hit.object.userData.item.z; }
    else { const p = new THREE.Vector3(); if (!r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return; tx = p.x; tz = p.z; }
    const path = findPath(W.mapObj, m.x, m.z, tx, tz); if (!path || !path.length) return; m.path = path; m.best = 1e9; m.stuckT = 0; m.replanned = 0; showMarker(tx, tz);
    if (W.onTouch) W.onTouch();
  }

  /* walk somewhere along a path (used by tap-to-walk; handy for tests and tutorials too) */
  W.walkTo = function (x, z) { const m = W.me; if (!m) return false; const path = findPath(W.mapObj, m.x, m.z, x, z); if (!path || !path.length) return false; m.path = path; m.best = 1e9; m.stuckT = 0; m.replanned = 0; showMarker(x, z); return true; };
  /* ---------------- the frame ---------------- */
  const tmpV = () => W._v || (W._v = new THREE.Vector3());
  function frame(now) {
    requestAnimationFrame(frame);
    if (hidden || !W.on) { last = now; return; }
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now; const t = (now - t0) / 1000;
    const m = W.me, locked = W.blocked(), K2 = W.keys, map = W.mapObj;
    if (m) {
      let ix = 0, iz = 0;
      if (!locked && W.mode !== 'off' && !W.frozen && !W.typing) { if (K2.w) iz -= 1; if (K2.s) iz += 1; if (K2.a) ix -= 1; if (K2.d) ix += 1; ix += W.joy.x; iz += W.joy.y; }
      /* arrows turn the camera and tilt it; WASD walks */
      if (!locked) { const turn = (K2.arrowleft ? 1 : 0) - (K2.arrowright ? 1 : 0), tilt = (K2.arrowup ? 1 : 0) - (K2.arrowdown ? 1 : 0); if (turn) { yaw += dt * 2.4 * turn * W.sens.x; m.path = null; } if (tilt) cEl = Math.max(0.22, Math.min(0.95, cEl + dt * 1.04 * tilt * W.sens.y * (W.sens.invY ? -1 : 1))); }
      let len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; len = 1; }
      let fx2 = 0, fz2 = 0, sp = 0;
      if (len > 0.08) { m.path = null; if (marker) marker.visible = false; sp = (W.role === 'hider' ? 8 : K2.shift ? 12.5 : 9) * Math.min(1, len); fx2 = Math.sin(yaw) * -iz - Math.cos(yaw) * ix; fz2 = Math.cos(yaw) * -iz + Math.sin(yaw) * ix; const l = Math.hypot(fx2, fz2) || 1; fx2 /= l; fz2 /= l; }
      else if (m.path && m.path.length && !W.frozen && !locked) { const [px, pz] = m.path[0], dx = px - m.x, dz = pz - m.z, d = Math.hypot(dx, dz);
        if (d < 0.35) { m.path.shift(); m.best = 1e9; if (!m.path.length) { m.path = null; if (marker) marker.visible = false; } } else { fx2 = dx / d; fz2 = dz / d; sp = W.role === 'hider' ? 8 : 9.5;
          /* stuck? no progress toward the next corner for a while: plan again from here, once */
          if (d < (m.best || 1e9) - 0.05) { m.best = d; m.stuckT = 0; } else if ((m.stuckT = (m.stuckT || 0) + dt) > 0.9) { const goal = m.path[m.path.length - 1]; m.stuckT = 0; m.best = 1e9; const again = (m.replanned || 0) < 3 && findPath(W.mapObj, m.x, m.z, goal[0], goal[1]); m.replanned = (m.replanned || 0) + 1; m.path = again && again.length ? again : null; if (!m.path && marker) marker.visible = false; } } }
      const moving = sp > 0;
      if (moving) {
        const nx = m.x + fx2 * sp * dt, nz = m.z + fz2 * sp * dt, c = LAY.collide(map, nx, nz, 0.6, m.x, m.z);
        m.x = c[0]; m.z = c[1];
        if (len <= 0.08) { const want = Math.atan2(fx2, fz2); m.ry += Math.atan2(Math.sin(want - m.ry), Math.cos(want - m.ry)) * Math.min(1, dt * 10); yaw = m.ry; }
      }
      if (len > 0.08 || !m.path) m.ry += Math.atan2(Math.sin(yaw - m.ry), Math.cos(yaw - m.ry)) * Math.min(1, dt * 16);
      m.moving = moving; m.running = moving && (K2.shift || sp > 9.6);
      if (!m.grounded || m.vy) { m.vy -= 26 * dt; m.y += m.vy * dt; if (m.y <= 0) { m.y = 0; m.vy = 0; if (!m.grounded) { m.grounded = true; m.g.userData.av.userData.M.scale.set(2.2, 1.75, 2.2); } } }
      const Ms = m.g.userData.av.userData.M.scale; Ms.x += (2 - Ms.x) * 0.2; Ms.y += (2 - Ms.y) * 0.2; Ms.z += (2 - Ms.z) * 0.2;
      m.g.position.set(m.x, m.y, m.z); m.g.rotation.y = m.ry; m.g.userData.tag.visible = W.map === 'lobby';
      m.g.userData.av.userData.anim(t, dt, { moving, running: m.running, speed: m.running ? 1.4 : 1.1, jumping: !m.grounded });
      if (m.g.userData.pet) petFollow(m.g, m, t, dt, moving);
      /* lobby: the ready ring */
      if (W.map === 'lobby') { const R = LAY.lobby.ring, inside = Math.hypot(m.x - R.x, m.z - R.z) < R.r - 0.2; if (inside !== W.ring) { W.ring = inside; if (W.onRing) W.onRing(inside); } }
      /* walk up to a gift box and it's yours */
      if (W.map !== 'lobby' && !W.frozen && !W.dead) W.items.forEach(it => { if (it.gift && Math.hypot(it.x - m.x, it.z - m.z) < 2.8 && now > it.pend) { it.pend = now + 1500; if (W.onGrab) W.onGrab(it.id); } });
      /* camera: always straight behind you, a little above */
      { const behind = yaw + Math.PI, d = Math.atan2(Math.sin(behind - cAz), Math.cos(behind - cAz)); cAz += d * Math.min(1, dt * 12); }
      const prop = !!m.info.asProp, base = prop ? 10 : 13.5, dist = base * W.zoom * W.sens.dist, ty = (prop ? 1.8 : 3.4) + m.y * 0.5, v = tmpV().set(m.x, ty, m.z);
      /* a caught hider watches the seeker */
      if (W.dead) for (const o of W.others.values()) if (o.info && o.info.role === 'seeker') { v.set(o.x, 3.6, o.z); break; }
      if (!cT) cT = v.clone(); cT.lerp(v, 0.16);
      const el = cEl;
      cam.position.set(cT.x + Math.sin(cAz) * Math.cos(el) * dist, cT.y + Math.sin(el) * dist, cT.z + Math.cos(cAz) * Math.cos(el) * dist);
      /* walls are 2.4 high: keep the camera above them so it never ends up inside one */
      if (W.map !== 'lobby' && cam.position.y < 3.4) cam.position.y = 3.4;
      const hf = W.mode === 'home' && !W.menuHidden ? W.homeFrame : { side: 0, up: 0 };
      cam.lookAt(cT.x + Math.cos(cAz) * hf.side, cT.y + hf.up, cT.z - Math.sin(cAz) * hf.side);
      sun.position.set(m.x + 22, 46, m.z + 26); sun.target.position.set(m.x, 0, m.z); sun.target.updateMatrixWorld();
      /* trees and parasols near you fade so nothing hides under them */
      for (const c of (groups[W.mapKey] && groups[W.mapKey].userData.canopies) || []) { const d = Math.hypot(c.x - m.x, c.z - m.z), want = d < c.r + 1.5 ? 0.25 : 1; c.mat.opacity += (want - c.mat.opacity) * 0.12; c.out.opacity = c.mat.opacity; c.mat.depthWrite = c.mat.opacity > 0.95; }
      W.canTag = !!tagCand();   /* no ring on the ground: the TAG button lights up when something is in reach */
    }
    W.others.forEach(o => { const k = Math.min(1, dt * 10); o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k; let d = o.try - o.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); o.ry += d * k; if (now - o.lastAt > 350) o.moving = false;
      o.g.visible = !(W.blind && o.info.asProp) && !o.info.ghost; o.g.position.set(o.x, o.y, o.z); o.g.rotation.y = o.ry; o.g.userData.av.userData.anim(t, dt, { moving: o.moving, running: !!(o.f & 2), speed: 1.1, jumping: o.y > 0.05 }); if (o.g.userData.pet) petFollow(o.g, o, t, dt, o.moving); });
    W.items.forEach(it => { if (it.gift) { it.m.rotation.y += dt * 1.2; it.m.position.y = it.y + 0.15 + Math.sin(t * 2.5 + it.x) * 0.12; }
      if (it.wig > 0) { it.wig -= dt; it.m.rotation.z = Math.sin(it.wig * 40) * 0.25 * (it.wig / 0.45); if (it.wig <= 0) it.m.rotation.z = 0; }
      const gl = it.m.userData.live && it.m.userData.glow; if (gl) gl.children.forEach(c => { c.scale.setScalar(1 + Math.sin(t * 9 + it.x) * 0.04); }); });
    if (marker && marker.visible) { const k = ((now - marker.userData.t0) / 700) % 1; marker.scale.setScalar(1 + k * 0.5); marker.material.opacity = 1 - k * 0.7; }
    for (let i = anim.length - 1; i >= 0; i--) { const r = anim[i].fn(t, dt); if (anim[i].once && r === true) anim.splice(i, 1); }
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; f.parts.forEach(p => { p.vy -= 20 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; if (p.m.position.y < 0.08) { p.m.position.y = 0.08; p.vy *= -0.3; p.vx *= 0.8; p.vz *= 0.8; } p.r += dt * 8; p.m.rotation.set(p.r, p.r * 0.7, 0); p.m.scale.setScalar(Math.max(0.01, 1 - Math.max(0, f.t - 0.9) / 0.6)); });
      if (f.t > 1.5) { f.parts.forEach(p => scene.remove(p.m)); fx.splice(i, 1); } }
    sky.position.copy(cam.position);
    renderer.render(scene, cam);
  }
  function petFollow(g, o, t, dt, moving) {
    const pet = g.userData.pet, want = tmpV().set(-Math.sin(2.3) * 1.7, 0, -Math.cos(2.3) * 1.7);
    pet.position.lerp(want, Math.min(1, dt * 4)); pet.rotation.y = Math.atan2(-pet.position.x, -pet.position.z) + Math.PI; pet.userData.anim(t, moving, false);
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  const TEX = {};
  W.init = function (cv) {
    THREE = window.THREE; if (!THREE) return false; canvas = cv;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return false; }
    const small = Math.min(innerWidth, innerHeight) < 700;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.75 : 2)); renderer.setClearColor(0xffffff, 1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    VC = new THREE.MeshLambertMaterial({ vertexColors: true }); OUTM = new THREE.MeshBasicMaterial({ color: K, side: THREE.BackSide });
    /* style preview: every lit surface goes through one small shader patch (cube grid, shade variation, saturation) */
    /* every lit surface: slightly calmer colour, a black line along each face edge (faded out on tiny faces so
       eyes and details stay clean), and on floors the joints between planks or tiles. userData.edge = false and
       userData.cell = [x, z, stagger] set these per material. */
    THREE.MeshLambertMaterial.prototype.customProgramCacheKey = () => 'found-lines';
    THREE.MeshLambertMaterial.prototype.onBeforeCompile = function (sh) {
      const c = this.userData.cell || [0, 0, 0];
      sh.uniforms.fCell = { value: new THREE.Vector3(c[0], c[1], c[2]) }; sh.uniforms.fEdge = { value: this.userData.edge === false ? 0 : 1 };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec2 vFuv;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vFuv = uv;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec2 vFuv; uniform vec3 fCell; uniform float fEdge;').replace('#include <color_fragment>', `#include <color_fragment>
        { float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = max(vec3(0.0), mix(vec3(l), diffuseColor.rgb, 0.94));
          vec3 dPx = dFdx(vWp), dPy = dFdy(vWp); float aa = max(max(length(dPx), length(dPy)), 1e-4), wv = ${LINE.toFixed(3)}, ln = 0.0;
          if (fEdge > 0.5) { vec2 dUx = dFdx(vFuv), dUy = dFdy(vFuv); float det = dUx.x * dUy.y - dUy.x * dUx.y;
            if (abs(det) > 1e-9) { float Su = length((dPx * dUy.y - dPy * dUx.y) / det), Sv = length((dPy * dUx.x - dPx * dUy.x) / det);
              float d = min(min(vFuv.x, 1.0 - vFuv.x) * Su, min(vFuv.y, 1.0 - vFuv.y) * Sv);
              ln = smoothstep(0.2, 0.55, min(Su, Sv)) * (1.0 - smoothstep(wv - aa * 0.5, wv + aa * 0.5, d)); } }
          if (fCell.x > 0.0) { float xo = vWp.x + mod(floor(vWp.z / fCell.y), 2.0) * fCell.z;
            float d = min(abs(fract(xo / fCell.x + 0.5) - 0.5) * fCell.x, abs(fract(vWp.z / fCell.y + 0.5) - 0.5) * fCell.y);
            ln = max(ln, 1.0 - smoothstep(wv * 0.6 - aa * 0.5, wv * 0.6 + aa * 0.5, d)); }
          ln *= clamp(wv * 1.8 / aa, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.043, 0.043, 0.059), ln); }`);
    }; GLOWM = new THREE.MeshBasicMaterial({ vertexColors: true });
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fd0ff);
    cam = new THREE.PerspectiveCamera(52, 1, 0.6, 3200);
    /* the sky: a big dome, deep blue overhead fading to a pale blue at the horizon, no haze over the ground */
    sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x1f8bff) }, mid: { value: new THREE.Color(0x5cc4ff) }, low: { value: new THREE.Color(0xb8ecff) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); vec3 c = mix(low, mid, smoothstep(0.0, 0.12, h)); c = mix(c, top, smoothstep(0.12, 0.7, h)); gl_FragColor = vec4(c, 1.0); }' }));
    sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
    hemi = new THREE.HemisphereLight(0xffffff, 0xdcdbe6, 0.86); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 0.34); sun.castShadow = true; sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 1, far: 160 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun); scene.add(sun.target);
    buildOutdoors(); buildLobby(); bindInput(); resize(); addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { hidden = document.hidden; W.keys = {}; });
    W.zoom = innerHeight > innerWidth ? 1.45 : 1;
    t0 = performance.now(); last = t0; W.ok = true; W.on = true; requestAnimationFrame(frame);
    W.mapObj = LAY.lobby; W.mapKey = 'lobby'; setTimeout(() => { gridFor(LAY.lobby); }, 300);
    return true;
  };
  W.setFov = f => { if (cam) { cam.fov = f; cam.updateProjectionMatrix(); } };
  W.cam = () => cam; W.renderer = () => renderer; W.scene = () => scene;

  /* ---------------- studio: icons for objects and cosmetics, and a live stage for gift reveals ---------------- */
  let studio = null;
  function studioR() {
    if (studio) return studio; const c = document.createElement('canvas'); c.width = c.height = 256;
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(256, 256, false);
    const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0xd6d5e0, 0.86)); const d = new THREE.DirectionalLight(0xffffff, 0.36); d.position.set(3, 6, 5); s.add(d);
    const cm = new THREE.PerspectiveCamera(26, 1, 0.1, 100); return (studio = { r, s, cm, c, cache: new Map() });
  }
  function shoot(key, build, fit) {
    const S = studioR(); if (S.cache.has(key)) return S.cache.get(key);
    const g = build(); S.s.add(g); g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3()), R = Math.max(size.x, size.y, size.z) * (fit || 1);
    const dist = R / Math.tan(13 * Math.PI / 180) * 0.62; S.cm.position.set(ctr.x + dist * 0.55, ctr.y + dist * 0.42, ctr.z + dist * 0.72); S.cm.lookAt(ctr);
    S.r.render(S.s, S.cm); const url = S.c.toDataURL('image/png'); S.s.remove(g); S.cache.set(key, url); return url;
  }
  W.icon = id => shoot('o:' + id, () => objModel(id), 1);
  W.giftIcon = k => shoot('g:' + k, () => objModel('gift', k), 1);
  W.itemIcon = function (id, slot) {
    return shoot('c:' + id, () => {
      if (slot === 'pet') { const p = AV.pet(THREE, id); p.userData.anim(0, false, false); return p; }
      const look = { skin: 0, hair: slot === 'hat' ? 'none' : 'short', hc: 0, outfit: slot === 'outfit' ? id : 'tee', hat: slot === 'hat' ? id : '', acc: slot === 'acc' ? id : '' };
      const g = AV.make(THREE, look, '#2f7bff', slot === 'outfit' ? 'fig' : slot); g.userData.anim(0, 0.016, {}); g.rotation.y = slot === 'acc' ? 2.6 : 0.35; return g;
    }, slot === 'outfit' ? 0.95 : 1);
  };
  /* a live stage in a modal: one figure or a gift box, turning */
  W.stage = function (cv) {
    let r; try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.shadowMap.enabled = true;
    const s = new THREE.Scene(), cm = new THREE.PerspectiveCamera(30, 1, 0.1, 60); s.add(new THREE.HemisphereLight(0xffffff, 0xdcdbe6, 0.86)); const d = new THREE.DirectionalLight(0xffffff, 0.36); d.position.set(3, 7, 5); d.castShadow = true; d.shadow.mapSize.set(1024, 1024); s.add(d);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), new THREE.ShadowMaterial({ opacity: 0.16 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; s.add(fl);
    let obj = null, alive = true, spin = true, view = { y: 2.0, d: 8.5, ty: 1.8 }, extra = [];
    const set = (g, v) => { if (obj) s.remove(obj); obj = g; if (g) { g.traverse(o => { if (o.isMesh) o.castShadow = true; }); s.add(g); } view = Object.assign({ y: 2.0, d: 8.5, ty: 1.8 }, v || {}); };
    const t0 = performance.now();
    (function loop() { if (!alive) return; requestAnimationFrame(loop); const w = cv.clientWidth || 300, h = cv.clientHeight || 300; if (cv.width !== Math.round(w * r.getPixelRatio())) r.setSize(w, h, false); cm.aspect = w / h; cm.updateProjectionMatrix();
      const t = (performance.now() - t0) / 1000; if (obj) { if (obj.userData.anim) { if (obj.userData.pet) obj.userData.anim(t, false, false); else obj.userData.anim(t, 1 / 60, {}); } if (spin) obj.rotation.y = Math.sin(t * 0.6) * 0.6 + (obj.userData.baseRy || 0); if (obj.userData.tick) obj.userData.tick(t); }
      extra.forEach(f => f(t)); const k = Math.max(1, 0.8 / cm.aspect); cm.position.set(0, view.ty + (view.y - view.ty) * k, view.d * k); cm.lookAt(0, view.ty, 0); r.render(s, cm); })();
    return {
      figure(look, pet, col) { const g = new THREE.Group(), a = AV.make(THREE, look, col || '#2f7bff'); g.add(a); g.userData.anim = (t, dt) => a.userData.anim(t, dt, {}); if (pet) { const p = AV.pet(THREE, pet); p.position.set(1.5, 0, 0.4); p.scale.setScalar(0.85); g.add(p); const pa = g.userData.anim; g.userData.anim = (t, dt) => { pa(t, dt); p.userData.anim(t, false, false); }; } set(g, { y: 2.3, d: 9.2, ty: 1.9 }); return a; },
      item(id, slot) { if (slot === 'pet') { const p = AV.pet(THREE, id); p.scale.setScalar(1.6); p.userData.pet = true; const g = new THREE.Group(); g.add(p); g.userData.anim = t => p.userData.anim(t, false, false); g.userData.pet = true; set(g, { y: 1.8, d: 6, ty: 0.9 }); return; }
        const look = { skin: 0, hair: slot === 'hat' ? 'none' : 'short', hc: 0, outfit: slot === 'outfit' ? id : 'tee', hat: slot === 'hat' ? id : '', acc: slot === 'acc' ? id : '' };
        const a = AV.make(THREE, look, '#2f7bff'); const g = new THREE.Group(); g.add(a); g.userData.anim = (t, dt) => a.userData.anim(t, dt, {}); set(g, { y: 2.3, d: 9.2, ty: 1.9 }); },
      gift(kind) { const g = objModel('gift', kind); g.scale.setScalar(2.2); g.userData.baseRy = 0.5; set(g, { y: 2.2, d: 7.5, ty: 1.0 }); return g; },
      shake(k) { if (!obj) return; obj.position.x = Math.sin(performance.now() / 30) * 0.08 * k; obj.rotation.z = Math.sin(performance.now() / 40) * 0.1 * k; },
      calm() { if (obj) { obj.position.x = 0; obj.rotation.z = 0; } },
      spin(v) { spin = v; }, clear() { set(null); }, onTick(f) { extra.push(f); }, obj: () => obj,
      stop() { alive = false; r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); }
    };
  };
  globalThis.FOUND_WORLD = W;
})();
