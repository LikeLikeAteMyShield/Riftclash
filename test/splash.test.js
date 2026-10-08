import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNES, runeRingSVG, ticksSVG, sigilPoints, hexagramPath, createSplash, splashWidth, riftOpen, SPLASH_H } from '../src/splash.js';

test('rune glyphs are simple strokes inside their 6 x 10 box, all different', () => {
  assert.ok(RUNES.length >= 12);
  assert.equal(new Set(RUNES).size, RUNES.length);
  for (const d of RUNES) {
    assert.match(d, /^[MLVHZ0-9 .]+$/, d);
    const nums = d.match(/\d+(\.\d+)?/g).map(Number);
    assert.ok(nums.every(n => n >= 0 && n <= 10), d);
  }
});

test('a rune ring places every glyph on its circle, upright, starting from the offset', () => {
  const svg = runeRingSVG({ r: 400, count: 24, size: 20, offset: 3 });
  const paths = svg.match(/<path /g);
  assert.equal(paths.length, 24);
  assert.ok(svg.includes(`d="${RUNES[3]}"`), 'the ring starts at the offset glyph');
  assert.ok(svg.includes('rotate(15.00) translate(0 -400)'), 'glyphs are spaced evenly round the circle');
  assert.equal(ticksSVG({ r0: 450, r1: 460, count: 120, major: 10 }).match(/class="tick major"/g).length, 12);
});

test('the class sigils sit on a hexagram: one at the top, one at the bottom, two either side', () => {
  const p = sigilPoints(6, 300);
  assert.deepEqual(p[0], { x: 0, y: -300 });
  assert.deepEqual(p[3], { x: 0, y: 300 });
  assert.ok(p.every(q => Math.abs(Math.hypot(q.x, q.y) - 300) < 1));
  assert.equal(p.filter(q => q.x < 0).length, 2);
  assert.equal(hexagramPath(300).match(/Z/g).length, 2, 'two triangles');
});

test('the backdrop fills the screen, the Rift tears open, and it keeps moving', () => {
  assert.equal(splashWidth(1206, 760), Math.round(SPLASH_H * 1206 / 760));
  assert.equal(splashWidth(390, 844), 83);
  assert.equal(splashWidth(4000, 500), 420);
  const s = createSplash(240);
  const f0 = s.render(0).slice(), f3 = s.render(3).slice(), f4 = s.render(4).slice();
  assert.equal(f0.length, 240 * SPLASH_H * 4);
  for (let i = 3; i < f0.length; i += 4) assert.equal(f0[i], 255);
  // Brightness of the column down the middle, where the Rift is.
  const centre = f => { let sum = 0; for (let y = 0; y < SPLASH_H; y++) for (let x = 116; x < 124; x++) sum += f[(y * 240 + x) * 4]; return sum; };
  assert.equal(riftOpen(0), 0);
  assert.equal(riftOpen(5), 1);
  assert.ok(centre(f3) > centre(f0) * 1.5, 'the Rift is open by the time the title is up');
  let moved = 0;
  for (let i = 0; i < f3.length; i += 4) if (Math.abs(f3[i] - f4[i]) > 2) moved++;
  assert.ok(moved > 100, `animated (${moved} pixels changed)`);
  assert.deepEqual(createSplash(240).render(3), f3, 'deterministic for a given time');
});
