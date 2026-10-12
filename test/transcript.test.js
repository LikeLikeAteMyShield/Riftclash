import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import * as greedy from '../src/ai.js';
import { playTurn as masochistTurn, chooseMulligan } from '../src/masochist.js';
import { startTranscript, finishTranscript, replay, saveTranscript, loadTranscripts, clearTranscripts, sanitizeTranscripts, exportBundle, MAX_SAVED, FORMAT } from '../src/transcript.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
};

function recordedGame(seed, { masochist = false } = {}) {
  const g = new Game({ classes: ['pyromancer', 'shade'], seed });
  const t = startTranscript(g, { mode: masochist ? 'masochist' : 'standard', ai: masochist ? 'masochist' : 'greedy', board: 'moonwood' });
  g.mulligan(1, masochist ? chooseMulligan(g, 1) : greedy.mulliganChoice(g, 1));
  g.mulligan(0, greedy.mulliganChoice(g, 0));
  for (let i = 0; i < 120 && g.winner === null; i++) {
    if (g.current === 1 && masochist) masochistTurn(g, 1, { beam: 8, finalists: 4, nodes: 500 });
    else greedy.playTurn(g, g.current);
  }
  finishTranscript(t, g);
  return { g, t };
}

test('a transcript replays the match exactly, move for move', () => {
  for (const masochist of [false, true]) {
    const { g, t } = recordedGame(77, { masochist });
    assert.equal(t.format, FORMAT);
    assert.ok(t.actions.length > 20);
    assert.ok(t.result.winner !== null);
    const again = replay(t);
    assert.deepEqual(again.snapshot(), g.snapshot(), 'the replay ends in exactly the same position');
    assert.equal(again.winner, t.result.winner);
    // And it survives a round trip through JSON (as a downloaded file would).
    assert.deepEqual(replay(JSON.parse(JSON.stringify(t))).snapshot(), g.snapshot());
  }
});

test('a transcript reads well: named actions, a summary per turn, the battle log', () => {
  const { t } = recordedGame(5);
  assert.deepEqual(t.meta.classes, ['pyromancer', 'shade']);
  assert.deepEqual(t.meta.players, ['human', 'greedy']);
  assert.deepEqual(t.actions.slice(0, 2).map(a => [a.type, a.player]), [['mulligan', 1], ['mulligan', 0]]);
  const play = t.actions.find(a => a.type === 'playCard');
  assert.ok(play.card && play.cardId && Number.isInteger(play.turn));
  const attack = t.actions.find(a => a.type === 'attack');
  assert.ok(attack.attacker && attack.targetName);
  const ends = t.actions.filter(a => a.type === 'endTurn').length;
  assert.ok(t.turns.length >= ends && t.turns.length <= ends + 1, 'a summary after every turn, plus one if the game ended mid-turn');
  const s = t.turns[0];
  assert.ok(Array.isArray(s.players[0].board) && Array.isArray(s.players[1].hand) && Number.isInteger(s.players[0].hero.health));
  assert.ok(t.log.length > 0);
  // Mid-game positions can be rebuilt for study.
  const mid = replay(t, { upTo: Math.floor(t.actions.length / 2) });
  assert.equal(mid.winner, null);
});

test('a transcript whose actions no longer apply fails loudly', () => {
  const { t } = recordedGame(9);
  const broken = JSON.parse(JSON.stringify(t));
  const i = broken.actions.findIndex(a => a.type === 'attack');
  broken.actions[i].target = 999999;
  assert.throws(() => replay(broken), /no longer applies/);
  assert.throws(() => replay({ format: 'nope' }), /Not a Riftclash transcript/);
});

test('finished matches are saved locally, the latest few dozen, and export as one file', () => {
  const s = memoryStorage();
  const { t } = recordedGame(11);
  const size = JSON.stringify(t).length;
  assert.ok(size < 120000, `a transcript is small enough to keep dozens (${size} bytes)`);
  for (let i = 0; i < MAX_SAVED + 3; i++) assert.ok(saveTranscript({ ...t, startedAt: `game ${i}` }, s));
  const saved = loadTranscripts(s);
  assert.equal(saved.length, MAX_SAVED);
  assert.equal(saved.at(-1).startedAt, `game ${MAX_SAVED + 2}`, 'the oldest drop off');
  const bundle = exportBundle(saved);
  assert.equal(bundle.count, MAX_SAVED);
  assert.deepEqual(sanitizeTranscripts([null, 5, { format: 'x' }, t]), [t]);
  s.setItem('riftclash-transcripts', '{broken');
  assert.deepEqual(loadTranscripts(s), []);
  clearTranscripts(s);
  assert.deepEqual(loadTranscripts(s), []);
});
