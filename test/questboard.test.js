import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuestBoard, planBoard, questBoardWidth, BOARD_H as H } from '../src/questboard.js';

const WIDTHS = [120, 180, 256, 288, 360];
const luminance = (f, W) => {
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = (0.2126 * f[i * 4] + 0.7152 * f[i * 4 + 1] + 0.0722 * f[i * 4 + 2]) / 255;
  return L;
};

test('the quest board fills the viewport\'s shape, within limits', () => {
  assert.equal(questBoardWidth(1440, 900), 256);
  assert.equal(questBoardWidth(390, 844), 120);
  assert.equal(questBoardWidth(4000, 900), 360);
});

test('every width renders a full, opaque frame', () => {
  for (const W of WIDTHS) {
    const f = createQuestBoard(W).render(2);
    assert.equal(f.length, W * H * 4);
    for (let i = 3; i < f.length; i += 4) assert.equal(f[i], 255, `W=${W}: every pixel is opaque`);
  }
});

test('the board is centred with papers pinned inside it, and the window fits beside it on wide screens', () => {
  for (const W of WIDTHS) {
    const P = planBoard(W);
    assert.ok(Math.abs((P.board.x0 + P.board.x1) / 2 - W / 2) <= 1, `W=${W}: board centred`);
    assert.ok(P.board.x0 - 4 >= 0 && P.board.x1 + 4 < W, `W=${W}: frame on screen`);
    assert.ok(P.papers.length >= 6, `W=${W}: ${P.papers.length} papers`);
    for (const p of P.papers) {
      assert.ok(p.x >= P.board.x0 && p.x + p.w <= P.board.x1 && p.y >= P.board.y0 && p.y + p.h <= P.board.y1, `W=${W}: paper outside the board`);
    }
    if (W >= 256) assert.ok(P.window, `W=${W}: dawn through the window`);
    if (P.window) assert.ok(P.window.x0 >= 0 && P.window.x1 + 4 < P.board.x0 - 4, `W=${W}: window clear of the board`);
    assert.ok(P.papers.some(p => p.kind === 'map') && P.papers.some(p => p.kind === 'wanted'), 'a map and a wanted poster');
  }
});

test('the quest board is dim enough for the notices on top to stand out', () => {
  for (const W of [180, 256, 360]) {
    for (const t of [0, 3, 8]) {
      const L = luminance(createQuestBoard(W).render(t), W);
      const mean = L.reduce((a, b) => a + b) / L.length;
      const p95 = [...L].sort((a, b) => a - b)[Math.floor(L.length * 0.95)];
      assert.ok(mean < 0.17, `W=${W} t=${t}: mean brightness ${mean.toFixed(3)}`);
      assert.ok(p95 < 0.4, `W=${W} t=${t}: 95th percentile brightness ${p95.toFixed(3)}`);
    }
  }
});

test('lanterns flicker, clouds drift and papers flutter, gently', () => {
  const W = 256, s = createQuestBoard(W);
  let prev = luminance(s.render(0).slice(), W), worst = 0, changed = 0;
  for (let i = 1; i <= 60; i++) {
    const cur = luminance(s.render(i / 20).slice(), W);
    let sharp = 0;
    for (let k = 0; k < W * H; k++) { const d = Math.abs(cur[k] - prev[k]); if (d > 0.1) sharp++; if (d > 0.004) changed++; }
    worst = Math.max(worst, sharp / (W * H));
    prev = cur;
  }
  assert.ok(changed > 1000, 'the scene animates');
  assert.ok(worst < 0.01, `at worst ${(worst * 100).toFixed(2)}% of pixels change sharply in one frame`);
});

test('rendering is deterministic for a given width and time', () => {
  assert.deepEqual(createQuestBoard(200).render(4.5).slice(), createQuestBoard(200).render(4.5));
  assert.deepEqual(planBoard(200), planBoard(200));
});
