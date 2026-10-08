import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, availableModes, bossChoices, unlockProgress, isModeUnlocked } from '../src/modes.js';
import { CHAMPION_QUESTS, emptyProgress } from '../src/progress.js';
import { isVisible } from '../src/unlocks.js';
import { CLASSES, HEROES, RIFTKIN } from '../src/cards.js';
import { Game } from '../src/engine.js';
import { playTurn, mulliganChoice } from '../src/ai.js';
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

test('Challenge the Riftkin unlocks by completing every Champion\'s Trial, or with the play-test code', () => {
  const riftkin = MODES.find(m => m.id === 'riftkin');
  assert.equal(riftkin.name, 'Challenge the Riftkin');
  assert.equal(riftkin.screen, 'bosses');
  assert.deepEqual(riftkin.unlock.quests, CHAMPION_QUESTS.map(q => q.id));
  const withTrials = ids => ({ ...emptyProgress(), quests: Object.fromEntries(ids.map(id => [id, { completedAt: 1 }])) });
  const ids = CHAMPION_QUESTS.map(q => q.id);
  // Locked at first, and still locked with one trial (or only the general quest) left.
  assert.deepEqual(availableModes({}, emptyProgress()).map(m => m.id), ['standard']);
  assert.deepEqual(availableModes({}, withTrials(['win5', ...ids.slice(1)])).map(m => m.id), ['standard']);
  assert.deepEqual(unlockProgress(riftkin, withTrials(ids.slice(1))), { done: ids.length - 1, total: ids.length });
  // Every trial complete: open.
  assert.deepEqual(availableModes({}, withTrials(ids)).map(m => m.id), ['standard', 'riftkin']);
  // The play-test code opens it with no trials done.
  assert.deepEqual(availableModes({ celestial: { how: 'playtest', at: 1 } }, emptyProgress()).map(m => m.id), ['standard', 'riftkin']);
  // Opening the mode through the trials doesn't reveal the Celestial class: beating the Riftkin will.
  assert.equal(isVisible('celestial', {}), false);
  assert.equal(isModeUnlocked(MODES.find(m => m.id === 'standard'), {}, emptyProgress()), true, 'the standard mode is always open');
});

test('the boss screen offers the five Riftkin, in order, each with a portrait and hero power', () => {
  const bosses = bossChoices();
  assert.deepEqual(bosses.map(b => b.id), RIFTKIN);
  for (const b of bosses) {
    assert.equal(b.boss, true, b.id);
    assert.ok(hasSprite(b.portrait) && b.heroPower?.name && b.title && b.lore, b.id);
  }
});

test('a boss battle runs: the player\'s class against the chosen Riftkin and its Celestial deck', () => {
  for (const boss of RIFTKIN) {
    const g = new Game({ heroes: [CLASSES.vanguard.defaultHero, boss], seed: 7 });
    assert.equal(g.players[1].heroId, boss);
    assert.equal(g.players[1].heroClass, 'celestial');
    assert.equal(g.heroPower(1).name, HEROES[boss].heroPower.name);
    g.mulligan(0, mulliganChoice(g, 0));
    g.mulligan(1, mulliganChoice(g, 1));
    for (let i = 0; i < 200 && g.winner === null; i++) playTurn(g, g.current);
    assert.notEqual(g.winner, null, `${boss}: the game finished`);
  }
});
