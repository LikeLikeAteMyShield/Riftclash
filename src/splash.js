// The splash screen shown when the game first opens: a big title inside
// rings of glowing runes, with the class sigils around it, over a pixel-art
// sky where the Rift tears open. "Press any key" dismisses it, which is also
// the gesture browsers need before they'll play the music.
//
// Pure, so it's tested in node: the backdrop paints into an RGBA buffer (see
// src/pixelbuf.js) and the rune rings are built as SVG markup strings. ui.js
// mounts both.

import { Canvas, BAYER, clamp, hex, rng, hash3 } from './pixelbuf.js';

// ---------------------------------------------------------------- runes

/**
 * Rune glyphs: angular strokes in a 6 x 10 box, as SVG path data (M, L, V, H
 * only). Original shapes, in the spirit of carved runes.
 */
export const RUNES = [
  'M3 0V10 M3 2L6 0 M3 5L6 3',
  'M1 0V10 M1 0L5 4L1 7 M5 4V10',
  'M3 0V10 M0 3L3 6L6 3',
  'M0 0L3 3L6 0 M3 3V10',
  'M1 0V10 M5 0V10 M1 3L5 7',
  'M3 0V10 M0 2L6 8 M6 2L0 8',
  'M0 10L3 0L6 10 M1 6H5',
  'M1 0V10 M1 0L5 3L1 6 M1 6L5 10',
  'M3 0L6 5L3 10L0 5Z',
  'M0 0V10 M6 0V10 M0 0L6 10',
  'M3 0V10 M0 0L3 3 M6 0L3 3 M0 10L3 7 M6 10L3 7',
  'M0 2H6 M3 2V10 M0 7L3 10L6 7',
  'M1 0V10 M1 5L5 1 M1 5L5 9',
  'M0 0L6 4L0 7L6 10',
  'M3 0V10 M3 4L0 1 M3 4L6 1 M3 8L6 5',
  'M0 5H6 M3 0V10 M1 1L5 9',
];

/**
 * One ring of runes, as SVG markup centred on (0, 0): `count` glyphs evenly
 * around a circle of radius `r`, each `size` units tall and standing upright
 * relative to the circle (its foot towards the centre). `offset` picks which
 * glyph starts, so two rings don't repeat the same sequence.
 */
export function runeRingSVG({ r, count, size, offset = 0, className = 'rune' }) {
  const scale = size / 10;
  const glyphs = [];
  for (let i = 0; i < count; i++) {
    const deg = (i * 360) / count;
    const path = RUNES[(i + offset) % RUNES.length];
    // Rotate to the spot on the ring, step out to the radius, then centre the 6x10 glyph.
    glyphs.push(`<path class="${className}" style="--i:${i}" d="${path}" transform="rotate(${deg.toFixed(2)}) translate(0 ${-r}) scale(${scale.toFixed(3)}) translate(-3 -5)"/>`);
  }
  return glyphs.join('');
}

/** Tick marks around a circle: `count` short radial lines from r0 to r1 (every `major`th one longer). */
export function ticksSVG({ r0, r1, count, major = 0, className = 'tick' }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const long = major && i % major === 0;
    const deg = (i * 360) / count;
    out.push(`<line class="${className}${long ? ' major' : ''}" x1="0" y1="${-r0}" x2="0" y2="${-(long ? r1 + (r1 - r0) : r1)}" transform="rotate(${deg.toFixed(2)})"/>`);
  }
  return out.join('');
}

/**
 * Where the class sigils sit: the points of a hexagram (a pointy-top hexagon)
 * of radius `r`, as {x, y} in the same units as the rings. The top and bottom
 * points sit above and below the title; the other four flank it at the sides.
 */
export function sigilPoints(count, r) {
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
  });
}

/** The hexagram itself: two overlapping triangles through the sigil points, as SVG path data. */
export function hexagramPath(r) {
  const p = sigilPoints(6, r);
  const tri = idx => `M${idx.map(i => `${p[i].x} ${p[i].y}`).join(' L')} Z`;
  return `${tri([0, 2, 4])} ${tri([1, 3, 5])}`;
}

// ---------------------------------------------------------------- backdrop

export const SPLASH_H = 180;

/** Width in low-res pixels for a viewport, so the backdrop fills it with little cropping. */
export function splashWidth(viewW, viewH) {
  return clamp(Math.round(SPLASH_H * viewW / Math.max(1, viewH)), 80, 420);
}

const C = Object.fromEntries(Object.entries({
  sky0: '#04030a', sky1: '#0c0820', sky2: '#170c2c', sky3: '#0a0614',
  nebV: '#4a1c6a', nebB: '#16306a', nebP: '#6a1c4a',
  star: '#cfc4ff', starW: '#ffffff',
  rift: '#8a4ae0', riftHi: '#d4b8ff', riftCore: '#ffffff', halo: '#5a2a9a', gold: '#e8a83a',
  ember: '#ffb45a', mote: '#a88aff',
}).map(([k, v]) => [k, hex(v)]));

