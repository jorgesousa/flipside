/* Game 05 — Last One: the alien shooter, flipped. You're the last invader. */
(() => {
  const W = 300, H = 420, CY = 394;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const quips = ['Invasion postponed. Indefinitely.', 'Tell the mothership I tried.', 'One small step back for alien-kind.', 'Zapped, but fabulous.'];
  const hitRect = (x, y, r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

  class LastOne {
    constructor(api) {
      this.api = api;
      this.me = { x: 150, y: 90, w: 28, h: 20, vx: 0 };
      this.cannon = { x: 150, w: 34, alive: true, rt: 0, cd: 1 };
      this.shots = []; this.bombs = []; this.bombT = 900;
      this.bunkers = [];
      for (const bx of [36, 126, 216]) for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
        if (j === 2 && (i === 2)) continue;
        this.bunkers.push({ x: bx + i * 9.6, y: 300 + j * 7, w: 9.6, h: 7 });
      }
      this.t = 0; this.hits = 0; this.dead = false;
    }
    score() { return Math.floor(this.t * 10) + this.hits * 200; }
    hud() { return [['Score', this.score()], ['Hits', this.hits]]; }
    bunkerHit(x, y) {
      for (let i = 0; i < this.bunkers.length; i++) if (hitRect(x, y, this.bunkers[i])) { const b = this.bunkers[i]; this.bunkers.splice(i, 1); this.api.burst(b.x + 4, b.y + 3, this.api.C.ink, 5, .5); return true; }
      return false;
    }
    update(dt, inp) {
      if (this.dead) return;
      const s = dt / 1000, api = this.api, me = this.me, cn = this.cannon;
      this.t += s;
      me.vx = inp.x * 180;
      me.x = clamp(me.x + me.vx * s, 16, W - 16);
      me.y = clamp(me.y + inp.y * 160 * s, 40, 235);

      // my bombs
      this.bombT -= dt;
      if (this.bombT <= 0 && this.bombs.length < 2) { this.bombs.push({ x: me.x, y: me.y + 12, noticed: Math.random() < Math.min(.92, .65 + this.t * .008) }); this.bombT = 1300; api.sfx.shoot(); }
      for (const b of this.bombs) b.y += 175 * s;
      // cannon shots
      const sv = Math.min(640, 380 + this.t * 4);
      for (const sh of this.shots) { sh.y -= sv * s; sh.x += (sh.vx || 0) * s; }

      // cannon AI
      if (!cn.alive) { cn.rt -= dt; if (cn.rt <= 0) { cn.alive = true; cn.x = me.x < W / 2 ? W - 30 : 30; cn.cd = .8; } }
      else {
        const cs = Math.min(260, 140 + this.t * 1.5);
        let target = null;
        const threat = this.bombs.find(b => b.noticed && Math.abs(b.x - cn.x) < 28 && (CY - b.y) / 175 < .95 && b.y < CY);
        if (threat) target = threat.x < cn.x ? Math.min(W - 20, threat.x + 60) : Math.max(20, threat.x - 60);
        else { const lead = (CY - me.y) / sv; target = me.x + me.vx * lead; }
        cn.x += clamp(target - cn.x, -cs * s, cs * s); cn.x = clamp(cn.x, 20, W - 20);
        cn.cd -= s;
        if (!threat && cn.cd <= 0 && Math.abs(target - cn.x) < 12) {
          cn.n = (cn.n || 0) + 1;
          this.shots.push({ x: cn.x, y: CY - 14 });
          if (this.t > 10 && cn.n % 3 === 0) { const sp = 60 + Math.min(60, this.t); this.shots.push({ x: cn.x, y: CY - 14, vx: -sp }); this.shots.push({ x: cn.x, y: CY - 14, vx: sp }); }
          cn.cd = Math.max(.24, .65 - this.t * .01); api.sfx.blip();
        }
      }
      // collisions
      for (const b of this.bombs) {
        if (b.dead) continue;
        if (this.bunkerHit(b.x, b.y + 6)) { b.dead = true; continue; }
        if (cn.alive && Math.abs(b.x - cn.x) < cn.w / 2 + 3 && b.y > CY - 14 && b.y < CY + 10) {
          b.dead = true; cn.alive = false; cn.rt = 1400; this.hits++;
          api.flash('Boom!'); api.float(cn.x, CY - 30, '+200', api.C.red); api.burst(cn.x, CY - 6, api.C.ink, 30, 1.5); api.shake(10); api.sfx.boom(); api.buzz([30, 40, 30]);
        }
        if (b.y > H + 10) b.dead = true;
      }
      for (const sh of this.shots) {
        if (sh.dead) continue;
        if (this.bunkerHit(sh.x, sh.y)) { sh.dead = true; continue; }
        if (Math.abs(sh.x - me.x) < me.w / 2 - 2 && sh.y < me.y + me.h / 2 && sh.y > me.y - me.h / 2) {
          this.dead = true;
          api.burst(me.x, me.y, api.C.red, 34, 1.6); api.shake(14); api.sfx.bad(); api.buzz(120);
          api.end({ title: 'Zapped.', text: `You held the sky for ${this.t.toFixed(1)} s and blew up the cannon ${this.hits} time${this.hits === 1 ? '' : 's'}.`, quip: quips[(Math.random() * quips.length) | 0] });
          return;
        }
        if (sh.y < -10) sh.dead = true;
      }
      this.bombs = this.bombs.filter(b => !b.dead); this.shots = this.shots.filter(s2 => !s2.dead);
    }
    draw(c, now) {
      const { C, D } = this.api, me = this.me, cn = this.cannon;
      D.bg(c, W, H, 14);
      c.setLineDash([3, 7]); c.strokeStyle = C.line; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 248); c.lineTo(W, 248); c.stroke(); c.setLineDash([]);
      for (const b of this.bunkers) D.rr(c, b.x, b.y, b.w - .8, b.h - .8, 1.5, C.paper2, C.ink, 1.4);
      for (const sh of this.shots) D.rr(c, sh.x - 1.5, sh.y - 6, 3, 12, 1.5, C.blue);
      c.strokeStyle = C.red; c.lineWidth = 2.4; c.lineJoin = 'round';
      for (const b of this.bombs) { c.beginPath(); c.moveTo(b.x, b.y - 6); c.lineTo(b.x + 3, b.y - 2); c.lineTo(b.x - 3, b.y + 2); c.lineTo(b.x, b.y + 6); c.stroke(); }
      c.fillStyle = C.ink; c.fillRect(0, CY + 12, W, 3);
      if (cn.alive) {
        D.rr(c, cn.x - cn.w / 2, CY - 4, cn.w, 14, 4, C.ink);
        D.rr(c, cn.x - 4, CY - 14, 8, 12, 2, C.ink);
        c.fillStyle = C.red; c.fillRect(cn.x - 10, CY + 1, 20, 3);
      } else if (Math.floor(now / 140) % 2) { c.globalAlpha = .3; D.rr(c, cn.x - cn.w / 2, CY - 4, cn.w, 14, 4, C.ink); c.globalAlpha = 1; }
      if (!this.dead) {
        const leg = Math.floor(now / 250) % 2;
        const danger = this.shots.some(sh => Math.abs(sh.x - me.x) < 24 && sh.y > me.y && sh.y - me.y < 110);
        c.save(); c.translate(me.x, me.y);
        if (danger && !this.api.reduced) c.translate(Math.sin(now / 30) * 1.2, 0);
        c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, -9); c.lineTo(-8, -15); c.moveTo(5, -9); c.lineTo(8, -15); c.stroke();
        D.circle(c, -8, -15, 2.2, C.red); D.circle(c, 8, -15, 2.2, C.red);
        D.rr(c, -14, -10, 28, 18, 7, C.red, C.ink, 2);
        c.fillStyle = C.ink;
        if (leg) { c.fillRect(-12, 8, 4, 5); c.fillRect(-2, 8, 4, 5); c.fillRect(8, 8, 4, 5); }
        else { c.fillRect(-9, 8, 4, 5); c.fillRect(5, 8, 4, 5); }
        D.eyes(c, 0, -2, 5.5, 3.6, cn.x - me.x, CY - me.y);
        if (danger) D.ellipse(c, 17, -4 + (now / 7) % 10, 1.8, 2.8, 0, C.blue);
        c.restore();
      }
    }
  }

  FLIP.register({
    id: 'lastone', num: '05', name: 'Last One', flipOf: 'the alien shooter', W, H, controls: 'joy2d',
    role: "You're the last invader.",
    intro: 'The whole fleet is gone. Fly anywhere in the sky, dodge the cannon and hide above the bunkers. You drop bombs on your own; hit the cannon for big points.',
    hint: 'Hold anywhere and drag to fly. Bombs drop by themselves.',
    keys: 'Arrows or WASD to fly · Space pauses',
    pauseLine: 'The cannon is reloading. Forever, hopefully.',
    create: api => new LastOne(api)
  });
})();
