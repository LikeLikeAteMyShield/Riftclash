// Background music player. Songs (src/songs.js) are played with NES-style
// voices: pulse waves at 12.5/25/50% duty, a triangle bass and noise drums.
// Notes are scheduled slightly ahead on the Web Audio clock so timing stays
// tight even when the main thread is busy animating.

import { audioGraph } from './sfx.js';
import { SONGS, compileSong, midiToFreq } from './songs.js';

const LOOKAHEAD = 0.3;   // seconds of music scheduled in advance
const TICK_MS = 60;
const FADE_IN = 1.5;
const FADE_OUT = 1.0;
const MUSIC_VOLUME = 0.7;

let enabled = true;
try { enabled = localStorage.getItem('riftclash-music') !== '0'; } catch { /* storage unavailable */ }

let graph = null;      // { ctx, master } from sfx.js, once audio is unlocked
let musicGain = null;
let wanted = null;     // the track the current screen asks for
let playing = null;    // { id, song, comp, gain, step, time }
let timer = null;
const compiled = {};
const waveCache = new WeakMap();
const noiseCache = new WeakMap();

// ---------------------------------------------------------------- public API

export const isMusicOn = () => enabled;

/** Ask for a track ('menu', 'battle', 'library'). Crossfades if it differs. */
export function playTrack(id) {
  wanted = id;
  if (graph && enabled && !document.hidden) start(id);
}

/** Call from a user gesture: browsers only allow audio after one. */
export function startMusic() {
  graph ??= audioGraph();
  if (!graph) return;
  if (!musicGain) {
    musicGain = graph.ctx.createGain();
    musicGain.gain.value = MUSIC_VOLUME;
    musicGain.connect(graph.master);
  }
  if (wanted && enabled && !document.hidden) start(wanted);
}

export function setMusicOn(value) {
  enabled = value;
  try { localStorage.setItem('riftclash-music', value ? '1' : '0'); } catch { /* ignore */ }
  if (!value) stop(0.4);
  else if (graph && wanted) start(wanted);
}

/** The track currently audible (for tests and debugging). */
export const currentTrack = () => playing?.id ?? null;

// Pause in background tabs: timers are throttled there, which would make the
// scheduler fall behind and stutter. Resume from the top when visible again.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop(0.3);
  else if (graph && enabled && wanted) start(wanted);
});

// ---------------------------------------------------------------- scheduling

function songData(id) {
  if (!compiled[id]) {
    const comp = compileSong(id);
    comp.byStep = Array.from({ length: comp.length }, () => []);
    for (const ev of comp.events) comp.byStep[ev.step].push(ev);
    compiled[id] = comp;
  }
  return compiled[id];
}

function start(id) {
  if (playing?.id === id) return;
  stop(FADE_OUT);
  const ctx = graph.ctx;
  const song = SONGS[id];
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(song.volume, ctx.currentTime + FADE_IN);
  gain.connect(musicGain);
  playing = { id, song, comp: songData(id), gain, step: 0, time: ctx.currentTime + 0.1 };
  timer ??= setInterval(tick, TICK_MS);
  tick();
}

function stop(fade) {
  if (!playing) return;
  const { gain } = playing;
  const t = graph.ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + fade);
  setTimeout(() => gain.disconnect(), (fade + LOOKAHEAD + 1) * 1000);
  playing = null;
}

function tick() {
  if (!playing) { clearInterval(timer); timer = null; return; }
  const ctx = graph.ctx;
  const p = playing;
  if (p.time < ctx.currentTime - 0.2) p.time = ctx.currentTime + 0.05; // fell behind: skip ahead, don't burst
  while (p.time < ctx.currentTime + LOOKAHEAD) {
    for (const ev of p.comp.byStep[p.step]) playEvent(ctx, p.gain, p.song.channels[ev.channel], ev, p.time, p.comp.stepDur);
    p.step = (p.step + 1) % p.comp.length;
    p.time += p.comp.stepDur;
  }
}

/**
 * Schedule a stretch of a song directly, without the live scheduler. Used to
 * render songs offline (e.g. into an OfflineAudioContext for previews).
 */
export function renderSong(ctx, dest, id, when = 0, steps = null) {
  const comp = songData(id);
  const song = SONGS[id];
  const total = steps ?? comp.length;
  for (let i = 0; i < total; i++) {
    for (const ev of comp.byStep[i % comp.length]) playEvent(ctx, dest, song.channels[ev.channel], ev, when + i * comp.stepDur, comp.stepDur);
  }
  return total * comp.stepDur;
}

// ---------------------------------------------------------------- voices

const DUTY = { pulse12: 0.125, pulse25: 0.25, pulse50: 0.5 };

function pulseWave(ctx, wave) {
  let cache = waveCache.get(ctx);
  if (!cache) waveCache.set(ctx, cache = {});
  if (!cache[wave]) {
    // Fourier series of a pulse wave with the given duty cycle.
    const n = 48, duty = DUTY[wave];
    const real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    cache[wave] = ctx.createPeriodicWave(real, imag);
  }
  return cache[wave];
}

function noiseBuffer(ctx) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

function playEvent(ctx, dest, ch, ev, t, stepDur) {
  if (ch.wave === 'noise') return drum(ctx, dest, ev.drum, t, ch.volume);
  const { a, d, s, r } = ch.env;
  const vol = ch.volume;
  const end = t + Math.max(ev.steps * stepDur, a + d);
  const osc = ctx.createOscillator();
  if (ch.wave === 'triangle') osc.type = 'triangle';
  else osc.setPeriodicWave(pulseWave(ctx, ch.wave));
  const freq = midiToFreq(ev.midi);
  osc.frequency.setValueAtTime(freq, t);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.linearRampToValueAtTime(vol * s, t + a + d);
  g.gain.setValueAtTime(vol * s, end);
  g.gain.linearRampToValueAtTime(0, end + r);

  let node = osc;
  if (ch.filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = ch.filter;
    f.Q.value = 0.5;
    node = node.connect(f);
  }
  node.connect(g).connect(dest);

  if (ch.vibrato && end - t > ch.vibrato.delay) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = ch.vibrato.rate;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(freq * (2 ** (ch.vibrato.depth / 1200) - 1), t + ch.vibrato.delay + 0.1);
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(end + r + 0.05);
  }
  osc.start(t);
  osc.stop(end + r + 0.05);
}

function drum(ctx, dest, type, t, vol) {
  const g = ctx.createGain();
  g.connect(dest);
  if (type === 'k') {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol * 1.8, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.18);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  const len = type === 's' ? 0.13 : 0.045;
  if (type === 's') { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; } else { f.type = 'highpass'; f.frequency.value = 7000; }
  g.gain.setValueAtTime(vol * (type === 's' ? 1.1 : 0.55), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g);
  src.start(t, Math.random() * 0.5);
  src.stop(t + len + 0.02);
}
