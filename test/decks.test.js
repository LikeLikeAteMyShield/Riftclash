import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, CLASSES } from '../src/cards.js';
import { Game } from '../src/engine.js';
import {
  DECK_SIZE, MAX_COPIES, deckPool, addCard, removeCard, addBlocker, autoFill, deckProblems, isPlayable, manaCurve,
  newDeck, sanitizeDecks, loadDecks, saveDecks, storeDeck, removeDeck, loadDeckChoice, saveDeckChoice, cleanName,
} from '../src/decks.js';

/** An in-memory stand-in for localStorage. */
const memoryStorage = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
};
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('a deck may hold its own class cards and neutrals, never tokens or other classes', () => {
  for (const cls of Object.keys(CLASSES)) {
    const pool = deckPool(cls);
    assert.ok(pool.every(c => !c.token && (c.cls === cls || c.cls === 'neutral')));
    assert.ok(pool.length * MAX_COPIES >= DECK_SIZE, `${cls} has enough cards to fill a deck`);
  }
  const deck = newDeck('pyromancer', 'Burn');
  const other = Object.values(CARDS).find(c => c.cls === 'oracle' && !c.token);
  const token = Object.values(CARDS).find(c => c.token);
  assert.equal(addCard(deck, other.id), deck);
  assert.equal(addCard(deck, token.id), deck);
  assert.match(addBlocker(deck, other.id), /can't go in a Pyromancer deck/);
});

test('at most two copies of a card, and at most 30 cards', () => {
  const id = deckPool('warlord')[0].id;
  let d = newDeck('warlord', 'Steel');
  d = addCard(addCard(addCard(d, id), id), id);
  assert.equal(d.cards.filter(x => x === id).length, MAX_COPIES);
  assert.match(addBlocker(d, id), /Only 2 copies/);
  d = autoFill(d, seeded(3));
  assert.equal(d.cards.length, DECK_SIZE);
  assert.match(addBlocker(d, deckPool('warlord').find(c => !d.cards.includes(c.id)).id), /full/);
  assert.equal(removeCard(d, id).cards.length, DECK_SIZE - 1);
  assert.equal(removeCard(d, 'no_such_card'), d);
});

test('auto-fill completes any partial deck legally and keeps what was there', () => {
  for (const cls of Object.keys(CLASSES)) {
    const start = addCard(addCard(newDeck(cls, 'x'), deckPool(cls).at(-1).id), deckPool(cls).at(-1).id);
    const d = autoFill(start, seeded(cls.length));
    assert.deepEqual(deckProblems(d), []);
    assert.equal(d.cards.filter(x => x === deckPool(cls).at(-1).id).length, 2);
    // Every class card goes in first.
    for (const c of deckPool(cls).filter(c => c.cls === cls)) assert.equal(d.cards.filter(x => x === c.id).length, 2);
  }
});

test('deckProblems explains what is wrong', () => {
  const d = newDeck('shade', '  ');
  assert.equal(d.name, 'Shade deck');
  assert.match(deckProblems(d).join(' '), /exactly 30 cards \(it has 0\)/);
  assert.match(deckProblems({ ...autoFill(d, seeded()), name: ' ' }).join(' '), /name/);
  assert.equal(isPlayable(autoFill(d, seeded())), true);
  const smuggled = { ...autoFill(d, seeded()), cards: [...autoFill(d, seeded()).cards.slice(1), 'p_cinderbolt'] };
  assert.match(deckProblems(smuggled).join(' '), /can't go in this deck/);
});

test('names are trimmed, collapsed and capped', () => {
  assert.equal(cleanName('  Big    Burn  '), 'Big Burn');
  assert.equal(cleanName('x'.repeat(40)).length, 24);
  assert.equal(cleanName(null), '');
});

test('mana curve groups 7+ together', () => {
  const ids = Object.values(CARDS).filter(c => !c.token).map(c => c.id);
  const curve = manaCurve(ids);
  assert.equal(curve.length, 8);
  assert.equal(curve.reduce((a, b) => a + b), ids.length);
});

test('decks round-trip through storage, and bad or outdated data is cleaned up', () => {
  const s = memoryStorage();
  assert.deepEqual(loadDecks(s), []);
  const a = autoFill(newDeck('oracle', 'Light'), seeded());
  let decks = storeDeck(a, s);
  decks = storeDeck(newDeck('stalker', 'Hunt'), s);
  assert.equal(decks.length, 2);
  assert.deepEqual(loadDecks(s).find(d => d.id === a.id).cards, a.cards);
  // Updating replaces by id.
  storeDeck({ ...a, name: 'Dawn' }, s);
  assert.equal(loadDecks(s).length, 2);
  assert.equal(loadDecks(s).find(d => d.id === a.id).name, 'Dawn');
  assert.equal(removeDeck(a.id, s).length, 1);

  s.setItem('riftclash-decks', 'not json');
  assert.deepEqual(loadDecks(s), []);
  const cleaned = sanitizeDecks([
    null, { cls: 'bard', cards: [] },
    { id: 'x', name: 'Old', cls: 'pyromancer', cards: ['p_cinderbolt', 'deleted_card', 'o_ward', 7, 'p_cinderbolt', 'p_cinderbolt'] },
    { id: 'x', name: '', cls: 'pyromancer', cards: 'nope' },
  ]);
  assert.equal(cleaned.length, 2);
  assert.notEqual(cleaned[0].id, cleaned[1].id);
  assert.equal(cleaned[1].name, 'Pyromancer deck');
  assert.deepEqual(cleaned[0].cards, ['p_cinderbolt', 'p_cinderbolt']);
  assert.ok(cleaned[0].cards.every(id => CARDS[id] && (CARDS[id].cls === 'pyromancer' || CARDS[id].cls === 'neutral')));
  assert.ok(cleaned[0].cards.filter(id => id === cleaned[0].cards[0]).length <= MAX_COPIES);
});

test('storage failures do not throw', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(loadDecks(broken), []);
  assert.equal(saveDecks([], broken), false);
  assert.deepEqual(loadDeckChoice(broken), {});
  saveDeckChoice('shade', 'd1', broken);
  assert.deepEqual(loadDecks(null), []);
});

test('the deck choice is remembered per class', () => {
  const s = memoryStorage();
  saveDeckChoice('shade', 'd1', s);
  saveDeckChoice('oracle', 'standard', s);
  assert.deepEqual(loadDeckChoice(s), { shade: 'd1', oracle: 'standard' });
});

test('a custom deck is what the player draws from', () => {
  const deck = autoFill(newDeck('vanguard', 'Wall'), seeded(9));
  const game = new Game({ classes: ['vanguard', 'shade'], decks: [deck.cards], seed: 4 });
  const p = game.players[0];
  const drawn = [...p.deck, ...p.hand].map(i => i.cardId).sort();
  assert.deepEqual(drawn, [...deck.cards].sort());
});
