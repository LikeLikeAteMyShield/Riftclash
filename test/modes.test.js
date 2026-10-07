import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, availableModes } from '../src/modes.js';
import { hasSprite } from '../src/pixelart.js';
import '../src/sprites/index.js';

test('the standard mode is offered, as "Enter the Rift"', () => {
  const standard = availableModes().find(m => m.id === 'standard');
  assert.ok(standard);
  assert.equal(standard.name, 'Enter the Rift');
  assert.equal(standard.screen, 'play');
});

test('every mode is well formed, with a unique id and an emblem', () => {
  const ids = new Set();
  for (const m of MODES) {
    assert.ok(m.id && !ids.has(m.id), m.id); ids.add(m.id);
    assert.ok(m.name && m.text && m.screen, m.id);
    assert.ok(hasSprite(m.icon), `${m.id}: emblem "${m.icon}" isn't a registered sprite`);
  }
});
