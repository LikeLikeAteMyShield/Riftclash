import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SECRET_CODE, PLAYTEST_CLASSES, sequenceMatcher, sanitizeUnlocks, loadUnlocks, setUnlocked, isVisible, visibleClasses, togglePlaytest,
} from '../src/unlocks.js';
import { CARDS, CLASSES } from '../src/cards.js';
import { filterCards } from '../src/library.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('Celestial is hidden by default: not among the visible classes, its cards not in the library', () => {
  assert.deepEqual(PLAYTEST_CLASSES, ['celestial']);
  const visible = visibleClasses({});
  assert.ok(!visible.includes('celestial'));
  assert.deepEqual(visible, Object.keys(CLASSES).filter(c => c !== 'celestial'));
  assert.equal(isVisible('neutral', {}), true);
  const all = Object.values(CARDS);
  assert.ok(!filterCards(all, {}).some(c => c.cls === 'celestial'));
  assert.ok(!filterCards(all, { query: 'oblivion', tokens: true }).length, 'not even by searching');
  assert.ok(!filterCards(all, { cls: 'celestial' }).length, 'not even by asking for its tab');
});

test('once unlocked, the class and its cards show up', () => {
  const unlocks = { celestial: { how: 'playtest', at: 1 } };
  assert.ok(visibleClasses(unlocks).includes('celestial'));
  const cel = filterCards(Object.values(CARDS), { cls: 'celestial', unlocks });
  assert.equal(cel.length, Object.values(CARDS).filter(c => c.cls === 'celestial' && !c.token).length);
});

test('the secret code must be typed exactly; typing it again locks the class again', () => {
  const s = memoryStorage();
  const match = sequenceMatcher(SECRET_CODE);
  // Near misses never match.
  for (const k of [...SECRET_CODE.slice(0, 9), 'x', ...SECRET_CODE.slice(1)]) assert.equal(match(k), false);
  assert.equal(match('B'), false);
  // The real code (capital letters fine), even straight after extra presses of the first key.
  const presses = ['ArrowUp', ...SECRET_CODE.slice(0, -2), 'B', 'A'];
  assert.deepEqual(presses.map(match).map((m, i) => (m ? i : null)).filter(i => i !== null), [presses.length - 1]);
  assert.equal(togglePlaytest(s), true);
  assert.ok(isVisible('celestial', loadUnlocks(s)));
  assert.equal(loadUnlocks(s).celestial.how, 'playtest');
  assert.equal(togglePlaytest(s), false);
  assert.ok(!isVisible('celestial', loadUnlocks(s)));
});

test('only hidden classes can be unlocked, and bad stored data is ignored', () => {
  const s = memoryStorage();
  setUnlocked('shade', true, { storage: s });
  assert.deepEqual(loadUnlocks(s), {});
  setUnlocked('celestial', true, { storage: s, how: 'riftkin', now: 42 });
  assert.deepEqual(loadUnlocks(s), { celestial: { how: 'riftkin', at: 42 } });
  assert.deepEqual(sanitizeUnlocks({ celestial: true, bard: { how: 'x' }, shade: { how: 'x' } }), {});
  s.setItem('riftclash-unlocks', 'not json');
  assert.deepEqual(loadUnlocks(s), {});
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(loadUnlocks(broken), {});
  assert.doesNotThrow(() => togglePlaytest(broken));
});
