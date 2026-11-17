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
    nope: () => tone(220, 0.14, 'sine', 0.07, 150), click: () => tone(900, 0.03, 'square', 0.025), win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.11), i * 120)) };

  /* ---------------- identity and the socket ---------------- */
  const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
  function ident(reset) { let v = null; try { v = JSON.parse(localStorage.getItem('found-id')); } catch (e) {} if (reset || !v || !v.id) { v = { id: hex(12), key: hex(24) }; try { localStorage.setItem('found-id', JSON.stringify(v)); } catch (e) {} } return v; }
  const hashCode = () => { const m = /^#([A-Za-z]{4})$/.exec(location.hash); return m ? m[1].toUpperCase() : ''; };
  const keepCode = c => { try { c ? sessionStorage.setItem('found-party', c) : sessionStorage.removeItem('found-party'); } catch (e) {} };
  const keptCode = () => { try { return sessionStorage.getItem('found-party') || ''; } catch (e) { return ''; } };
  let ws = null, retry = 0, replaced = false;
  function connect() {
    if (replaced) return;
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => { retry = 0; const id = ident(); send({ t: 'auth', id: id.id, key: id.key, code: hashCode() || keptCode() }); if (hashCode()) history.replaceState(null, '', location.pathname); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } const h = ON[m.t]; if (h) try { h(m); } catch (er) { console.error(m.t, er); } };
    ws.onclose = e => { if (e.code === 4000) { replaced = true; return; } if (S.booted) toast('Reconnecting…'); setTimeout(connect, Math.min(5000, 300 * 2 ** retry++)); };
  }
  const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

  /* ---------------- incoming ---------------- */
  const live = ph => ph === 'hide' || ph === 'seek';
  const myRow = () => S.party && S.me ? S.party.players.find(p => p.id === S.me.id) : null;
  /* a hider in a round is drawn as their object */
  const deco = p => Object.assign({}, p, { asProp: live(S.phase) && p.role === 'hider' && !p.found ? p.prop : null, ghost: live(S.phase) && p.role === 'hider' && p.found });   // a caught hider is out and unseen
  const meInfo = () => { const r = myRow() || {}; return deco({ id: S.me.id, name: S.me.name, look: S.me.look, pet: S.me.pet, col: S.me.col, role: r.role, found: r.found, prop: r.prop }); };
  const playerName = id => { const p = S.party && S.party.players.find(q => q.id === id); return p ? p.name : 'Someone'; };
  const ON = {
    me(m) { S.me = m.me; W.setMe(meInfo()); paintMe(); if (!S.booted) boot(); if (S.layer === 'locker' || S.layer === 'shop') paintWardrobe(true); },
    authfail() { ident(true); ws.close(); },
    replaced() { replaced = true; layer(`<div class="card modal narrow"><div class="mhead"><h2>Opened elsewhere</h2></div><div class="mbody"><p>FOUND is open in another tab or device. Close that one, then reload here.</p><div class="mfoot"><button class="btn black" onclick="location.reload()">Reload</button></div></div></div>`, 'replaced'); },
    party(m) {
      if (m.now) S.skew = m.now - Date.now();
      const was = S.party, prev = S.phase; S.party = m; S.phase = m.phase; keepCode(m.code);
      if (!was || was.code !== m.code) enterParty();
      if (S.practice && m.phase === 'lobby' && m.players.length === 1) { S.practice = false; send({ t: 'start' }); }
      for (const p of m.players) W.upsert(deco(p));
      W.keep(m.players.map(p => p.id)); W.setMe(meInfo());
      const r = myRow() || {}; W.role = live(m.phase) ? r.role : null; W.seeking = m.phase === 'seek'; W.blind = m.phase === 'hide' && r.role === 'seeker'; W.dead = live(m.phase) && !!r.found; W.frozen = W.blind || m.phase === 'results' || W.dead;
      if (prev !== m.phase) phaseChanged(prev, m.phase);
      paintHud(); paintRole();
    },
    tp(m) { W.setMap(m.map, m.seed); W.tp(m.x, m.z, m.ry); },
    unready() { S.hold = W.ring; if (S.hold) toast('Settings changed. Step out and back into the ring to accept.'); },
    pos(m) { W.pos(m.p); },
    fix(m) { W.fix(m.x, m.z); },
    bye(m) { W.drop(m.id); },
    emote(m) { W.emote(m.id, m.e); },
    role(m) { S.offer = m; S.offer.mine = m.picked; showPick(); },
    round(m) {
      S.round = m; closeLayer('pick'); W.setMap(m.map, m.seed); W.setItems(m.items); paintRole();
      if (!m.role) toast('A round is on. You are watching until the next one.');
      else if (!S.tipped[m.role]) { S.tipped[m.role] = 1; tip(m.role === 'hider' ? 'Find a spot and keep still. Moving gives you away.' : W.touch ? 'Walk up to an object and press TAG.' : 'Walk up to an object and press <kbd>E</kbd> or click it.', 9000); }
    },
    taken(m) { const mine = S.me && m.by === S.me.id; W.take(m.item); if (mine) { SFX.pop(); toast('You found a Mystery Box. It is yours after the round.'); } },
    found(m) {
      const mine = S.me && m.by === S.me.id, me = S.me && m.id === S.me.id; if (m.item) W.take(m.item);
      if (me) { SFX.nope(); toast('Caught! You are out this round.'); } else if (mine) { SFX.win(); toast(m.id ? `You caught ${playerName(m.id)}!` : 'Caught one!'); } else { SFX.pop(); feed(m.id ? `${esc(playerName(m.by))} caught ${esc(playerName(m.id))}` : `${esc(playerName(m.by))} caught a hider`); }
    },
    miss(m) { W.nope(m.item); if (S.round) S.round.endAt = m.endAt; if (S.me && m.by === S.me.id) { SFX.nope(); toast('Just an object. 10 seconds lost.'); } },
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
    bought(m) { SFX.pop(); toast(`Bought ${m.r.name}.`); S.sel = null; },
    left() { leaveParty(); },
    err(m) { toast(m.m); SFX.nope(); if (m.of === 'join' || m.of === 'auth') { keepCode(''); if (!S.party) showHome(); } if (m.of === 'open' && S.reveal) S.reveal.fail(); }
  };

  /* ---------------- boot ---------------- */
  function boot() {
    S.booted = true; $('#boot').classList.add('done'); setTimeout(() => $('#boot').remove(), 700);
    if (!S.party) showHome();
    if (S.me.daily) setTimeout(() => toast('Your free Mystery Box is waiting in the shop.'), 1400);
  }
  function paintMe() {
    const m = S.me; if (!m) return; const n = m.boxes + (m.daily ? 1 : 0);
    if (document.activeElement !== $('#name')) $('#name').value = m.name;
    $$('.coins').forEach(e => { e.textContent = fmt(m.coins); });
    $$('.shop-badge').forEach(b => { b.hidden = !n; b.textContent = n; });
    const ib = $('#idle-b'), sb = $('#spin-b'), mb = $('#mini-b');
    if (ib) { ib.innerHTML = `Collect ${fmt(m.idle || 0)}<small>${m.idleRate}/hour while away</small>`; ib.classList.toggle('hot', (m.idle || 0) > 0); }
    if (sb) { sb.innerHTML = `Daily spin<small>${m.spin ? 'Ready' : 'Back tomorrow'}</small>`; sb.classList.toggle('hot', !!m.spin); }
    if (mb) mb.innerHTML = `Odd one out<small>${m.miniLeft ? m.miniLeft + ' paid wins left today' : 'Just for fun today'}</small>`;
  }

  /* ---------------- home and party ---------------- */
  function showHome() {
    $('#roam').hidden = true; W.menuHidden = false; $('#menu-open').hidden = true; $('#home').classList.remove('folded');
    W.mode = 'home'; W.role = null; W.blind = false; W.setMap('lobby'); W.keep([]); W.frozen = false; W.tp(0, 8, Math.PI);
    $('#home').hidden = false; $('#hud').hidden = true; $('#blind').hidden = true; touchControls(false);
    W.homeFrame = innerWidth < 760 ? { side: 0, up: 2.6 } : { side: -3.6, up: 1.2 };
  }
  const ROAM = ['house', 'cabin', 'mansion'];
  function roam(i, shuffle) {
    S.roamI = i; const id = ROAM[i], seed = shuffle || !S.roamSeed ? (Math.random() * 1e9) | 0 : S.roamSeed; S.roamSeed = seed;
    W.mode = 'roam'; W.role = null; W.blind = false; W.dead = false; W.frozen = false; W.menuHidden = true; W.keep([]); W.clearItems(); W.setMap(id, seed);
    const c = globalThis.FOUND_LAYOUT.info(id).center; W.tp(c[0], c[1], Math.PI);   /* start in the middle of the house, where hiders start */
    $('#home').hidden = true; $('#menu-open').hidden = true; $('#hud').hidden = true; $('#roam').hidden = false; touchControls(true);
    $('#roam-name').textContent = globalThis.FOUND_LAYOUT.info(id).name;
  }
  function enterParty() {
    $('#roam').hidden = true; $('#menu-open').hidden = true;
    W.mode = 'play'; $('#home').hidden = true; $('#hud').hidden = false; touchControls(true);
    $('#code-tiles').innerHTML = S.party.code.split('').map(ch => `<b>${ch}</b>`).join(''); W.ring = false;
  }
  function leaveParty() { S.party = null; S.phase = ''; S.round = null; keepCode(''); closeLayer(); W.clearItems(); $('#hud').classList.remove('in-round'); showHome(); }
  function phaseChanged(prev, ph) {
    $('#hud').classList.toggle('in-round', ph !== 'lobby');
    if (ph === 'lobby') { closeLayer('pick'); closeLayer('results'); S.round = null; W.setMap('lobby'); W.ring = false; }
    if (ph === 'pick') closeLayer('results');
    if (ph === 'seek') { SFX.go(); flash('GO'); }
  }

  /* ---------------- HUD ---------------- */
  function paintHud() {
    const P = S.party; if (!P) return; if (S.layer === 'rules') showRules(); const ph = P.phase, meId = S.me && S.me.id;
    $('#board').innerHTML = P.players.map(p => {
      const col = W.PC[p.col % W.PC.length], host = p.id === P.host ? ' <small>HOST</small>' : '';
      const st = ph === 'lobby' ? (p.ready ? 'READY' : '') : p.spec ? 'WATCHING' : p.role === 'seeker' ? 'SEEKER' : ph === 'pick' ? (p.picked ? 'PICKED' : 'PICKING') : 'HIDER';
      return `<div class="prow${p.id === meId ? ' me' : ''}${p.here === false ? ' away' : ''}"><i class="dot" style="background:${col}"></i><span class="nm">${esc(p.name)}${host}</span><span class="st">${st}</span>${ph === 'lobby' && p.id !== meId ? `<button class="btn mini-gift" data-a="gift" data-v="${p.id}">Gift 100</button>` : ''}</div>`;
    }).join('');
    const lb = $('#lobby-bar');
    if (ph === 'lobby') {
      const ready = P.players.filter(p => p.ready).length, isHost = P.host === meId, n = P.players.length;
      const how = P.mode === 'solo' ? 'Practice: you seek 3 hidden objects. Invite a friend for a 1v1.' : P.mode === 'duel' ? '1v1: two rounds, you swap sides.' : `Party of ${n}: ${n >= 7 ? 'two seek' : 'one seeks'}, the rest hide.`;
      const mi = globalThis.FOUND_LAYOUT.info(P.map), mapB = isHost ? `<button class="btn" data-a="map">Map: ${mi.name}${P.mapPick === 'auto' ? '' : ' ✓'}</button>` : `<div class="hint"><span>Map: <b>${mi.name}</b></span></div>`;
      const stakeB = P.mode !== 'duel' ? '' : isHost ? `<button class="btn" data-a="stake">Stake: ${P.stake ? fmt(P.stake) : 'none'}</button>` : P.stake ? `<div class="hint"><span>Stake: <b>${fmt(P.stake)}</b> each</span></div>` : '';
      lb.hidden = false;
      lb.innerHTML = `<div class="hint"><span><b>${how}</b><br>${P.readyAt ? 'Starting…' : `Stand in the READY ring to start · ${ready}/${n}`}</span></div>${mapB}${stakeB}<button class="btn" data-a="rules">Rules${isHost ? '' : ' (view)'}</button>` + (isHost ? `<button class="btn black" data-a="start">Start</button>` : '');
    } else if (!S.tipUntil || Date.now() > S.tipUntil) lb.hidden = true;
  }
  function tip(html, ms) { const lb = $('#lobby-bar'); lb.hidden = false; lb.innerHTML = `<div class="hint"><span>${html}</span></div>`; S.tipUntil = Date.now() + ms; setTimeout(() => { if (Date.now() >= S.tipUntil && S.phase !== 'lobby') lb.hidden = true; }, ms + 50); }
  /* the card that says what you are this round */
  function paintRole() {
    const el = $('#role'), P = S.party, r = myRow(); if (!P || !r || !live(P.phase)) { el.hidden = true; $('#actions').hidden = true; return; }
    el.hidden = false; const left = P.round ? P.round.left : 0;
    if (r.role === 'hider' && !r.found) { const o = OBJ.BY[r.prop] || { name: '' }; el.innerHTML = `<img src="${r.prop ? W.icon(r.prop) : 'mark.svg'}" alt=""><div><h3>You are a</h3><h2>${esc(o.name)}</h2></div>`; }
    else if (r.role === 'seeker') el.innerHTML = `<img src="mark.svg" alt=""><div><h3>Seeker</h3><h2>${left} to find</h2></div>`;
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
    const f = (m.moving ? 1 : 0) | (m.running ? 2 : 0) | (!m.grounded ? 4 : 0), key = [m.x.toFixed(2), m.z.toFixed(2), m.y.toFixed(1), m.ry.toFixed(2), f].join();
    if (key === lastMv && Date.now() - lastMvAt < 1000) return; lastMv = key; lastMvAt = Date.now();
    send({ t: 'mv', x: +m.x.toFixed(2), z: +m.z.toFixed(2), y: +m.y.toFixed(2), ry: +m.ry.toFixed(2), f });
  }, 80);
  W.onRing = inside => { if (!inside) S.hold = false; if (S.party && S.party.phase === 'lobby' && !(inside && S.hold)) { send({ t: 'ready', v: inside }); if (inside) SFX.click(); } };
  W.onGrab = id => send({ t: 'grab', item: id });
  W.onTag = id => { send({ t: 'tag', id }); SFX.click(); };

  /* ---------------- modals ---------------- */
  /* host rules: each row is a setting with its choices; non-hosts see the same panel read-only */
  const RULE_ROWS = [['hide', 'Hiding time', [[0.6, 'Short'], [1, 'Normal'], [1.5, 'Long']], 'How long hiders get to move before the seeker is let in.'],
    ['seek', 'Seeking time', [[0.6, 'Short'], [1, 'Normal'], [1.5, 'Long']], 'How long the seeker has.'],
    ['penalty', 'Wrong tag costs', [[5, '5s'], [10, '10s'], [20, '20s']], 'Seconds lost when the seeker tags an ordinary object.'],
    ['copies', 'Copies of each object', [[2, '2'], [3, '3'], [5, '5']], 'More copies make hiders harder to spot.'],
    ['seekers', 'Seekers', [[0, 'Auto'], [1, 'One'], [2, 'Two']], 'Auto is one seeker, or two from 7 players.']];
  function showRules() {
    const P = S.party; if (!P) return; const host = P.host === (S.me && S.me.id), R = P.rules || {}, T = P.times || { hide: 30000, seek: 150000 };
    const dur = ms => { const s = Math.round(ms / 1000); return s >= 60 ? Math.floor(s / 60) + 'm' + (s % 60 ? ' ' + (s % 60) + 's' : '') : s + 's'; };
    const tl = (base, names) => [[0.6, 'Short'], [1, 'Normal'], [1.5, 'Long']].map(([v, n]) => [v, `${n}<small>${dur(base * v)}</small>`]);
    const rows = RULE_ROWS.map(([k, name, opts, why]) => `<div class="rrow"><div><b>${name}</b><small>${why}</small></div><div class="seg">${(k === 'hide' ? tl(T.hide) : k === 'seek' ? tl(T.seek) : opts).map(([v, l]) => `<button class="${R[k] === v ? 'on' : ''}" ${host ? `data-a="rule" data-v="${k}:${v}"` : 'disabled'}>${l}</button>`).join('')}</div></div>`).join('');
    layer(`<div class="card modal narrow"><div class="mhead"><h2>Rules</h2><span class="sub">${host ? 'You are the host' : 'Set by the host'}</span></div><div class="mbody">${rows}<div class="mfoot"><button class="btn black" data-a="close">Done</button></div></div></div>`, 'rules');
  }
  function layer(html, name) { if (S.stage) { S.stage.stop(); S.stage = null; } const L = $('#layer'); L.innerHTML = html; L.hidden = false; S.layer = name; W.keys = {}; }
  function closeLayer(name) { if (name && S.layer !== name) return; const L = $('#layer'); if (S.stage) { S.stage.stop(); S.stage = null; } L.hidden = true; L.innerHTML = ''; S.layer = null; }
  W.blocked = () => !!S.layer && S.layer !== 'results' || !!S.reveal;

  /* pick: hiders choose a disguise, the seeker waits */
  function showPick() {
    const O = S.offer; if (!O) return; const head = O.of > 1 ? `Round ${O.round} of ${O.of}` : MODE[O.mode] || '';
    const bar = '<div class="bar"><i id="pick-bar"></i></div>';
    if (O.role === 'seeker') return layer(`<div class="card modal narrow"><div class="mhead"><div><h2>You are the seeker</h2><div class="sub">${head}</div></div></div><div class="mbody"><p class="big">${O.mode === 'solo' ? 'Three objects in the house are hiders. Find them. Tagging an ordinary object costs 10 seconds.' : 'The others are choosing an object to hide as. Tag them to catch them. Tagging an ordinary object costs 10 seconds.'}</p>${bar}</div></div>`, 'pick');
    const card = id => { const o = OBJ.BY[id], T = OBJ.TIERS[o.tier]; return `<button class="pcard${O.mine === id ? ' on' : ''}" data-a="choose" data-v="${id}"><img src="${W.icon(id)}" alt=""><b>${esc(o.name)}</b><span class="tier ${o.tier}">${T.name}</span><small>${T.mult > 1 ? '×' + T.mult + ' points' : 'Hardest to spot'}</small></button>`; };
    layer(`<div class="card modal"><div class="mhead"><div><h2>Hide as…</h2><div class="sub">${head ? head + ' · ' : ''}Copies of your object are placed around the house too.</div></div></div>
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
  const SLOTS = [['outfit', 'Outfits'], ['hat', 'Hats'], ['acc', 'Extras'], ['pet', 'Pets']], LOOKS = [['look', 'Hair & skin'], ['col', 'Colour']];
  const RANK = { starter: 0, common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
  let wTab = 'outfit', wMode = 'locker';
  const owned = id => C.STARTER.includes(id) || S.me.own.includes(id);
  const myCol = () => W.PC[S.me.col % W.PC.length];
  function showWardrobe(mode) {
    wMode = mode; S.sel = null; if (mode === 'shop' && (wTab === 'look' || wTab === 'col')) wTab = 'outfit';
    layer(`<div class="card modal"><div class="mhead"><div><h2>${mode === 'shop' ? 'Shop' : 'Locker'}</h2><div class="sub"><span class="pill coin coins"></span></div></div><div class="mtools"><button class="btn sm" data-a="${mode === 'shop' ? 'locker' : 'shop'}">${mode === 'shop' ? 'Locker' : 'Shop'}</button><button class="btn icon" data-a="close" aria-label="Close">&#x2715;</button></div></div>
      <div class="locker"><div class="stage"><canvas id="lk-stage"></canvas><div class="buy" id="lk-buy"></div></div><div class="mbody" id="lk-body"></div></div></div>`, mode);
    S.stage = W.stage($('#lk-stage')); if (S.stage) S.stage.figure(S.me.look, S.me.pet, myCol());
    paintMe(); paintWardrobe();
  }
  let iconJob = 0;
  function paintWardrobe(fromMe) {
    const me = S.me, body = $('#lk-body'); if (!body) return; const shop = wMode === 'shop';
    if (fromMe) { paintMe(); if (S.stage && !S.sel) S.stage.figure(me.look, me.pet, myCol()); }
    const tabs = `<div class="tabs">${SLOTS.concat(shop ? [] : LOOKS).map(s => `<button class="tab${s[0] === wTab ? ' on' : ''}" data-a="wtab" data-v="${s[0]}">${s[1]}</button>`).join('')}</div>`;
    let inner = '';
    if (wTab === 'look') inner = `<h4>Hair</h4><div class="hairs">${D.HAIRS.map(h => `<button class="tab${me.look.hair === h[0] ? ' on' : ''}" data-a="hair" data-v="${h[0]}">${h[1]}</button>`).join('')}</div>
      <h4>Hair colour</h4><div class="swatches">${D.HAIRC.map((c, i) => `<button class="sw${me.look.hc === i ? ' on' : ''}" style="background:${c}" data-a="hc" data-v="${i}" aria-label="Hair colour ${i + 1}"></button>`).join('')}</div>
      <h4>Skin</h4><div class="swatches">${D.SKIN.map((c, i) => `<button class="sw${me.look.skin === i ? ' on' : ''}" style="background:${c}" data-a="skin" data-v="${i}" aria-label="Skin ${i + 1}"></button>`).join('')}</div>`;
    else if (wTab === 'col') inner = `<h4>Your colour</h4><div class="swatches">${W.PC.map((c, i) => `<button class="sw${me.col === i ? ' on' : ''}" style="background:${c}" data-a="col" data-v="${i}" aria-label="Colour ${i + 1}"></button>`).join('')}</div>`;
    else {
      let list = C.ITEMS.filter(r => r[1] === wTab).map(r => C.BY[r[0]]).filter(i => shop ? !owned(i.id) : owned(i.id)).sort((a, b) => RANK[a.rarity] - RANK[b.rarity]);
      const cur = wTab === 'pet' ? me.pet : me.look[wTab];
      const none = !shop && wTab !== 'outfit' ? `<div class="it${!cur ? ' on' : ''}" data-a="wear" data-v=""><i class="none"></i><b>None</b></div>` : '';
      const tile = i => `<div style="border-color:${C.RCOL[i.rarity]}" class="it${(shop ? S.sel === i.id : cur === i.id) ? ' on' : ''}" data-a="${shop ? 'pick' : 'wear'}" data-v="${i.id}"><img data-icon="${i.id}" data-slot="${i.slot}" alt=""><b>${esc(i.name)}</b>${shop ? `<span class="p">${fmt(C.PRICE[i.rarity])}</span>` : ''}<i class="r" style="background:${C.RCOL[i.rarity]}">${C.RNAME[i.rarity]}</i></div>`;
      const box = shop ? `<div class="boxbar"><img src="${W.giftIcon('box')}" alt=""><div><b>Mystery Box${me.boxes ? ' ×' + me.boxes : ''}</b><span>A random item you don't own.</span></div><div class="boxbtns">${me.daily ? '<button class="btn black" data-a="daily">Free today</button>' : ''}${me.boxes ? '<button class="btn black" data-a="open">Open</button>' : ''}<button class="btn" data-a="buybox"${me.coins >= C.BOX.price ? '' : ' disabled'}>Buy ${fmt(C.BOX.price)}</button></div></div>` : '';
      const legend = shop ? `<div class="legend">${['common', 'rare', 'epic', 'legendary', 'mythic'].map(r => `<span style="background:${C.RCOL[r]}">${C.RNAME[r]} ${fmt(C.PRICE[r])}</span>`).join('')}</div><p class="earn-line">Get coins by playing rounds, collecting idle coins, the daily spin and Odd one out.</p>` : '';
      inner = box + legend + (list.length || none ? `<div class="grid">${none}${list.map(tile).join('')}</div>` : `<p class="big">${shop ? 'You own all of these.' : 'Nothing here yet. Visit the shop.'}</p>`);
    }
    body.innerHTML = tabs + inner; paintBuy();
    const job = ++iconJob, imgs = $$('#lk-body img[data-icon]');
    const step = () => { if (job !== iconJob) return; const t0 = performance.now(); while (imgs.length && performance.now() - t0 < 24) { const im = imgs.shift(); im.src = W.itemIcon(im.dataset.icon, im.dataset.slot); } if (imgs.length) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  /* shop: the item you tapped is tried on, with its price and a Buy button under the figure */
  function paintBuy() {
    const el = $('#lk-buy'); if (!el) return; const it = S.sel && C.BY[S.sel]; if (!it || wMode !== 'shop') { el.innerHTML = ''; return; }
    const price = C.PRICE[it.rarity], can = S.me.coins >= price;
    el.innerHTML = `<b>${esc(it.name)}</b><span style="color:${C.RCOL[it.rarity]}">${C.RNAME[it.rarity]}</span><button class="btn black big" data-a="buy" data-v="${it.id}"${can ? '' : ' disabled'}>${can ? 'Buy ' + fmt(price) : 'Need ' + fmt(price - S.me.coins) + ' more'}</button>`;
  }
  function tryOn(id) { const it = C.BY[id], look = Object.assign({}, S.me.look); let pet = S.me.pet; if (it.slot === 'pet') pet = id; else look[it.slot] = id; if (S.stage) S.stage.figure(look, pet, myCol()); }
  function wear(slot, id) {
    const look = Object.assign({}, S.me.look); let pet = S.me.pet; if (slot === 'pet') pet = id; else look[slot] = id;
    S.me.look = look; S.me.pet = pet; SFX.click(); send({ t: 'equip', look, pet }); if (S.stage) S.stage.figure(look, pet, myCol()); if (S.layer === 'locker') paintWardrobe();
  }
  function setLook(k, v) { const l = Object.assign({}, S.me.look, { [k]: v }); S.me.look = l; send({ t: 'equip', look: l }); if (S.stage) S.stage.figure(l, S.me.pet, myCol()); paintWardrobe(); }
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
      if (r.item) { st.item(r.item, r.slot); el.querySelector('.top').innerHTML = `<h2>${esc(r.name)}</h2><p style="color:${C.RCOL[r.rarity]}">${C.RNAME[r.rarity]} ${r.slot === 'acc' ? 'extra' : r.slot}</p>`; }
      else { st.clear(); el.querySelector('.top').innerHTML = `<h2>+${fmt(r.coins)} coins</h2><p>You already own everything.</p>`; }
      $('#rv-b').innerHTML = (r.item ? '<button class="btn black big" data-rv="wear">Wear it</button>' : '') + (S.me.boxes ? '<button class="btn big" data-rv="again">Open another</button>' : '') + '<button class="btn big" data-rv="done">Done</button>';
    };
    const finish = wearIt => { st.stop(); el.remove(); S.reveal = null; if (wearIt) wear(res.slot, res.item); if (back === 'shop' || back === 'locker') showWardrobe(back); };
    el.addEventListener('click', e => { const b = e.target.closest('[data-rv]'); if (!b) return; const a = b.dataset.rv; if (a === 'again') { finish(); closeLayer(); reveal(); } else finish(a === 'wear'); });
  }

  /* ---------------- actions ---------------- */
  const A = {
    create() { send({ t: 'create' }); SFX.click(); },
    join() { const c = $('#code').value.trim().toUpperCase(); if (!/^[A-Z]{4}$/.test(c)) { toast('Party codes are 4 letters.'); return; } send({ t: 'join', code: c }); SFX.click(); },
    leave() { send({ t: 'leave' }); },
    /* fold the home menu away to walk the plaza, or bring it back */
    menu() { const h = $('#home'), fold = !W.menuHidden; W.menuHidden = fold; h.classList.toggle('folded', fold); $('#menu-open').hidden = !fold; touchControls(fold); SFX.click(); },
    /* practice: a party of one starts straight away; the server fills it with computer hiders */
    practice() { S.practice = true; send({ t: 'create' }); SFX.click(); },
    /* explore: any map, alone, no server involved */
    explore() { roam(0); SFX.click(); },
    roamnext() { roam((S.roamI + 1) % ROAM.length); }, roamshuffle() { roam(S.roamI, true); },
    roamexit() { showHome(); SFX.click(); },
    copy() { const url = location.origin + '/#' + S.party.code; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Invite link copied. Friends can also type ' + S.party.code + '.'), () => toast('Party code: ' + S.party.code)); },
    start() { send({ t: 'start' }); },
    choose(v) { if (!S.offer) return; S.offer.mine = v; send({ t: 'choose', obj: v }); SFX.click(); $$('.pcard').forEach(c => c.classList.toggle('on', c.dataset.v === v)); },
    lobby() { send({ t: 'lobby' }); },
    tag() { if (!W.tryTag()) SFX.nope(); },
    map() { const ids = ['auto'].concat(globalThis.FOUND_LAYOUT.maps), i = ids.indexOf(S.party.mapPick); send({ t: 'map', id: ids[(i + 1) % ids.length] }); },
    idle() { send({ t: 'idle' }); }, spin() { send({ t: 'spin' }); }, mini() { send({ t: 'mini' }); SFX.click(); },
    minipick(v) { if (S.mini) send({ t: 'minipick', i: +v }); },
    gift(v) { send({ t: 'gift', to: v, n: 100 }); SFX.click(); },
    rules() { showRules(); SFX.click(); },
    rule(v) { const [k, x] = v.split(':'); send({ t: 'rule', k, v: +x }); SFX.click(); },
    stake() { const st = [0, 100, 250, 500], i = st.indexOf(S.party.stake); send({ t: 'stake', n: st[(i + 1) % st.length] }); },
    locker() { showWardrobe('locker'); }, shop() { showWardrobe('shop'); }, close() { closeLayer(); },
    wtab(v) { wTab = v; S.sel = null; if (S.stage) S.stage.figure(S.me.look, S.me.pet, myCol()); paintWardrobe(); },
    wear(v) { wear(wTab, v); },
    pick(v) { S.sel = v; tryOn(v); SFX.click(); $$('#lk-body .it').forEach(e => e.classList.toggle('on', e.dataset.v === v)); paintBuy(); },
    buy(v) { send({ t: 'buy', item: v }); },
    hair(v) { setLook('hair', v); }, hc(v) { setLook('hc', +v); }, skin(v) { setLook('skin', +v); },
    col(v) { S.me.col = +v; send({ t: 'equip', col: +v }); if (S.stage) S.stage.figure(S.me.look, S.me.pet, W.PC[+v]); paintWardrobe(); },
    daily() { send({ t: 'daily' }); SFX.pop(); }, buybox() { send({ t: 'buybox' }); SFX.click(); }, open() { reveal(); }
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = A[b.dataset.a]; if (a) { e.preventDefault(); ac(); a(b.dataset.v, b); } });
  $('#layer').addEventListener('pointerdown', e => { if (e.target.id === 'layer' && ['locker', 'shop'].includes(S.layer)) closeLayer(); });
  $('#name').addEventListener('change', e => { const n = e.target.value.trim(); if (n.length >= 2) send({ t: 'equip', name: n }); });
  $('#code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') A.join(); });
  addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Escape') { if (!S.reveal && ['locker', 'shop'].includes(S.layer)) closeLayer(); return; }
    if (S.layer && S.layer !== 'results') return;
    const k = e.key.toLowerCase();
    if (k === 'e' && !e.repeat) A.tag();
    if (k === '1') send({ t: 'emote', e: 'wave' }); if (k === '2') send({ t: 'emote', e: 'cheer' }); if (k === '3') send({ t: 'emote', e: 'dance' }); if (k === '4') send({ t: 'emote', e: 'spin' }); if (k === '5') send({ t: 'emote', e: 'bow' }); if (k === '6') send({ t: 'emote', e: 'floss' });
    if (k === 'm') { muted = !muted; try { localStorage.setItem('found-mute', muted ? '1' : '0'); } catch (er) {} toast(muted ? 'Sound off' : 'Sound on'); }
  });

  /* ---------------- touch: joystick and jump ---------------- */
  function touchControls(on) { const t = W.touch && on; $('#joy').hidden = !t; $('#jump').hidden = !t; }
  (function joystick() {
    const j = $('#joy'), k = j.querySelector('i'); let id = null, cx = 0, cy = 0;
    const set = (x, y) => { const r = 46, d = Math.hypot(x, y), s = d > r ? r / d : 1; x *= s; y *= s; k.style.transform = `translate(${x}px,${y}px)`; W.joy.x = x / r; W.joy.y = y / r; if (W.me && (x || y)) W.me.path = null; };
    j.addEventListener('pointerdown', e => { id = e.pointerId; j.setPointerCapture(id); const b = j.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; set(e.clientX - cx, e.clientY - cy); });
    j.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
    const end = e => { if (e.pointerId !== id) return; id = null; set(0, 0); };
    j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
    $('#jump').addEventListener('pointerdown', e => { e.preventDefault(); W.jump(); });
  })();

  /* ---------------- start ---------------- */
  const ok = W.init($('#world'));
  if (!ok) { $('#boot-msg').textContent = 'FOUND needs WebGL. Try another browser.'; return; }
  W.mode = 'home';
  const fontsReady = document.fonts ? Promise.race([document.fonts.load('40px "Fredoka Bold"'), new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(connect);
  globalThis.FOUND_APP = { S, send, W };   // handy in the console and for tests
})();
