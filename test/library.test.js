import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterCards, sortCards, CLASS_ORDER } from '../src/library.js';
import { CARDS, CLASSES } from '../src/cards.js';

const all = Object.values(CARDS);
const collectible = all.filter(c => !c.token);
// With every hidden class unlocked, the library shows every card (unlocks.test.js covers the locked view).
const unlocks = Object.fromEntries(Object.keys(CLASSES).filter(c => CLASSES[c].hidden).map(c => [c, { how: 'test', at: 0 }]));

test('default view shows every collectible card and hides tokens', () => {
  const shown = filterCards(all, { unlocks });
  assert.equal(shown.length, collectible.length);
  assert.ok(shown.every(c => !c.token));
  assert.equal(filterCards(all, { tokens: true, unlocks }).length, all.length);
});

test('class filter shows exactly that class', () => {
  for (const cls of CLASS_ORDER) {
    const shown = filterCards(all, { cls, unlocks });
    assert.ok(shown.length >= 8, cls);
    assert.ok(shown.every(c => c.cls === cls), cls);
  }
  const total = CLASS_ORDER.reduce((n, cls) => n + filterCards(all, { cls, unlocks }).length, 0);
  assert.equal(total, collectible.length, 'tabs cover every card exactly once');
});

test('search matches name, rules text, type and class', () => {
  assert.deepEqual(filterCards(all, { query: 'cinder bolt' }).map(c => c.id), ['p_cinderbolt']);
  assert.ok(filterCards(all, { query: 'TAUNT' }).every(c => c.keywords.taunt || /taunt/i.test(c.text ?? '')));
  assert.ok(filterCards(all, { query: 'weapon' }).some(c => c.type === 'weapon'));
  assert.ok(filterCards(all, { query: 'oracle' }).every(c => c.cls === 'oracle'));
  assert.equal(filterCards(all, { query: 'zzzz-no-such-card' }).length, 0);
});

test('cost filter: exact cost or 7+', () => {
  assert.ok(filterCards(all, { cost: 2 }).every(c => c.cost === 2));
  const big = filterCards(all, { cost: '7+' });
  assert.ok(big.length > 0 && big.every(c => c.cost >= 7));
  assert.deepEqual(filterCards(all, { cls: 'shade', cost: 0 }).map(c => c.id), ['r_knife']);
});

test('sorted by class order, then cost, then name', () => {
  const sorted = sortCards(collectible);
  for (let i = 1; i < sorted.length; i++) {
    const [a, b] = [sorted[i - 1], sorted[i]];
    const ca = CLASS_ORDER.indexOf(a.cls), cb = CLASS_ORDER.indexOf(b.cls);
    assert.ok(ca < cb || (ca === cb && (a.cost < b.cost || (a.cost === b.cost && a.name.localeCompare(b.name) <= 0))), `${a.id} before ${b.id}`);
  }
  assert.equal(CLASS_ORDER.at(-1), 'neutral');
  assert.deepEqual(CLASS_ORDER.slice(0, -1), Object.keys(CLASSES));
});
