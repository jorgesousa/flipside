/* Game 07 — Mole: whack-a-mole, flipped. You're the mole. */
(() => {
  const W = 300, H = 400, HOLES = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) HOLES.push({ x: 60 + c * 90, y: 150 + r * 92 });
  const ORANGE = '#F2862B', GOLD = '#F5B700';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const quips = ['Bonk. Bonk. Bonk.', 'Back to the burrow.', 'The hammer always wins. Eventually.', 'Whacked, but well fed.'];

  class Mole {
    constructor(api) {
      this.api = api;
      this.me = { hole: -1, up: 0, stun: 0 };
      this.ham = { x: 150, y: 50, state: 'track', t: 0, target: 4, hole: 4, dwell: 0, feint: false };
      this.carrots = []; this.cT = 700;
      this.t = 0; this.upTime = 0; this.tick = 0; this.got = 0; this.gold = 0; this.whiffs = 0; this.lives = 3; this.inv = 0; this.dead = false;
    }
    holeAt(x, y) {
      let best = -1, bd = 1e9;
      HOLES.forEach((h, i) => { const d = Math.hypot(x - h.x, (y - (h.y - 18)) * 1.15); if (d < bd) { bd = d; best = i; } });
      return bd < 58 ? best : -1;
    }
    score() { return Math.floor(this.upTime * 20) + this.got * 50 + this.gold * 150 + this.whiffs * 25; }
    hud() { return [['Score', this.score()], ['Lives', 'x' + this.lives]]; }
    update(dt, inp) {
      if (this.dead) return;
      const s = dt / 1000, api = this.api, C = api.C, me = this.me, hm = this.ham;
      this.t += s;
      let want = -1;
      if (inp.ptr && inp.ptr.down) want = this.holeAt(inp.ptr.x, inp.ptr.y);
      for (let i = 0; i < 9; i++) if (inp.held['hole' + i]) want = i;
      if (me.stun > 0) { me.stun -= dt; want = -1; }
      if (this.inv > 0) this.inv -= dt;
      if (want !== me.hole) { me.up = Math.max(0, me.up - s * 9); if (me.up === 0) me.hole = want; }
      else if (me.hole >= 0) me.up = Math.min(1, me.up + s * 8);
      const isUp = me.hole >= 0 && me.up > .6;
      if (me.hole >= 0 && me.up >= 1) {
        this.upTime += s; this.tick += s;
        if (this.tick >= 1) { this.tick -= 1; api.float(HOLES[me.hole].x, HOLES[me.hole].y - 60, '+20', C.ink); }
      }
      // carrots
      this.cT -= dt;
      if (this.cT <= 0) {
        this.cT = Math.max(1100, 2200 - this.t * 15);
        const free = HOLES.map((_, i) => i).filter(i => !this.carrots.some(c => c.hole === i) && i !== me.hole);
        if (free.length && this.carrots.length < 2) this.carrots.push({ hole: free[(Math.random() * free.length) | 0], life: 3800, gold: Math.random() < .12 });
      }
      for (const c of this.carrots) {
        c.life -= dt;
        if (isUp && c.hole === me.hole) {
          c.taken = true; const h = HOLES[c.hole];
          if (c.gold) { this.gold++; api.flash('Golden carrot!'); api.float(h.x, h.y - 70, '+150', C.red); api.sfx.great(); }
          else { this.got++; api.float(h.x, h.y - 70, '+50', C.red); api.sfx.good(); }
          api.burst(h.x, h.y - 30, c.gold ? GOLD : ORANGE, 12, .8); api.buzz(15);
        }
      }
      this.carrots = this.carrots.filter(c => c.life > 0 && !c.taken);
      // hammer
      const speed = Math.min(950, 380 + this.t * 9), wind = Math.max(230, 520 - this.t * 5);
      if (hm.state === 'track') {
        let target = hm.target;
        if (isUp && this.inv <= 0) target = me.hole;
        else if (this.carrots.length) target = this.carrots[0].hole;
        if (target !== hm.target) { hm.target = target; hm.dwell = 0; }
        const h = HOLES[hm.target], tx = h.x + 14, ty = h.y - 78;
        const dx = tx - hm.x, dy = ty - hm.y, d = Math.hypot(dx, dy);
        if (d > 2) { const k = Math.min(1, speed * s / d); hm.x += dx * k; hm.y += dy * k; }
        else {
          hm.dwell += dt;
          const onMe = isUp && me.hole === hm.target && this.inv <= 0;
          if (onMe || hm.dwell > 900) {
            if (!onMe && !this.carrots.some(c => c.hole === hm.target)) { hm.target = (Math.random() * 9) | 0; hm.dwell = 0; }
            else { hm.state = 'wind'; hm.t = wind; hm.hole = hm.target; hm.feint = this.t > 15 && Math.random() < .18; }
          }
        }
      } else if (hm.state === 'wind') {
        hm.t -= dt;
        if (hm.feint && hm.t < wind * .4) { hm.state = 'track'; hm.dwell = 0; hm.feint = false; }
        else if (hm.t <= 0) { hm.state = 'slam'; hm.t = 70; }
      } else if (hm.state === 'slam') {
        hm.t -= dt;
        if (hm.t <= 0) {
          const h = HOLES[hm.hole];
          api.shake(5);
          if (me.hole === hm.hole && me.up > .35 && this.inv <= 0) {
            this.lives--; me.stun = 700; this.inv = 900;
            api.burst(h.x, h.y - 24, C.red, 22, 1.2); api.sfx.bad(); api.buzz(110);
            if (this.lives <= 0) {
              this.dead = true;
              api.end({ title: 'Whacked.', text: `You spent ${this.upTime.toFixed(1)} s above ground, ate ${this.got + this.gold} carrot${this.got + this.gold === 1 ? '' : 's'} and made the hammer whiff ${this.whiffs} time${this.whiffs === 1 ? '' : 's'}.`, quip: quips[(Math.random() * quips.length) | 0] });
              return;
            }
            api.flash('Bonked! ' + this.lives + ' left'); hm.state = 'recover'; hm.t = 420;
          } else {
            const had = this.carrots.some(c => c.hole === hm.hole);
            this.carrots = this.carrots.filter(c => c.hole !== hm.hole);
            if (had) api.float(h.x, h.y - 40, 'carrot smashed', C.blue);
            else { this.whiffs++; api.float(h.x, h.y - 40, 'whiff +25', C.blue); }
            api.sfx.blip(); api.buzz(8);
            hm.state = 'stuck'; hm.t = Math.max(320, 700 - this.t * 4);
          }
        }
      } else { hm.t -= dt; if (hm.t <= 0) { hm.state = 'track'; hm.dwell = 0; } }
    }
    drawMole(c, h, up, now) {
      const { C, D } = this.api, me = this.me, hm = this.ham;
      const top = h.y - 50 * up;
      c.save(); c.beginPath(); c.rect(h.x - 40, h.y - 90, 80, 92); c.clip();
      D.rr(c, h.x - 20, top, 40, 64, [20, 20, 6, 6], C.red, C.ink, 2);
      const stunned = me.stun > 0;
      const scared = hm.state === 'wind' && hm.hole === me.hole;
      if (stunned) {
        c.strokeStyle = C.pupil; c.lineWidth = 2;
        for (const sx of [-7, 7]) { c.beginPath(); c.moveTo(h.x + sx - 3, top + 13); c.lineTo(h.x + sx + 3, top + 19); c.moveTo(h.x + sx + 3, top + 13); c.lineTo(h.x + sx - 3, top + 19); c.stroke(); }
      } else D.eyes(c, h.x, top + 16, 7, scared ? 5 : 4.2, hm.x - h.x, hm.y - (top + 16));
      D.ellipse(c, h.x, top + 27, 5, 3.6, 0, C.pupil);
      c.fillStyle = C.eye; c.fillRect(h.x - 4, top + 32, 3.5, 5); c.fillRect(h.x + .5, top + 32, 3.5, 5);
      c.strokeStyle = C.ink; c.lineWidth = 1.2;
      for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(h.x + sx * 8, top + 27); c.lineTo(h.x + sx * 19, top + 24); c.moveTo(h.x + sx * 8, top + 29); c.lineTo(h.x + sx * 19, top + 31); c.stroke(); }
      if (scared) D.ellipse(c, h.x + 23, top + 6 + (now / 7) % 12, 2, 3, 0, C.blue);
      c.restore();
      if (stunned) for (let i = 0; i < 3; i++) { const a = now / 200 + i * 2.1; D.text(c, '*', h.x + Math.cos(a) * 16, top - 6 + Math.sin(a) * 5, 14, C.blue); }
    }
    draw(c, now) {
      const { C, D } = this.api, me = this.me, hm = this.ham;
      D.bg(c, W, H, 16);
      c.fillStyle = C.paper2; c.fillRect(0, 92, W, H - 92);
      c.fillStyle = C.ink; c.fillRect(0, 92, W, 3);
      c.fillStyle = C.dot; for (let y = 108; y < H; y += 16) for (let x = (y % 32 ? 4 : 12); x < W; x += 16) c.fillRect(x, y, 4, 2);
      HOLES.forEach((h, i) => {
        const tgt = hm.state === 'wind' && hm.hole === i;
        if (tgt) { c.globalAlpha = .35 + .3 * Math.sin(now / 50); D.ellipse(c, h.x, h.y, 44, 17, 0, C.red); c.globalAlpha = 1; }
        D.ellipse(c, h.x, h.y, 36, 13, 0, C.ink);
        const car = this.carrots.find(k => k.hole === i);
        if (car) {
          const blink = car.life < 900 && Math.floor(now / 120) % 2;
          if (!blink) {
            const col = car.gold ? GOLD : ORANGE, bob = Math.sin(now / 200 + i) * 2;
            c.fillStyle = C.leaf; for (const a of [-.5, 0, .5]) { c.save(); c.translate(h.x, h.y - 34 + bob); c.rotate(a); c.fillRect(-2, -14, 4, 14); c.restore(); }
            c.beginPath(); c.moveTo(h.x - 9, h.y - 34 + bob); c.lineTo(h.x + 9, h.y - 34 + bob); c.lineTo(h.x, h.y - 4 + bob); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = C.ink; c.lineWidth = 1.6; c.stroke();
            if (car.gold) { c.globalAlpha = .5 + .5 * Math.sin(now / 90); D.text(c, '+', h.x + 13, h.y - 38, 12, GOLD); c.globalAlpha = 1; }
          }
        }
        if (me.hole === i && me.up > 0) this.drawMole(c, h, me.up, now);
        c.beginPath(); c.ellipse(h.x, h.y, 36, 13, 0, 0, Math.PI); c.lineWidth = 4; c.strokeStyle = C.paper2; c.stroke();
        c.beginPath(); c.ellipse(h.x, h.y + 2, 38, 14, 0, .1, Math.PI - .1); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke();
      });
      // hammer
      let hx = hm.x, hy = hm.y, rot = -.25;
      if (hm.state === 'wind') { const k = 1 - hm.t / Math.max(1, Math.max(230, 520 - this.t * 5)); hy -= 22 * k; rot = -.25 - .7 * k; if (!this.api.reduced) hx += Math.sin(now / 25) * 1.5; }
      if (hm.state === 'slam' || hm.state === 'stuck' || hm.state === 'recover') { const h = HOLES[hm.hole]; hx = h.x + 14; hy = h.y - 30; rot = .05; }
      c.save(); c.translate(hx, hy); c.rotate(rot);
      D.rr(c, 4, -4, 52, 9, 4, C.ink);
      D.rr(c, -26, -18, 34, 36, 7, C.blue, C.ink, 2.5);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-21, -13, 5, 26);
      c.restore();
      if (hm.state === 'stuck') { c.globalAlpha = .7; D.text(c, 'clang', hx - 8, hy - 34, 11, C.blue, 'center', C.paper2); c.globalAlpha = 1; }
      for (let i = 0; i < 3; i++) D.circle(c, 18 + i * 18, 20, 6, i < this.lives ? C.red : C.line);
    }
  }

  FLIP.register({
    id: 'mole', num: '07', name: 'Mole', flipOf: 'whack-a-mole', W, H, controls: 'tap',
    role: "You're the mole.",
    intro: 'Hold a hole to pop up, let go to duck. Grab carrots before the hammer smashes them. Watch for the red glow: that is where it is about to slam.',
    hint: 'Hold a hole to pop up. Let go to duck.',
    keys: 'Hold Q W E / A S D / Z X C (or 1–9) to pop up · Space pauses',
    pauseLine: 'The hammer is hovering. Ominously.',
    create: api => new Mole(api)
  });
})();
