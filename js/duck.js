/* Game 06 — Duck: the duck-shooting game, flipped. You're the duck. */
(() => {
  const W = 300, H = 420, GROUND = 372;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const quips = ['Quack. Quack-ack.', 'Ruffled, but not roasted. Well.', 'Should have flown south.', 'Feathers everywhere.'];

  class Duck {
    constructor(api) {
      this.api = api;
      this.d = { x: 150, y: 200, vx: 0, vy: 0, face: 1 };
      this.aim = { x: 60, y: 330, state: 'hunt', t: 0, lockT: 0 };
      this.clouds = [{ x: 40, y: 90, w: 70, v: 9 }, { x: 220, y: 200, w: 84, v: -7 }];
      this.crumbs = []; this.cT = 1500;
      this.t = 0; this.lives = 3; this.near = 0; this.got = 0; this.inv = 0; this.dead = false; this.shots = [];
    }
    score() { return Math.floor(this.t * 10) + this.near * 15 + this.got * 25; }
    hud() { return [['Score', this.score()], ['Lives', 'x' + this.lives]]; }
    hidden() { const d = this.d; return this.clouds.some(c => Math.abs(d.x - c.x) < c.w / 2 - 6 && Math.abs(d.y - c.y) < 16); }
    update(dt, inp) {
      if (this.dead) return;
      const s = dt / 1000, api = this.api, C = api.C, d = this.d, a = this.aim;
      this.t += s;
      // duck
      d.vx += (inp.x * 190 - d.vx) * Math.min(1, s * 7);
      d.vy += (inp.y * 190 - d.vy) * Math.min(1, s * 7);
      d.x = clamp(d.x + d.vx * s, 16, W - 16); d.y = clamp(d.y + d.vy * s, 22, GROUND - 22);
      if (Math.abs(d.vx) > 10) d.face = Math.sign(d.vx);
      if (this.inv > 0) this.inv -= dt;
      for (const c of this.clouds) {
        c.x += c.v * s * (1 + this.t * .01);
        if (c.x > W + c.w) { c.x = -c.w; c.y = 60 + Math.random() * 230; }
        if (c.x < -c.w) { c.x = W + c.w; c.y = 60 + Math.random() * 230; }
      }
      const hid = this.hidden();
      // crumbs
      this.cT -= dt;
      if (this.cT <= 0 && this.crumbs.length < 2) { this.crumbs.push({ x: 24 + Math.random() * (W - 48), y: 40 + Math.random() * (GROUND - 90), life: 5000 }); this.cT = 2800; }
      for (const k of this.crumbs) {
        k.life -= dt;
        if (Math.hypot(k.x - d.x, k.y - d.y) < 18) { k.life = 0; this.got++; api.float(k.x, k.y - 14, '+25', C.red); api.burst(k.x, k.y, C.leaf, 8, .6); api.sfx.good(); api.buzz(12); }
      }
      this.crumbs = this.crumbs.filter(k => k.life > 0);
      // hunter crosshair
      const speed = Math.min(520, 210 + this.t * 4.5), lockTime = Math.max(260, 460 - this.t * 3.5);
      if (a.state === 'hunt') {
        let tx, ty;
        if (hid) { tx = a.x + Math.sin(this.t * 1.7) * 60; ty = a.y + Math.cos(this.t * 1.3) * 40; }
        else { const lead = .35; tx = d.x + d.vx * lead; ty = d.y + d.vy * lead; }
        tx = clamp(tx, 10, W - 10); ty = clamp(ty, 10, GROUND - 10);
        const dx = tx - a.x, dy = ty - a.y, dist = Math.hypot(dx, dy);
        if (dist > 1) { const k = Math.min(1, speed * s / dist); a.x += dx * k; a.y += dy * k; }
        const onDuck = !hid && Math.hypot(a.x - d.x, a.y - d.y) < 26;
        a.lockT = onDuck ? a.lockT + dt : Math.max(0, a.lockT - dt);
        if (a.lockT > 220) { a.state = 'lock'; a.t = lockTime; a.lockT = 0; const k = lockTime / 1000 * .85; a.tx = clamp(d.x + d.vx * k, 10, W - 10); a.ty = clamp(d.y + d.vy * k, 10, GROUND - 10); }
      } else if (a.state === 'lock') {
        a.t -= dt;
        const f = Math.min(1, s * 14); a.x += (a.tx - a.x) * f; a.y += (a.ty - a.y) * f;
        if (a.t <= 0) {
          a.state = 'reload'; a.t = Math.max(260, 520 - this.t * 4);
          this.shots.push({ x: a.x, y: a.y, life: 260 });
          api.sfx.shoot(); api.shake(3);
          const dist = Math.hypot(a.x - d.x, a.y - d.y);
          if (dist < 17 && this.inv <= 0 && !hid) {
            this.lives--; this.inv = 1300;
            api.burst(d.x, d.y, C.eye, 18, 1); api.burst(d.x, d.y, C.red, 14, 1.1); api.sfx.bad(); api.buzz(110); api.shake(10);
            if (this.lives <= 0) {
              this.dead = true;
              api.end({ title: 'Plucked.', text: `You stayed in the air for ${this.t.toFixed(1)} s, dodged ${this.near} close shot${this.near === 1 ? '' : 's'} and grabbed ${this.got} crumb${this.got === 1 ? '' : 's'}.`, quip: quips[(Math.random() * quips.length) | 0] });
              return;
            }
            api.flash('Ouch! ' + this.lives + ' left');
          } else if (dist < 46 && !hid) { this.near++; api.float(d.x, d.y - 22, 'close! +15', C.blue); api.sfx.good(); api.buzz(10); }
        }
      } else { a.t -= dt; if (a.t <= 0) a.state = 'hunt'; }
      for (const sh of this.shots) sh.life -= dt;
      this.shots = this.shots.filter(sh => sh.life > 0);
    }
    draw(c, now) {
      const { C, D } = this.api, d = this.d, a = this.aim;
      D.bg(c, W, H, 15);
      D.circle(c, W - 48, 52, 22, C.paper2); c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.arc(W - 48, 52, 22, 0, Math.PI * 2); c.stroke();
      for (const k of this.crumbs) {
        const blink = k.life < 1200 && Math.floor(now / 120) % 2; if (blink) continue;
        const b = Math.sin(now / 220 + k.x) * 2;
        D.ellipse(c, k.x, k.y + b, 7, 5, .3, C.paper2); c.strokeStyle = C.ink; c.lineWidth = 1.6; c.beginPath(); c.ellipse(k.x, k.y + b, 7, 5, .3, 0, Math.PI * 2); c.stroke();
        D.circle(c, k.x - 2, k.y + b - 1, 1, C.ink); D.circle(c, k.x + 2, k.y + b + 1, 1, C.ink);
      }
      // duck (drawn before clouds so clouds hide it)
      const blink = this.inv > 0 && Math.floor(now / 100) % 2;
      if (!this.dead && !blink) {
        c.save(); c.translate(d.x, d.y); c.scale(d.face, 1);
        const flap = this.api.reduced ? 0 : Math.sin(now / 70);
        D.ellipse(c, 0, 0, 15, 10, 0, C.red); c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(-14, -2); c.lineTo(-22, -6); c.lineTo(-16, 3); c.closePath(); c.fillStyle = C.red; c.fill(); c.stroke();
        D.circle(c, 12, -9, 8, C.red); c.beginPath(); c.arc(12, -9, 8, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(18, -10); c.lineTo(27, -7); c.lineTo(18, -4); c.closePath(); c.fillStyle = C.paper; c.fill(); c.stroke();
        c.save(); c.translate(-2, -2); c.rotate(-.4 - flap * .6);
        D.ellipse(c, -4, -6, 10, 5, 0, C.paper2); c.beginPath(); c.ellipse(-4, -6, 10, 5, 0, 0, Math.PI * 2); c.stroke(); c.restore();
        c.restore();
        const ex = d.x + 13 * d.face, ey = d.y - 11;
        D.circle(c, ex, ey, 3.2, C.eye);
        const lx = a.x - ex, ly = a.y - ey, l = Math.hypot(lx, ly) || 1;
        D.circle(c, ex + lx / l * 1.4, ey + ly / l * 1.4, 1.7, C.pupil);
        if (a.state === 'lock' && Math.hypot(a.x - d.x, a.y - d.y) < 40) D.ellipse(c, d.x - 18 * d.face, d.y - 16 + (now / 7) % 10, 1.8, 2.8, 0, C.blue);
      }
      for (const cl of this.clouds) {
        c.fillStyle = C.board; c.strokeStyle = C.ink; c.lineWidth = 2.5;
        const x = cl.x, y = cl.y, w = cl.w;
        c.beginPath(); c.moveTo(x - w / 2, y + 12);
        c.arc(x - w / 4, y + 2, w / 5, Math.PI * .9, Math.PI * 1.8); c.arc(x + w / 12, y - 6, w / 4.2, Math.PI * 1.1, Math.PI * 1.95); c.arc(x + w / 3, y + 4, w / 6, Math.PI * 1.3, Math.PI * .2);
        c.lineTo(x - w / 2, y + 12); c.closePath(); c.fill(); c.stroke();
      }
      c.fillStyle = C.paper2; c.fillRect(0, GROUND, W, H - GROUND); c.fillStyle = C.ink; c.fillRect(0, GROUND, W, 3);
      c.strokeStyle = C.leaf; c.lineWidth = 2.5;
      for (let x = 6; x < W; x += 12) { c.beginPath(); c.moveTo(x, GROUND); c.lineTo(x - 3 + Math.sin(now / 400 + x) * 2, GROUND - 12 - (x % 3) * 3); c.stroke(); }
      for (const sh of this.shots) { c.globalAlpha = sh.life / 260; D.circle(c, sh.x, sh.y, 26 * (1 - sh.life / 260) + 6, C.red); c.globalAlpha = 1; }
      // crosshair
      const lock = a.state === 'lock', col = lock ? C.red : C.blue;
      const lockTime = Math.max(260, 460 - this.t * 3.5);
      const r = lock ? 10 + 22 * (a.t / lockTime) : 18;
      c.strokeStyle = col; c.lineWidth = lock ? 3 : 2.5; c.globalAlpha = a.state === 'reload' ? .4 : 1;
      c.beginPath(); c.arc(a.x, a.y, r, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(a.x - r - 7, a.y); c.lineTo(a.x - 5, a.y); c.moveTo(a.x + 5, a.y); c.lineTo(a.x + r + 7, a.y); c.moveTo(a.x, a.y - r - 7); c.lineTo(a.x, a.y - 5); c.moveTo(a.x, a.y + 5); c.lineTo(a.x, a.y + r + 7); c.stroke();
      c.globalAlpha = 1;
      for (let i = 0; i < 3; i++) D.circle(c, 18 + i * 18, 20, 6, i < this.lives ? C.red : C.line);
      if (this.hidden() && !this.dead) D.text(c, 'HIDDEN', d.x, d.y - 26, 10, C.ink, 'center', C.board);
    }
  }

  FLIP.register({
    id: 'duck', num: '06', name: 'Duck', flipOf: 'the duck-shooting game', W, H, controls: 'joy2d',
    role: "You're the duck.",
    intro: 'A crosshair hunts you across the sky. When it turns red and shrinks, it is about to fire: swerve. Hide inside clouds and grab crumbs for points.',
    hint: 'Hold anywhere and drag to fly.',
    keys: 'Arrows or WASD to fly · Space pauses',
    pauseLine: 'The hunter is wiping its glasses.',
    create: api => new Duck(api)
  });
})();
