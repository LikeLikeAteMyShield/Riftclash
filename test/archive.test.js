import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArchive, planArchive, archiveWidth, ARCHIVE_H as H } from '../src/archive.js';

const WIDTHS = [120, 180, 256, 288, 360];
const luminance = (f, W) => {
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = (0.2126 * f[i * 4] + 0.7152 * f[i * 4 + 1] + 0.0722 * f[i * 4 + 2]) / 255;
  return L;
};

test('the archive fills the viewport\'s shape, within limits', () => {
  assert.equal(archiveWidth(1440, 900), 256);
  assert.equal(archiveWidth(390, 844), 120);
  assert.equal(archiveWidth(4000, 900), 360);
});

test('every width renders a full, opaque frame', () => {
  for (const W of WIDTHS) {
    const f = createArchive(W).render(0);
    assert.equal(f.length, W * H * 4);
    for (let i = 3; i < f.length; i += 4) assert.equal(f[i], 255, `W=${W}: every pixel is opaque`);
  }
});

test('the layout keeps the window centred and the candles on screen', () => {
  for (const W of WIDTHS) {
    const P = planArchive(W);
    assert.ok(Math.abs((P.win.x0 + P.win.x1) / 2 - W / 2) <= 1, `W=${W}: window centred`);
    assert.ok(P.candles.length >= 8, `W=${W}: ${P.candles.length} candles`);
    assert.ok(P.candles.some(c => c.kind === 'float'), 'some candles float');
    for (const c of P.candles) assert.ok(c.x >= 0 && c.x < W && c.y > 0 && c.y < H, `W=${W}: candle at ${c.x},${c.y}`);
    // Shelves cover both sides, out to the edges.
    assert.ok(P.bays.some(b => b.x0 <= 0) && P.bays.some(b => b.x1 >= W - 1), `W=${W}: shelves reach both edges`);
    // No pillar or bay overlaps the window.
    for (const p of [...P.pillars, ...P.bays]) assert.ok(p.x1 < P.win.x0 || p.x0 > P.win.x1, `W=${W}: something covers the window`);
  }
});

test('the archive is dark and calm enough to read cards over', () => {
  for (const W of [180, 288]) {
    for (const t of [0, 4, 9]) {
      const L = luminance(createArchive(W).render(t), W);
      const mean = L.reduce((a, b) => a + b) / L.length;
      const p95 = [...L].sort((a, b) => a - b)[Math.floor(L.length * 0.95)];
      assert.ok(mean < 0.14, `W=${W} t=${t}: mean brightness ${mean.toFixed(3)}`);
      assert.ok(p95 < 0.3, `W=${W} t=${t}: 95th percentile brightness ${p95.toFixed(3)}`);
    }
  }
});

test('candles flicker and motes drift, but gently', () => {
  const W = 256, s = createArchive(W);
  const a = luminance(s.render(3).slice(), W);
  const b = luminance(s.render(3.05), W);           // one frame at 20fps
  const c = luminance(createArchive(W).render(6), W);
  let moved = 0, sharp = 0, later = 0;
  for (let i = 0; i < W * H; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > 0.004) moved++;
    if (d > 0.1) sharp++;
    if (Math.abs(a[i] - c[i]) > 0.004) later++;
  }
  assert.ok(later > 200, `animated (${later} pixels differ after 3s)`);
  assert.ok(moved > 10, `moves frame to frame (${moved} pixels)`);
  assert.ok(sharp / (W * H) < 0.01, `${(sharp / (W * H) * 100).toFixed(2)}% of pixels change sharply in one frame`);
});

test('rendering is deterministic for a given width and time', () => {
  assert.deepEqual(createArchive(200).render(7.25).slice(), createArchive(200).render(7.25));
  assert.deepEqual(planArchive(200), planArchive(200));
});
