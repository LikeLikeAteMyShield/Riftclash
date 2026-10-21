import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tutorial, STEPS, TUTORIAL_SETUP, createTutorialGame, playThrough, findRef, HUMAN, AI } from '../src/tutorial.js';
import { CARDS, CLASSES, HEROES } from '../src/cards.js';
import { QUESTS, emptyProgress, emptyStats, recordResult, recordTutorial, loadProgress, sanitizeProgress, questStatus } from '../src/progress.js';
import { MODES } from '../src/modes.js';
import { BACKGROUNDS } from '../src/backgrounds.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('the tutorial match is fixed: known heroes, stacked 30-card decks, a board, and no hidden or reward cards', () => {
  const rewards = new Set(QUESTS.flatMap(q => q.reward?.cards ?? []));
  for (const id of TUTORIAL_SETUP.heroes) assert.ok(HEROES[id] && !HEROES[id].boss && !CLASSES[HEROES[id].cls].hidden, id);
  for (const deck of TUTORIAL_SETUP.decks) {
    assert.equal(deck.length, 30);
    for (const id of deck) assert.ok(CARDS[id] && !CARDS[id].token && !rewards.has(id) && !CLASSES[CARDS[id].cls]?.hidden, id);
  }
  assert.ok(BACKGROUNDS[TUTORIAL_SETUP.board] && !BACKGROUNDS[TUTORIAL_SETUP.board].boss);
  // Stacked decks: the opening hands are the top of each deck, in order.
  const g = createTutorialGame();
  assert.deepEqual(g.players[HUMAN].hand.map(c => c.cardId), TUTORIAL_SETUP.decks[0].slice(0, 3));
  assert.deepEqual(g.players[AI].hand.map(c => c.cardId), TUTORIAL_SETUP.decks[1].slice(0, 4));
  assert.equal(g.current, HUMAN);
  assert.deepEqual(g.players.map(p => p.hero.health), TUTORIAL_SETUP.health);
});

test('the script plays through to a win for the player', () => {
  const t = playThrough();
  assert.equal(t.game.winner, HUMAN);
  assert.ok(t.complete);
  assert.equal(t.index, STEPS.length);
  assert.ok(t.game.players[HUMAN].hero.health > 15, 'the player wins comfortably');
});

test('it plays out exactly the same way every time', () => {
  const runs = [0, 1].map(() => {
    const seen = [];
    const t = playThrough(undefined, { onTip: (s, tut) => seen.push(JSON.stringify(tut.game.snapshot())) });
    return [...seen, JSON.stringify(t.game.snapshot())];
  });
  assert.deepEqual(runs[0], runs[1]);
  // And the real (not silent) game the UI plays matches the silent one.
  const loud = playThrough(new Tutorial());
  assert.equal(JSON.stringify(loud.game.snapshot()), runs[0].at(-1));
});

test('every tip points at something that is there when it is shown', () => {
  playThrough(undefined, {
    onTip: (step, t) => {
      assert.ok(step.text, `step ${t.index} has text`);
      if (String(step.point).includes(':')) assert.ok(findRef(t.game, HUMAN, step.point), `step ${t.index}: ${step.point} is on the board`);
    },
  });
  for (const s of STEPS) assert.ok(s.text || s.ai, 'each player step has a tip');
});

