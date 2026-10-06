import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTS, emptyProgress, emptyStats, recordResult, questStatus, updateQuests, applyGame, winRate,
  sanitizeProgress, loadProgress, saveProgress, recordGame,
} from '../src/progress.js';
import { Game } from '../src/engine.js';
import { playTurn, mulliganChoice } from '../src/ai.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('results are tallied overall and per class, with win streaks', () => {
  let s = emptyStats();
  for (const [cls, result] of [['shade', 'win'], ['shade', 'win'], ['oracle', 'loss'], ['shade', 'win'], ['oracle', 'draw'], ['warlord', 'win']]) {
    s = recordResult(s, { cls, result });
  }
  assert.deepEqual([s.played, s.wins, s.losses, s.draws], [6, 4, 1, 1]);
  assert.deepEqual(s.byClass.shade, { played: 3, wins: 3, losses: 0, draws: 0 });
  assert.deepEqual(s.byClass.oracle, { played: 2, wins: 0, losses: 1, draws: 1 });
  assert.equal(s.streak, 1, 'the draw broke the streak');
  assert.equal(s.bestStreak, 2);
  assert.equal(winRate(s), 67);
  assert.equal(winRate(emptyStats()), null);
  assert.throws(() => recordResult(s, { cls: 'shade', result: 'forfeit' }), /Unknown result/);
});

test('"Win 5 games" completes on the fifth win, once, and stays complete', () => {
  assert.ok(QUESTS.find(q => q.id === 'win5'));
  let p = emptyProgress();
  const done = [];
  const games = ['win', 'loss', 'win', 'win', 'draw', 'win', 'loss', 'win', 'win'];
  games.forEach((result, i) => {
    const out = applyGame(p, { cls: 'pyromancer', result }, 1000 + i);
    p = out.progress;
    done.push(out.completed.map(q => q.id));
  });
  const fifthWin = 7;    // index of the fifth 'win'
  done.forEach((ids, i) => assert.deepEqual(ids, i === fifthWin ? ['win5'] : [], `game ${i}`));
  const [q] = questStatus(p).filter(q => q.id === 'win5');
  assert.equal(q.done, true);
  assert.equal(q.completedAt, 1000 + fifthWin);
  assert.equal(q.value, 5, 'progress is capped at the goal');
});

test('quest progress before completion', () => {
  let p = emptyProgress();
  for (let i = 0; i < 3; i++) p = applyGame(p, { cls: 'stalker', result: 'win' }).progress;
  const q = questStatus(p).find(q => q.id === 'win5');
  assert.deepEqual([q.value, q.goal, q.done, q.completedAt], [3, 5, false, null]);
  // Quests already complete are not completed again.
  const again = updateQuests({ ...p, quests: { win5: { completedAt: 1 } } });
  assert.deepEqual(again.completed, []);
});

test('every quest is well formed', () => {
  const ids = new Set();
  for (const q of QUESTS) {
    assert.ok(q.id && !ids.has(q.id), q.id); ids.add(q.id);
    assert.ok(q.title && q.text && Number.isInteger(q.goal) && q.goal > 0, q.id);
    assert.equal(q.progress(emptyStats()), 0, `${q.id} starts at zero`);
  }
});

test('progress round-trips through storage, and bad data is cleaned up', () => {
  const s = memoryStorage();
  assert.deepEqual(loadProgress(s), emptyProgress());
  for (let i = 0; i < 5; i++) recordGame({ cls: 'vanguard', result: 'win' }, s, 50 + i);
  const back = loadProgress(s);
  assert.equal(back.stats.wins, 5);
  assert.deepEqual(back.quests, { win5: { completedAt: 54 } });

  s.setItem('riftclash-progress', '{not json');
  assert.deepEqual(loadProgress(s), emptyProgress());
  const cleaned = sanitizeProgress({
    stats: { played: 3, wins: -2, losses: 'x', draws: 1.5, streak: 2, byClass: { shade: { played: 2, wins: 2 }, bard: { played: 9 } } },
    quests: { win5: { completedAt: 'soon' }, made_up: { completedAt: 5 } },
  });
  assert.deepEqual([cleaned.stats.played, cleaned.stats.wins, cleaned.stats.losses, cleaned.stats.draws], [3, 0, 0, 0]);
  assert.deepEqual(Object.keys(cleaned.stats.byClass), ['shade']);
  assert.deepEqual(cleaned.quests, {});
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(loadProgress(broken), emptyProgress());
  assert.equal(saveProgress(emptyProgress(), broken), false);
});

test('a real game produces a result the stats accept', () => {
  const g = new Game({ classes: ['warlord', 'shade'], seed: 99 });
  g.mulligan(0, mulliganChoice(g, 0));
  g.mulligan(1, mulliganChoice(g, 1));
  for (let i = 0; i < 200 && g.winner === null; i++) playTurn(g, g.current);
  const result = g.winner === 'draw' ? 'draw' : g.winner === 0 ? 'win' : 'loss';
  const p = applyGame(emptyProgress(), { cls: 'warlord', result }).progress;
  assert.equal(p.stats.played, 1);
  assert.equal(p.stats.byClass.warlord.played, 1);
});
