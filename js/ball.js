/* Game 08 — The Ball: the paddle game, flipped. You're the ball. */
(() => {
  const W = 300, H = 420, TOP = 34, BOT = 386, PW = 66, ROUND = 45;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const quips = ['Bouncy. Sneaky. Victorious-ish.', 'The paddles need a nap.', 'Ball is life. Briefly.', 'Round, and proud of it.'];
  function fold(x, r) {
    const lo = r, hi = W - r, span = hi - lo;
    let v = (x - lo) % (2 * span); if (v < 0) v += 2 * span;
    return v <= span ? lo + v : hi - (v - span);
  }

  class Ball {
    constructor(api) {
      this.api = api;
      this.b = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 9, held: 900 };
      this.pads = [{ y: TOP, x: W / 2, err: 0, armed: false }, { y: BOT, x: W / 2, err: 0, armed: false }];
      this.left = ROUND; this.t = 0; this.goals = 0; this.hits = 0; this.dead = false; this.trail = []; this.serveDir = Math.random() < .5 ? -1 : 1;
    }
    score() { return this.goals * 100 + this.hits * 3; }
    hud() { return [['Goals', this.goals], ['Time', Math.ceil(this.left) + 's']]; }
    serve() { const b = this.b; b.x = W / 2; b.y = H / 2; b.vx = (Math.random() - .5) * 120; b.vy = 0; b.held = 800; this.trail = []; }
    update(dt, inp) {
      if (this.dead) return;
      const s = dt / 1000, api = this.api, b = this.b;
      this.t += s; this.left -= s;
      if (this.left <= 0) {
        this.left = 0; this.dead = true; api.sfx.great(); api.buzz([20, 40, 20]);
        api.end({ title: 'Time!', text: `You slipped past the paddles ${this.goals} time${this.goals === 1 ? '' : 's'} in ${ROUND} seconds, with ${this.hits} bounce${this.hits === 1 ? '' : 's'} along the way.`, quip: quips[(Math.random() * quips.length) | 0], delay: 600 });
        return;
      }
      const pSpeed = Math.min(300, 150 + this.goals * 10 + this.hits * 1.5);
      if (b.held > 0) {
        b.held -= dt;
        if (b.held <= 0) { b.vy = this.serveDir * 240; this.serveDir *= -1; }
      } else {
        b.vx += inp.x * 1400 * s; b.vx *= (1 - .6 * s); b.vx = clamp(b.vx, -340, 340);
        const py = b.y;
        b.x += b.vx * s; b.y += b.vy * s;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * .9; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * .9; }
        for (const [i, p] of this.pads.entries()) {
          const toward = i === 0 ? b.vy < 0 : b.vy > 0;
          const lineY = i === 0 ? p.y + 10 : p.y;
          const crossed = i === 0 ? (py - b.r >= lineY && b.y - b.r < lineY) : (py + b.r <= lineY && b.y + b.r > lineY);
          if (toward && crossed && Math.abs(b.x - p.x) <= PW / 2 + b.r * .6) {
            b.vy = clamp(-b.vy * 1.04, -560, 560); b.vx += (b.x - p.x) * 3; b.y = i === 0 ? lineY + b.r : lineY - b.r;
            this.hits++; api.sfx.blip(); api.buzz(8); api.burst(b.x, lineY, api.C.ink, 6, .5);
          }
        }
        if (b.y < -b.r * 2 || b.y > H + b.r * 2) {
          this.goals++; api.flash('Goal!'); api.float(clamp(b.x, 40, W - 40), b.y < 0 ? 60 : H - 60, '+100', api.C.red);
          api.burst(clamp(b.x, 10, W - 10), b.y < 0 ? 4 : H - 4, api.C.red, 26, 1.3); api.sfx.great(); api.buzz([25, 35, 25]);
          this.serve();
        }
      }
      // paddle AI
      for (const [i, p] of this.pads.entries()) {
        const toward = b.held <= 0 && (i === 0 ? b.vy < 0 : b.vy > 0);
        let target = W / 2;
        if (toward) {
          if (!p.armed) { p.armed = true; p.err = (Math.random() * 2 - 1) * (18 + Math.abs(b.vy) * .06); }
          const lineY = i === 0 ? p.y + 10 : p.y;
          const tt = Math.abs((lineY - b.y) / b.vy);
          target = fold(b.x + b.vx * tt, b.r) + p.err;
        } else { p.armed = false; target = W / 2 + (b.x - W / 2) * .3; }
        p.x += clamp(target - p.x, -pSpeed * s, pSpeed * s); p.x = clamp(p.x, PW / 2, W - PW / 2);
      }
      this.trail.push({ x: b.x, y: b.y }); if (this.trail.length > 8) this.trail.shift();
    }
    draw(c, now) {
      const { C, D } = this.api, b = this.b;
      D.bg(c, W, H, 15);
      c.setLineDash([8, 8]); c.strokeStyle = C.line; c.lineWidth = 3; c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke(); c.setLineDash([]);
      c.fillStyle = C.red; c.globalAlpha = .12; c.fillRect(0, 0, W, 8); c.fillRect(0, H - 8, W, 8); c.globalAlpha = 1;
      for (const p of this.pads) {
        D.rr(c, p.x - PW / 2, p.y, PW, 10, 5, C.ink);
        D.eyes(c, p.x, p.y + 5, 6, 2.4, b.x - p.x, b.y - p.y);
      }
      for (let i = 0; i < this.trail.length; i++) { c.globalAlpha = i / this.trail.length * .3; D.circle(c, this.trail[i].x, this.trail[i].y, b.r * i / this.trail.length, C.red); }
      c.globalAlpha = 1;
      const pulse = b.held > 0 && !this.api.reduced ? 1 + Math.sin(now / 80) * .08 : 1;
      D.circle(c, b.x, b.y, b.r * pulse, C.red);
      c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, b.r * pulse, 0, Math.PI * 2); c.stroke();
      D.eyes(c, b.x, b.y - 1, 3.6, 2.8, b.vx, b.vy || 1);
      if (b.held > 0) D.text(c, 'READY', W / 2, H / 2 - 30, 14, C.red, 'center', C.board);
    }
  }

  FLIP.register({
    id: 'ball', num: '08', name: 'The Ball', flipOf: 'the paddle game', W, H, controls: 'joyx',
    role: "You're the ball.",
    intro: 'Two paddles keep sending you back. Curve left or right to sneak past either one. You have 45 seconds.',
    hint: 'Hold anywhere and drag left or right to curve.',
    keys: 'Left / right or A / D to curve · Space pauses',
    pauseLine: 'The ball is catching its breath.',
    create: api => new Ball(api)
  });
})();
