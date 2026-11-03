/* Game 02 — Brick: the brick-breaker, flipped. You're one brick. */
(() => {
  const W = 300, H = 420, PY = 392, MAXA = 62 * Math.PI / 180;
  const quips = ['Grout luck next time.', 'You were a pillar of the community. Then a pile.', 'Cracked under pressure. Literally.', 'Rubble with a cause.'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function circRect(cx, cy, r, x, y, w, h) {
    const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h);
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r ? { dx, dy } : null;
  }
  function fold(x, r) {
    const lo = r, hi = W - r, span = hi - lo;
    let v = (x - lo) % (2 * span); if (v < 0) v += 2 * span;
    return v <= span ? lo + v : hi - (v - span);
  }

  class Brick {
    constructor(api) {
      this.api = api;
      this.me = { x: 128, y: 112, w: 44, h: 16, vx: 0 };
      this.ceil = []; for (let i = 0; i < 7; i++) this.ceil.push({ x: 8 + i * 41, y: 34, w: 35, h: 12 });
      this.shields = []; for (let i = 0; i < 7; i++) this.shields.push({ x: 10 + i * 40, y: 176, w: 34, h: 12, alive: true, t: 0 });
      this.pad = { x: 150, w: 62, target: 150 };
      this.ball = { x: 150, y: PY - 7, vx: 0, vy: 0, r: 6, held: 800, speed: 225 };
      this.trail = [];
      this.t = 0; this.near = 0; this.misses = 0; this.dead = false; this.err = 0; this.wasDown = false; this.nearArmed = false;
    }
    score() { return Math.floor(this.t * 10) + this.near * 15 + this.misses * 100; }
    hud() { return [['Score', this.score()], ['Time', this.t.toFixed(1) + 's']]; }
    aimAngleFrom(x) {
      const m = this.me, dx = m.x + m.w / 2 - x, dy = PY - (m.y + m.h / 2);
      return clamp(Math.atan2(dx, dy), -MAXA, MAXA);
    }
    launch() {
      const b = this.ball, a = this.aimAngleFrom(b.x) + (Math.random() - .5) * .25;
      b.vx = b.speed * Math.sin(a); b.vy = -b.speed * Math.cos(a); b.held = 0;
    }
    update(dt, inp) {
      if (this.dead) return;
      const s = dt / 1000, api = this.api, m = this.me, b = this.ball, p = this.pad;
      this.t += s;
      m.vx = inp.x * 240; m.x = clamp(m.x + m.vx * s, 4, W - 4 - m.w);
      for (const sh of this.shields) if (!sh.alive) { sh.t -= dt; if (sh.t <= 0 && !circRect(b.x, b.y, b.r + 4, sh.x, sh.y, sh.w, sh.h)) { sh.alive = true; } }

      // paddle AI
      const pSpeed = Math.min(430, 260 + this.t * 2);
      if (b.held > 0) {
        b.held -= dt; b.x = p.x; b.y = PY - 7;
        p.target = clamp(m.x + m.w / 2 + Math.sin(this.t * 2) * 40, 31, W - 31);
        if (b.held <= 0) this.launch();
      } else if (b.vy > 0) {
        if (!this.wasDown) {
          this.wasDown = true;
          const miss = Math.min(.14, .06 + this.t * .001);
          this.err = Math.random() < (.13 - Math.min(.08, this.t * .0015)) ? (Math.random() < .5 ? -1 : 1) * (p.w / 2 + 16) : (Math.random() - .5) * 10;
          void miss;
        }
        const tt = (PY - b.y) / b.vy, land = fold(b.x + b.vx * tt, b.r);
        const off = this.aimAngleFrom(land) / MAXA;
        p.target = land - off * p.w / 2 * .9 + this.err;
      } else { this.wasDown = false; p.target = p.x + (W / 2 - p.x) * .02; }
      const dx = p.target - p.x; p.x += clamp(dx, -pSpeed * s, pSpeed * s); p.x = clamp(p.x, p.w / 2, W - p.w / 2);

      if (b.held > 0) return;
      const steps = 4, ss = s / steps;
      for (let k = 0; k < steps; k++) {
        const py = b.y;
        b.x += b.vx * ss; b.y += b.vy * ss;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
        for (const br of this.ceil) this.bounceRect(br);
        for (const sh of this.shields) if (sh.alive && this.bounceRect(sh)) {
          sh.alive = false; sh.t = 7000; api.burst(sh.x + sh.w / 2, sh.y + sh.h / 2, api.C.ink, 10, .7); api.sfx.blip();
        }
        if (circRect(b.x, b.y, b.r, m.x, m.y, m.w, m.h)) {
          this.dead = true;
          api.burst(m.x + m.w / 2, m.y + m.h / 2, api.C.red, 34, 1.6); api.shake(14); api.sfx.bad(); api.buzz(120);
          api.end({ title: 'Smashed.', text: `You dodged for ${this.t.toFixed(1)} s, survived ${this.near} close call${this.near === 1 ? '' : 's'} and made the paddle miss ${this.misses} time${this.misses === 1 ? '' : 's'}.`, quip: quips[(Math.random() * quips.length) | 0] });
          return;
        }
        if (b.vy > 0 && py + b.r < PY && b.y + b.r >= PY && Math.abs(b.x - p.x) <= p.w / 2 + b.r) {
          const off = clamp((b.x - p.x) / (p.w / 2), -1, 1), a = off * MAXA;
          b.speed = Math.min(470, b.speed + 6);
          b.vx = b.speed * Math.sin(a); b.vy = -b.speed * Math.cos(a); b.y = PY - b.r;
          api.sfx.blip();
        }
      }
      // near miss
      const cx = clamp(b.x, m.x, m.x + m.w), cy = clamp(b.y, m.y, m.y + m.h), dd = Math.hypot(b.x - cx, b.y - cy);
      if (dd < 16) this.nearArmed = true;
      else if (this.nearArmed && dd > 34) { this.nearArmed = false; this.near++; api.float(m.x + m.w / 2, m.y - 10, 'close! +15', api.C.blue); api.sfx.good(); api.buzz(10); }
      if (b.y > H + 20) {
        this.misses++; api.flash('Paddle missed!'); api.float(b.x, H - 40, '+100', api.C.red); api.sfx.great(); api.buzz([20, 30, 20]);
        b.held = 900; b.speed = Math.max(240, b.speed - 30);
      }
      this.trail.push({ x: b.x, y: b.y }); if (this.trail.length > 7) this.trail.shift();
    }
    bounceRect(r) {
      const b = this.ball, hit = circRect(b.x, b.y, b.r, r.x, r.y, r.w, r.h);
      if (!hit) return false;
      if (Math.abs(hit.dx) > Math.abs(hit.dy)) { b.vx = hit.dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx); b.x += hit.dx > 0 ? 1 : -1; }
      else { b.vy = hit.dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy); b.y += hit.dy > 0 ? 1.5 : -1.5; if (hit.dy === 0) b.vy = -b.vy; }
      return true;
    }
    draw(c, now) {
      const { C, D } = this.api, m = this.me, b = this.ball, p = this.pad;
      D.bg(c, W, H);
      for (const br of this.ceil) D.rr(c, br.x, br.y, br.w, br.h, 3, C.paper2, C.ink, 2);
      for (const sh of this.shields) {
        if (sh.alive) D.rr(c, sh.x, sh.y, sh.w, sh.h, 3, C.paper2, C.ink, 2);
        else if (sh.t < 1500) { c.globalAlpha = .3 + .3 * Math.sin(now / 60); D.rr(c, sh.x, sh.y, sh.w, sh.h, 3, null, C.ink, 1.5); c.globalAlpha = 1; }
      }
      c.setLineDash([4, 6]); c.strokeStyle = C.line; c.lineWidth = 2; c.beginPath(); c.moveTo(0, PY + 16); c.lineTo(W, PY + 16); c.stroke(); c.setLineDash([]);
      for (let i = 0; i < this.trail.length; i++) { c.globalAlpha = i / this.trail.length * .35; D.circle(c, this.trail[i].x, this.trail[i].y, b.r * (i / this.trail.length), C.blue); }
      c.globalAlpha = 1;
      D.circle(c, b.x, b.y, b.r, C.blue);
      D.rr(c, p.x - p.w / 2, PY, p.w, 10, 5, C.ink);
      if (!this.dead) {
        const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
        const danger = b.vy < 0 && Math.abs(b.x - cx) < 70 && b.y > cy;
        const wob = danger && !this.api.reduced ? Math.sin(now / 35) * 1.2 : 0;
        D.rr(c, m.x + wob, m.y, m.w, m.h, 3, C.red, C.ink, 2);
        c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(m.x + m.w / 2 + wob, m.y + 2); c.lineTo(m.x + m.w / 2 + wob, m.y + m.h - 2); c.stroke();
        D.eyes(c, cx + wob, cy - 1, 7, 3.6, b.x - cx, b.y - cy);
        if (danger) { c.fillStyle = C.blue; c.globalAlpha = .8; D.ellipse(c, m.x + m.w + 4, m.y + ((now / 8) % 14), 1.8, 2.8, 0, C.blue); c.globalAlpha = 1; }
      }
    }
  }

  FLIP.register({
    id: 'brick', num: '02', name: 'Brick', flipOf: 'the brick-breaker', W, H, controls: 'joyx',
    role: "You're one brick in the wall.",
    intro: 'The paddle aims the ball straight at you. Slide away, hide behind the other bricks, and laugh when the paddle misses.',
    hint: 'Hold anywhere and drag left or right to slide.',
    keys: 'Left / right or A / D to slide · Space pauses',
    pauseLine: 'The ball is hovering, menacingly.',
    create: api => new Brick(api)
  });
})();
