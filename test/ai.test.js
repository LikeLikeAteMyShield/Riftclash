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

test('attacks first when its minion would die to its own AoE anyway (g8 t12)', () => {
  const g = setup(['pyromancer', 'warlord'], 5);
  place(g, 0, 'w_bastion');                       // 3/5 taunt
  for (let i = 0; i < 3; i++) place(g, 0, 'n_mossling');
  place(g, 1, 'n_scrapper');                      // 3/2: Earthshatter kills it whatever happens
  give(g, 1, 'w_earthshatter');                   // 3 damage to all minions
  playTurn(g, 1);
  assert.deepEqual(g.players[0].board, [], 'Scrapper softens the Warden, then Earthshatter clears the lot');
});

test('a taunt is cleared by the cheapest minion that kills it, and the big one goes face (g0 t17)', () => {
  const g = setup(['pyromancer', 'warlord'], 0);
  place(g, 0, 'w_bastion', { health: 1 });        // a wounded 3/1 taunt
  const big = place(g, 1, VANILLA, { health: 1 });
  const small = place(g, 1, 't_recruit');
  playTurn(g, 1);
  assert.deepEqual(g.players[0].board, []);
  assert.ok(g.players[1].board.includes(big) && !g.players[1].board.includes(small));
  assert.equal(g.players[0].hero.health + g.players[0].hero.armor, 29, "the 4/1 hit face (through the Warden's 3 Armor)");
});

test("sets up Headsman's Verdict with Shockwave Stomp to kill a big minion (g6 t12)", () => {
  const g = setup(['pyromancer', 'warlord'], 3);
  const treant = place(g, 0, 'n_treant');         // 6/8, undamaged: no target for Verdict yet
  give(g, 1, 'w_stomp');
  give(g, 1, 'w_verdict');
  give(g, 1, 'n_boar');                           // a 3-drop the old AI would rather play
  playTurn(g, 1);
  assert.ok(!g.players[0].board.includes(treant));
});

test('in danger of dying, it kills the biggest attacker instead of going face', () => {
  const g = setup(['pyromancer', 'warlord'], 0);
  setHealth(g, 1, 6);
  const rider = place(g, 0, 'c_comet', { health: 1 });   // 5/1
  place(g, 1, VANILLA);                           // 4/5: trading costs it the whole minion, which the old AI never did
  playTurn(g, 1);
  assert.ok(!g.players[0].board.includes(rider));
  assert.equal(g.players[0].hero.health, 30);
});

test('in danger of dying, it plays a taunt with armour over a bigger threat of its own (g7 t12)', () => {
  const g = setup(['pyromancer', 'warlord'], 4);
  setHealth(g, 1, 9);
  for (let i = 0; i < 2; i++) place(g, 0, VANILLA);    // 8 damage next turn
  give(g, 1, 'n_stormcaller');
  const warden = give(g, 1, 'w_bastion');
  playTurn(g, 1);
  assert.ok(!g.players[1].hand.some(c => c.uid === warden));
  assert.equal(g.players[1].hero.armor, 3);
});

test('ahead on the race, a big minion goes face instead of trading with a small one (g6 t24)', () => {
  const g = setup(['pyromancer', 'warlord'], 0);
  setHealth(g, 0, 12);
  place(g, 0, 't_shardling');                     // 2/2: a free trade the old AI always took
  place(g, 1, VANILLA, { attack: 9, health: 6 });
  playTurn(g, 1);
  assert.equal(g.players[0].hero.health, 3);
});

test('behind on the race, it takes a free trade even into a 1-attack minion', () => {
  const g = setup(['pyromancer', 'warlord'], 0);
  setHealth(g, 1, 20);
  for (let i = 0; i < 3; i++) place(g, 0, VANILLA);    // 12 a turn at us
  const beetle = place(g, 0, 'n_adder', { keywords: {} }); // a 1/2 with nothing special
  place(g, 1, 'n_courier');
  playTurn(g, 1);
  assert.ok(!g.players[0].board.includes(beetle));
});

test('the cheapest answer: Spark kills a 5/1 and Starfall Meteor stays in hand (g5 t14)', () => {
  const g = setup(['warlord', 'pyromancer'], 7);
  const rider = place(g, 0, 'c_comet', { health: 1 });
  place(g, 0, 'n_brambebeetle');
  const starfall = give(g, 1, 'p_starfall');
  give(g, 1, 'n_ram');
  playTurn(g, 1);
  assert.ok(!g.players[0].board.includes(rider));
  assert.ok(g.players[1].hand.some(c => c.uid === starfall));
});

test('spends the mana: a 3-drop and a 2-drop beat a lone 4-drop with 5 mana', () => {
  const g = setup(['pyromancer', 'warlord'], 5);
  give(g, 1, VANILLA);
  give(g, 1, 'n_boar');
  give(g, 1, 'n_scrapper');
  playTurn(g, 1);
  assert.deepEqual(g.players[1].board.map(m => m.cardId).sort(), ['n_boar', 'n_scrapper']);
});

test('the Coin unlocks the hero power as well as cards (g5 t8)', () => {
  const g = setup(['warlord', 'pyromancer'], 1);
  const herald = place(g, 0, 'n_herald', { health: 1 });   // 3/1
  give(g, 1, 't_coin');
  playTurn(g, 1);
  assert.ok(!g.players[0].board.includes(herald), 'Coin, then Spark');
});

test('the Coin still plays out a 2-drop on turn one', () => {
  const g = setup(['pyromancer', 'warlord'], 1);
  give(g, 1, 't_coin');
  give(g, 1, 'n_scrapper');
  playTurn(g, 1);
  assert.deepEqual(g.players[1].board.map(m => m.cardId), ['n_scrapper']);
});

test("Colossus of the Rift's battlecry counts the friendly minions it would kill (g2 t18)", () => {
  const g = setup(['pyromancer', 'warlord'], 9);
  for (let i = 0; i < 3; i++) place(g, 1, 'n_boar', { keywords: {} });   // three 2/4s... that a 3-damage battlecry
  for (const m of g.players[1].board) m.health = 3;                       // ...would now kill
  place(g, 0, 'n_mossling');
  give(g, 1, 'n_colossus');
  give(g, 1, 'n_sentinel');
  playTurn(g, 1);
  assert.equal(g.players[1].board.filter(m => m.cardId === 'n_boar').length, 3);
  assert.ok(g.players[1].board.some(m => m.cardId === 'n_sentinel'));
});

test('Healing Aura is not wasted on a healthy hero (g1 t19)', () => {
  const g = setup(['pyromancer', 'warlord'], 10);
  setHealth(g, 1, 25);
  const aura = give(g, 1, 'n_aura');
  playTurn(g, 1);
  assert.ok(g.players[1].hand.some(c => c.uid === aura));
  setHealth(g, 1, 15);
  g.endTurn();                                    // the opponent's turn passes
  g.players[1].hand = g.players[1].hand.filter(c => c.uid === aura);
  playTurn(g, 1);
  assert.equal(g.players[1].hero.health, 17);
});

test('Oblivion is held while winning the race (g5 t15)', () => {
  const g = setup(['pyromancer', 'celestial'], 8);
  setHealth(g, 0, 7);
  for (let i = 0; i < 3; i++) place(g, 0, VANILLA);
  place(g, 1, VANILLA, { attack: 7 });            // kills them next turn; theirs need 3 turns
  const oblivion = give(g, 1, 'c_oblivion');
  playTurn(g, 1);
  assert.ok(g.players[1].hand.some(c => c.uid === oblivion));
});
