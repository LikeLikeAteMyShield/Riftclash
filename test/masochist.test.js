import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { CLASSES } from '../src/cards.js';
import * as greedy from '../src/ai.js';
import { planTurn, playTurn, chooseMulligan, legalActions, evaluate } from '../src/masochist.js';
import { MODES, availableModes } from '../src/modes.js';
import { emptyProgress } from '../src/progress.js';

const classes = Object.keys(CLASSES).filter(c => !CLASSES[c].hidden);
const FAST = { beam: 12, finalists: 6, nodes: 2000 };

function started(a, b, seed) {
  const g = new Game({ classes: [a, b], seed });
  g.mulligan(0, greedy.mulliganChoice(g, 0));
  g.mulligan(1, greedy.mulliganChoice(g, 1));
  return g;
}

test('a snapshot restores a game that plays out identically, draws and random effects included', () => {
  const g = started('pyromancer', 'shade', 42);
  const copy = Game.restore(g.snapshot());
  for (let t = 0; t < 30 && g.winner === null; t++) { greedy.playTurn(g, g.current); greedy.playTurn(copy, copy.current); }
  assert.deepEqual(copy.snapshot(), g.snapshot());
});

test('a clone is independent of the original and silent', () => {
  const g = started('warlord', 'oracle', 7);
  g.takeEvents();
  const before = JSON.stringify(g.snapshot());
  const c = g.clone();
  greedy.playTurn(c, c.current);
  greedy.playTurn(c, c.current);
  assert.equal(JSON.stringify(g.snapshot()), before, 'the original is untouched');
  assert.deepEqual(c.takeEvents(), [], 'no events from a simulation');
  assert.notEqual(JSON.stringify(c.snapshot()), before);
});

test('the Masochist only ever plans legal moves, and its mulligan comes from its hand', () => {
  const g = new Game({ classes: ['vanguard', 'stalker'], seed: 3 });
  const uids = chooseMulligan(g, 1);
  assert.ok(uids.every(u => g.players[1].hand.some(c => c.uid === u)));
  g.mulligan(0, []); g.mulligan(1, uids);
  for (let t = 0; t < 12 && g.winner === null; t++) {
    if (g.current === 1) {
      for (const action of planTurn(g, 1, FAST)) assert.ok(greedy.applyAction(g, action), `${action.type} was legal`);
      if (g.winner === null) g.endTurn();
    } else greedy.playTurn(g, 0);
  }
});

test('the Masochist takes lethal whenever it has it', () => {
  let checked = 0;
  for (let seed = 1; seed < 40 && checked < 5; seed++) {
    const g = started(classes[seed % classes.length], 'warlord', seed);
    // Play until the Masochist (player 1) starts a turn with an attacker ready, then leave its foe on 1 health.
    for (let t = 0; t < 30 && g.winner === null; t++) {
      if (g.current === 1 && [...g.players[1].board, g.players[1].hero].some(e => g.canAttack(e.uid) && g.attackTargets(e.uid).includes(g.players[0].hero))) break;
      greedy.playTurn(g, g.current);
    }
    if (g.winner !== null || g.current !== 1) continue;
    g.players[0].hero.health = 1; g.players[0].hero.armor = 0;
    for (const action of planTurn(g, 1, FAST)) greedy.applyAction(g, action);
    assert.equal(g.winner, 1, `seed ${seed}: it found the kill`);
    checked++;
  }
  assert.ok(checked >= 3, 'enough positions with lethal to check');
});

test('the Masochist crushes the regular AI', () => {
  let wins = 0;
  const N = 12;
  for (let i = 0; i < N; i++) {
    const g = new Game({ classes: [classes[i % classes.length], classes[(i * 5 + 1) % classes.length]], seed: 500 + i });
    g.mulligan(0, greedy.mulliganChoice(g, 0));
    g.mulligan(1, chooseMulligan(g, 1));
    for (let t = 0; t < 120 && g.winner === null; t++) g.current === 1 ? playTurn(g, 1, FAST) : greedy.playTurn(g, 0);
    if (g.winner === 1) wins++;
  }
  assert.ok(wins >= N - 2, `the Masochist won ${wins} of ${N}`);
});

test('the evaluation prefers winning, and legal moves cover cards, the hero power and attacks', () => {
  const g = started('pyromancer', 'warlord', 11);
  for (let t = 0; t < 8; t++) greedy.playTurn(g, g.current);
  const kinds = new Set(legalActions(g, g.current).map(a => a.type));
  assert.ok(kinds.size >= 1);
  const won = g.clone(); won.winner = g.current;
  assert.ok(evaluate(won, g.current) > evaluate(g, g.current));
});

test('Masochist mode exists only once the play-test code is entered: no locked tile, nothing', () => {
  const mode = MODES.find(m => m.id === 'masochist');
  assert.equal(mode.playtestOnly, true);
  assert.equal(mode.ai, 'masochist');
  assert.ok(!availableModes({}, emptyProgress()).some(m => m.id === 'masochist'));
  const allTrials = { ...emptyProgress(), quests: Object.fromEntries(['win5', 'win5_pyromancer', 'win5_warlord', 'win5_stalker', 'win5_oracle', 'win5_vanguard', 'win5_shade'].map(id => [id, { completedAt: 1 }])) };
  assert.ok(!availableModes({}, allTrials).some(m => m.id === 'masochist'), 'quests never unlock it');
  assert.ok(availableModes({ celestial: { how: 'playtest', at: 1 } }, emptyProgress()).some(m => m.id === 'masochist'));
});
