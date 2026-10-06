import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENE_H, CYCLE, FIG, GROUND, sceneWidth, layoutHeroes, SCHEDULE, eventsBetween, poseAt,
} from '../src/menuplan.js';
import { CLASSES } from '../src/cards.js';
import { getSprite } from '../src/pixelart.js';
import '../src/sprites/index.js';

const WIDTHS = [90, 100, 130, 159, 160, 200, 249, 250, 288, 320, 400];
const beats = (step = 0.05) => Array.from({ length: Math.round(CYCLE / step) }, (_, i) => i * step);

test('the scene is as wide as the viewport needs, within limits', () => {
  assert.equal(sceneWidth(1440, 900), 288);
  assert.equal(sceneWidth(1920, 1080), 320);
  assert.equal(sceneWidth(390, 844), 90);       // phones: clamped narrow
  assert.equal(sceneWidth(5000, 900), 400);     // ultrawide: clamped wide
  assert.equal(sceneWidth(800, 0), 400);
});

test('every hero stands fully on screen, facing the other army, at every width', () => {
  for (const W of WIDTHS) {
    const heroes = layoutHeroes(W);
    const n = heroes.length / 2;
    assert.ok([1, 2, 3].includes(n), `W=${W}`);
    for (const h of heroes) {
      assert.ok(h.x >= 0 && h.x + FIG <= W, `W=${W}: ${h.cls} at x=${h.x} is off screen`);
      assert.ok(h.y >= 0 && h.y + FIG <= SCENE_H, `W=${W}: ${h.cls} at y=${h.y}`);
      assert.equal(h.facing, h.side === 'L' ? 1 : -1);
      assert.ok(CLASSES[h.cls], h.cls);
    }
    for (const side of ['L', 'R']) {
      const mine = heroes.filter(h => h.side === side).sort((a, b) => a.rank - b.rank);
      // Front ranks are nearest the middle; ranks don't overlap much.
      for (let i = 1; i < mine.length; i++) {
        assert.ok(Math.abs(mine[i].x - mine[i - 1].x) >= 20, `W=${W}: ${side} ranks ${i - 1} and ${i} overlap`);
        assert.ok(Math.abs(mine[i].x + 16 - W / 2) > Math.abs(mine[i - 1].x + 16 - W / 2));
      }
    }
    // The armies mirror each other across the middle.
    for (const l of heroes.filter(h => h.side === 'L')) {
      const r = heroes.find(h => h.side === 'R' && h.rank === l.rank);
      assert.equal(r.x, W - l.x - FIG);
    }
    assert.equal(new Set(heroes.map(h => h.cls)).size, heroes.length, 'no hero appears twice');
  }
});

test('wide screens show all six heroes', () => {
  assert.deepEqual(layoutHeroes(320).map(h => h.cls).sort(), Object.keys(CLASSES).sort());
});

test('every pose has a sprite, and every hero has art for every pose it can strike', () => {
  for (const cls of Object.keys(CLASSES)) {
    const frames = new Set(beats().map(b => poseAt(cls, b).frame));
    for (const f of frames) {
      const s = getSprite(`champ_${cls}_${f}`);
      assert.ok(s, `missing sprite champ_${cls}_${f}`);
      assert.deepEqual([s.width, s.height], [FIG, FIG]);
    }
    assert.ok(frames.size >= 2, `${cls} should move between at least two poses`);
  }
});

test('poses repeat every round and the Warlord leaps out and back', () => {
  for (const cls of Object.keys(CLASSES)) {
    for (const b of beats(0.25)) assert.deepEqual(poseAt(cls, b), poseAt(cls, b + CYCLE * 3), `${cls} at ${b}`);
  }
  const leaps = beats().map(b => poseAt('warlord', b).leap);
  assert.ok(leaps.every(l => l >= 0 && l <= 1));
  assert.equal(Math.max(...leaps), 1);
  assert.equal(poseAt('warlord', 0).leap, 0);
  assert.equal(poseAt('warlord', 6.5).leap, 1, 'landed when the slam fires');
  // The Shade is only hidden while dashing through the middle.
  const hidden = beats().filter(b => poseAt('shade', b).hidden);
  assert.ok(hidden.length && hidden.every(b => b >= 9 && b < 11));
});

test('each scheduled event fires exactly once per round', () => {
  const round = eventsBetween(0, CYCLE);
  assert.equal(round.length, SCHEDULE.length);
  // Split into small frames, the same events fire, in order, once each.
  const framed = [];
  for (let t = 0; t < CYCLE; t += 0.07) framed.push(...eventsBetween(t, Math.min(CYCLE, t + 0.07)));
  assert.deepEqual(framed.map(e => e.at), round.map(e => e.at));
  assert.ok(round.every((e, i) => i === 0 || e.at >= round[i - 1].at));
  assert.equal(eventsBetween(5, 5).length, 0);
  assert.equal(eventsBetween(6, 5).length, 0);
  assert.equal(eventsBetween(CYCLE * 10, CYCLE * 13).length, SCHEDULE.length * 3);
});

test('scheduled events name real heroes and line up with their poses', () => {
  for (const e of SCHEDULE) {
    assert.ok(e.who === null || CLASSES[e.who], e.who);
    assert.ok(e.beat >= 0 && e.beat < CYCLE);
  }
  // The Pyromancer throws on the beat her throwing pose starts; the Stalker looses as his string snaps forward.
  for (const e of SCHEDULE.filter(e => e.type === 'fireball')) assert.equal(poseAt('pyromancer', e.beat + 0.01).frame, 'throw');
  for (const e of SCHEDULE.filter(e => e.type === 'arrow')) assert.equal(poseAt('stalker', e.beat + 0.01).frame, 'loose');
  assert.ok(GROUND < SCENE_H);
});
