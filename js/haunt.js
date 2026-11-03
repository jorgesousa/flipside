/* Game 03 — Haunt: the maze chase, flipped. You're a ghost. */
(() => {
  const MAP = ["#############", "#o.........o#", "#.##.###.##.#", "#...........#", "#.##.#.#.##.#", "#....#.#....#", "##.#.....#.##", "#..#.###.#..#", "#.....#.....#", "##.#.....#.##", "#....#.#....#", "#.##.#.#.##.#", "#o.........o#", "#...#...#...#", "#############"];
  const COLS = 13, ROWS = 15, CS = 24, W = COLS * CS, H = ROWS * CS, N = COLS * ROWS;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DLIST = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const idx = (x, y) => y * COLS + x;
  const open = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && MAP[y][x] !== '#';
  const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
  const opp = (a, b) => a && b && a[0] === -b[0] && a[1] === -b[1];
  const quips = ['Boo. Hoo.', 'Spooky, but not scary enough.', 'The maze is clean. You are not.', 'Even ghosts have off days.'];

  function bfs(sources) {
    const d = new Int16Array(N).fill(-1), q = [];
    for (const [x, y] of sources) { const i = idx(x, y); if (d[i] < 0) { d[i] = 0; q.push(i); } }
    for (let h = 0; h < q.length; h++) {
      const c = q[h], cx = c % COLS, cy = (c / COLS) | 0;
      for (const [dx, dy] of DLIST) { const nx = cx + dx, ny = cy + dy; if (!open(nx, ny)) continue; const ni = idx(nx, ny); if (d[ni] >= 0) continue; d[ni] = d[c] + 1; q.push(ni); }
    }
    return d;
  }
  const ent = (cx, cy, speed) => ({ cx, cy, dir: null, p: 0, speed, home: [cx, cy], wait: 0 });
  const pos = e => ({ x: e.cx + (e.dir ? e.dir[0] * e.p : 0), y: e.cy + (e.dir ? e.dir[1] * e.p : 0) });
  const optsOf = e => DLIST.filter(([dx, dy]) => open(e.cx + dx, e.cy + dy));

  class Haunt {
    constructor(api) {
      this.api = api;
      this.me = ent(6, 6, 5); this.want = null; this.inv = 0;
      this.mun = ent(6, 12, 4.5); this.mun.wait = 1200; this.mun.dir = [-1, 0];
      this.helpers = [ent(1, 3, 3.7), ent(11, 3, 3.7)];
      this.t = 0; this.lives = 3; this.catches = 0; this.assists = 0; this.level = 0; this.powered = 0; this.dead = false;
      this.fill();
    }
    fill() { this.pel = new Uint8Array(N); for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const ch = MAP[y][x]; if (ch === '.') this.pel[idx(x, y)] = 1; if (ch === 'o') this.pel[idx(x, y)] = 2; } }
    dots() { let n = 0; for (let i = 0; i < N; i++) if (this.pel[i]) n++; return n; }
    score() { return this.catches * 200 + this.assists * 100 + Math.floor(this.t * 5); }
    hud() { return [['Score', this.score()], ['Lives', 'x' + this.lives], ['Dots', this.dots()]]; }

    move(e, dt, choose) {
      if (e.wait > 0) { e.wait -= dt; return; }
      if (!e.dir) { const d = choose(e); if (!d) return; e.dir = d; }
      e.p += e.speed * dt / 1000;
      let guard = 0;
      while (e.p >= 1 && guard++ < 4) {
        e.cx += e.dir[0]; e.cy += e.dir[1]; e.p -= 1;
        if (e.onArrive) e.onArrive(e);
        const d = choose(e);
        if (!d) { e.p = 0; e.dir = null; break; }
        e.dir = d;
      }
    }
    choosePlayer(e) {
      if (this.want && open(e.cx + this.want[0], e.cy + this.want[1])) return this.want;
      if (e.dir && open(e.cx + e.dir[0], e.cy + e.dir[1])) return e.dir;
      return null;
    }
    chooseMuncher(e) {
      let o = optsOf(e);
      if (o.length > 1 && e.dir) o = o.filter(d => !opp(d, e.dir));
      const threats = [[this.me.cx, this.me.cy], ...this.helpers.filter(h => h.wait <= 0).map(h => [h.cx, h.cy])];
      const dT = bfs(this.powered > 0 ? [[this.me.cx, this.me.cy]] : threats);
      const pellets = []; for (let i = 0; i < N; i++) if (this.pel[i]) pellets.push([i % COLS, (i / COLS) | 0]);
      const dP = pellets.length ? bfs(pellets) : null;
      let best = null, bs = -1e9;
      for (const d of o) {
        const nx = e.cx + d[0], ny = e.cy + d[1], i = idx(nx, ny);
        let sc;
        if (this.powered > 0) sc = -dT[i] * 1.5 + Math.random() * .5;
        else sc = 1.4 * Math.min(dT[i], 9) - (dP ? .7 * dP[i] : 0) + (this.pel[i] ? 1.2 : 0) + Math.random() * .7;
        if (sc > bs) { bs = sc; best = d; }
      }
      return best;
    }
    chooseHelper(e) {
      let o = optsOf(e);
      if (o.length > 1 && e.dir) o = o.filter(d => !opp(d, e.dir));
      if (Math.random() < (this.powered > 0 ? .8 : .62)) {
        const dm = bfs([[this.mun.cx, this.mun.cy]]);
        o.sort((a, b) => (dm[idx(e.cx + a[0], e.cy + a[1])] - dm[idx(e.cx + b[0], e.cy + b[1])]) * (this.powered > 0 ? -1 : 1));
        return o[0];
      }
      return o[(Math.random() * o.length) | 0];
    }
    respawnMuncher() {
      const spots = [[6, 12], [1, 13], [11, 13], [6, 1], [1, 8], [11, 8]];
      const dm = bfs([[this.me.cx, this.me.cy]]);
      spots.sort((a, b) => dm[idx(b[0], b[1])] - dm[idx(a[0], a[1])]);
      const s = spots[0];
      Object.assign(this.mun, { cx: s[0], cy: s[1], dir: null, p: 0, wait: 900 });
      this.powered = 0;
    }
    update(dt, inp) {
      if (this.dead) return;
      const api = this.api, C = api.C;
      this.t += dt / 1000;
      if (inp.dir4) this.want = DIRS[inp.dir4];
      for (const k of ['up', 'down', 'left', 'right']) if (inp.pressed['dir_' + k]) this.want = DIRS[k];
      const me = this.me;
      if (me.dir && this.want && opp(this.want, me.dir) && me.p > 0) { me.cx += me.dir[0]; me.cy += me.dir[1]; me.p = 1 - me.p; me.dir = this.want; }
      if (this.inv > 0) this.inv -= dt;
      if (this.powered > 0) { this.powered -= dt; if (this.powered <= 0) api.flash('Back to normal'); }
      this.mun.speed = this.powered > 0 ? 4.6 : Math.min(6.2, 4.5 + this.level * .3);
      for (const h of this.helpers) h.speed = this.powered > 0 ? 3 : 3.7;
      this.mun.onArrive = e => {
        const i = idx(e.cx, e.cy), v = this.pel[i];
        if (!v) return;
        this.pel[i] = 0;
        if (v === 2) { this.powered = 5500; api.flash("It's powered up!"); api.sfx.steal(); api.buzz([15, 30, 15]); }
      };
      this.move(me, dt, e => this.choosePlayer(e));
      this.move(this.mun, dt, e => this.chooseMuncher(e));
      for (const h of this.helpers) this.move(h, dt, e => this.chooseHelper(e));

      const mp = pos(this.mun), cell = v => (v + .5) * CS;
      const close = e => { const p = pos(e); return Math.hypot(p.x - mp.x, p.y - mp.y) < .72; };
      if (this.mun.wait <= 0) {
        if (close(me) && this.inv <= 0) {
          if (this.powered > 0) {
            this.lives--; api.burst(cell(mp.x), cell(mp.y), C.red, 24, 1.2); api.shake(10); api.sfx.bad(); api.buzz(100);
            if (this.lives <= 0) {
              this.dead = true;
              api.end({ title: 'Eaten.', text: `You caught the muncher ${this.catches} time${this.catches === 1 ? '' : 's'} and your buddies helped ${this.assists} time${this.assists === 1 ? '' : 's'}.`, quip: quips[(Math.random() * quips.length) | 0] });
              return;
            }
            api.flash('Eaten! ' + this.lives + ' left');
            Object.assign(me, { cx: 6, cy: 6, dir: null, p: 0 }); this.want = null; this.inv = 1500; this.powered = 0;
          } else {
            this.catches++; this.level++;
            api.flash('Gotcha!'); api.float(cell(mp.x), cell(mp.y), '+200', C.red); api.burst(cell(mp.x), cell(mp.y), C.ink, 24, 1.2); api.sfx.great(); api.buzz([25, 35, 25]);
            this.fill(); this.respawnMuncher();
          }
        } else for (const h of this.helpers) {
          if (h.wait > 0 || !close(h)) continue;
          if (this.powered > 0) { api.float(cell(mp.x), cell(mp.y), 'buddy down', C.blue); Object.assign(h, { cx: h.home[0], cy: h.home[1], dir: null, p: 0, wait: 2200 }); api.sfx.steal(); }
          else { this.assists++; api.flash('Assist!'); api.float(cell(mp.x), cell(mp.y), '+100', C.red); api.burst(cell(mp.x), cell(mp.y), C.ink, 18); api.sfx.good(); this.fill(); this.respawnMuncher(); this.level++; }
          break;
        }
      }
      if (this.dots() === 0) {
        this.dead = true; api.sfx.bad(); api.buzz(100);
        api.end({ title: 'It cleared the maze.', text: `You caught the muncher ${this.catches} time${this.catches === 1 ? '' : 's'} before it ate every dot.`, quip: quips[(Math.random() * quips.length) | 0] });
      }
    }
    ghost(c, x, y, col, stroke, look, scared, now, alpha = 1) {
      const { D, C } = this.api, r = 10;
      c.globalAlpha = alpha;
      c.beginPath(); c.moveTo(x - r, y + r);
      c.lineTo(x - r, y); c.arc(x, y, r, Math.PI, 0); c.lineTo(x + r, y + r);
      const ph = this.api.reduced ? 0 : Math.sin(now / 90) * 1.6;
      for (let i = 0; i < 4; i++) { const x1 = x + r - (i + .5) * r / 2, x2 = x + r - (i + 1) * r / 2; c.quadraticCurveTo(x1, y + r - 4 + (i % 2 ? ph : -ph), x2, y + r); }
      c.closePath(); c.fillStyle = col; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
      if (scared) {
        D.circle(c, x - 4, y - 1, 2.2, C.ink); D.circle(c, x + 4, y - 1, 2.2, C.ink);
        c.strokeStyle = C.ink; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - 5, y + 5); for (let i = 0; i < 4; i++) c.lineTo(x - 5 + (i + 1) * 2.5, y + 5 + (i % 2 ? 0 : -2)); c.stroke();
      } else D.eyes(c, x, y - 1, 4.2, 3.4, look[0], look[1]);
      c.globalAlpha = 1;
    }
    draw(c, now) {
      const { C, D } = this.api, cell = v => (v + .5) * CS;
      c.fillStyle = C.board; c.fillRect(0, 0, W, H);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (MAP[y][x] === '#') D.rr(c, x * CS + 1.5, y * CS + 1.5, CS - 3, CS - 3, 5, C.blue);
        const v = this.pel[idx(x, y)];
        if (v === 1) D.circle(c, cell(x), cell(y), 2.4, C.ink);
        if (v === 2) D.circle(c, cell(x), cell(y), 5 + Math.sin(now / 150) * 1.2, C.red);
      }
      const mp = pos(this.mun), mx = cell(mp.x), my = cell(mp.y), d = this.mun.dir || [1, 0];
      // muncher
      if (this.mun.wait > 0 && Math.floor(now / 120) % 2) c.globalAlpha = .35;
      if (this.powered > 0) { c.globalAlpha *= .5 + .3 * Math.sin(now / 80); D.circle(c, mx, my, 13, C.red); c.globalAlpha = this.mun.wait > 0 && Math.floor(now / 120) % 2 ? .35 : 1; }
      D.circle(c, mx, my, 9.5, C.ink);
      const lx = d[0], ly = d[1];
      D.eyes(c, mx + lx * 2, my - 3 + ly * 1.5, 3.6, 2.7, lx, ly);
      c.strokeStyle = C.eye; c.lineWidth = 1.6; c.beginPath();
      const mw = 9, mxs = mx - mw / 2 + lx * 1.5, mys = my + 4 + ly;
      c.moveTo(mxs, mys); for (let i = 1; i <= 6; i++) c.lineTo(mxs + i * mw / 6, mys + (i % 2 ? 2 : 0) + (Math.floor(now / 120) % 2 ? .6 : 0)); c.stroke();
      if (this.powered > 0) { c.strokeStyle = C.ink; c.lineWidth = 1.6; c.beginPath(); c.moveTo(mx - 7, my - 9); c.lineTo(mx - 2, my - 7); c.moveTo(mx + 7, my - 9); c.lineTo(mx + 2, my - 7); c.stroke(); }
      c.globalAlpha = 1;
      const scared = this.powered > 0;
      for (const h of this.helpers) { const p = pos(h); this.ghost(c, cell(p.x), cell(p.y), C.paper2, C.ink, [mp.x - p.x, mp.y - p.y], scared, now, h.wait > 0 ? .3 : 1); }
      if (!this.dead) {
        const p = pos(this.me);
        const blink = this.inv > 0 && Math.floor(now / 100) % 2 ? .35 : 1;
        this.ghost(c, cell(p.x), cell(p.y), scared ? C.paper2 : C.red, scared ? C.red : C.ink, [mp.x - p.x, mp.y - p.y], scared, now, blink);
      }
      if (this.powered > 0) { c.fillStyle = C.red; c.fillRect(0, H - 4, W * Math.max(0, this.powered) / 5500, 4); }
    }
  }

  FLIP.register({
    id: 'haunt', num: '03', name: 'Haunt', flipOf: 'the maze chase', W, H, controls: 'joy4',
    role: "You're the red ghost.",
    intro: 'The muncher is eating every dot. Catch it before the maze is clean. Two buddy ghosts help, a bit. Careful: after a red pill, it hunts you.',
    hint: 'Drag in a direction to turn. Your ghost keeps floating until a wall.',
    keys: 'Arrows or WASD to steer · Space pauses',
    pauseLine: 'The muncher is chewing quietly.',
    create: api => new Haunt(api)
  });
})();
