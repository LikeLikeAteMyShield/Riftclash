// Synthesized sound effects (Web Audio API). No audio files: every sound is
// built from oscillators and filtered noise, so nothing needs loading.

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem('riftclash-muted') === '1'; } catch { /* storage unavailable */ }

const VOLUME = 0.55;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Browsers only allow audio after a user gesture; call this from one. */
export function unlock() { ensure(); }

/** The shared context and master volume, for other audio such as music. Null if Web Audio is unavailable. */
export function audioGraph() {
  return ensure() ? { ctx, master } : null;
}

export function isMuted() { return muted; }

export function setMuted(value) {
  muted = value;
  try { localStorage.setItem('riftclash-muted', value ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.setTargetAtTime(value ? 0 : VOLUME, ctx.currentTime, 0.02);
}

function envelope(gain, t, { vol, attack, dur }) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(freq, { type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, to, delay = 0, filter } = {}) {
  if (muted || !ensure()) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  envelope(gain, t, { vol, attack, dur });
  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    node = node.connect(f);
  }
  node.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.3, attack = 0.005, type = 'bandpass', freq = 1000, to, q = 1, delay = 0 } = {}) {
  if (muted || !ensure()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ctx.createGain();
  envelope(gain, t, { vol, attack, dur });
  src.connect(filter).connect(gain).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  click() { tone(900, { type: 'triangle', dur: 0.06, vol: 0.12 }); },
  error() { tone(150, { type: 'square', dur: 0.14, vol: 0.08, filter: 900 }); tone(120, { type: 'square', dur: 0.14, vol: 0.08, filter: 900, delay: 0.08 }); },
  cardPlay() { noise({ freq: 700, to: 3200, dur: 0.28, vol: 0.22, q: 1.5, attack: 0.05 }); },
  draw() { noise({ type: 'highpass', freq: 2500, dur: 0.09, vol: 0.08 }); },

  /** Heavier minions land with a deeper thud. */
  summon(cost = 3) {
    const weight = Math.min(1, cost / 9);
    tone(170 - weight * 70, { to: 45, dur: 0.22 + weight * 0.25, vol: 0.45 + weight * 0.3 });
    noise({ type: 'lowpass', freq: 500 - weight * 200, dur: 0.18 + weight * 0.2, vol: 0.25 + weight * 0.2 });
    if (cost >= 7) noise({ type: 'lowpass', freq: 150, dur: 0.7, vol: 0.4, attack: 0.02 });
  },

  spellCast() {
    [660, 990, 1320, 1760].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.35, vol: 0.09, delay: i * 0.045 }));
    noise({ type: 'highpass', freq: 3000, to: 8000, dur: 0.4, vol: 0.1, attack: 0.05 });
  },
  heroPower() {
    tone(330, { type: 'triangle', to: 660, dur: 0.22, vol: 0.18 });
    tone(495, { type: 'sine', to: 990, dur: 0.22, vol: 0.1, delay: 0.03 });
  },
  projectile() { noise({ freq: 400, to: 2200, dur: 0.3, vol: 0.14, q: 3, attack: 0.03 }); },

  swing() { noise({ freq: 2200, to: 500, dur: 0.2, vol: 0.2, q: 2, attack: 0.04 }); },
  impact(amount = 2) {
    const k = Math.min(1, amount / 8);
    noise({ type: 'lowpass', freq: 1500 + k * 1000, dur: 0.12 + k * 0.15, vol: 0.3 + k * 0.25 });
    tone(130 - k * 50, { to: 40, dur: 0.18 + k * 0.2, vol: 0.4 + k * 0.3 });
  },
  explosion() {
    noise({ type: 'lowpass', freq: 1800, to: 120, dur: 0.7, vol: 0.55, attack: 0.01 });
    tone(90, { to: 30, dur: 0.6, vol: 0.5 });
  },

  heal() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.4, vol: 0.09, attack: 0.03, delay: i * 0.06 })); },
  buff() {
    tone(440, { type: 'triangle', to: 880, dur: 0.25, vol: 0.14 });
    tone(660, { type: 'sine', to: 1320, dur: 0.25, vol: 0.08, delay: 0.05 });
  },
  freeze() {
    noise({ type: 'highpass', freq: 6000, dur: 0.45, vol: 0.18, attack: 0.01 });
    tone(1760, { type: 'triangle', to: 2640, dur: 0.3, vol: 0.07 });
    tone(2350, { type: 'sine', dur: 0.5, vol: 0.05, delay: 0.08 });
  },
  shield() {
    tone(1500, { type: 'triangle', dur: 0.3, vol: 0.12 });
    tone(2250, { type: 'triangle', dur: 0.35, vol: 0.08, delay: 0.02 });
    noise({ type: 'highpass', freq: 5000, dur: 0.2, vol: 0.12 });
  },
  armor() {
    tone(220, { type: 'square', dur: 0.1, vol: 0.1, filter: 1500 });
    tone(880, { type: 'triangle', dur: 0.3, vol: 0.1, delay: 0.02 });
    noise({ freq: 3500, dur: 0.12, vol: 0.12, q: 4 });
  },
  equip() {
    noise({ freq: 4000, dur: 0.25, vol: 0.18, q: 6 });
    tone(330, { type: 'square', dur: 0.12, vol: 0.08, filter: 1200 });
    tone(1320, { type: 'triangle', dur: 0.4, vol: 0.06, delay: 0.03 });
  },
  destroy() {
    tone(200, { type: 'sawtooth', to: 50, dur: 0.5, vol: 0.18, filter: 800 });
    noise({ type: 'lowpass', freq: 900, to: 200, dur: 0.5, vol: 0.2 });
  },
  death() {
    tone(320, { type: 'triangle', to: 70, dur: 0.4, vol: 0.18 });
    noise({ freq: 1200, to: 300, dur: 0.35, vol: 0.18, q: 1 });
  },
  // A hushed "shh": breathy noise falling away, under a soft low bell.
  silence() {
    noise({ type: 'bandpass', freq: 5200, to: 2400, dur: 0.6, vol: 0.14, q: 0.8, attack: 0.06 });
    tone(392, { type: 'sine', to: 196, dur: 0.7, vol: 0.08, attack: 0.02 });
  },
  // A bright rising fanfare for completing a quest.
  questComplete() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.5, vol: 0.1, attack: 0.01, delay: 0.25 + i * 0.09 }));
    tone(1568, { type: 'sine', dur: 0.9, vol: 0.06, attack: 0.02, delay: 0.25 + 5 * 0.09 });
  },
  bounce() { noise({ freq: 600, to: 4000, dur: 0.3, vol: 0.16, q: 2, attack: 0.08 }); },
  burn() { noise({ type: 'lowpass', freq: 3000, to: 400, dur: 0.6, vol: 0.2, attack: 0.05 }); },

  yourTurn() {
    tone(392, { type: 'sawtooth', dur: 0.25, vol: 0.1, filter: 1600 });
    tone(523, { type: 'sawtooth', dur: 0.5, vol: 0.12, filter: 1600, delay: 0.16 });
    tone(784, { type: 'sine', dur: 0.5, vol: 0.06, delay: 0.16 });
  },
};
