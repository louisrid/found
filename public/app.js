/* FOUND app: boot, the socket, home, the lobby, a prop hunt round (pick, hide, seek, results), the locker and the shop. */
(function () {
  'use strict';
  const W = globalThis.FOUND_WORLD, C = globalThis.FOUND_CATALOG, OBJ = globalThis.FOUND_OBJECTS, D = globalThis.FOUND_AVATAR_DATA;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => Math.round(n).toLocaleString('en-GB');
  const S = { me: null, party: null, phase: '', round: null, offer: null, results: null, layer: null, booted: false, tipped: {}, hold: false };
  const now = () => Date.now() + (S.skew || 0);
  const MODE = { solo: 'Practice', duel: '1v1', party: 'Party' };

  /* ---------------- sound: tiny synth blips, off with M ---------------- */
  let AC = null, muted = false; try { muted = localStorage.getItem('found-mute') === '1'; } catch (e) {}
  const ac = () => { if (!AC) try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} if (AC && AC.state === 'suspended') AC.resume(); return AC; };
  function tone(f, d, type, vol, slide) { if (muted) return; const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02); }
  const SFX = { pop: () => { tone(520, 0.12, 'triangle', 0.14, 1040); setTimeout(() => tone(880, 0.1, 'sine', 0.08, 1320), 60); }, tick: () => tone(660, 0.07, 'square', 0.04), go: () => { tone(523, 0.12, 'triangle', 0.12); setTimeout(() => tone(784, 0.2, 'triangle', 0.12), 110); },
    pew: v => tone(620 + Math.random() * 120, 0.09, 'square', v || 0.05, 160), boom: () => { tone(120, 0.25, 'sawtooth', 0.12, 40); },
    nope: () => tone(220, 0.14, 'sine', 0.07, 150), click: () => tone(900, 0.03, 'square', 0.025), win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.11), i * 120)) };

  /* ---------------- identity and the socket ---------------- */
  const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
  /* your identity lives in localStorage and a ten-year cookie (so clearing one does not lose you), plus a signed copy of your profile the server sends now and then */
  const cookieGet = () => { try { const m = /(?:^|; )found-id=([^;]+)/.exec(document.cookie); return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { return null; } };
  const cookieSet = v => { try { document.cookie = 'found-id=' + encodeURIComponent(JSON.stringify(v)) + ';max-age=315360000;path=/;SameSite=Lax' + (location.protocol === 'https:' ? ';Secure' : ''); } catch (e) {} };
  function ident(reset) { let v = null; try { v = JSON.parse(localStorage.getItem('found-id')); } catch (e) {} if (!v || !v.id) v = cookieGet(); if (reset || !v || !v.id) { v = { id: hex(12), key: hex(24) }; try { localStorage.removeItem('found-snap'); } catch (e) {} } try { localStorage.setItem('found-id', JSON.stringify(v)); } catch (e) {} cookieSet(v); return v; }
  const snapGet = () => { try { return localStorage.getItem('found-snap') || undefined; } catch (e) { return undefined; } };
  let ws = null, retry = 0, replaced = false;
  function connect() {
    if (replaced) return;
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => { retry = 0; const id = ident(); send({ t: 'auth', id: id.id, key: id.key, snap: snapGet(), auto: 1 }); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } const h = ON[m.t]; if (h) try { h(m); } catch (er) { console.error(m.t, er); } };
    ws.onclose = e => { if (e.code === 4000) { replaced = true; return; } if (S.booted) toast('Reconnecting…'); setTimeout(connect, Math.min(5000, 300 * 2 ** retry++)); };
  }
  const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

  /* ---------------- incoming ---------------- */
  const live = ph => ph === 'hide' || ph === 'seek';
  const myRow = () => S.party && S.me ? S.party.players.find(p => p.id === S.me.id) : null;
  /* a hider in a round is drawn as their object */
  const gunsOn = () => !!(S.party && S.party.guns && S.party.phase === 'lobby');
  const GUNS = globalThis.FOUND_GUNS, myGun = () => GUNS.BY[S.me && S.me.gun] || GUNS.BY[GUNS.START];
  const deco = p => Object.assign({}, p, { asProp: live(S.phase) && p.role === 'hider' && !p.found ? p.prop : null, ghost: live(S.phase) && p.role === 'hider' && p.found, gun: gunsOn() ? (GUNS.BY[p.gun] ? p.gun : GUNS.START) : '' });   // a caught hider is out and unseen
  const meInfo = () => { const r = myRow() || {}; return deco({ id: S.me.id, name: S.me.name, look: S.me.look, pet: S.me.pet, col: S.me.col, gun: S.me.gun, role: r.role, found: r.found, prop: r.prop }); };
  const playerName = id => { const p = S.party && S.party.players.find(q => q.id === id); return p ? p.name : 'Someone'; };
  const ON = {
    me(m) { const was = S.me; S.me = m.me; W.setMe(meInfo()); paintMe(); if (!S.booted) boot(); if (S.layer === 'locker' || S.layer === 'shop') paintWardrobe(true); },
    authfail() { ident(true); ws.close(); },
    snap(m) { try { localStorage.setItem('found-snap', m.s); } catch (e) {} },
    replaced() { replaced = true; layer(`<div class="card modal narrow"><div class="mhead"><h2>Opened elsewhere</h2></div><div class="mbody"><p>FOUND is open in another tab or device. Close that one, then reload here.</p><div class="mfoot"><button class="btn black" onclick="location.reload()">Reload</button></div></div></div>`, 'replaced'); },
    party(m) {
      if (m.now) S.skew = m.now - Date.now();
      const was = S.party, prev = S.phase; S.party = m; S.phase = m.phase;
      if (!was || was.code !== m.code) enterParty();
      if (S.practice && m.phase === 'lobby' && m.players.length === 1) { S.practice = false; send({ t: 'start' }); }
      for (const p of m.players) W.upsert(deco(p));
      W.keep(m.players.map(p => p.id)); W.setMe(meInfo());
      W.gunsOn = gunsOn(); if (W.gunsOn) { for (const p of m.players) { W.setHp(p.id, p.hp); W.setDead(p.id, !!p.dead); } S.dead = !!(myRow() || {}).dead; const r0 = myRow(); if (r0 && r0.hp != null && !S.dead) S.hp = r0.hp; } else { S.dead = false; W.clearDead(); }
      W.setPickups(W.gunsOn ? m.pk || [] : []);
      const r = myRow() || {}; W.role = live(m.phase) ? r.role : null; W.seeking = m.phase === 'seek'; W.blind = m.phase === 'hide' && r.role === 'seeker'; W.dead = live(m.phase) && !!r.found; W.frozen = W.blind || m.phase === 'results' || W.dead || !!S.dead;
      if (prev !== m.phase) phaseChanged(prev, m.phase);
      paintHud(); paintRole(); paintGun();
    },
    tp(m) { W.setMap(m.map, m.seed); W.tp(m.x, m.z, m.ry); },
    unready() { if ((myRow() || {}).ready) toast('Settings changed. Tap Hide & Seek to ready up again.'); },
    pos(m) { W.pos(m.p); },
    fix(m) { W.fix(m.x, m.z); },
    bye(m) { W.drop(m.id); },
    emote(m) { W.emote(m.id, m.e); },
    role(m) { S.offer = m; S.offer.mine = m.picked; showPick(); },
    round(m) {
      S.round = m; S.moveLeft = 5; W.restless = false; closeLayer('pick'); W.setMap(m.map, m.seed); W.setItems(m.items); paintRole();
      if (!m.role) toast('A round is on. You are watching until the next one.');
      else if (!S.tipped[m.role]) { S.tipped[m.role] = 1; tip(m.role === 'hider' ? `Hide anywhere. Jump onto tables. Move every 10 s for +40.` : W.touch ? 'Walk up to an object and press TAG.' : 'Walk up to an object, press <kbd>E</kbd>.', 6000); }
    },
    taken(m) { const mine = S.me && m.by === S.me.id; W.take(m.item); if (mine) { SFX.pop(); toast('You found a Mystery Box. It is yours after the round.'); } },
    found(m) {
      const mine = S.me && m.by === S.me.id, me = S.me && m.id === S.me.id; if (m.item) W.take(m.item);
      if (me) { SFX.nope(); toast('Caught! You are out this round.'); } else if (mine) { SFX.win(); toast(m.id ? `You caught ${playerName(m.id)}!` : 'Caught one!'); } else { SFX.pop(); feed(m.id ? `${esc(playerName(m.by))} caught ${esc(playerName(m.id))}` : `${esc(playerName(m.by))} caught a hider`); }
    },
    miss(m) { W.nope(m.item); if (S.round) S.round.endAt = m.endAt; if (S.me && m.by === S.me.id) { SFX.nope(); toast(`Just an object. ${(S.party && S.party.rules && S.party.rules.penalty) || 10} seconds lost.`); } },
    /* the last 30%: the seeker learns which objects are still hidden */
    hint(m) { const r = myRow(), list = m.names || m.rooms; if (!r || !list || !list.length) return; SFX.pop();
      if (r.role === 'seeker') toast(m.names ? 'Hint: look for ' + list.join(', ') : 'Hint: try ' + list.join(', '));
      else if (r.role === 'hider' && !r.found) toast(m.names ? 'The seeker now knows what is still hidden. Move!' : 'The seeker now knows which rooms to search. Move!'); paintRole(); },
    restless(m) { W.restless = !!m.on; if (m.on) { SFX.nope(); toast('You have kept still too long: your object is twitching. Move to stop it.'); } paintRole(); },
    bonus(m) { S.moveLeft = m.left; SFX.win(); toast(`+${m.n} for moving to a new spot` + (m.left ? '' : ' (that was the last one)')); paintRole(); },
    results(m) { S.results = m; showResults(); if (m.reward && m.reward.won) SFX.win(); },
    got(m) { SFX.win(); toast(m.why === 'spin' ? (m.box ? 'The wheel gave you a Mystery Box!' : `The wheel gave you ${fmt(m.coins)} coins!`) : `Collected ${fmt(m.coins)} coins.`); },
    sent(m) { toast(`Sent ${fmt(m.n)} coins to ${esc(m.to)}.`); },
    gifted(m) { SFX.win(); toast(`${esc(m.from)} gave you ${fmt(m.n)} coins!`); },
    mini(m) { S.mini = m; const end = Date.now() + m.ms;
      layer(`<div class="card modal narrow"><div class="mhead"><h2>Odd one out</h2><span class="sub">Tap the different one</span></div><div class="mbody"><div class="mini-grid">${m.cells.map((id, i) => `<button class="mini-c" data-a="minipick" data-v="${i}"><img src="${W.icon(id)}" alt=""></button>`).join('')}</div><div class="bar"><i id="mini-bar"></i></div><div class="mfoot"><button class="btn" data-a="close">Close</button></div></div></div>`, 'mini');
      const tick = () => { const b = $('#mini-bar'); if (!b || S.mini !== m) return; b.style.transform = `scaleX(${Math.max(0, (end - Date.now()) / m.ms)})`; requestAnimationFrame(tick); }; tick(); },
    minires(m) { S.mini = null; if (S.layer !== 'mini') return; $$('.mini-c').forEach((e, i) => { e.disabled = true; if (i === m.at) e.classList.add('right'); });
      const f = $('#layer .mfoot'); if (m.win) SFX.win(); else SFX.nope();
      f.innerHTML = `<b class="mini-msg">${m.win ? (m.coins ? '+' + m.coins + ' coins' : 'Right! (no more paid wins today)') : 'Not that one'}</b><button class="btn black" data-a="mini">Again</button><button class="btn" data-a="close">Close</button>`; },
    opened(m) { if (S.reveal) S.reveal.result(m.r); },
    crated(m) { if (S.crate) S.crate.result(m.r); },
    /* guns */
    shot(m) { W.shot(m); const mine = S.me && m.id === S.me.id, big = (GUNS.BY[m.g] || {}).dmg >= 50; if (mine) { if (big) SFX.boom(); else SFX.pew(0.05); } else SFX.pew(0.018); },
    hit(m) { W.hit(m); if (S.me && m.by === S.me.id) SFX.tick(); if (S.me && m.id === S.me.id) { S.hp = m.hp; paintGun(); const v = $('#hurt'); v.classList.remove('on'); void v.offsetWidth; v.classList.add('on'); } },
    kill(m) {
      W.killed(m.id); const mine = S.me && m.by === S.me.id, me = S.me && m.id === S.me.id;
      feed(`<b>${esc(playerName(m.by))}</b> ▸ ${esc(playerName(m.id))}`);
      if (me) { S.dead = true; W.frozen = true; S.deadAt = Date.now(); SFX.nope(); paintGun(); }
      else if (mine) { SFX.win(); toast(m.coins ? `+${fmt(m.coins)} coins` : 'Same victim again: no reward yet'); }
      if (me && m.lost) toast(`You lost ${fmt(m.lost)} coins`);
    },
    pk(m) { W.pickupGot(m); if (S.me && m.by === S.me.id) { SFX.pop(); toast(({ heal: '+50 HP', shield: 'Shield for 5 seconds', coins: '+1,000 coins', rage: 'Rage: double damage for 8 seconds' })[m.kind] || ''); } },
    spawned(m) { W.spawned(m.id); if (S.me && m.id === S.me.id) { S.dead = false; S.hp = GUNS.HP; W.frozen = false; paintGun(); } },
    bought(m) { SFX.pop(); toast(`Bought ${m.r.name}.`); S.sel = null; },
    left() { leaveParty(); if (S.explore) { S.explore = false; roam(0); } else send({ t: 'play' }); },
    err(m) { toast(m.m); SFX.nope(); if ((m.of === 'play' || m.of === 'auth') && !S.party) showHome(); if (m.of === 'open' && S.reveal) S.reveal.fail(); if (m.of === 'crate' && S.crate) S.crate.fail(); }
  };

  /* ---------------- boot ---------------- */
  function boot() {
    S.booted = true; $('#boot').classList.add('done'); setTimeout(() => $('#boot').remove(), 700);
    setTimeout(() => { if (!S.party && W.mode === 'home') send({ t: 'play' }); }, 2500);
    if (S.me.daily) setTimeout(() => toast('Your free Mystery Box is waiting in the shop.'), 1400);
  }
  function paintMe() {
    const m = S.me; if (!m) return; const n = m.boxes + (m.daily ? 1 : 0);
    if (document.activeElement !== $('#name')) $('#name').value = m.name;
    const up = S.lastCoins != null && m.coins > S.lastCoins; S.lastCoins = m.coins;
    $$('.coins').forEach(e => { e.textContent = fmt(m.coins); if (up) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); } });
    $$('.shop-badge').forEach(b => { b.hidden = !n; b.textContent = n; });
    const ib = $('#idle-b'), sb = $('#spin-b'), mb = $('#mini-b');
    if (ib) { ib.innerHTML = `Collect ${fmt(m.idle || 0)}<small>${m.idleRate}/hour while away</small>`; ib.classList.toggle('hot', (m.idle || 0) > 0); }
    if (sb) { sb.innerHTML = `Daily spin<small>${m.spin ? 'Ready' : 'Back tomorrow'}</small>`; sb.classList.toggle('hot', !!m.spin); }
    if (mb) mb.innerHTML = `Odd one out<small>${m.miniLeft ? m.miniLeft + ' paid wins left today' : 'Just for fun today'}</small>`;
  }

  /* ---------------- home and party ---------------- */
  function showHome() {
    /* only when there is no lobby to be in (offline, or the join failed): the menu stands open in the plaza */
    $('#roam').hidden = true; W.menuHidden = false; $('#home').classList.remove('folded'); paintMenu();
    W.mode = 'home'; W.role = null; W.blind = false; W.setMap('lobby'); W.keep([]); W.frozen = false; W.tp(0, 8, Math.PI);
    $('#home').hidden = false; $('#hud').hidden = true; $('#blind').hidden = true; touchControls(true);
    W.homeFrame = innerWidth < 760 ? { side: 0, up: 2.6 } : { side: -3.6, up: 1.2 };
  }
  const paintMenu = () => { const b = $('#back-lobby'); if (b) b.hidden = !!(S.party && S.party.pub); };
  const ROAM = ['house', 'cabin', 'mansion'];
  function roam(i, shuffle) {
    S.roamI = i; const id = ROAM[i], seed = shuffle || !S.roamSeed ? (Math.random() * 1e9) | 0 : S.roamSeed; S.roamSeed = seed;
    W.mode = 'roam'; W.role = null; W.blind = false; W.dead = false; W.frozen = false; W.menuHidden = true; W.keep([]); W.clearItems(); W.setMap(id, seed);
    const c = globalThis.FOUND_LAYOUT.info(id).center; W.tp(c[0], c[1], Math.PI);   /* start in the middle of the house, where hiders start */
    $('#home').hidden = true; $('#hud').hidden = true; $('#roam').hidden = false; touchControls(true);
    $('#roam-name').textContent = globalThis.FOUND_LAYOUT.info(id).name;
  }
  function enterParty() {
    $('#roam').hidden = true;
    W.mode = 'play'; W.menuHidden = true; $('#home').hidden = true; $('#hud').hidden = false; touchControls(true);
    if (S.party.pub && !S.tipped.guns) { S.tipped.guns = 1; setTimeout(() => toast('Guns are on. Kill = +10,000 coins. Tap Hide & Seek for a round.'), 900); }
  }
  function leaveParty() { S.party = null; S.phase = ''; S.round = null; closeLayer(); W.clearItems(); W.gunsOn = false; S.dead = false; $('#hud').classList.remove('in-round'); $('#hud').hidden = true; }
  function phaseChanged(prev, ph) {
    $('#hud').classList.toggle('in-round', ph !== 'lobby');
    if (ph === 'lobby') { closeLayer('pick'); closeLayer('results'); S.round = null; W.setMap('lobby'); }
    if (ph !== 'lobby') closeLayer('hs');
    if (ph === 'pick') closeLayer('results');
    if (ph === 'seek') { SFX.go(); flash('GO'); }
  }

  /* ---------------- HUD ---------------- */
  function paintHud() {
    const P = S.party; if (!P) return; if (S.layer === 'rules') showRules(); if (S.layer === 'hs') showHS(); const ph = P.phase, meId = S.me && S.me.id;
    $('#board').innerHTML = (ph === 'lobby' && P.guns ? [...P.players].sort((a, b) => (b.kills || 0) - (a.kills || 0)) : P.players).map(p => {
      const col = W.PC[p.col % W.PC.length], host = p.id === P.host ? ' <small>★</small>' : '';
      const st = ph === 'lobby' ? (p.ready ? 'READY' : '') : p.spec ? 'WATCHING' : p.role === 'seeker' ? 'SEEKER' : ph === 'pick' ? (p.picked ? 'PICKED' : 'PICKING') : 'HIDER';
      const g = ph === 'lobby' && P.guns, hpbar = g ? `<div class="hpbar"><u style="width:${Math.max(0, Math.min(100, p.hp || 0))}%"></u></div>` : '';
      return `<div class="prow${p.id === meId ? ' me' : ''}${p.here === false ? ' away' : ''}"><i class="dot" style="background:${col}"></i><span class="nm">${esc(p.name)}${host}${ph === 'lobby' && p.ready ? ' <small>✓</small>' : ''}</span><span class="st">${g ? (p.dead ? 'OUT' : (p.kills || 0) + ' K') : st}</span>${hpbar}${ph === 'lobby' && !g && p.id !== meId ? `<button class="btn mini-gift" data-a="gift" data-v="${p.id}">Gift 100</button>` : ''}</div>`;
    }).join('');
    const lb = $('#lobby-bar');
    if (ph === 'lobby') {
      const ready = P.players.filter(p => p.ready).length, n = P.players.length, need = n <= 2 ? n : Math.ceil(n * 0.6), mine = !!(myRow() || {}).ready;
      lb.hidden = false;
      lb.innerHTML = `<button class="btn hs-btn${mine ? ' on' : ''}" data-a="hs"><span>${mine ? 'Ready ✓' : 'Hide &amp; Seek'}</span><b>${P.readyAt ? 'Go!' : ready + '/' + need}</b></button>`;
    } else if (!S.tipUntil || Date.now() > S.tipUntil) lb.hidden = true;
  }
  function tip(html, ms) { const lb = $('#lobby-bar'); lb.hidden = false; lb.innerHTML = `<div class="hint"><span>${html}</span></div>`; S.tipUntil = Date.now() + ms; setTimeout(() => { if (Date.now() >= S.tipUntil && S.phase !== 'lobby') lb.hidden = true; }, ms + 50); }
  /* the card that says what you are this round */
  function paintRole() {
    const el = $('#role'), P = S.party, r = myRow(); if (!P || !r || !live(P.phase)) { el.hidden = true; $('#actions').hidden = true; return; }
    el.hidden = false; const left = P.round ? P.round.left : 0;
    if (r.role === 'hider' && !r.found) { const o = OBJ.BY[r.prop] || { name: '' }, mv = P.phase !== 'seek' ? '' : W.restless ? `<p class="role-hint hot">Twitching! Move to stop</p>` : S.moveLeft > 0 ? `<p class="role-hint">New spot every 10 s: +40 (${S.moveLeft} left)</p>` : ''; el.innerHTML = `<img src="${r.prop ? W.icon(r.prop) : 'mark.svg'}" alt=""><div><h3>You are a</h3><h2>${esc(o.name)}</h2>${mv}</div>`; }
    else if (r.role === 'seeker') { const h = P.round && P.round.hint, rm = P.round && P.round.rooms; el.innerHTML = `<img src="mark.svg" alt=""><div><h3>Seeker</h3><h2>${left} to find</h2>${h && h.length ? `<p class="role-hint">Look for: ${h.map(esc).join(', ')}</p>` : ''}${rm && rm.length ? `<p class="role-hint">Try: ${rm.map(esc).join(', ')}</p>` : ''}</div>`; }
    else if (r.role === 'hider') el.innerHTML = `<img src="mark.svg" alt=""><div><h3>Caught: watching the seeker</h3><h2>${left} still hidden</h2></div>`;
    else el.innerHTML = `<img src="mark.svg" alt=""><div><h3>Watching</h3><h2>${left} hidden</h2></div>`;
    $('#actions').hidden = !(r.role === 'seeker' && P.phase === 'seek');
  }
  function feed(html) { const f = $('#feed'), d = document.createElement('div'); d.innerHTML = `<span>${html}</span>`; f.appendChild(d); while (f.children.length > 3) f.firstChild.remove(); setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 600); }, 4200); }
  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3000); }
  function flash(text) { const bc = $('#big-count'); bc.hidden = false; bc.innerHTML = `<span>${text}</span>`; setTimeout(() => { if (bc.textContent === text) bc.hidden = true; }, 900); }
  /* the clock: countdowns, the round timer, the seeker's wait, button states */
  let lastCount = '';
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function clock() {
    const P = S.party, t = now(), tm = $('#timer'), R = P && P.round; let count = '';
    if (P && P.phase === 'lobby' && P.readyAt) { const s = Math.ceil((P.readyAt - t) / 1000); if (s > 0) count = String(s); }
    if (count !== lastCount) { lastCount = count; if (count) { flash(count); SFX.tick(); } }
    const hide = P && P.phase === 'hide', seek = P && P.phase === 'seek';
    tm.hidden = !(hide || seek) || !R;
    if (hide && R) { tm.innerHTML = `<small>HIDE</small>${mmss(R.hideEnds - t)}`; tm.classList.remove('hurry'); }
    if (seek && R) { const end = S.round && S.round.endAt ? Math.min(S.round.endAt, R.endAt) : R.endAt, left = end - t; tm.innerHTML = mmss(left); tm.classList.toggle('hurry', left < 20000); }
    const bl = $('#blind'); bl.hidden = !W.blind; if (W.blind && R) $('#blind-n').textContent = Math.max(0, Math.ceil((R.hideEnds - t) / 1000));
    if (seek) $('#tag').classList.toggle('on', !!W.canTag);
    if (S.layer === 'pick' && S.offer) { const b = $('#pick-bar'); if (b) b.style.transform = `scaleX(${Math.max(0, Math.min(1, (S.offer.ends - t) / 12000))})`; }
    if (S.layer === 'results' && S.results) { const e = $('#res-left'); if (e) e.textContent = Math.max(0, Math.ceil((S.results.ends - t) / 1000)); }
  }
  setInterval(clock, 100);
  /* send my position a dozen times a second when it changes */
  let lastMv = '', lastMvAt = 0;
  setInterval(() => {
    const m = W.me; if (!m || !S.party) return;
    const f = (m.moving ? 1 : 0) | (m.running ? 2 : 0) | (!m.grounded ? 4 : 0) | (m.roll ? 8 : 0), key = [m.x.toFixed(2), m.z.toFixed(2), m.y.toFixed(1), m.ry.toFixed(2), f].join();
    if (key === lastMv && Date.now() - lastMvAt < 1000) return; lastMv = key; lastMvAt = Date.now();
    send({ t: 'mv', x: +m.x.toFixed(2), z: +m.z.toFixed(2), y: +m.y.toFixed(2), ry: +m.ry.toFixed(2), f });
  }, 80);
  W.onGrab = id => send({ t: 'grab', item: id });
  W.onTag = id => { send({ t: 'tag', id }); SFX.click(); };

  /* ---------------- modals ---------------- */
  /* host rules: each row is a setting with its choices; non-hosts see the same panel read-only */
  const RULE_ROWS = [['hide', 'Hiding time', [[0.6, 'Short'], [1, 'Normal'], [1.5, 'Long']], 'How long hiders get to move before the seeker is let in.'],
    ['seek', 'Seeking time', [[0.6, 'Short'], [1, 'Normal'], [1.5, 'Long']], 'How long the seeker has.'],
    ['penalty', 'Wrong tag costs', [[5, '5s'], [10, '10s'], [20, '20s']], 'Seconds lost when the seeker tags an ordinary object.'],
    ['copies', 'Copies of each object', [[2, '2'], [3, '3'], [5, '5']], 'More copies make hiders harder to spot.'],
    ['seekers', 'Seekers', [[0, 'Auto'], [1, 'One'], [2, 'Two']], 'Auto is one seeker, or two from 7 players.'],
    ['hints', 'Seeker hints', [[0, 'Off'], [1, 'On']], 'Last 30%: which objects are still hidden. Last 15%: which rooms.']];
  /* the one button for the other game: ready up, pick the map, see the rules, or start it now */
  function showHS() {
    const P = S.party; if (!P || P.phase !== 'lobby') { closeLayer('hs'); return; }
    const meId = S.me && S.me.id, host = P.host === meId, mine = !!(myRow() || {}).ready, n = P.players.length, ready = P.players.filter(p => p.ready).length, need = n <= 2 ? n : Math.ceil(n * 0.6), mi = globalThis.FOUND_LAYOUT.info(P.map);
    const sig = [mine, ready, need, host, P.map, P.mapPick, !!P.readyAt, n].join(); if (S.layer === 'hs' && S.hsSig === sig) return; S.hsSig = sig;
    layer(`<div class="card modal narrow"><div class="mhead"><div><h2>Hide &amp; Seek</h2><div class="sub">${P.readyAt ? 'Starting…' : ready + ' of ' + need + ' ready'}</div></div><button class="btn icon" data-a="close" aria-label="Close">&#x2715;</button></div>
      <div class="mbody"><p class="big">One seeks. The rest hide as objects.</p><button class="btn big${mine ? '' : ' black'}" data-a="ready">${mine ? 'Ready ✓ (tap to cancel)' : "I'm ready"}</button>
      <div class="hs-row">${host ? `<button class="btn" data-a="map">Map: ${mi.name}${P.mapPick === 'auto' ? '' : ' ✓'}</button>` : ''}<button class="btn" data-a="rules">Rules</button>${host ? '<button class="btn" data-a="start">Start now</button>' : ''}</div></div></div>`, 'hs');
  }
  function showRules() {
    const P = S.party; if (!P) return; const host = P.host === (S.me && S.me.id), R = P.rules || {}, T = P.times || { hide: 30000, seek: 150000 };
    const dur = ms => { const s = Math.round(ms / 1000); return s >= 60 ? Math.floor(s / 60) + 'm' + (s % 60 ? ' ' + (s % 60) + 's' : '') : s + 's'; };
    const tl = (base, names) => [[0.6, 'Short'], [1, 'Normal'], [1.5, 'Long']].map(([v, n]) => [v, `${n}<small>${dur(base * v)}</small>`]);
    const rows = RULE_ROWS.map(([k, name, opts, why]) => `<div class="rrow"><div><b>${name}</b><small>${why}</small></div><div class="seg">${(k === 'hide' ? tl(T.hide) : k === 'seek' ? tl(T.seek) : opts).map(([v, l]) => `<button class="${R[k] === v ? 'on' : ''}" ${host ? `data-a="rule" data-v="${k}:${v}"` : 'disabled'}>${l}</button>`).join('')}</div></div>`).join('');
    layer(`<div class="card modal narrow"><div class="mhead"><h2>Rules</h2><span class="sub">${host ? 'You are the host' : 'Set by the host'}</span></div><div class="mbody">${rows}<div class="mfoot"><button class="btn black" data-a="close">Done</button></div></div></div>`, 'rules');
  }
  /* settings: look speed, camera, sound. Saved in this browser only. */
  const SET0 = { x: 1, y: 1, invY: false, dist: 1, fov: 52 };
  function loadSettings() { let v = {}; try { v = JSON.parse(localStorage.getItem('found-settings') || '{}') || {}; } catch (e) {} Object.assign(W.sens, SET0, v); W.setFov(W.sens.fov); }
  function saveSettings() { try { localStorage.setItem('found-settings', JSON.stringify(W.sens)); } catch (e) {} }
  const SET_ROWS = [['x', 'Look left / right', 0.3, 3, 0.1, v => v.toFixed(1) + '×'], ['y', 'Look up / down', 0.3, 3, 0.1, v => v.toFixed(1) + '×'],
    ['dist', 'Camera distance', 0.7, 1.5, 0.05, v => Math.round(v * 100) + '%'], ['fov', 'Field of view', 40, 80, 1, v => v + '°']];
  /* a rarity colour mixed 72% with white: the background of an item card */
  const pastel = hex => { const n = parseInt(String(hex).slice(1), 16), mix = c => Math.round(c + (255 - c) * 0.72); return `rgb(${mix(n >> 16 & 255)},${mix(n >> 8 & 255)},${mix(n & 255)})`; };
  function showSettings() {
    const V = W.sens, row = ([k, name, lo, hi, st, f]) => `<div class="srow"><div class="shead"><b>${name}</b><span id="sv-${k}">${f(V[k])}</span></div><input type="range" min="${lo}" max="${hi}" step="${st}" value="${V[k]}" data-set="${k}" aria-label="${name}"></div>`;
    layer(`<div class="card modal narrow settings"><div class="mhead"><h2>Settings</h2><span class="sub">Saved on this device</span></div><div class="mbody">
      ${SET_ROWS.map(row).join('')}
      <div class="rrow"><div><b>Invert up / down</b></div><div class="seg"><button class="${V.invY ? '' : 'on'}" data-a="setinv" data-v="0">Off</button><button class="${V.invY ? 'on' : ''}" data-a="setinv" data-v="1">On</button></div></div>
      <div class="rrow"><div><b>Sound</b></div><div class="seg"><button class="${muted ? '' : 'on'}" data-a="setsound" data-v="1">On</button><button class="${muted ? 'on' : ''}" data-a="setsound" data-v="0">Off</button></div></div>
      <div class="mfoot"><button class="btn" data-a="setreset">Reset</button><button class="btn black" data-a="close">Done</button></div></div></div>`, 'settings');
    $$('#layer input[data-set]').forEach(inp => inp.addEventListener('input', () => { const k = inp.dataset.set, v = +inp.value, r = SET_ROWS.find(q => q[0] === k); W.sens[k] = v; $('#sv-' + k).textContent = r[5](v); if (k === 'fov') W.setFov(v); saveSettings(); }));
  }
  function layer(html, name) { if (S.stage) { S.stage.stop(); S.stage = null; } const L = $('#layer'); L.innerHTML = html; L.hidden = false; S.layer = name; W.keys = {}; }
  function closeLayer(name) { if (name && S.layer !== name) return; const L = $('#layer'); if (S.stage) { S.stage.stop(); S.stage = null; } L.hidden = true; L.innerHTML = ''; S.layer = null; }
  W.onRoll = () => tone(260, 0.3, 'sine', 0.07, 720);
  W.blocked = () => !!S.layer && S.layer !== 'results' || !!S.reveal || !!S.crate;

  /* pick: hiders choose a disguise, the seeker waits */
  function showPick() {
    const O = S.offer; if (!O) return; const head = O.of > 1 ? `Round ${O.round} of ${O.of}` : MODE[O.mode] || '';
    const bar = '<div class="bar"><i id="pick-bar"></i></div>';
    if (O.role === 'seeker') return layer(`<div class="card modal narrow"><div class="mhead"><div><h2>You are the seeker</h2><div class="sub">${head}</div></div></div><div class="mbody"><p class="big">${O.mode === 'solo' ? 'Three objects in the house are hiders. Find them. Tagging an ordinary object costs 10 seconds.' : 'The others are choosing an object to hide as. Tag them to catch them. Tagging an ordinary object costs 10 seconds.'}</p>${bar}</div></div>`, 'pick');
    const card = id => { const o = OBJ.BY[id], T = OBJ.TIERS[o.tier]; return `<button class="pcard${O.mine === id ? ' on' : ''}" data-a="choose" data-v="${id}"><img src="${W.icon(id)}" alt=""><b>${esc(o.name)}</b><span class="tier ${o.tier}">${T.name}</span><small>${T.mult > 1 ? '×' + T.mult + ' points' : 'Hardest to spot'}</small></button>`; };
    layer(`<div class="card modal"><div class="mhead"><div><h2>Hide as…</h2><div class="sub">${head || 'Pick one'}</div></div></div>
      <div class="mbody"><div class="pick-cards">${O.offer.map(card).join('')}</div>${bar}</div></div>`, 'pick');
  }
  /* results */
  function showResults() {
    const R = S.results, me = S.me.id, isHost = S.party && S.party.host === me, rw = R.reward;
    const rows = R.ranking.map(r => { const p = S.party.players.find(q => q.id === r.id) || {};
      const what = r.role === 'seeker' ? `Seeker · ${r.finds} caught` : r.survived ? 'Hider · survived' : 'Hider · caught';
      return `<div class="prow big${r.id === me ? ' me' : ''}"><span class="place">${r.place}</span><i class="dot" style="background:${W.PC[(p.col || 0) % W.PC.length]}"></i><span class="nm">${esc(r.name)}<small>${what}</small></span><span class="mini">${r.prop ? `<img src="${W.icon(r.prop)}" alt="">` : ''}</span><span class="sc">${fmt(r.score)}</span></div>`; }).join('');
    const rewards = rw ? `<div class="rewards"><div class="rw"><b>+${fmt(rw.coins)}</b><span>Coins</span></div>${rw.pot ? `<div class="rw"><b>+${fmt(rw.pot)}</b><span>Pot</span></div>` : ''}${rw.boxes ? `<div class="rw box"><img src="${W.giftIcon('box')}" alt=""><div><b>${rw.boxes}×</b><span>Mystery Box</span></div></div>` : ''}</div>` : '';
    const head = !R.final ? `Round ${R.round} of ${R.of}` : !rw ? 'Round over' : R.mode === 'solo' ? (R.win === 'seekers' ? 'All found!' : 'Time!') : R.mode === 'duel' ? (rw.place === 1 ? 'You win!' : 'You lose') : rw.won ? 'You win!' : 'Round over';
    const sub = !R.final ? 'Swap sides in' : 'Lobby in';
    layer(`<div class="card modal narrow"><div class="mhead"><h2>${head}</h2><span class="sub">${sub} <span id="res-left"></span>s</span></div><div class="mbody"><div class="podium">${rows}</div>${rewards}
      <div class="mfoot">${R.final && isHost ? '<button class="btn black" data-a="lobby">Back to lobby</button>' : ''}</div></div></div>`, 'results');
  }

  /* ---------------- locker (what you own) and shop (what you can buy) ---------------- */
  const SLOTS = [['outfit', 'Outfits'], ['hat', 'Hats'], ['acc', 'Extras'], ['pet', 'Pets'], ['aura', 'Auras'], ['gun', 'Guns']], LOOKS = [['look', 'Hair & skin'], ['col', 'Colour']];
  const RANK = {}; C.RARITY.forEach((r, i) => { RANK[r] = i; });
  const rcol = r => r === 'starter' ? '#8a8a99' : C.RCOL[r];
  const gunFor = () => wTab === 'gun' ? S.me.gun || GUNS.START : '';
  let wTab = 'outfit', wMode = 'locker';
  const owned = id => C.STARTER.includes(id) || S.me.own.includes(id);
  const myCol = () => W.PC[S.me.col % W.PC.length];
  function showWardrobe(mode) {
    wMode = mode; S.sel = null; if (mode === 'shop' && (wTab === 'look' || wTab === 'col')) wTab = 'outfit';
    layer(`<div class="card modal"><div class="mhead"><div><h2>${mode === 'shop' ? 'Shop' : 'Locker'}</h2><div class="sub"><span class="pill coin coins"></span></div></div><div class="mtools"><button class="btn sm" data-a="${mode === 'shop' ? 'locker' : 'shop'}">${mode === 'shop' ? 'Locker' : 'Shop'}</button><button class="btn icon" data-a="close" aria-label="Close">&#x2715;</button></div></div>
      <div class="locker"><div class="stage"><canvas id="lk-stage"></canvas><div class="buy" id="lk-buy"></div></div><div class="mbody" id="lk-body"></div></div></div>`, mode);
    S.stage = W.stage($('#lk-stage')); if (S.stage) S.stage.figure(S.me.look, S.me.pet, myCol(), gunFor());
    paintMe(); paintWardrobe();
  }
  let iconJob = 0;
  function paintWardrobe(fromMe) {
    const me = S.me, body = $('#lk-body'); if (!body) return; const shop = wMode === 'shop';
    if (fromMe) { paintMe(); if (S.stage && !S.sel) S.stage.figure(me.look, me.pet, myCol(), gunFor()); }
    const tabs = `<div class="tabs">${SLOTS.concat(shop ? [] : LOOKS).map(s => `<button class="tab${s[0] === wTab ? ' on' : ''}" data-a="wtab" data-v="${s[0]}">${s[1]}</button>`).join('')}</div>`;
    let inner = '';
    if (wTab === 'look') inner = `<h4>Hair</h4><div class="hairs">${D.HAIRS.map(h => `<button class="tab${me.look.hair === h[0] ? ' on' : ''}" data-a="hair" data-v="${h[0]}">${h[1]}</button>`).join('')}</div>
      <h4>Hair colour</h4><div class="swatches">${D.HAIRC.map((c, i) => `<button class="sw${me.look.hc === i ? ' on' : ''}" style="background:${c}" data-a="hc" data-v="${i}" aria-label="Hair colour ${i + 1}"></button>`).join('')}</div>
      <h4>Skin</h4><div class="swatches">${D.SKIN.map((c, i) => `<button class="sw${me.look.skin === i ? ' on' : ''}" style="background:${c}" data-a="skin" data-v="${i}" aria-label="Skin ${i + 1}"></button>`).join('')}</div>`;
    else if (wTab === 'col') inner = `<h4>Your colour</h4><div class="swatches">${W.PC.map((c, i) => `<button class="sw${me.col === i ? ' on' : ''}" style="background:${c}" data-a="col" data-v="${i}" aria-label="Colour ${i + 1}"></button>`).join('')}</div>`;
    else {
      let list = C.ITEMS.filter(r => r[1] === wTab).map(r => C.BY[r[0]]).filter(i => shop ? !owned(i.id) : owned(i.id)).sort((a, b) => RANK[a.rarity] - RANK[b.rarity]);
      const cur = wTab === 'pet' ? me.pet : wTab === 'gun' ? me.gun : me.look[wTab];
      const none = !shop && wTab !== 'outfit' && wTab !== 'gun' ? `<div class="it${!cur ? ' on' : ''}" data-a="wear" data-v=""><i class="none"></i><b>None</b></div>` : '';
      const tile = i => `<div style="--rc:${rcol(i.rarity)}" class="it r-${i.rarity}${(shop ? S.sel === i.id : cur === i.id) ? ' on' : ''}" data-a="${shop ? 'pick' : 'wear'}" data-v="${i.id}"><i class="rt">${C.RNAME[i.rarity]}</i><img data-icon="${i.id}" data-slot="${i.slot}" alt=""><b>${esc(i.name)}</b>${shop ? `<span class="p">${fmt(C.PRICE[i.rarity])}</span>` : ''}</div>`;
      const crate = shop && wTab === 'gun' ? `<div class="boxbar"><img data-icon="g_cosmic" data-slot="gun" alt=""><div><b>Gun Crate</b><span>Win a gun, rarest ones last. Duplicates pay coins back. Coins come in at 1,000 a minute.</span></div><div class="boxbtns"><button class="btn black" data-a="crate"${me.coins >= C.CRATE.price ? '' : ' disabled'}>Open ${fmt(C.CRATE.price)}</button></div></div>` : '';
      const box = shop && wTab !== 'gun' ? `<div class="boxbar"><img src="${W.giftIcon('box')}" alt=""><div><b>Mystery Box${me.boxes ? ' ×' + me.boxes : ''}</b><span>A random item you don't own.</span></div><div class="boxbtns">${me.daily ? '<button class="btn black" data-a="daily">Free today</button>' : ''}${me.boxes ? '<button class="btn black" data-a="open">Open</button>' : ''}<button class="btn" data-a="buybox"${me.coins >= C.BOX.price ? '' : ' disabled'}>Buy ${fmt(C.BOX.price)}</button></div></div>` : '';
      const legend = shop ? `<div class="legend">${C.RARITY.filter(r => r !== 'starter').map(r => `<span class="r-${r}" style="--rc:${C.RCOL[r]}">${C.RNAME[r]} ${fmt(C.PRICE[r])}</span>`).join('')}</div><p class="earn-line">Get coins by playing rounds, collecting idle coins, the daily spin and Odd one out.</p>` : '';
      inner = crate + box + legend + (list.length || none ? `<div class="grid">${none}${list.map(tile).join('')}</div>` : `<p class="big">${shop ? 'You own all of these.' : 'Nothing here yet. Visit the shop.'}</p>`);
    }
    body.innerHTML = tabs + inner; paintBuy();
    const job = ++iconJob, imgs = $$('#lk-body img[data-icon]');
    /* cards on screen first, then the rest in order */
    const box = $('#lk-body'), seen = im => { const r = im.getBoundingClientRect(), b = box.getBoundingClientRect(); return r.bottom > b.top - 60 && r.top < b.bottom + 60; };
    const step = () => { if (job !== iconJob) return; const t0 = performance.now(); while (imgs.length && performance.now() - t0 < 24) { let k = imgs.findIndex(seen); if (k < 0) k = 0; const im = imgs.splice(k, 1)[0]; im.src = W.itemIcon(im.dataset.icon, im.dataset.slot); } if (imgs.length) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  /* shop: the item you tapped is tried on, with its price and a Buy button under the figure */
  function paintBuy() {
    const el = $('#lk-buy'); if (!el) return; const it = S.sel && C.BY[S.sel]; if (!it || wMode !== 'shop') { el.innerHTML = ''; return; }
    const price = C.PRICE[it.rarity], can = S.me.coins >= price;
    el.innerHTML = `<b>${esc(it.name)}</b><span style="color:${C.RCOL[it.rarity]}">${C.RNAME[it.rarity]}</span><button class="btn black big" data-a="buy" data-v="${it.id}"${can ? '' : ' disabled'}>${can ? 'Buy ' + fmt(price) : 'Need ' + fmt(price - S.me.coins) + ' more'}</button>`;
  }
  function tryOn(id) { const it = C.BY[id], look = Object.assign({}, S.me.look); let pet = S.me.pet, gun = gunFor(); if (it.slot === 'pet') pet = id; else if (it.slot === 'gun') gun = id; else look[it.slot] = id; if (S.stage) S.stage.figure(look, pet, myCol(), gun); }
  function wear(slot, id) {
    if (slot === 'gun') { S.me.gun = id; SFX.click(); send({ t: 'equip', gun: id }); W.setMe(meInfo()); if (S.stage) S.stage.figure(S.me.look, S.me.pet, myCol(), id); if (S.layer === 'locker') paintWardrobe(); return; }
    const look = Object.assign({}, S.me.look); let pet = S.me.pet; if (slot === 'pet') pet = id; else look[slot] = id;
    S.me.look = look; S.me.pet = pet; SFX.click(); send({ t: 'equip', look, pet }); if (S.stage) S.stage.figure(look, pet, myCol(), gunFor()); if (S.layer === 'locker') paintWardrobe();
  }
  function setLook(k, v) { const l = Object.assign({}, S.me.look, { [k]: v }); S.me.look = l; send({ t: 'equip', look: l }); if (S.stage) S.stage.figure(l, S.me.pet, myCol(), gunFor()); paintWardrobe(); }
  /* opening a Mystery Box: tap, it rattles, it opens */
  function reveal() {
    if (!S.me.boxes) return; const back = S.layer; closeLayer();
    const el = document.createElement('div'); el.className = 'reveal'; el.innerHTML = `<div class="top"><h2>Mystery Box</h2><p id="rv-sub">Tap to open</p></div><div class="rv-stage"><canvas id="rv-c"></canvas></div><div class="bottom" id="rv-b"></div>`;
    document.body.appendChild(el);
    const st = W.stage($('#rv-c')); if (!st) { el.remove(); return; } st.gift('box');
    let phase = 'idle', res = null, t0 = 0;
    S.reveal = { result(r) { res = r; }, fail() { finish(); } };
    st.onTick(() => { if (phase !== 'shaking') return; const k = Math.min(1, (performance.now() - t0) / 1200); st.shake(0.4 + k * 1.4); if (res && k >= 1) { phase = 'shown'; show(); } });
    $('#rv-c').addEventListener('pointerdown', () => { if (phase !== 'idle') return; phase = 'shaking'; t0 = performance.now(); $('#rv-sub').textContent = 'Opening…'; send({ t: 'open' }); });
    const show = () => {
      st.calm(); SFX.win(); const r = res;
      if (r.item) { st.item(r.item, r.slot); el.querySelector('.top').innerHTML = `<h2>${esc(r.name)}</h2><p style="color:${C.RCOL[r.rarity]}">${C.RNAME[r.rarity]} ${r.slot === 'acc' ? 'extra' : r.slot}</p>`; el.dataset.rar = r.rarity; if (RANK[r.rarity] >= RANK.legendary) [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 90)); }
      else { st.clear(); el.querySelector('.top').innerHTML = `<h2>+${fmt(r.coins)} coins</h2><p>You already own everything.</p>`; }
      $('#rv-b').innerHTML = (r.item ? '<button class="btn black big" data-rv="wear">Wear it</button>' : '') + (S.me.boxes ? '<button class="btn big" data-rv="again">Open another</button>' : '') + '<button class="btn big" data-rv="done">Done</button>';
    };
    const finish = wearIt => { st.stop(); el.remove(); S.reveal = null; if (wearIt) wear(res.slot, res.item); if (back === 'shop' || back === 'locker') showWardrobe(back); };
    el.addEventListener('click', e => { const b = e.target.closest('[data-rv]'); if (!b) return; const a = b.dataset.rv; if (a === 'again') { finish(); closeLayer(); reveal(); } else finish(a === 'wear'); });
  }


  /* ---------------- guns: fire, health, the death card ---------------- */
  function fire() {
    if (!gunsOn() || S.dead || (S.layer && S.layer !== 'results') || S.reveal || S.crate) return;
    const d = myGun(), t = performance.now(), sf = globalThis.FOUND_LAYOUT.lobby.safe;
    if (W.me && Math.hypot(W.me.x - sf.x, W.me.z - sf.z) < sf.r) { if (t - (S.safeAt || 0) > 2500) { S.safeAt = t; toast('Safe zone. Step out to fight.'); } return; }
    if (t - (S.fireAt || 0) < d.ms) return; S.fireAt = t;
    const ry = W.aimAt(d.range, d); if (W.me) { W.me.ry = ry; W.aimHold = performance.now() + 260; }
    send({ t: 'shoot', ry: +ry.toFixed(3) });
  }
  setInterval(() => { if (S.fireHeld) fire(); }, 30);
  function paintGun() {
    const on = gunsOn(), hp = $('#hp'), fb = $('#fire'), rip = $('#rip');
    hp.hidden = !on; fb.hidden = !on; $('#keys').hidden = !on || !!W.touch; $('#hud').classList.toggle('guns', on);
    if (!on) { rip.hidden = true; return; }
    const r = myRow() || {}, n = S.hp == null ? GUNS.HP : S.hp; $('#hp-n').textContent = Math.max(0, Math.round(n)); const f = $('#hp-fill'); f.style.transform = `scaleX(${Math.max(0, n / GUNS.HP)})`; f.style.background = n > 50 ? '#2fd84a' : n > 25 ? '#ffc61a' : '#ff3b30';
    hp.classList.toggle('low', n <= 25); $('#hp-k').textContent = `${r.kills || 0} kills`;
    const g = myGun(); if (fb.dataset.g !== g.id) { fb.dataset.g = g.id; $('#fire-i').src = W.itemIcon(g.id, 'gun'); } $('#fire-g').textContent = g.name; rip.hidden = !S.dead;
  }
  /* the FIRE button shows the gun and fills back in as it cools; it lights up while held */
  (function cool() { requestAnimationFrame(cool); const fb = $('#fire'); if (fb.hidden) return; const d = myGun(); fb.style.setProperty('--cd', Math.min(1, (performance.now() - (S.fireAt || 0)) / d.ms).toFixed(2)); fb.classList.toggle('held', !!S.fireHeld); })();
  /* the hotbar: every gun you own, strongest last. Keys 1-9 (or a tap) put one in your hand; it shows whenever guns are on */
  const hotGuns = () => C.ITEMS.filter(r => r[1] === 'gun' && owned(r[0])).map(r => r[0]).sort((a, b) => RANK[C.BY[a].rarity] - RANK[C.BY[b].rarity]);
  function selectGun(id) { if (!id || !owned(id)) return; if (S.me.gun !== id) { wear('gun', id); SFX.click(); } paintGun(); paintHotbar(true); }
  let hotSig = '';
  function paintHotbar(force) {
    const hb = $('#hotbar'), show = gunsOn() && !(S.layer && S.layer !== 'results') && !S.reveal && !S.crate && !!S.me;
    if (hb.hidden === show) hb.hidden = !show; if (!show) { hotSig = ''; return; }
    const list = hotGuns(), cur = S.me.gun || GUNS.START, sig = list.join() + '|' + cur;
    if (!force && sig === hotSig) return; const rebuilt = hotSig.split('|')[0] !== list.join(); hotSig = sig;
    if (rebuilt || !hb.children.length) { hb.innerHTML = list.map((id, i) => `<button class="slot r-${C.BY[id].rarity}" style="--rc:${rcol(C.BY[id].rarity)}" data-g="${id}" title="${esc(C.BY[id].name)}">${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}<img alt=""></button>`).join('');
      const imgs = [...hb.querySelectorAll('button')]; (function fill() { const b = imgs.shift(); if (!b) return; b.querySelector('img').src = W.itemIcon(b.dataset.g, 'gun'); requestAnimationFrame(fill); })(); }
    hb.querySelectorAll('.slot').forEach(b => { const on = b.dataset.g === cur; b.classList.toggle('on', on); if (on && rebuilt !== undefined) b.scrollIntoView({ block: 'nearest', inline: 'center' }); });
  }
  $('#hotbar').addEventListener('click', e => { const b = e.target.closest('.slot'); if (b) selectGun(b.dataset.g); });
  setInterval(() => paintHotbar(), 250);
  setInterval(() => { if (!S.dead) return; const left = Math.max(0, Math.ceil((3000 - (Date.now() - (S.deadAt || 0))) / 1000)); const e = $('#rip-n'); if (e) e.textContent = left; }, 200);
  $('#fire').addEventListener('pointerdown', e => { e.preventDefault(); S.fireHeld = true; fire(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#fire').addEventListener(ev, () => { S.fireHeld = false; });
  addEventListener('keyup', e => { if (e.key.toLowerCase() === 'f') S.fireHeld = false; });
  /* right mouse button: hold to fire */
  $('#world').addEventListener('contextmenu', e => { if (gunsOn()) e.preventDefault(); });
  $('#world').addEventListener('pointerdown', e => { if (e.button === 2 && gunsOn()) { e.preventDefault(); S.fireHeld = true; S.rmb = e.pointerId; fire(); } });
  addEventListener('pointerup', e => { if (e.button === 2) { S.fireHeld = false; S.rmb = null; } });
  addEventListener('blur', () => { S.fireHeld = false; });

  /* ---------------- the gun crate: shake, a spinning strip of guns, then the card ---------------- */
  const RFX = { common: { rays: 0, parts: 10, shake: 0, flash: 0.0 }, uncommon: { rays: 0, parts: 18, shake: 0, flash: 0.25 }, rare: { rays: 1, parts: 26, shake: 0.4, flash: 0.45 }, epic: { rays: 1, parts: 40, shake: 0.8, flash: 0.7 }, legendary: { rays: 2, parts: 60, shake: 1.2, flash: 0.9 }, mythic: { rays: 3, parts: 90, shake: 1.8, flash: 1 }, celestial: { rays: 4, parts: 130, shake: 2.4, flash: 1 }, cosmic: { rays: 5, parts: 190, shake: 3, flash: 1 } };
  function crateReveal() {
    if (S.crate) return; if (S.me.coins < C.CRATE.price) { toast(`A Gun Crate costs ${fmt(C.CRATE.price)} coins. You earn 1,000 a minute.`); SFX.nope(); return; }
    const back = S.layer; closeLayer();
    const el = document.createElement('div'); el.className = 'crate-fx';
    el.innerHTML = `<div class="cr-bg"></div><div class="cr-top"><h2>Gun Crate</h2><p id="cr-sub">Tap the crate to open · ${fmt(C.CRATE.price)} coins</p></div><div class="cr-stage"><canvas id="cr-c"></canvas></div>
      <div class="cr-strip" id="cr-strip" hidden><div class="cr-track" id="cr-track"></div><i class="cr-mark"></i></div><div class="cr-flash" id="cr-flash"></div><div class="cr-card" id="cr-card" hidden></div><div class="cr-bottom" id="cr-b"><span class="pill coin coins"></span></div>`;
    document.body.appendChild(el); paintMe();
    const st = W.stage($('#cr-c')); if (!st) { el.remove(); return; } st.crate();
    let phase = 'idle', res = null, t0 = 0;
    S.crate = { result(r) { res = r; }, fail() { finish(); } };
    const order = C.RARITY.filter(r => r !== 'starter'), pool = C.ITEMS.filter(i => i[1] === 'gun' && i[3] !== 'starter');
    st.onTick(() => { if (phase !== 'shaking') return; const k = Math.min(1, (performance.now() - t0) / 1300); st.shake(0.5 + k * 2.2); if (k < 1 && Math.random() < 0.08) SFX.tick(); if (res && k >= 1) { phase = 'strip'; spin(); } });
    $('#cr-c').addEventListener('pointerdown', () => { if (phase !== 'idle') return; phase = 'shaking'; t0 = performance.now(); $('#cr-sub').textContent = 'Opening…'; send({ t: 'crate' }); SFX.click(); });
    const flash = (col, k) => { const f = $('#cr-flash'); f.style.background = col; f.style.setProperty('--k', k); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); };
    /* the strip: 44 guns, the prize at 36, slowing to a stop under the marker */
    function spin() {
      st.calm(); flash('#fff', 0.9); SFX.pop(); $('#cr-c').style.visibility = 'hidden'; const strip = $('#cr-strip'), track = $('#cr-track'); strip.hidden = false; $('#cr-sub').textContent = '';
      const W0 = Math.min(150, Math.max(104, innerWidth / 5)), N = 44, WIN = 36, cells = [];
      for (let i = 0; i < N; i++) { let id; if (i === WIN) id = res.item; else { const r = Math.random() * 100; let acc = 0, rar = 'common'; for (const k of order) { acc += C.CRATE.odds[k]; if (r < acc) { rar = k; break; } } const list = pool.filter(q => q[3] === rar); id = list[Math.floor(Math.random() * list.length)][0]; } cells.push(id); }
      track.innerHTML = cells.map(id => `<div class="cr-c r-${C.BY[id].rarity}" style="width:${W0}px;--rc:${C.RCOL[C.BY[id].rarity]}"><img data-icon="${id}" alt=""><b>${esc(C.BY[id].name)}</b></div>`).join('');
      $$('#cr-track img').forEach(im => { im.src = W.itemIcon(im.dataset.icon, 'gun'); });
      const stripW = strip.clientWidth, jitter = (Math.random() - 0.5) * W0 * 0.6, target = WIN * W0 + W0 / 2 + jitter - stripW / 2, T = 4600, s0 = performance.now(); let lastI = -1;
      const ease = x => 1 - Math.pow(1 - x, 4);
      (function step() { const k = Math.min(1, (performance.now() - s0) / T), x = target * ease(k); track.style.transform = `translateX(${-x}px)`; const i = Math.floor((x + stripW / 2) / W0); if (i !== lastI) { lastI = i; SFX.tick(); }
        if (k < 1) requestAnimationFrame(step); else land(); })();
    }
    function land() {
      phase = 'shown'; const r = res, fx = RFX[r.rarity], col = C.RCOL[r.rarity], d = GUNS.BY[r.item];
      $$('#cr-track .cr-c')[36].classList.add('win'); SFX.win(); if (RANK[r.rarity] >= RANK.legendary) [523, 659, 784, 1047, 1319].concat(RANK[r.rarity] >= RANK.celestial ? [1568, 2093, 2637] : []).forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 90));
      setTimeout(() => {
        flash(RANK[r.rarity] >= RANK.mythic ? '#fff' : col, fx.flash); if (fx.shake) { el.style.setProperty('--sh', fx.shake); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
        const dps = Math.round(d.dmg * d.pellets * 1000 / d.ms), bar = (v, mx) => `<i><u style="width:${Math.min(100, v / mx * 100)}%"></u></i>`;
        const card = $('#cr-card'); card.hidden = false; card.className = `cr-card show r-${r.rarity}`; card.style.setProperty('--rc', col);
        card.innerHTML = `${fx.rays ? `<div class="rays r${fx.rays}"></div>` : ''}<div class="face"><span class="rar">${C.RNAME[r.rarity]}</span><img src="${W.itemIcon(r.item, 'gun')}" alt=""><h3>${esc(r.name)}</h3>
          <div class="stats"><div><span>Damage</span>${bar(d.dmg * d.pellets, 90)}<b>${d.dmg}${d.pellets > 1 ? '×' + d.pellets : ''}</b></div><div><span>Speed</span>${bar(1000 / d.ms, 15)}<b>${(1000 / d.ms).toFixed(1)}/s</b></div><div><span>Range</span>${bar(d.range, 90)}<b>${d.range}</b></div></div>
          <p class="dps">${dps} damage a second${r.equipped ? ' · equipped!' : ''}</p>${r.dup ? `<p class="dup">Duplicate · +${fmt(r.coins)} coins back</p>` : ''}</div>`;
        const parts = document.createElement('div'); parts.className = 'parts'; card.appendChild(parts);
        for (let i = 0; i < fx.parts; i++) { const p = document.createElement('i'), a = Math.random() * 6.283, dist = 120 + Math.random() * (160 + fx.parts * 2); p.style.cssText = `--x:${Math.cos(a) * dist}px;--y:${Math.sin(a) * dist - 40}px;--d:${Math.random() * 0.25}s;--s:${6 + Math.random() * 10}px;background:${r.rarity === 'mythic' || r.rarity === 'cosmic' ? `hsl(${Math.random() * 360},95%,60%)` : r.rarity === 'celestial' ? ['#fff', '#fff2a8', col][i % 3] : Math.random() < 0.3 ? '#fff' : col}`; parts.appendChild(p); }
        $('#cr-b').innerHTML = `${r.equipped || r.dup ? '' : '<button class="btn black big" data-cr="equip">Equip</button>'}<button class="btn big" data-cr="again"${S.me.coins >= C.CRATE.price && r.left ? '' : ' disabled'}>Another ${fmt(C.CRATE.price)}</button><button class="btn big" data-cr="done">Done</button><span class="pill coin coins"></span>`; paintMe();
      }, 450);
    }
    const finish = () => { st.stop(); el.remove(); S.crate = null; if (back === 'shop' || back === 'locker') showWardrobe(back); paintGun(); };
    el.addEventListener('click', e => { const b = e.target.closest('[data-cr]'); if (!b || b.disabled) return; const a = b.dataset.cr; if (a === 'equip') { wear('gun', res.item); b.remove(); } else if (a === 'again') { finish(); crateReveal(); } else finish(); });
  }

  /* ---------------- actions ---------------- */
  const A = {
    play() { $('#home').hidden = true; send({ t: 'play' }); SFX.click(); },
    settings() { showSettings(); SFX.click(); },
    setinv(v) { W.sens.invY = v === '1'; saveSettings(); showSettings(); },
    setsound(v) { muted = v !== '1'; try { localStorage.setItem('found-mute', muted ? '1' : '0'); } catch (e) {} showSettings(); SFX.click(); },
    setreset() { Object.assign(W.sens, SET0); W.setFov(SET0.fov); saveSettings(); showSettings(); },
    /* the menu opens over the lobby; M or the x closes it */
    menu() { const h = $('#home'); h.hidden = !h.hidden; paintMenu(); SFX.click(); },
    /* practice: a party of one starts straight away; the server fills it with computer hiders */
    practice() { $('#home').hidden = true; S.practice = true; send({ t: 'create' }); SFX.click(); },
    /* explore: any map, alone, no server involved */
    explore() { $('#home').hidden = true; if (S.party) { S.explore = true; send({ t: 'leave' }); } else roam(0); SFX.click(); },
    roamnext() { roam((S.roamI + 1) % ROAM.length); }, roamshuffle() { roam(S.roamI, true); },
    roamexit() { send({ t: 'play' }); SFX.click(); },
    start() { send({ t: 'start' }); },
    choose(v) { if (!S.offer) return; S.offer.mine = v; send({ t: 'choose', obj: v }); SFX.click(); $$('.pcard').forEach(c => c.classList.toggle('on', c.dataset.v === v)); },
    lobby() { send({ t: 'lobby' }); },
    tag() { if (!W.tryTag()) SFX.nope(); },
    map() { const ids = ['auto'].concat(globalThis.FOUND_LAYOUT.maps), i = ids.indexOf(S.party.mapPick); send({ t: 'map', id: ids[(i + 1) % ids.length] }); },
    idle() { send({ t: 'idle' }); }, spin() { send({ t: 'spin' }); }, mini() { send({ t: 'mini' }); SFX.click(); },
    minipick(v) { if (S.mini) send({ t: 'minipick', i: +v }); },
    gift(v) { send({ t: 'gift', to: v, n: 100 }); SFX.click(); },
    hs() { S.hsSig = ''; showHS(); SFX.click(); },
    ready() { send({ t: 'ready', v: !(myRow() || {}).ready }); SFX.click(); },
    rules() { showRules(); SFX.click(); },
    rule(v) { const [k, x] = v.split(':'); send({ t: 'rule', k, v: +x }); SFX.click(); },
    stake() { const st = [0, 100, 250, 500], i = st.indexOf(S.party.stake); send({ t: 'stake', n: st[(i + 1) % st.length] }); },
    locker() { $('#home').hidden = true; showWardrobe('locker'); }, shop() { $('#home').hidden = true; showWardrobe('shop'); }, close() { closeLayer(); },
    wtab(v) { wTab = v; S.sel = null; if (S.stage) S.stage.figure(S.me.look, S.me.pet, myCol(), gunFor()); paintWardrobe(); },
    wear(v) { wear(wTab, v); },
    pick(v) { S.sel = v; tryOn(v); SFX.click(); $$('#lk-body .it').forEach(e => e.classList.toggle('on', e.dataset.v === v)); paintBuy(); },
    buy(v) { send({ t: 'buy', item: v }); },
    hair(v) { setLook('hair', v); }, hc(v) { setLook('hc', +v); }, skin(v) { setLook('skin', +v); },
    col(v) { S.me.col = +v; send({ t: 'equip', col: +v }); if (S.stage) S.stage.figure(S.me.look, S.me.pet, W.PC[+v], gunFor()); paintWardrobe(); },
    crate() { crateReveal(); },
    daily() { send({ t: 'daily' }); SFX.pop(); }, buybox() { send({ t: 'buybox' }); SFX.click(); }, open() { reveal(); }
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = A[b.dataset.a]; if (a) { e.preventDefault(); ac(); a(b.dataset.v, b); } });
  $('#home').addEventListener('pointerdown', e => { if (e.target.id === 'home' && S.party) A.menu(); });
  $('#layer').addEventListener('pointerdown', e => { if (e.target.id === 'layer' && ['locker', 'shop'].includes(S.layer)) closeLayer(); });
  $('#name').addEventListener('change', e => { const n = e.target.value.trim(); if (n.length >= 2) send({ t: 'equip', name: n }); });
  addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Escape') { if (!S.reveal && ['locker', 'shop'].includes(S.layer)) closeLayer(); else if (!$('#home').hidden && S.party) A.menu(); return; }
    if (S.layer && S.layer !== 'results') return;
    const k = e.key.toLowerCase();
    if (k === 'e' && !e.repeat) A.tag();
    if (k === 'f') { S.fireHeld = true; fire(); }
    if (gunsOn() && /^[1-9]$/.test(k)) { selectGun(hotGuns()[+k - 1]); return; }   /* with guns on, the number keys pick a gun instead of an emote */
    if (k === '1') send({ t: 'emote', e: 'wave' }); if (k === '2') send({ t: 'emote', e: 'cheer' }); if (k === '3') send({ t: 'emote', e: 'dance' }); if (k === '4') send({ t: 'emote', e: 'spin' }); if (k === '5') send({ t: 'emote', e: 'bow' }); if (k === '6') send({ t: 'emote', e: 'floss' });
    if (k === 'm' && !e.repeat && (W.mode === 'play' || W.mode === 'home') && (!S.party || S.phase === 'lobby')) A.menu();   /* M opens and closes the home menu; sound is in Settings */
  });

  /* ---------------- touch: joystick and jump ---------------- */
  function touchControls(on) { const t = W.touch && on; $('#joy').hidden = !t; $('#jump').hidden = !t; }
  (function joystick() {
    const j = $('#joy'), k = j.querySelector('i'); let id = null, cx = 0, cy = 0;
    let side = 0, sideAt = 0, sideTaps = 0;
    const flick = x => { const sd = x > 30 ? 1 : x < -30 ? -1 : 0; if (sd !== side) { side = sd; if (sd) { const t = performance.now(); sideTaps = sd === (flick.last || 0) && t - sideAt < 320 ? sideTaps + 1 : 1; flick.last = sd; sideAt = t; if (sideTaps >= 2) { sideTaps = 0; W.roll(sd); } } } };
    const set = (x, y) => { flick(x); const r = 46, d = Math.hypot(x, y), s = d > r ? r / d : 1; x *= s; y *= s; k.style.transform = `translate(${x}px,${y}px)`; W.joy.x = x / r; W.joy.y = y / r; if (W.me && (x || y)) W.me.path = null; };
    j.addEventListener('pointerdown', e => { id = e.pointerId; j.setPointerCapture(id); const b = j.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; set(e.clientX - cx, e.clientY - cy); });
    j.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
    const end = e => { if (e.pointerId !== id) return; id = null; set(0, 0); };
    j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
    $('#jump').addEventListener('pointerdown', e => { e.preventDefault(); W.jump(); });
  })();

  /* ---------------- start ---------------- */
  const ok = W.init($('#world'));
  if (!ok) { $('#boot-msg').textContent = 'FOUND needs WebGL. Try another browser.'; return; }
  W.mode = 'home'; loadSettings();
  const fontsReady = document.fonts ? Promise.race([document.fonts.load('40px "Fredoka Bold"'), new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(connect);
  globalThis.FOUND_APP = { S, send, W, fire };   // handy in the console and for tests
})();
