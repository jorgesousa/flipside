/* Game 04 — Stomped: the platformer, flipped. You're the little walker. */
(() => {
  const W = 320, H = 400, GY = 334, G = 1500, JV = 560, T = 2 * JV / G;
  const PLAT = { x1: 116, x2: 204, y: 244 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const quips = ['Flattened, but still adorable.', "That's how pancakes are made.", 'The hero got a coin for that. Rude.', 'Squashed it. Badly.'];

  class Stomped {
    constructor(api) {
      this.api = api;
      this.me = { x: 230, y: GY, w: 30, h: 22, vx: 0, vy: 0, ground: true };
      this.hero = { x: 40, y: GY, w: 24, h: 34, vx: 0, vy: 0, ground: true, state: 'run', t: 0, cd: .6, spin: 0 };
      this.t = 0; this.bonks = 0; this.level = 0; this.dead = false;
      this.clouds = [{ x: 40, y: 60, s: 1 }, { x: 200, y: 100, s: .8 }, { x: 300, y: 40, s: 1.2 }];
    }
    score() { return Math.floor(this.t * 10) + this.bonks * 100; }
    hud() { return [['Score', this.score()], ['Bonks', this.bonks]]; }
    land(e, prevY) {
      e.ground = false;
      if (e.vy >= 0 && prevY <= PLAT.y && e.y >= PLAT.y && e.x > PLAT.x1 - 4 && e.x < PLAT.x2 + 4) { e.y = PLAT.y; e.vy = 0; e.ground = true; }
      if (e.y >= GY) { e.y = GY; e.vy = 0; e.ground = true; }
      if (e.ground && e.y === PLAT.y && (e.x < PLAT.x1 - 4 || e.x > PLAT.x2 + 4)) e.ground = false;
    }
    update(dt, inp) {
      if (this.dead) return;
      const s = dt / 1000, api = this.api, me = this.me, h = this.hero;
      this.t += s;
      for (const cl of this.clouds) { cl.x -= 8 * cl.s * s; if (cl.x < -50) cl.x = W + 40; }
      // me
      const ox0 = me.x; me.vx = inp.x * 140;
      if ((inp.pressed.up || inp.pressed.hop) && me.ground) { me.vy = -380; me.ground = false; api.sfx.hop(); }
      me.x = clamp(me.x + me.vx * s, me.w / 2, W - me.w / 2); me.vx = s > 0 ? (me.x - ox0) / s : 0;
      let py = me.y; me.vy += G * s; me.y += me.vy * s; this.land(me, py);

      // hero
      const speed = Math.min(200, 118 + this.t * 1.2 + this.level * 6);
      const hPrevBottom = h.y;
      if (h.state === 'hurt') {
        h.t -= dt; h.spin += s * 12; h.x += h.vx * s; h.vy += G * s; h.y += h.vy * s;
        if (h.t <= 0) {
          const left = me.x > W / 2;
          Object.assign(h, { x: left ? 20 : W - 20, y: -40, vx: 0, vy: 0, ground: false, state: 'run', cd: .5, spin: 0 });
        }
      } else {
        h.cd -= s;
        const dir = Math.sign(me.x - h.x) || 1;
        if (h.ground) {
          const target = clamp(me.x + me.vx * T * .6, h.w / 2, W - h.w / 2);
          const reach = Math.abs(target - h.x);
          if (h.cd <= 0 && reach < speed * T + 16) {
            h.vy = -JV; h.ground = false; h.vx = clamp((target - h.x) / T, -240, 240); h.cd = Math.max(.25, .5 - this.level * .02);
          } else if (h.cd > 0 && Math.abs(me.x - h.x) < 30) h.vx = -dir * speed * .8;
          else h.vx = dir * speed;
        } else if (h.vy > -JV * .5) {
          const air = Math.min(950, 320 + this.t * 11 + this.level * 25);
          h.vx = clamp(h.vx + Math.sign(me.x - h.x) * air * s, -260, 260);
        }
        h.x = clamp(h.x + h.vx * s, h.w / 2, W - h.w / 2);
        py = h.y; h.vy += G * s; h.y += h.vy * s; this.land(h, py);
        // contact
        const ox = Math.abs(h.x - me.x) < (h.w + me.w) / 2 - 3;
        const oy = h.y > me.y - me.h + 2 && h.y - h.h < me.y - 2;
        if (ox && oy) {
          if (h.vy > 0 && hPrevBottom <= me.y - me.h + 9) {
            this.dead = true; me.squash = 1;
            api.burst(me.x, me.y - 6, api.C.red, 30, 1.4); api.shake(14); api.sfx.bad(); api.buzz(120);
            api.end({ title: 'Squish.', text: `You dodged for ${this.t.toFixed(1)} s and bonked the hero ${this.bonks} time${this.bonks === 1 ? '' : 's'}.`, quip: quips[(Math.random() * quips.length) | 0] });
            return;
          }
          this.bonks++; this.level++;
          h.state = 'hurt'; h.t = 1100; h.vy = -380; h.vx = (h.x < me.x ? -1 : 1) * 170; h.ground = false;
          api.flash('Bonk!'); api.float(h.x, h.y - 44, '+100', api.C.red); api.burst(h.x, h.y - 20, api.C.blue, 18); api.shake(6); api.sfx.great(); api.buzz([25, 35, 25]);
        }
      }
    }
    draw(c, now) {
      const { C, D } = this.api, me = this.me, h = this.hero;
      D.bg(c, W, H, 16);
      for (const cl of this.clouds) {
        c.strokeStyle = C.line; c.lineWidth = 2.5; c.fillStyle = C.board;
        c.beginPath(); c.arc(cl.x, cl.y, 12 * cl.s, Math.PI * .9, Math.PI * 2.05); c.arc(cl.x + 16 * cl.s, cl.y - 6 * cl.s, 14 * cl.s, Math.PI, Math.PI * 2); c.arc(cl.x + 34 * cl.s, cl.y, 11 * cl.s, Math.PI * 1.1, Math.PI * .1); c.closePath(); c.fill(); c.stroke();
      }
      // platform
      for (let x = PLAT.x1; x < PLAT.x2; x += 22) D.rr(c, x, PLAT.y, 22, 14, 2, C.paper2, C.ink, 2);
      // ground
      c.fillStyle = C.paper2; c.fillRect(0, GY, W, H - GY);
      c.fillStyle = C.ink; c.fillRect(0, GY, W, 3);
      c.fillStyle = C.dot; for (let x = 6; x < W; x += 14) for (let y = GY + 12; y < H; y += 12) c.fillRect(x + (y % 24 ? 7 : 0), y, 3, 3);
      // hero shadow
      if (!h.ground && h.state !== 'hurt') {
        const floorY = h.x > PLAT.x1 && h.x < PLAT.x2 && h.y < PLAT.y ? PLAT.y : GY;
        const k = clamp(1 - (floorY - h.y) / 220, .25, 1);
        c.globalAlpha = .28; D.ellipse(c, h.x, floorY + 1, 14 * k, 3.5 * k, 0, C.ink); c.globalAlpha = 1;
      }
      // me
      if (!this.dead) {
        const scared = !h.ground && h.state !== 'hurt' && Math.abs(h.x - me.x) < 60 && h.y < me.y - 20;
        const step = me.vx && me.ground ? Math.sin(now / 60) * 2 : 0;
        const wob = scared && !this.api.reduced ? Math.sin(now / 30) : 0;
        c.fillStyle = C.ink; c.fillRect(me.x - 10 + step, me.y - 4, 7, 4); c.fillRect(me.x + 3 - step, me.y - 4, 7, 4);
        c.beginPath(); c.moveTo(me.x - me.w / 2 + wob, me.y - 3); c.lineTo(me.x - me.w / 2 + wob, me.y - 10); c.arc(me.x + wob, me.y - 10, me.w / 2, Math.PI, 0); c.lineTo(me.x + me.w / 2 + wob, me.y - 3); c.closePath();
        c.fillStyle = C.red; c.fill(); c.strokeStyle = C.ink; c.lineWidth = 2; c.stroke();
        D.eyes(c, me.x + wob, me.y - 13, 5.5, 4, h.x - me.x, (h.y - 20) - (me.y - 13));
        if (scared) { D.ellipse(c, me.x + wob, me.y - 6, 2, 2.6, 0, C.pupil); D.ellipse(c, me.x + me.w / 2 + 4, me.y - 22 + ((now / 7) % 10), 1.8, 2.8, 0, C.blue); }
      } else { D.ellipse(c, me.x, me.y - 3, me.w * .7, 4, 0, C.red); }
      // hero
      c.save(); c.translate(h.x, h.y - h.h / 2); if (h.state === 'hurt') c.rotate(h.spin);
      const run = h.ground && h.state === 'run' ? Math.sin(now / 55) * 3 : 0;
      c.fillStyle = C.ink;
      if (h.ground) { c.fillRect(-9 + run, h.h / 2 - 6, 7, 6); c.fillRect(2 - run, h.h / 2 - 6, 7, 6); }
      else { c.fillRect(-10, h.h / 2 - 8, 7, 6); c.fillRect(3, h.h / 2 - 4, 7, 6); c.fillRect(-h.w / 2 - 5, -h.h / 2 + 2, 5, 9); c.fillRect(h.w / 2, -h.h / 2 + 2, 5, 9); }
      D.rr(c, -h.w / 2, -h.h / 2, h.w, h.h - 5, 6, C.blue, C.ink, 2);
      c.fillStyle = C.eye; c.fillRect(-h.w / 2 + 1, -h.h / 2 + 6, h.w - 2, 4);
      if (h.state === 'hurt') { c.strokeStyle = C.pupil; c.lineWidth = 1.6; for (const sx of [-5, 5]) { c.beginPath(); c.moveTo(sx - 2, -2); c.lineTo(sx + 2, 2); c.moveTo(sx + 2, -2); c.lineTo(sx - 2, 2); c.stroke(); } }
      else D.eyes(c, 0, 0, 5, 3.2, me.x - h.x, me.y - h.y);
      c.restore();
    }
  }

  FLIP.register({
    id: 'stomped', num: '04', name: 'Stomped', flipOf: 'the platformer', W, H, controls: 'joyx', buttons: [{ id: 'hop', label: 'Hop' }],
    role: "You're the little walker.",
    intro: 'The hero wants to land on your head. Watch its shadow and shuffle away. Bump into it from the side and the hero gets hurt.',
    hint: 'Drag left or right to walk. Tap Hop or flick up to jump.',
    keys: 'Left / right to walk · Up or W to hop · Space pauses',
    pauseLine: 'The hero is mid-air. Somehow.',
    create: api => new Stomped(api)
  });
})();
