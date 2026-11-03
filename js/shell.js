/* Flipside shell: shared runner, full-screen player, thumb joystick, sound, scores */
(() => {
  'use strict';
  const games = [], byId = {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- colours from CSS tokens ----------
  const C = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    Object.assign(C, {
      board: g('--board'), paper: g('--paper'), paper2: g('--paper-2'), ink: g('--ink'), soft: g('--ink-soft'),
      red: g('--red'), blue: g('--blue'), leaf: g('--leaf'), eye: g('--eye'), dot: g('--dot'), line: g('--line'), pupil: '#111'
    });
  }
  readColors();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors); } catch (e) {}
  try { new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] }); } catch (e) {}

  // ---------- sound + haptics ----------
  let ac = null, soundOn = true;
  try { soundOn = localStorage.getItem('flipside-sound') !== 'off'; } catch (e) {}
  function tone(f, dur, type = 'square', vol = .045, slide = 0, delay = 0) {
    if (!soundOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + .02);
    } catch (e) {}
  }
  const sfx = {
    blip() { tone(660, .05, 'square', .03); },
    good() { tone(880, .07); tone(1320, .09, 'square', .04, 0, .06); },
    great() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .12, 'square', .045, 0, i * .08)); },
    bad() { tone(320, .4, 'sawtooth', .06, 55); },
    boom() { tone(160, .35, 'sawtooth', .07, 40); },
    hop() { tone(300, .12, 'triangle', .05, 620); },
    shoot() { tone(900, .06, 'square', .02, 300); },
    steal() { tone(500, .12, 'triangle', .05, 220); },
    start() { tone(392, .08); tone(587, .12, 'square', .045, 0, .09); }
  };
  const mute = Object.fromEntries(Object.keys(sfx).map(k => [k, () => {}]));
  function buzz(p) { try { if (soundOn && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  // ---------- drawing helpers ----------
  const D = {
    circle(c, x, y, r, col) { c.beginPath(); c.arc(x, y, Math.max(.1, r), 0, Math.PI * 2); c.fillStyle = col; c.fill(); },
    ellipse(c, x, y, rx, ry, rot, col) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, Math.PI * 2); c.fillStyle = col; c.fill(); },
    rr(c, x, y, w, h, r, col, stroke, lw) {
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
      if (col) { c.fillStyle = col; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); }
    },
    text(c, s, x, y, size, col, align = 'center', outline) {
      c.font = `700 ${size}px Silkscreen, ui-monospace, monospace`;
      c.textAlign = align; c.textBaseline = 'middle';
      if (outline) { c.lineWidth = Math.max(2, size * .25); c.strokeStyle = outline; c.lineJoin = 'round'; c.strokeText(s, x, y); }
      c.fillStyle = col; c.fillText(s, x, y);
    },
    bg(c, W, H, step = 15) {
      c.fillStyle = C.board; c.fillRect(0, 0, W, H);
      c.fillStyle = C.dot;
      for (let x = step; x < W; x += step) for (let y = step; y < H; y += step) c.fillRect(x - 1, y - 1, 2, 2);
    },
    eyes(c, x, y, sep, r, lx, ly) {
      const l = Math.hypot(lx, ly) || 1; lx /= l; ly /= l;
      for (const s of [-1, 1]) { const ex = x + s * sep; D.circle(c, ex, y, r, C.eye); D.circle(c, ex + lx * r * .42, y + ly * r * .42, r * .52, C.pupil); }
    }
  };

  // ---------- particles + floating text ----------
  function Effects() {
    return {
      parts: [], floats: [], shake: 0,
      burst(x, y, col, n = 14, p = 1) {
        if (reduced) n = Math.ceil(n / 3);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.283, v = (40 + Math.random() * 130) * p;
          this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, life: 1, col, s: 2 + Math.random() * 5 });
        }
      },
      float(x, y, t, col) { this.floats.push({ x, y, t, col, life: 1 }); },
      update(dt) {
        const s = dt / 1000;
        for (const p of this.parts) { p.x += p.vx * s; p.y += p.vy * s; p.vy += 520 * s; p.life -= s * 1.4; }
        this.parts = this.parts.filter(p => p.life > 0);
        for (const f of this.floats) { f.y -= 34 * s; f.life -= s; }
        this.floats = this.floats.filter(f => f.life > 0);
        this.shake = Math.max(0, this.shake - dt * .03);
      },
      draw(c) {
        for (const p of this.parts) { c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.col; c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
        c.globalAlpha = 1;
        for (const f of this.floats) { c.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6)); D.text(c, f.t, f.x, f.y, 14, f.col, 'center', C.board); }
        c.globalAlpha = 1;
      }
    };
  }

  function blankInput() { return { x: 0, y: 0, dir4: null, active: false, pressed: {}, held: {} }; }

  // ---------- runner: one game instance on one canvas ----------
  class Runner {
    constructor(cv, def, opts = {}) {
      this.cv = cv; this.ctx = cv.getContext('2d'); this.def = def; this.opts = opts;
      this.input = opts.input || blankInput(); this.paused = false; this.scale = 1; this.dpr = 1;
      this.reset();
    }
    reset() { this.fx = Effects(); this.ended = false; this.game = this.def.create(this.api(), { demo: !!this.opts.demo }); }
    api() {
      const r = this;
      return {
        C, D, reduced, W: r.def.W, H: r.def.H,
        sfx: r.opts.demo ? mute : sfx, buzz: r.opts.demo ? () => {} : buzz,
        burst: (...a) => r.fx.burst(...a), float: (...a) => r.fx.float(...a),
        shake: n => { if (!reduced) r.fx.shake = Math.max(r.fx.shake, n); },
        flash: t => { if (r.opts.onFlash) r.opts.onFlash(t); },
        zone: r.opts.zone || null,
        end: (sum = {}) => {
          if (r.ended) return; r.ended = true;
          if (r.opts.demo) { setTimeout(() => r.reset(), 1000); return; }
          setTimeout(() => r.opts.onEnd && r.opts.onEnd(sum), sum.delay ?? 850);
        }
      };
    }
    fit(bw, bh) {
      const { W, H } = this.def;
      let w = bw, h = w * H / W;
      if (h > bh) { h = bh; w = h * W / H; }
      w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
      this.dpr = Math.min(window.devicePixelRatio || 1, 2); this.scale = w / W;
      this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
      this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    }
    step(dt, now) {
      if (!this.paused) { this.game.update(Math.min(dt, 40), this.input); this.fx.update(dt); }
      this.input.pressed = {};
      this.render(now);
    }
    render(now) {
      const c = this.ctx;
      c.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
      c.save();
      if (this.fx.shake > 0) c.translate((Math.random() - .5) * this.fx.shake, (Math.random() - .5) * this.fx.shake);
      this.game.draw(c, now);
      this.fx.draw(c);
      c.restore();
    }
  }

  // ---------- best scores ----------
  function getBest(id) {
    try {
      let v = parseInt(localStorage.getItem('flipside-best-' + id) || '0', 10) || 0;
      if (id === 'apple') v = Math.max(v, parseInt(localStorage.getItem('flipside-apple-best') || '0', 10) || 0);
      return v;
    } catch (e) { return 0; }
  }
  function setBest(id, v) { try { localStorage.setItem('flipside-best-' + id, String(v)); } catch (e) {} }

  // ---------- player ----------
  const $ = id => document.getElementById(id);
  let player, pCanvas, pStage, pOv, pFlash, pHud, pZone, pHint, pBtns, knob, knobDot, pSound;
  let runner = null, current = null, wake = null, lastFocus = null, bestNow = 0, hudT = 0;
  const input = blankInput();
  const finePointer = () => matchMedia('(pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches;

  function resetInput() { input.ptr = null; tp = null; input.x = 0; input.y = 0; input.dir4 = null; input.active = false; input.pressed = {}; input.held = {}; held.clear(); lastKey = null; jp = null; if (knob) knob.hidden = true; }

  function fitPlayer() { if (!runner) return; const r = pStage.getBoundingClientRect(); runner.fit(r.width - 14, r.height - 14); }

  function openGame(id) {
    const def = byId[id]; if (!def) return;
    if (player.hidden) lastFocus = document.activeElement;
    current = def; bestNow = getBest(id);
    player.hidden = false;
    document.documentElement.classList.add('playing');
    $('pNum').textContent = def.num; $('pName').textContent = def.name;
    player.dataset.game = def.id;
    resetInput();
    pBtns.innerHTML = '';
    pZone.dataset.mode = def.controls;
    pHint.textContent = finePointer() ? def.keys : def.hint;
    if (def.buttons) for (const b of def.buttons) {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'p-action'; el.textContent = b.label;
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); input.pressed[b.id] = true; input.held[b.id] = true; el.classList.add('on'); buzz(8); });
      const up = () => { input.held[b.id] = false; el.classList.remove('on'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
      pBtns.appendChild(el);
    }
    runner = new Runner(pCanvas, def, { input, zone: def.controls === 'custom' ? pBtns : null, onEnd, onFlash: flash });
    runner.paused = true;
    fitPlayer(); requestAnimationFrame(fitPlayer);
    renderHud();
    showIntro();
  }

  function overlay(html, actions) {
    pOv.innerHTML = `<div class="ov-card">${html}</div>`;
    pOv.hidden = false;
    pOv.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); actions[b.dataset.act](); }));
    const f = pOv.querySelector('[data-act]'); if (f) f.focus({ preventScroll: true });
  }
  function showIntro() {
    overlay(`<span class="ov-num">Game ${current.num} · flip of ${current.flipOf}</span><h3>${current.role}</h3><p>${current.intro}</p><p class="ov-how">${finePointer() ? current.keys : current.hint}</p><button class="btn" type="button" data-act="play">Play</button>`, { play: startRun });
  }
  function startRun() {
    if (!runner) return;
    runner.reset(); runner.paused = false; pOv.hidden = true; resetInput();
    sfx.start(); buzz(12); lockWake(); renderHud();
  }
  function onEnd(sum) {
    if (!runner) return;
    runner.paused = true;
    const sc = Math.max(0, Math.round(runner.game.score()));
    const isBest = sc > bestNow && sc > 0;
    if (isBest) { bestNow = sc; setBest(current.id, sc); updateCardBests(); }
    renderHud();
    const i = games.indexOf(current), next = games[(i + 1) % games.length];
    overlay(`<h3>${sum.title || 'Game over'}</h3><span class="big">${sc}</span>${isBest ? '<span class="newbest">New best!</span>' : `<span class="ov-num">Best ${bestNow}</span>`}<p>${sum.text || ''}</p>${sum.quip ? `<p><b>${sum.quip}</b></p>` : ''}<div class="ov-actions"><button class="btn" type="button" data-act="again">Again</button><button class="btn ghost" type="button" data-act="next">Next: ${next.name}</button></div>`,
      { again: startRun, next: () => openGame(next.id) });
    buzz([20, 60, 30]);
  }
  function pause() {
    if (!runner || runner.paused || runner.ended || !pOv.hidden) return;
    runner.paused = true;
    overlay(`<h3>Paused</h3><p>${current.pauseLine || 'The hero is pretending to wait.'}</p><div class="ov-actions"><button class="btn" type="button" data-act="resume">Resume</button><button class="btn ghost" type="button" data-act="restart">Restart</button></div>`,
      { resume: () => { runner.paused = false; pOv.hidden = true; resetInput(); }, restart: startRun });
  }
  function closeGame() {
    if (player.hidden) return;
    player.hidden = true; document.documentElement.classList.remove('playing');
    runner = null; current = null; pOv.hidden = true; pOv.innerHTML = ''; resetInput(); releaseWake();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function flash(t) { pFlash.textContent = t; pFlash.classList.remove('go'); void pFlash.offsetWidth; pFlash.classList.add('go'); }
  function renderHud() {
    if (!runner) return;
    const items = runner.game.hud();
    pHud.innerHTML = items.map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('') + `<div><span>Best</span><b>${bestNow}</b></div>`;
  }
  async function lockWake() { try { if (!wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {} }
  function releaseWake() { try { if (wake) wake.release(); } catch (e) {} wake = null; }

  // ---------- floating thumb joystick ----------
  let jp = null, tp = null; const R = 46;
  function setPtr(e, down) { const r = pCanvas.getBoundingClientRect(); input.ptr = { x: (e.clientX - r.left - 3) / runner.scale, y: (e.clientY - r.top - 3) / runner.scale, down }; }
  function setStick(x, y) {
    const prevY = input.y;
    input.x = Math.max(-1, Math.min(1, x)); input.y = Math.max(-1, Math.min(1, y));
    const m = Math.hypot(x, y);
    let d = null;
    if (m > .32) d = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
    if (d && d !== input.dir4) { input.pressed['dir_' + d] = true; buzz(5); }
    input.dir4 = d;
    if (prevY > -.55 && input.y <= -.55) input.pressed.up = true;
  }
  function jStart(e) {
    if (!runner || runner.paused || !current || current.controls === 'custom') return;
    if (e.target.closest('button, .ov-card')) return;
    if (current.controls === 'tap') {
      e.preventDefault(); tp = e.pointerId;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      setPtr(e, true); buzz(5); return;
    }
    e.preventDefault();
    jp = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    knob.hidden = false; knob.style.left = e.clientX + 'px'; knob.style.top = e.clientY + 'px';
    knobDot.style.transform = 'translate(-50%,-50%)';
    input.active = true;
  }
  function jMove(e) {
    if (tp !== null && e.pointerId === tp && runner) { setPtr(e, true); return; }
    if (!jp || e.pointerId !== jp.id) return;
    let dx = e.clientX - jp.ox, dy = e.clientY - jp.oy;
    const m = Math.hypot(dx, dy);
    if (m > R) { const k = (m - R) / m; jp.ox += dx * k; jp.oy += dy * k; dx = e.clientX - jp.ox; dy = e.clientY - jp.oy; knob.style.left = jp.ox + 'px'; knob.style.top = jp.oy + 'px'; }
    setStick(dx / R, dy / R);
    knobDot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  function jEnd(e) { if (tp !== null && e.pointerId === tp) { tp = null; if (input.ptr) input.ptr.down = false; return; } if (!jp || e.pointerId !== jp.id) return; jp = null; knob.hidden = true; setStick(0, 0); input.active = false; }

  // ---------- keyboard ----------
  const held = new Set(); let lastKey = null;
  const TAP = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, KeyZ: 6, KeyX: 7, KeyC: 8, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8 };
  const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function keyStick() {
    if (jp) return;
    const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
    input.x = x; input.y = y;
    input.dir4 = lastKey && held.has(lastKey) ? lastKey : null;
    input.active = held.size > 0;
  }
  function onKeyDown(e) {
    if (player.hidden) return;
    if (e.code === 'Escape') { closeGame(); return; }
    if (e.code === 'Space' || e.code === 'KeyP') {
      if (e.target && e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      if (!pOv.hidden) { const b = pOv.querySelector('[data-act]'); if (b) b.click(); } else pause();
      return;
    }
    if (current && current.controls === 'tap' && e.code in TAP) { e.preventDefault(); input.held['hole' + TAP[e.code]] = true; return; }
    const d = KEYS[e.code];
    if (d) {
      e.preventDefault();
      if (!e.repeat) { held.add(d); lastKey = d; input.pressed['dir_' + d] = true; if (d === 'up') input.pressed.up = true; }
      keyStick(); return;
    }
    const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (n >= 0) input.pressed['pick' + (n + 1)] = true;
  }
  function onKeyUp(e) {
    if (current && current.controls === 'tap' && e.code in TAP) { input.held['hole' + TAP[e.code]] = false; return; }
    const d = KEYS[e.code];
    if (d) { held.delete(d); if (lastKey === d) lastKey = [...held].pop() || null; keyStick(); }
  }

  // ---------- landing page helpers ----------
  function updateCardBests() {
    document.querySelectorAll('[data-best]').forEach(el => { const v = getBest(el.dataset.best); el.textContent = v ? `Best ${v}` : ''; });
  }

  let demo = null, demoVisible = true;
  function bootDemo() {
    const cv = $('demo'); if (!cv || !byId.apple) return;
    demo = new Runner(cv, byId.apple, { demo: true });
    const box = cv.parentElement;
    const fitD = () => { const r = box.getBoundingClientRect(); if (r.width) demo.fit(r.width, r.height); };
    fitD();
    try { new ResizeObserver(fitD).observe(box); } catch (e) { addEventListener('resize', fitD); }
    try { new IntersectionObserver(es => { demoVisible = es[0].isIntersecting; }).observe(box); } catch (e) {}
  }

  function setSound(on) {
    soundOn = on;
    try { localStorage.setItem('flipside-sound', on ? 'on' : 'off'); } catch (e) {}
    pSound.setAttribute('aria-pressed', String(on));
    pSound.setAttribute('aria-label', on ? 'Sound and vibration on' : 'Sound and vibration off');
  }

  function boot() {
    player = $('player'); pCanvas = $('pCanvas'); pStage = $('pStage'); pOv = $('pOv'); pFlash = $('pFlash');
    pHud = $('pHud'); pZone = $('pZone'); pHint = $('pHint'); pBtns = $('pBtns'); knob = $('knob'); knobDot = knob.querySelector('i'); pSound = $('pSound');
    setSound(soundOn);
    $('pClose').addEventListener('click', closeGame);
    $('pPause').addEventListener('click', pause);
    pSound.addEventListener('click', () => setSound(!soundOn));
    for (const el of [pStage, pZone]) {
      el.addEventListener('pointerdown', jStart);
      el.addEventListener('pointermove', jMove);
      el.addEventListener('pointerup', jEnd);
      el.addEventListener('pointercancel', jEnd);
    }
    player.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('keydown', onKeyDown);
    addEventListener('keyup', onKeyUp);
    try { new ResizeObserver(fitPlayer).observe(pStage); } catch (e) { addEventListener('resize', fitPlayer); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    document.querySelectorAll('[data-game]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); openGame(el.dataset.game); }));
    updateCardBests();
    bootDemo();
    const h = (location.hash || '').replace('#', '');
    if (h.startsWith('play-') && byId[h.slice(5)]) openGame(h.slice(5));
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(50, now - last); last = now;
      if (runner) { runner.step(dt, now); hudT += dt; if (hudT > 120) { hudT = 0; renderHud(); } }
      else if (demo && demoVisible) demo.step(dt, now);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  window.FLIP = { register(def) { games.push(def); byId[def.id] = def; }, games, byId, boot, Runner, C, D, blankInput };
})();
