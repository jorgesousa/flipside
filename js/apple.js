/* Game 01 — Apple: the snake game, flipped. You're the apple. */
(() => {
  const COLS = 15, ROWS = 15, N = COLS * ROWS, CS = 20;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DLIST = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const idx = (x, y) => y * COLS + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const px = v => (v + .5) * CS;

  function makeSnake(hx, hy, dx, dy, len) { const s = []; for (let i = 0; i < len; i++) s.push({ x: hx - dx * i, y: hy - dy * i }); return s; }
  function bfs(g, sx, sy) {
    const d = new Int16Array(N).fill(-1), q = new Int16Array(N);
    let h = 0, t = 0; const s = idx(sx, sy); d[s] = 0; q[t++] = s;
    while (h < t) {
      const c = q[h++], cx = c % COLS, cy = (c / COLS) | 0;
      for (const [dx, dy] of DLIST) {
        const nx = cx + dx, ny = cy + dy; if (!inb(nx, ny)) continue;
        const ni = idx(nx, ny); if (g[ni] || d[ni] >= 0) continue;
        d[ni] = d[c] + 1; q[t++] = ni;
      }
    }
    return d;
  }
  function flood(g, x, y) { const d = bfs(g, x, y); let n = 0; for (let i = 0; i < N; i++) if (d[i] >= 0) n++; return n; }
  const quips = ['Snack status: snacked.', 'Five a day. You were one of them.', 'The snake thanks you for your service.', 'Core memory unlocked.', 'Keeps the doctor away. Not the snake.', 'Delicious. Would chase again.'];

  class Apple {
    constructor(api, demo) {
      this.api = api; this.demo = demo;
      const snake = makeSnake(5, 2, 1, 0, 4);
      Object.assign(this, {
        a: { x: 7, y: 11, fx: 7, fy: 11, dir: null, hop: 1 },
        snake, prev: snake.map(p => ({ ...p })), sdir: [1, 0], grow: 0,
        seeds: [], t: 0, aAcc: 0, sAcc: 0, gAcc: 0, seedAcc: 2500,
        seedsGot: 0, traps: 0, freeze: demo ? 0 : 900, dead: false, pending: null
      });
      if (!demo) api.float(150, 190, 'RUN!', api.C.red);
    }
    get aInt() { return this.demo ? 150 : 128; }
    sInt() { return Math.max(100, 255 - this.t * 3.2); }
    grid(freeTail) {
      const g = new Uint8Array(N), L = this.snake.length;
      for (let i = 0; i < L; i++) { if (freeTail && i === L - 1) continue; const p = this.snake[i]; g[idx(p.x, p.y)] = 1; }
      return g;
    }
    score() { return Math.floor(this.t * 10) + this.seedsGot * 25 + this.traps * 100; }
    hud() { return [['Score', this.score()], ['Time', this.t.toFixed(1) + 's']]; }

    respawn() {
      let best = null, bd = -1;
      const len = Math.min(10, 4 + Math.floor(this.t / 15));
      for (let k = 0; k < 400; k++) {
        const hz = Math.random() < .5;
        const dx = hz ? (Math.random() < .5 ? 1 : -1) : 0, dy = hz ? 0 : (Math.random() < .5 ? 1 : -1);
        const hx = (Math.random() * COLS) | 0, hy = (Math.random() * ROWS) | 0;
        const segs = makeSnake(hx, hy, dx, dy, len);
        if (!segs.every(p => inb(p.x, p.y) && !(p.x === this.a.x && p.y === this.a.y))) continue;
        if (!inb(hx + dx, hy + dy)) continue;
        const d = Math.abs(hx - this.a.x) + Math.abs(hy - this.a.y);
        if (d > bd) { bd = d; best = { segs, dx, dy }; }
      }
      if (!best) best = { segs: makeSnake(5, 2, 1, 0, 4), dx: 1, dy: 0 };
      this.snake = best.segs; this.prev = this.snake.map(p => ({ ...p }));
      this.sdir = [best.dx, best.dy]; this.grow = 0; this.freeze = 1100; this.sAcc = 0;
    }
    trapped() {
      const h = this.snake[0], api = this.api;
      api.burst(px(h.x), px(h.y), api.C.blue, 26, 1.4);
      if (!this.demo) {
        this.traps++; api.shake(10); api.float(px(h.x), px(h.y), '+100', api.C.red);
        api.flash('It bit itself!'); api.sfx.great(); api.buzz([30, 40, 30]);
      }
      this.respawn();
    }
    caught() {
      this.dead = true;
      const api = this.api;
      api.burst(px(this.a.x), px(this.a.y), api.C.red, 30, 1.6);
      api.shake(14); api.sfx.bad(); api.buzz(120);
      api.end({
        title: 'Chomp.',
        text: `You lasted ${this.t.toFixed(1)} s, grabbed ${this.seedsGot} seed${this.seedsGot === 1 ? '' : 's'} and tricked the snake ${this.traps} time${this.traps === 1 ? '' : 's'}.`,
        quip: quips[(Math.random() * quips.length) | 0]
      });
    }
    snakeStep() {
      this.prev = this.snake.map(p => ({ ...p }));
      const head = this.snake[0], g = this.grid(this.grow === 0);
      const opts = [];
      for (const [dx, dy] of DLIST) { const nx = head.x + dx, ny = head.y + dy; if (inb(nx, ny) && !g[idx(nx, ny)]) opts.push({ x: nx, y: ny, dx, dy }); }
      if (!opts.length) { this.trapped(); return; }
      const da = bfs(g, this.a.x, this.a.y);
      g[idx(head.x, head.y)] = 1;
      for (const o of opts) { o.dist = da[idx(o.x, o.y)]; o.area = flood(g, o.x, o.y); }
      const L = this.snake.length;
      const smart = Math.min(.9, .3 + this.t * .012), wander = Math.max(.03, .2 - this.t * .004);
      const byArea = opts.slice().sort((a, b) => b.area - a.area);
      const reach = opts.filter(o => o.dist >= 0).sort((a, b) => a.dist - b.dist || b.area - a.area);
      let pick;
      if (reach.length) {
        pick = reach[0];
        if (pick.area < L && Math.random() < smart) { const safe = reach.filter(o => o.area >= L); pick = safe.length ? safe[0] : byArea[0]; }
      } else pick = byArea[0];
      if (Math.random() < wander) pick = opts[(Math.random() * opts.length) | 0];
      this.sdir = [pick.dx, pick.dy];
      this.snake.unshift({ x: pick.x, y: pick.y });
      if (this.grow > 0) this.grow--; else this.snake.pop();
      const si = this.seeds.findIndex(s => s.x === pick.x && s.y === pick.y);
      if (si >= 0) { this.seeds.splice(si, 1); if (!this.demo) { this.api.float(px(pick.x), px(pick.y), 'yoink', this.api.C.blue); this.api.sfx.steal(); } }
      if (pick.x === this.a.x && pick.y === this.a.y) this.caught();
    }
    appleAI() {
      const g = this.grid(this.grow === 0), h = this.snake[0], d = bfs(g, h.x, h.y), a = this.a;
      let best = null, bs = -1e9;
      for (const [dx, dy] of [[0, 0], ...DLIST]) {
        const nx = a.x + dx, ny = a.y + dy;
        if (!inb(nx, ny) || g[idx(nx, ny)] || (nx === h.x && ny === h.y)) continue;
        let dist = d[idx(nx, ny)]; if (dist < 0) dist = 40;
        let sc = Math.min(dist, 12) + Math.random() * 1.4;
        if (this.seeds.some(s => s.x === nx && s.y === ny)) sc += 2.5;
        if (nx === 0 || ny === 0 || nx === COLS - 1 || ny === ROWS - 1) sc -= .9;
        if (!dx && !dy) sc -= .5;
        if (sc > bs) { bs = sc; best = [dx, dy]; }
      }
      a.dir = best && (best[0] || best[1]) ? best : null;
    }
    appleStep() {
      const a = this.a; a.fx = a.x; a.fy = a.y;
      if (!a.dir) return;
      const nx = a.x + a.dir[0], ny = a.y + a.dir[1];
      if (!inb(nx, ny)) return;
      const h = this.snake[0];
      if (h.x === nx && h.y === ny) { if (this.freeze > 0) return; a.x = nx; a.y = ny; this.caught(); return; }
      for (let i = 1; i < this.snake.length; i++) if (this.snake[i].x === nx && this.snake[i].y === ny) return;
      a.x = nx; a.y = ny; a.hop = 0;
      const si = this.seeds.findIndex(s => s.x === nx && s.y === ny);
      if (si >= 0) {
        this.seeds.splice(si, 1);
        if (!this.demo) { this.seedsGot++; this.api.float(px(nx), px(ny), '+25', this.api.C.red); this.api.burst(px(nx), px(ny), this.api.C.leaf, 10, .8); this.api.sfx.good(); this.api.buzz(15); }
      }
    }
    spawnSeed() {
      for (let k = 0; k < 120; k++) {
        const x = (Math.random() * COLS) | 0, y = (Math.random() * ROWS) | 0;
        if (Math.abs(x - this.a.x) + Math.abs(y - this.a.y) < 3) continue;
        if (this.snake.some(p => p.x === x && p.y === y) || this.seeds.some(s => s.x === x && s.y === y)) continue;
        this.seeds.push({ x, y, ph: Math.random() * 6 }); return;
      }
    }
    update(dt, inp) {
      if (this.dead) return;
      this.t += dt / 1000;
      if (!this.demo) for (const k of ['up', 'down', 'left', 'right']) if (inp.pressed['dir_' + k]) this.pending = k;
      const ai = this.aInt;
      this.aAcc += dt;
      while (this.aAcc >= ai) {
        this.aAcc -= ai;
        if (this.demo) this.appleAI();
        else { const d = inp.dir4 || this.pending; this.pending = null; this.a.dir = d ? DIRS[d] : null; }
        this.appleStep();
        if (this.dead) return;
      }
      this.a.hop = Math.min(1, this.a.hop + dt / ai);
      if (this.freeze > 0) this.freeze -= dt;
      else {
        const si = this.sInt(); this.sAcc += dt;
        while (this.sAcc >= si && !this.dead && this.freeze <= 0) { this.sAcc -= si; this.snakeStep(); }
      }
      this.gAcc += dt; if (this.gAcc > 3500) { this.gAcc -= 3500; this.grow++; }
      this.seedAcc += dt; if (this.seedAcc > 4500) { this.seedAcc = 0; if (this.seeds.length < 2) this.spawnSeed(); }
      if (this.demo && this.snake.length > 40) this.api.end();
    }
    draw(c, now) {
      const { C, D } = this.api, cell = CS, size = 300;
      c.fillStyle = C.board; c.fillRect(0, 0, size, size);
      c.fillStyle = C.dot;
      for (let x = 1; x < COLS; x++) for (let y = 1; y < ROWS; y++) c.fillRect(x * cell - 1.1, y * cell - 1.1, 2.2, 2.2);
      for (const s of this.seeds) {
        const cx = px(s.x), cy = px(s.y) + Math.sin(now / 260 + s.ph) * 1.4;
        c.globalAlpha = .25 + .15 * Math.sin(now / 200 + s.ph); D.circle(c, cx, cy, 6.4, C.leaf); c.globalAlpha = 1;
        D.ellipse(c, cx, cy, 2.2, 3.4, .5, C.ink); D.circle(c, cx - .6, cy - 1.2, .6, C.board);
      }
      const sA = this.freeze > 0 ? 1 : Math.min(1, this.sAcc / this.sInt());
      const pts = this.snake.map((p, i) => { const q = this.prev[i] || this.prev[this.prev.length - 1] || p; return { x: (q.x + (p.x - q.x) * sA + .5) * cell, y: (q.y + (p.y - q.y) * sA + .5) * cell }; });
      const blink = this.freeze > 0 && Math.floor(now / 110) % 2 ? .35 : 1;
      c.globalAlpha = blink; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = C.blue; c.lineWidth = cell * .7;
      c.beginPath(); c.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      for (let i = pts.length - 2; i >= 0; i--) c.lineTo(pts[i].x, pts[i].y);
      c.stroke();
      c.globalAlpha = blink * .5; for (let i = 1; i < pts.length; i += 2) D.circle(c, pts[i].x, pts[i].y, 2, C.board);
      c.globalAlpha = blink;
      const hp = pts[0], dir = this.sdir, perp = [-dir[1], dir[0]];
      D.circle(c, hp.x, hp.y, cell * .48, C.blue);
      const a = this.a, aA = Math.min(1, this.aAcc / this.aInt);
      const ax = (a.fx + (a.x - a.fx) * aA + .5) * cell, ay = (a.fy + (a.y - a.fy) * aA + .5) * cell;
      const head = this.snake[0], near = Math.abs(head.x - a.x) + Math.abs(head.y - a.y);
      for (const s of [-1, 1]) {
        const ex = hp.x + dir[0] * 1.6 + perp[0] * s * 4, ey = hp.y + dir[1] * 1.6 + perp[1] * s * 4;
        D.circle(c, ex, ey, 2.8, C.eye);
        const vx = ax - hp.x, vy = ay - hp.y, vl = Math.hypot(vx, vy) || 1;
        D.circle(c, ex + vx / vl * 1.2, ey + vy / vl * 1.2, 1.4, C.pupil);
      }
      if (near <= 2 && this.freeze <= 0 && !this.dead) D.ellipse(c, hp.x + dir[0] * 6, hp.y + dir[1] * 6, 2.8, 4.4, Math.atan2(dir[1], dir[0]), C.pupil);
      else if (now % 1500 < 260) {
        const tx = hp.x + dir[0] * 9, ty = hp.y + dir[1] * 9, ex = hp.x + dir[0] * 15.6, ey = hp.y + dir[1] * 15.6;
        c.strokeStyle = C.red; c.lineWidth = 1.6; c.beginPath(); c.moveTo(tx, ty); c.lineTo(ex, ey);
        c.moveTo(ex, ey); c.lineTo(ex + (dir[0] - perp[0]) * 2, ey + (dir[1] - perp[1]) * 2);
        c.moveTo(ex, ey); c.lineTo(ex + (dir[0] + perp[0]) * 2, ey + (dir[1] + perp[1]) * 2); c.stroke();
      }
      c.globalAlpha = 1;
      if (this.dead) return;
      const r = 8, hopK = Math.sin(Math.min(1, a.hop) * Math.PI), lift = this.api.reduced ? 0 : hopK * 3.2;
      const breathe = 1 + Math.sin(now / 320) * .025;
      D.ellipse(c, ax, ay + 7.6, r * (.85 - hopK * .2), 1.4, 0, 'rgba(0,0,0,.18)');
      c.save(); c.translate(ax, ay - lift); c.scale((1 + hopK * .07) * breathe, (1 - hopK * .07) * breathe);
      if (near <= 2 && !this.api.reduced) c.rotate(Math.sin(now / 40) * .08);
      c.strokeStyle = C.ink; c.lineWidth = 1.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -r * .8); c.quadraticCurveTo(r * .05, -r * 1.1, r * .18, -r * 1.25); c.stroke();
      D.ellipse(c, r * .45, -r * 1.08, r * .34, r * .15, -.5, C.leaf);
      D.circle(c, -r * .22, 0, r * .82, C.red); D.circle(c, r * .22, 0, r * .82, C.red); D.circle(c, 0, r * .12, r * .86, C.red);
      D.ellipse(c, -r * .42, -r * .36, r * .2, r * .11, -.7, 'rgba(255,255,255,.6)');
      D.eyes(c, 0, -r * .05, r * .34, r * .25, hp.x - ax, hp.y - ay);
      c.strokeStyle = C.pupil; c.lineWidth = 1.1;
      if (near <= 3) {
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * .55, -r * .42); c.lineTo(s * r * .15, -r * .52); c.stroke(); }
        D.ellipse(c, 0, r * .42, r * .11, r * .15, 0, C.pupil);
      } else { c.beginPath(); c.arc(0, r * .3, r * .2, .2 * Math.PI, .8 * Math.PI); c.stroke(); }
      if (near <= 2) { const dy = (now / 6) % (r * .6); c.globalAlpha = 1 - dy / (r * .6); D.ellipse(c, r * .95, -r * .4 + dy, r * .1, r * .16, 0, C.blue); c.globalAlpha = 1; }
      c.restore();
    }
  }

  FLIP.register({
    id: 'apple', num: '01', name: 'Apple', flipOf: 'the snake game', W: 300, H: 300, controls: 'joy4',
    role: "You're the apple.",
    intro: 'The snake is hungry and grows every few seconds. Stay alive, grab seeds, and trick it into biting itself.',
    hint: 'Hold anywhere and drag to roll. Let go to stop.',
    keys: 'Arrows or WASD to roll · Space pauses',
    pauseLine: 'The snake is pretending to wait.',
    create: (api, o) => new Apple(api, o.demo)
  });
})();
