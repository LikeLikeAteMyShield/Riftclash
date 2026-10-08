import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, compileSong, songSeconds, chord, arp, bass, noteToMidi } from '../src/songs.js';

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

test('each screen has its own track', () => {
  assert.deepEqual(Object.keys(SONGS).filter(id => SONGS[id].loop !== false).sort(),
    ['battle', 'crypt', 'forge', 'frozenpass', 'grun', 'highkeep', 'library', 'menu', 'moonwood', 'quests', 'riftkin', 'sanctum']);
});

test('battle, library and forge are calmer than the menu theme', () => {
  const density = id => { const s = compileSong(id); return s.events.length / (s.length * s.stepDur); };
  for (const calm of ['battle', 'library', 'forge']) {
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

test('the forge rings an anvil on every bar, in time with the forge scene\'s hammer', async () => {
  const { HAMMER_PERIOD, BELLOWS_PERIOD } = await import('../src/forge.js');
  const s = compileSong('forge');
  const barSeconds = 16 * s.stepDur;
  assert.equal(barSeconds, HAMMER_PERIOD, 'one bar is one hammer blow');
  assert.equal(BELLOWS_PERIOD, barSeconds * 2, 'the bellows pump every other bar');
  const strikes = s.events.filter(e => e.drum === 'a').map(e => e.step);
  assert.deepEqual(strikes, Array.from({ length: s.length / 16 }, (_, i) => i * 16), 'a strike on the first step of every bar');
  const breaths = s.events.filter(e => e.drum === 'b').map(e => e.step);
  assert.deepEqual(breaths, Array.from({ length: s.length / 32 }, (_, i) => i * 32), 'a bellows breath every other bar');
  assert.ok(s.events.some(e => e.drum === 't'), 'lighter taps between strikes');
});

test('the quest theme sits between the library and the menu: brighter than one, gentler than the other', () => {
  const density = id => { const s = compileSong(id); return s.events.length / (s.length * s.stepDur); };
  const q = SONGS.quests;
  for (const calm of ['library', 'forge', 'battle']) {
    assert.ok(q.bpm > SONGS[calm].bpm, `faster than ${calm}`);
    assert.ok(density('quests') > density(calm), `busier than ${calm}`);
  }
  assert.ok(q.bpm < SONGS.menu.bpm, 'slower than the menu');
  assert.ok(q.volume < SONGS.menu.volume, 'quieter than the menu');
  assert.ok(density('quests') < density('menu'), 'sparser than the menu');
  // Hopeful: a major key, so the lead's notes come from G major.
  const gMajor = new Set([7, 9, 11, 0, 2, 4, 6]);
  const lead = compileSong('quests').events.filter(e => e.channel === 'lead');
  assert.ok(lead.every(e => gMajor.has(e.midi % 12)), 'lead stays in G major');
});

test('the Riftkin fight to their own music: the battle theme made menacing, and Grun\'s more intense still', async () => {
  const { HEROES, RIFTKIN } = await import('../src/cards.js');
  const { BACKGROUNDS } = await import('../src/backgrounds.js');
  // Their music comes with their boards.
  for (const id of RIFTKIN) assert.equal(BACKGROUNDS[HEROES[id].board].music, id === 'grun' ? 'grun' : 'riftkin', id);
  const density = id => { const s = compileSong(id); return s.events.length / (s.length * s.stepDur); };
  const { riftkin, grun, battle, menu } = SONGS;
  // The Riftkin theme keeps the battle theme's ambient energy: about as slow, sparse and quiet.
  assert.ok(Math.abs(riftkin.bpm - battle.bpm) <= 8, 'about the battle tempo');
  assert.ok(density('riftkin') < density('battle') * 1.5, 'about as sparse as the battle theme');
  assert.ok(riftkin.volume < menu.volume);
  // Grun turns it up: faster, busier and louder than the other battles, but under the menu theme.
  for (const calmer of ['battle', 'riftkin']) {
    assert.ok(grun.bpm > SONGS[calmer].bpm && density('grun') > density(calmer) * 2 && grun.volume > SONGS[calmer].volume, `Grun is more intense than ${calmer}`);
  }
  assert.ok(grun.bpm < menu.bpm && density('grun') < density('menu') && grun.volume < menu.volume, 'but still under the menu theme');
  // Menacing: both leads lean on the flat second of their key (F over E, Db over C).
  const leadPitches = id => new Set(compileSong(id).events.filter(e => e.channel === 'lead').map(e => e.midi % 12));
  assert.ok(leadPitches('riftkin').has(5), 'the Riftkin lead touches F, the flat second of E minor');
  assert.ok(leadPitches('grun').has(1), 'Grun\'s lead touches Db, the flat second of C minor');
});

test('a battle ends with a short victory or defeat theme that plays once, and beating Grun gets a far grander one', async () => {
  const { HEROES } = await import('../src/cards.js');
  const stingers = Object.keys(SONGS).filter(id => SONGS[id].loop === false).sort();
  assert.deepEqual(stingers, ['defeat', 'grunVictory', 'victory']);
  for (const id of stingers) {
    const seconds = songSeconds(id);
    assert.ok(seconds > 3 && seconds <= 5.25, `${id} lasts ${seconds.toFixed(2)}s, about 5s at most`);
  }
  assert.equal(HEROES.grun.victoryMusic, 'grunVictory');
  assert.deepEqual(Object.keys(HEROES).filter(id => HEROES[id].victoryMusic), ['grun'], 'only Grun has his own');
  // Grander: a bigger band, louder, busier, and climbing higher than the standard fanfare.
  const v = compileSong('victory'), g = compileSong('grunVictory');
  const peak = c => Math.max(...c.events.filter(e => e.midi).map(e => e.midi));
  assert.ok(Object.keys(SONGS.grunVictory.channels).length > Object.keys(SONGS.victory.channels).length, 'more voices');
  assert.ok(SONGS.grunVictory.volume > SONGS.victory.volume, 'louder');
  assert.ok(g.events.length > v.events.length * 2, `busier: ${g.events.length} vs ${v.events.length} notes`);
  assert.ok(peak(g) > peak(v), 'reaches higher');
  // Victory ends bright in a major key, defeat ends low and slow.
  const last = (c, ch) => c.events.filter(e => e.channel === ch).at(-1).midi;
  assert.equal(last(v, 'lead') % 12, 9, 'victory resolves to A');
  assert.equal(last(g, 'lead') % 12, 0, 'Grun\'s victory resolves to C');
  assert.ok(SONGS.defeat.bpm < SONGS.victory.bpm && SONGS.defeat.volume < SONGS.victory.volume, 'defeat is slower and quieter');
});

test('the title theme is a marching battle theme in C minor, toned down to sit with the rest of the game', async () => {
  const { MENU_BPM } = await import('../src/menuplan.js');
  const menu = SONGS.menu;
  assert.equal(MENU_BPM, menu.bpm, 'the menu battle scene keeps time with the theme');
  assert.ok(menu.bpm >= 115 && menu.bpm <= 130, `a marching tempo, a little slower than before (${menu.bpm} BPM)`);
  assert.ok(menu.volume < 1);
  // C minor: the lead stays in C natural minor, plus the B natural that leads home from G.
  const cMinor = new Set([0, 2, 3, 5, 7, 8, 10, 11]);
  const lead = compileSong('menu').events.filter(e => e.channel === 'lead');
  assert.ok(lead.every(e => cMinor.has(e.midi % 12)), 'lead stays in C minor');
  assert.equal(lead[0].midi % 12, 0, 'starts on C');
  assert.equal(lead.at(-1).midi % 12, 0, 'ends on C');
  // No bright major interlude: every chord is minor, or one of the darker major chords of C minor.
  const roots = compileSong('menu').events.filter(e => e.channel === 'bass' && e.step % 16 === 0).map(e => e.midi % 12);
  assert.ok(roots.every(r => [0, 5, 7, 8, 10].includes(r)), 'chords on C, F, G, Ab and Bb');
});

test('every battle board has its own track, as calm as the battle theme', async () => {
  const { BACKGROUNDS } = await import('../src/backgrounds.js');
  const density = id => { const s = compileSong(id); return s.events.length / (s.length * s.stepDur); };
  const tracks = Object.values(BACKGROUNDS).map(b => b.music);
  assert.equal(new Set(tracks).size, tracks.length, 'no two boards share a track');
  for (const [id, board] of Object.entries(BACKGROUNDS)) {
    const song = SONGS[board.music];
    assert.ok(song && song.loop !== false, `${id} plays a looping track`);
    if (board.boss) continue;   // the boss boards' tracks have their own test
    assert.ok(song.bpm <= 80 && song.volume < SONGS.menu.volume, `${id}: slow and quieter than the menu`);
    assert.ok(density(board.music) < density('battle') * 3, `${id}: no more than three times as busy as the battle theme (${density(board.music).toFixed(1)} notes/s)`);
  }
  assert.equal(BACKGROUNDS.embers.music, 'battle', 'Field of Embers keeps the original battle theme');
});
