// The greedy AI's decisions in hand-built positions, mostly taken from play-test
// transcripts (docs/ai-learnings.md).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { playTurn, findLethal } from '../src/ai.js';
import { VANILLA } from './testcards.js';

const filler = Array(30).fill(VANILLA);

/** An empty board, empty hands, and the AI (player 1) to move with `mana`. */
function setup(classes = ['pyromancer', 'warlord'], mana = 10) {
  const g = new Game({ classes, decks: [filler, filler], seed: 1, firstPlayer: 1 });
  g.mulligan(0, []);
  g.mulligan(1, []);
  for (const p of g.players) { p.hand = []; p.maxMana = mana; p.mana = mana; }
  return g;
}

function give(g, pid, cardId) {
  const inst = { uid: g.nextUid++, cardId };
  g.players[pid].hand.push(inst);
  return inst.uid;
}

/** Put a minion straight onto `pid`'s board, ready to attack. */
function place(g, pid, cardId, changes = {}) {
  const saved = [g.current, g.players[pid].mana];
  g.current = pid;
  g.players[pid].mana = 10;
  assert.ok(g.playCard(give(g, pid, cardId), { target: null }), g.lastError);
  [g.current, g.players[pid].mana] = saved;
  const m = g.players[pid].board.at(-1);
  m.sleeping = false;
  return Object.assign(m, changes);
}

const setHealth = (g, pid, health) => { g.players[pid].hero.health = health; g.players[pid].hero.armor = 0; };

test('lethal: burn from a battlecry goes face instead of at a minion (g1 t21)', () => {
  const g = setup();
  setHealth(g, 0, 8);
  place(g, 0, 'n_mossling');                      // a killable minion, which the old targeting preferred
  place(g, 1, 'n_courier');                       // 2 attack
  place(g, 1, 'n_lurker');                        // 3 attack
  give(g, 1, 'n_sorcerer');                       // Battlecry: 3 damage
  assert.ok(findLethal(g, 1), 'it sees 3 + 2 + 3');
  playTurn(g, 1);
  assert.equal(g.winner, 1);
});

test('lethal: an AoE that hits the hero, then exactly enough to clear a taunt (g10 t27)', () => {
  const g = setup(['oracle', 'vanguard']);
  setHealth(g, 0, 6);
  place(g, 0, 'n_treant');                        // 6/8 taunt
  place(g, 1, VANILLA);                           // 4/5
  place(g, 1, VANILLA);                           // 4/5
  place(g, 1, 'n_mossling');                      // 2/1
  give(g, 1, 'v_hallowed');                       // 2 to all enemies: hero to 4, Treant to 6
  playTurn(g, 1);
  assert.equal(g.winner, 1, 'Hallowed Ground, two 4s into the Treant, Mossling and ... face');
});

test('lethal: the search ignores cards with random outcomes', () => {
  const g = setup();
  setHealth(g, 0, 3);
  give(g, 1, 'p_sparkshower');                    // 1 damage to a random enemy, 3 times: lethal only with no minions in the way
  place(g, 0, 'n_brambebeetle');
  assert.equal(findLethal(g, 1), null);
});
