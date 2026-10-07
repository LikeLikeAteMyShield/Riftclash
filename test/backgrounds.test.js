import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUNDS, createScene, pickBackground, randomBackgrounds, BG_WIDTH as W, BG_HEIGHT as H } from '../src/backgrounds.js';
import { HEROES, RIFTKIN } from '../src/cards.js';

const ids = Object.keys(BACKGROUNDS);
const luminance = f => {
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = (0.2126 * f[i * 4] + 0.7152 * f[i * 4 + 1] + 0.0722 * f[i * 4 + 2]) / 255;
  return L;
};

test('there are several backgrounds and each renders a full frame', () => {
  assert.ok(ids.length >= 4);
  for (const id of ids) {
    const s = createScene(id);
    const f = s.render(0);
    assert.equal(f.length, W * H * 4, id);
    assert.ok(s.name, id);
    for (let i = 3; i < f.length; i += 4) assert.equal(f[i], 255, `${id}: every pixel is opaque`);
  }
});

test('backgrounds are dark enough for the board to stay readable', () => {
  for (const id of ids) {
    for (const t of [0, 3, 8]) {
      const L = luminance(createScene(id).render(t));
      const mean = L.reduce((a, b) => a + b) / L.length;
      const p95 = [...L].sort((a, b) => a - b)[Math.floor(L.length * 0.95)];
      assert.ok(mean < 0.16, `${id} t=${t}: mean brightness ${mean.toFixed(3)}`);
      assert.ok(p95 < 0.3, `${id} t=${t}: 95th percentile brightness ${p95.toFixed(3)}`);
    }
  }
});

test('backgrounds are calm, not busy: few hard edges', () => {
  for (const id of ids) {
    const L = luminance(createScene(id).render(4));
    let edges = 0;
    for (let y = 0; y < H; y++) for (let x = 1; x < W; x++) if (Math.abs(L[y * W + x] - L[y * W + x - 1]) > 0.06) edges++;
    const share = edges / (H * (W - 1));
    assert.ok(share < 0.05, `${id}: ${(share * 100).toFixed(1)}% hard edges`);
  }
});

test('backgrounds move, but subtly', () => {
  for (const id of ids) {
    const s = createScene(id);
    const a = luminance(s.render(0).slice()), b = luminance(s.render(2.5));
    let moved = 0, big = 0;
    for (let i = 0; i < W * H; i++) { const d = Math.abs(a[i] - b[i]); if (d > 0.004) moved++; if (d > 0.08) big++; }
    assert.ok(moved > 20, `${id} is animated (${moved} pixels changed)`);
    assert.ok(big / (W * H) < 0.02, `${id}: ${(big / (W * H) * 100).toFixed(2)}% of pixels change sharply`);
  }
});

test('rendering is deterministic for a given time', () => {
  for (const id of ids) {
    const a = createScene(id).render(5.5).slice(), b = createScene(id).render(5.5);
    assert.deepEqual(a, b, id);
  }
});

test('the background is picked at random, never repeating the previous one', () => {
  const seen = new Set();
  let prev = null;
  for (let i = 0; i < 400; i++) {
    const id = pickBackground(Math.random, prev);
    assert.notEqual(id, prev);
    assert.ok(BACKGROUNDS[id]);
    seen.add(id);
    prev = id;
  }
  assert.equal(seen.size, randomBackgrounds().length, 'every ordinary background comes up');
  assert.ok(![...seen].some(id => BACKGROUNDS[id].boss), 'boss boards never come up at random');
});

test('the Riftkin fight on their own boards: Grun in his citadel, the other four in the Celestial Realm', () => {
  assert.equal(BACKGROUNDS.celestial.name, 'The Celestial Realm');
  assert.equal(BACKGROUNDS.citadel.name, 'Citadel of Endless Night');
  for (const id of RIFTKIN) {
    const board = HEROES[id].board;
    assert.ok(BACKGROUNDS[board]?.boss, `${id} fights on a boss board`);
    assert.equal(board, id === 'grun' ? 'citadel' : 'celestial', id);
  }
  assert.ok(!Object.values(HEROES).some(h => !h.boss && h.board), 'only bosses have a board');
});

test('bad scene data fails clearly', () => {
  assert.throws(() => createScene('nope'), /Unknown background "nope"/);
  BACKGROUNDS._bad = { name: 'Bad', layers: [{ type: 'dragons' }] };
  try { assert.throws(() => createScene('_bad'), /unknown layer type "dragons"/); } finally { delete BACKGROUNDS._bad; }
});
