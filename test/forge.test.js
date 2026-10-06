import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createForge, planForge, forgeWidth, fireLevel, hammerLift, FORGE_H as H, HAMMER_PERIOD, HAMMER_STRIKE, BELLOWS_PERIOD,
} from '../src/forge.js';

const WIDTHS = [120, 180, 256, 288, 360];
const luminance = (f, W) => {
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = (0.2126 * f[i * 4] + 0.7152 * f[i * 4 + 1] + 0.0722 * f[i * 4 + 2]) / 255;
  return L;
};

test('the forge fills the viewport\'s shape, within limits', () => {
  assert.equal(forgeWidth(1440, 900), 256);
  assert.equal(forgeWidth(390, 844), 120);
  assert.equal(forgeWidth(4000, 900), 360);
});

test('every width renders a full, opaque frame', () => {
  for (const W of WIDTHS) {
    const f = createForge(W).render(1);
    assert.equal(f.length, W * H * 4);
    for (let i = 3; i < f.length; i += 4) assert.equal(f[i], 255, `W=${W}: every pixel is opaque`);
  }
});

test('the hearth, anvil and barrel are on screen at every width, and weapons hang clear of the hearth', () => {
  for (const W of WIDTHS) {
    const P = planForge(W);
    assert.ok(P.hearth.x0 >= 0 && P.hearth.x1 < W, `W=${W}: hearth`);
    assert.ok(P.anvil.x - 18 >= 0 && P.anvil.x + 10 < W, `W=${W}: anvil`);
    if (W >= 160) assert.ok(P.barrel, `W=${W}: barrel`);
    if (P.barrel) assert.ok(P.barrel.x - 10 >= 0 && P.barrel.x + 10 < W, `W=${W}: barrel`);
    assert.ok(P.racks.length >= 2, `W=${W}: ${P.racks.length} weapons on the walls`);
    for (const r of P.racks) assert.ok(r.x < P.hearth.x0 - 8 || r.x > P.hearth.x1 + 6, `W=${W}: weapon at ${r.x} overlaps the hearth`);
  }
});

test('the bellows make the fire swell, and the hammer rises and lands on the beat', () => {
  // In every pump cycle, the fire is brightest just after the bellows are pressed.
  for (let n = 0; n < 4; n++) {
    const levels = Array.from({ length: 100 }, (_, i) => fireLevel((n + i / 100) * BELLOWS_PERIOD));
    const peak = levels.indexOf(Math.max(...levels)) / 100;
    assert.ok(peak >= 0.2 && peak < 0.45, `cycle ${n}: peak at ${peak}`);
  }
  // The hammer starts down, rises high, and is down again from the strike until the cycle ends.
  assert.equal(hammerLift(0), 0);
  assert.ok(hammerLift(HAMMER_PERIOD * 0.65) > 20);
  assert.equal(hammerLift(HAMMER_PERIOD * (HAMMER_STRIKE + 0.01)), 0);
  for (let i = 0; i < 300; i++) {
    const h = hammerLift(i / 100);
    assert.ok(h >= 0 && h < 24, `lift ${h}`);
  }
});

test('the forge is dark enough to work over', () => {
  for (const W of [180, 288]) {
    for (const t of [0.5, 1.6, 2.65]) {
      const L = luminance(createForge(W).render(t), W);
      const mean = L.reduce((a, b) => a + b) / L.length;
      const p95 = [...L].sort((a, b) => a - b)[Math.floor(L.length * 0.95)];
      assert.ok(mean < 0.14, `W=${W} t=${t}: mean brightness ${mean.toFixed(3)}`);
      assert.ok(p95 < 0.3, `W=${W} t=${t}: 95th percentile brightness ${p95.toFixed(3)}`);
    }
  }
});

test('the fire flickers and the hammer moves, without flashing the whole room', () => {
  const W = 256, s = createForge(W);
  let worst = 0;
  // Check consecutive frames at 24fps across a full hammer cycle, including the strike.
  let prev = luminance(s.render(0).slice(), W);
  let animated = 0;
  for (let i = 1; i <= 72; i++) {
    const cur = luminance(s.render(i / 24).slice(), W);
    let sharp = 0;
    for (let k = 0; k < W * H; k++) {
      const d = Math.abs(cur[k] - prev[k]);
      if (d > 0.1) sharp++;
      if (d > 0.004) animated++;
    }
    worst = Math.max(worst, sharp / (W * H));
    prev = cur;
  }
  assert.ok(animated > 1000, 'the scene animates');
  assert.ok(worst < 0.02, `at worst ${(worst * 100).toFixed(2)}% of pixels change sharply in one frame`);
});

test('rendering is deterministic for a given width and time', () => {
  assert.deepEqual(createForge(200).render(7.25).slice(), createForge(200).render(7.25));
  assert.deepEqual(planForge(200), planForge(200));
});