/** How far open the Rift is at time t (seconds): it tears open over the first moments, then breathes. */
export const riftOpen = t => clamp(t / 1.6, 0, 1) ** 0.6;

/**
 * Build the backdrop for a given width: `render(t)` returns the frame at time
 * t (seconds since the splash appeared) as an RGBA buffer.
 */
export function createSplash(width) {
  const W = width, H = SPLASH_H, cx = W / 2, cy = Math.round(H * 0.47);
  const r = rng(11);
  const base = new Canvas(W, H);

  // Deep sky, dithered between a few bands.
  const stops = [[0, C.sky0], [0.4, C.sky1], [0.62, C.sky2], [1, C.sky3]];
  for (let y = 0; y < H; y++) {
    const f = y / (H - 1);
    let i = 0;
    while (i < stops.length - 2 && stops[i + 1][0] <= f) i++;
    const [f0, c0] = stops[i], [f1, c1] = stops[i + 1];
    for (let x = 0; x < W; x++) {
      const level = Math.min(6, Math.floor(((f - f0) / (f1 - f0)) * 6 + BAYER[y & 3][x & 3])) / 6;
      base.put(x, y, c0.map((v, k) => Math.round(v + (c1[k] - v) * level)));
    }
  }
  // Nebulae: soft clouds of colour either side of the Rift.
  base.halo(cx - W * 0.3, H * 0.32, H * 0.55, C.nebV, 0.32);
  base.halo(cx + W * 0.32, H * 0.6, H * 0.5, C.nebB, 0.3);
  base.halo(cx + W * 0.12, H * 0.12, H * 0.32, C.nebP, 0.18);
  base.halo(cx, cy, H * 0.62, C.halo, 0.22);

  // Stars, twinkling; a few bright ones with a cross.
  const stars = Array.from({ length: Math.round(W * H / 90) }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * H), p: r() * 6.28, s: 0.6 + r() * 1.8, big: r() < 0.06 }));
  // The Rift: a jagged vertical tear through the centre, wider in the middle.
  const tear = Array.from({ length: H }, (_, y) => Math.round(Math.sin(y * 0.21) * 1.2 + Math.sin(y * 0.07 + 1) * 2 + (hash3(y, 3) - 0.5) * 1.6));
  // Embers and starlight drifting up out of the Rift.
  const motes = Array.from({ length: 70 }, () => ({ x: r(), y: r(), v: 0.4 + r(), p: r() * 6.28, gold: r() < 0.45 }));

  const frame = new Canvas(W, H);
  return {
    width: W, height: H,
    render(t = 0) {
      frame.d.set(base.d);
      for (const s of stars) {
        const a = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
        frame.blend(s.x, s.y, s.big ? C.starW : C.star, a);
        if (s.big) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) frame.blend(s.x + dx, s.y + dy, C.star, a * 0.35);
      }
      // The Rift tears open from the centre outwards, then pulses slowly.
      const open = riftOpen(t), pulse = 0.85 + 0.15 * Math.sin(t * 1.4);
      const reach = open * H * 0.62;
      frame.halo(cx, cy, H * 0.42 * open, C.rift, 0.5 * pulse * open);
      for (let y = 0; y < H; y++) {
        const dy = Math.abs(y - cy);
        if (dy > reach) continue;
        const taper = 1 - dy / Math.max(1, reach);
        const w = (0.6 + 3.2 * taper) * open;
        const x0 = cx + tear[y];
        for (let dx = -Math.ceil(w) - 3; dx <= Math.ceil(w) + 3; dx++) {
          const d = Math.abs(dx) / Math.max(0.5, w);
          if (d < 0.45) frame.add(x0 + dx, y, C.riftCore, 0.9 * pulse);
          else if (d < 1) frame.add(x0 + dx, y, C.riftHi, 0.7 * pulse * (1 - d));
          else frame.add(x0 + dx, y, C.rift, 0.3 * pulse * Math.max(0, 1 - (d - 1) / 2));
        }
      }
      // A warm glow behind where the title sits.
      frame.halo(cx, cy, H * 0.26, C.gold, 0.12 * open * pulse);
      for (const m of motes) {
        const y = H - ((m.y * H + t * 9 * m.v) % H);
        const spread = 1 - Math.abs(y - cy) / H;
        const x = cx + (m.x - 0.5) * W * (0.25 + 0.75 * (1 - spread)) + Math.sin(t * 0.9 + m.p) * 4;
        frame.add(x, y, m.gold ? C.ember : C.mote, (0.35 + 0.35 * Math.sin(t * 3 + m.p)) * open);
      }
      return frame.d;
    },
  };
}
