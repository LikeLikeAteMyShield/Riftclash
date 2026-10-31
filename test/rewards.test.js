import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, buildDeck } from '../src/cards.js';
import { QUESTS, CHAMPION_QUESTS, emptyProgress, sanitizeProgress } from '../src/progress.js';
import { REWARD_CARDS, lockedCards, rewardCards, rewardText, unseenRewards, markRewardsSeen } from '../src/rewards.js';
import { filterCards } from '../src/library.js';
import { addBlocker, autoFill, deckProblems, deckPool, isPlayable, newDeck } from '../src/decks.js';
import { Game } from '../src/engine.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

const BONUS = ['n_prisoner', 'n_scout', 't_footsoldier', 'n_aura', 'n_troll', 'n_death'];
const LEGENDS = ['p_pyrrha', 'w_gorrak', 's_kaelen', 'o_aurelia', 'v_aldric', 'r_nyx'];
const completed = (...ids) => ({ ...emptyProgress(), quests: Object.fromEntries(ids.map(id => [id, { completedAt: 1 }])) });
const playtest = { celestial: { how: 'playtest', at: 1 } };

test('"Win 5 games" rewards the bonus cards, and every reward card exists', () => {
  assert.deepEqual(QUESTS.find(q => q.id === 'win5').reward.cards, BONUS);
  for (const [id, quest] of Object.entries(REWARD_CARDS)) {
    assert.ok(CARDS[id], `${id} exists`);
    assert.ok(QUESTS.some(q => q.id === quest));
  }
  // A reward card's tokens are rewards too, so they can't turn up on their own.
  assert.equal(REWARD_CARDS.t_footsoldier, REWARD_CARDS.n_scout);
});

test('reward cards stay locked until their quest is complete (or the play-test code is used)', () => {
  assert.deepEqual([...lockedCards(emptyProgress(), {})].sort(), [...BONUS, ...LEGENDS].sort());
  assert.deepEqual([...lockedCards(completed('win5'), {})].sort(), [...LEGENDS].sort());
  assert.equal(lockedCards(emptyProgress(), playtest).size, 0);
  // Completion survives a save and load.
  assert.deepEqual([...lockedCards(sanitizeProgress(JSON.parse(JSON.stringify(completed('win5')))), {})].sort(), [...LEGENDS].sort());
});

test('each Champion\'s Trial unlocks its class\'s legendary, and the play-test code unlocks them all', () => {
  assert.equal(CHAMPION_QUESTS.length, LEGENDS.length);
  for (const q of CHAMPION_QUESTS) {
    assert.equal(q.reward.cards.length, 1, q.id);
    const card = CARDS[q.reward.cards[0]];
    assert.ok(card.legendary && card.cls === q.cls, `${q.id} rewards ${card.id}`);
    assert.equal(rewardText(q), 'Reward: a legendary card');
    const locked = lockedCards(completed('win5', q.id), {});
    assert.ok(!locked.has(card.id), `${card.id} unlocked by ${q.id}`);
    assert.equal(locked.size, LEGENDS.length - 1, 'the other legendaries stay locked');
  }
  assert.ok(LEGENDS.every(id => !lockedCards(emptyProgress(), playtest).has(id)));
  // Locked legendaries stay out of the AI's decks too.
  const locked = lockedCards(emptyProgress(), {});
  let x = 5;
  for (let i = 0; i < 30; i++) {
    const deck = buildDeck('vanguard', () => ((x = (x * 16807) % 2147483647) / 2147483647), locked);
    assert.ok(!deck.includes('v_aldric'));
  }
});

test('locked cards are hidden from the library and deck builder, tokens included', () => {
  const locked = lockedCards(emptyProgress(), {});
  const all = Object.values(CARDS);
  const shown = filterCards(all, { tokens: true, locked }).map(c => c.id);
  for (const id of BONUS) assert.ok(!shown.includes(id), `${id} hidden`);
  const unlocked = filterCards(all, { tokens: true }).map(c => c.id);
  for (const id of BONUS) assert.ok(unlocked.includes(id), `${id} shown once unlocked`);
});

test('decks can\'t use locked cards', () => {
  const locked = lockedCards(emptyProgress(), {});
  assert.ok(!deckPool('warlord', locked).some(c => locked.has(c.id)));
  const deck = newDeck('warlord', 'Test');
  assert.match(addBlocker(deck, 'n_troll', locked), /locked/);
  assert.equal(addBlocker(deck, 'n_troll'), null);
  const filled = autoFill(deck, Math.random, locked);
  assert.equal(filled.cards.length, 30);
  assert.ok(!filled.cards.some(id => locked.has(id)));
  // A deck built while they were unlocked (play-test) can't be played once they're locked again.
  const withTroll = { ...filled, cards: [...filled.cards.slice(0, 28), 'n_troll', 'n_troll'] };
  assert.ok(isPlayable(withTroll));
  assert.ok(!isPlayable(withTroll, locked));
  assert.ok(deckProblems(withTroll, locked).some(p => /Armored Troll is still locked/.test(p)));
});

test('built decks (the standard deck and the AI\'s) leave out locked cards', () => {
  const locked = lockedCards(emptyProgress(), {});
  for (let seed = 1; seed <= 40; seed++) {
    let x = seed;
    const deck = buildDeck('vanguard', () => ((x = (x * 16807) % 2147483647) / 2147483647), locked);
    assert.equal(deck.length, 30);
    assert.ok(!deck.some(id => locked.has(id)), `seed ${seed}`);
  }
  const g = new Game({ classes: ['shade', 'oracle'], locked, seed: 7 });
  for (const p of g.players) assert.ok(![...p.deck, ...p.hand].some(c => locked.has(c.cardId)));
});

test('rewards from completed quests are announced once', () => {
  const storage = memoryStorage();
  assert.deepEqual(unseenRewards(emptyProgress(), storage), [], 'nothing before the quest is complete');
  // A player who completed the quest before it had a reward is told on their next visit.
  const rewards = unseenRewards(completed('win5'), storage);
  assert.equal(rewards.length, 1);
  assert.equal(rewards[0].quest.id, 'win5');
  assert.deepEqual(rewards[0].cards, BONUS.filter(id => !CARDS[id].token), 'tokens come with their card');
  markRewardsSeen(rewards[0].cards, storage);
  assert.deepEqual(unseenRewards(completed('win5'), storage), []);
  // Bad stored data counts as nothing seen.
  storage.setItem('riftclash-rewards-seen', '{"oops":1}');
  assert.equal(unseenRewards(completed('win5'), storage).length, 1);
});

test('quests describe their rewards', () => {
  const win5 = QUESTS.find(q => q.id === 'win5');
  assert.deepEqual(rewardCards(win5), ['n_prisoner', 'n_scout', 'n_aura', 'n_troll', 'n_death']);
  assert.equal(rewardText(win5), 'Reward: 5 new cards');
  assert.equal(rewardText(QUESTS.find(q => !q.reward)), '');
});