test('moves off the script are refused, with a reason', () => {
  const t = new Tutorial();
  const g = t.game;
  assert.equal(g.mulliganDone[AI], true, 'the opponent has already kept its hand');
  // A tip is showing: nothing happens until Next.
  assert.equal(g.mulligan(HUMAN, []), false);
  assert.match(g.lastError, /Next/);
  t.next();
  // The hand must be kept.
  assert.equal(g.mulligan(HUMAN, [g.players[HUMAN].hand[0].uid]), false);
  assert.match(g.lastError, /Confirm/);
  assert.equal(g.mulligan(HUMAN, []), true);
  while (t.waiting) t.next();
  // Turn 1 wants the Mossling played: not the Coin-less end of turn, not another card.
  assert.equal(g.endTurn(), false);
  const captain = g.players[HUMAN].hand.find(c => c.cardId === 'v_captain');
  assert.equal(g.playCard(captain.uid), false);
  assert.match(g.lastError, /tip/);
  const moss = g.players[HUMAN].hand.find(c => c.cardId === 'n_mossling');
  // A minion goes in its scripted slot wherever it's dropped.
  assert.equal(g.playCard(moss.uid, { position: 5 }), true);
  assert.deepEqual(g.players[HUMAN].board.map(m => m.cardId), ['n_mossling']);
});

test('steps with several moves take them in any order', () => {
  const t = new Tutorial({ game: createTutorialGame({ silent: true }) });
  const g = t.game;
  // Play up to the final step (lethal: four attacks), then make its moves last first.
  const last = STEPS.length - 1;
  t.steps = STEPS.slice(0, last);
  playThrough(t);
  t.steps = STEPS;
  assert.equal(t.index, last);
  assert.equal(t.pending().length, 4);
  while (g.winner === null) {
    const { action: a } = t.pending().at(-1);
    assert.equal(g.attack(a.uid, a.target), true);
  }
  assert.equal(g.winner, HUMAN);
  assert.ok(t.complete);
});

test('the tutorial mode starts it, and its quest is the only thing finishing it counts for', () => {
  const mode = MODES.find(m => m.tutorial);
  assert.equal(mode.id, 'tutorial');
  assert.equal(MODES[0], mode, 'it comes first on the title screen');
  const quest = QUESTS.find(q => q.id === 'tutorial');
  assert.ok(quest && quest.goal === 1 && !quest.reward);

  const storage = memory();
  const { progress, completed } = recordTutorial(storage, 5);
  assert.deepEqual(completed.map(q => q.id), ['tutorial']);
  const s = progress.stats;
  assert.equal(s.tutorials, 1);
  // Not a game: no win, no streak, no class record, so no other quest moves.
  assert.deepEqual({ ...s, tutorials: 0 }, emptyStats());
  for (const q of questStatus(progress)) if (q.id !== 'tutorial') assert.equal(q.value, 0, q.id);
  assert.deepEqual(loadProgress(storage).quests.tutorial, { completedAt: 5 });
  // Doing it again doesn't complete anything new.
  assert.deepEqual(recordTutorial(storage).completed, []);
  // Real games keep the count, and saved progress keeps it too.
  assert.equal(recordResult({ ...emptyStats(), tutorials: 2 }, { cls: 'vanguard', result: 'win' }).tutorials, 2);
  assert.equal(sanitizeProgress({ stats: { tutorials: 3 } }).stats.tutorials, 3);
  assert.equal(sanitizeProgress({ stats: { tutorials: -1 } }).stats.tutorials, 0);
  assert.equal(emptyProgress().stats.tutorials, 0);
});

test('any ready copy of a minion can make its scripted attack', () => {
  const t = new Tutorial({ game: createTutorialGame({ silent: true }) });
  const g = t.game;
  // Turn 4: the Boar is down to 1 Health and either Recruit may finish it.
  const step = STEPS.findIndex(s => s.do?.[0]?.from === 'mine:t_recruit' && s.do[0].to === 'theirs:n_boar');
  t.steps = STEPS.slice(0, step);
  playThrough(t);
  t.steps = STEPS;
  const [p] = t.pending();
  assert.equal(p.sources.length, 2, 'both Recruits are ready');
  const other = p.sources.find(uid => uid !== p.action.uid);
  assert.equal(g.attack(other, p.action.target), true);
  assert.equal(t.index, step + 1);
  // And the rest of the script still plays out to the win.
  playThrough(t);
  assert.equal(g.winner, HUMAN);
});
