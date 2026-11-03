// Headless smoke test: loads every game module, plays it with scripted input
// and checks that it never throws and always reaches a game-over screen.
// Run with: node tests/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
Object.assign(globalThis, {
  window: globalThis,
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  getComputedStyle: () => ({ getPropertyValue: () => '#000' }),
  MutationObserver: class { observe() {} },
  document: { documentElement: {} },
  localStorage: { getItem: () => null, setItem: noop }
});

const dir = path.join(__dirname, '..', 'js');
const order = ['shell', 'apple', 'brick', 'haunt', 'stomped', 'lastone', 'duck', 'mole', 'ball'];
for (const f of order) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), { filename: f + '.js' });

const DIRS = ['up', 'down', 'left', 'right', null];
let failures = 0;
for (const def of FLIP.games) {
  let ended = null, t = 0, error = null;
  const api = {
    C: FLIP.C, D: FLIP.D, reduced: false, W: def.W, H: def.H,
    sfx: new Proxy({}, { get: () => noop }), buzz: noop, burst: noop, float: noop, shake: noop, flash: noop,
    zone: null, end: s => { if (!ended) ended = { t, title: s && s.title } }
  };
  try {
    const g = def.create(api, { demo: false });
    const inp = { x: 0, y: 0, dir4: null, pressed: {}, held: {}, ptr: null };
    for (let i = 0; i < 60 * 300 && !ended; i++) {
      if (i % 20 === 0) {
        const d = DIRS[(i / 20) % 5];
        inp.dir4 = d; inp.x = Math.sin(i / 37); inp.y = Math.cos(i / 53);
        if (d) inp.pressed['dir_' + d] = true;
        if (i % 60 === 0) { inp.pressed.up = true; inp.pressed.hop = true; }
        inp.ptr = { x: 150 + Math.sin(i / 90) * 100, y: 200 + Math.cos(i / 70) * 100, down: (i % 120) < 70 };
      }
      g.update(16.7, inp); t += 16.7; inp.pressed = {};
      if (i % 15 === 0) { g.draw(ctx, t); g.hud(); }
    }
    if (!Number.isFinite(g.score())) throw new Error('score is not a number');
  } catch (e) { error = e; }
  const ok = !error && ended;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${def.num} ${def.name.padEnd(9)} ${error ? error.message : ended ? `ended at ${(ended.t / 1000).toFixed(1)}s ("${ended.title}")` : 'never ended'}`);
}
if (FLIP.games.length !== 8) { console.log(`FAIL expected 8 games, found ${FLIP.games.length}`); failures++; }
process.exit(failures ? 1 : 0);
