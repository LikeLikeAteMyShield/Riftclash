import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, compileSong, chord, arp, bass, noteToMidi } from '../src/songs.js';

test('every song compiles, with all channels the same length', () => {
  for (const id of Object.keys(SONGS)) {
    const s = compileSong(id);
    assert.ok(s.length > 0 && s.length % 16 === 0, id);
    assert.ok(s.events.length > 0, id);
    for (const ev of s.events) {
      if (ev.midi !== undefined) assert.ok(ev.midi >= 33 && ev.midi <= 96, `${id} note ${ev.midi} out of range`);
    }
  }
});

test('the three screens each have a track', () => {
  assert.deepEqual(Object.keys(SONGS).sort(), ['battle', 'library', 'menu']);
});

test('battle and library are calmer than the menu theme', () => {
  const density = id => { const s = compileSong(id); return s.events.length / (s.length * s.stepDur); };
  for (const calm of ['battle', 'library']) {
    assert.ok(SONGS[calm].bpm < SONGS.menu.bpm, `${calm} slower`);
    assert.ok(SONGS[calm].volume < SONGS.menu.volume, `${calm} quieter`);
    assert.ok(density(calm) < density('menu') / 2, `${calm} sparser: ${density(calm).toFixed(1)} vs ${density('menu').toFixed(1)} notes/s`);
  }
  assert.ok(!SONGS.library.channels.drums, 'no drums while browsing');
});

test('malformed songs fail with a clear message', () => {
  const song = bars => ({ bpm: 100, volume: 1, channels: { a: { wave: 'triangle', volume: 1, env: { a: 0, d: 0, s: 1, r: 0 }, bars } } });
  assert.throws(() => compileSong('x', song(['C4 - -'])), /bar 1: 3 steps, expected 16/);
  assert.throws(() => compileSong('x', song(['C4 - - - - - - - - - - - - - - H9'])), /"H9" is not a note/);
  assert.throws(() => compileSong('x', song(['- - - - - - - - - - - - - - - -'])), /can't start with a hold/);
  assert.throws(() => compileSong('x', { ...song([]), channels: { d: { wave: 'noise', volume: 1, bars: ['k . . . . . . . . . . . . . . x'] } } }), /not a drum/);
  assert.throws(() => compileSong('nope'), /Unknown song/);
});

test('notes hold until the next note or rest', () => {
  const s = compileSong('x', { bpm: 120, volume: 1, channels: { a: { wave: 'pulse25', volume: 1, env: { a: 0, d: 0, s: 1, r: 0 },
    bars: ['C4 - - - E4 - . . G4 - - - - - - -'] } } });
  assert.deepEqual(s.events.map(e => [e.step, e.midi, e.steps]), [[0, 60, 4], [4, 64, 2], [8, 67, 8]]);
  assert.equal(s.stepDur, 0.125);
});

test('chord, arpeggio and bass helpers', () => {
  assert.deepEqual(chord('Dm', 4), ['D4', 'F4', 'A4']);
  assert.deepEqual(chord('A', 3), ['A3', 'C#4', 'E4']);
  assert.equal(arp('C', { order: [0, 1, 2, 3] }).split(' ').slice(0, 4).join(' '), 'C4 E4 G4 C5');
  assert.equal(arp('Am', { octave: 3, every: 2, order: [0, 1] }).split(' ').length, 16);
  assert.equal(bass('Bb', 'pump').split(' ')[2], 'Bb3');
  assert.equal(noteToMidi('A4'), 69);
});
