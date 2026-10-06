// Shared helpers for the pixel-art scenes painted into RGBA buffers
// (src/archive.js, src/forge.js): a tiny canvas with put/blend/add and a
// dithered glow, plus seeded randomness and an ordered-dither matrix.
// No DOM, so the scenes run in node tests too.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** 4x4 Bayer matrix, values in (0, 1): ordered dithering keeps gradients pixel-art. */
export const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16));

/** Seeded pseudo-random numbers in [0, 1), so a scene is the same every time. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable pseudo-random value in [0, 1) for integer inputs (no state). */
export function hash3(x, y, z = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  put(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
  }
  blend(x, y, c, a) {
    x = Math.round(x); y = Math.round(y);
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    a = Math.min(1, a);
    for (let k = 0; k < 3; k++) this.d[i + k] += (c[k] - this.d[i + k]) * a;
  }
  add(x, y, c, a) {
    x = Math.round(x); y = Math.round(y);
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    for (let k = 0; k < 3; k++) this.d[i + k] = Math.min(255, this.d[i + k] + c[k] * a);
  }
  rect(x0, y0, x1, y1, c) {
    for (let y = Math.max(0, Math.round(y0)); y <= Math.min(this.h - 1, Math.round(y1)); y++) {
      for (let x = Math.max(0, Math.round(x0)); x <= Math.min(this.w - 1, Math.round(x1)); x++) this.put(x, y, c);
    }
  }
  /** A soft round glow added on top: brightest at the center, dithered falloff. */
  halo(cx, cy, r, c, strength) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.1) / r;
        if (d >= 1 || y < 0 || x < 0 || x >= this.w || y >= this.h) continue;
        const a = (1 - d) ** 2 * strength;
        // Quantize to a few steps, dithered, so the glow stays pixel-art rather than a smooth gradient.
        const q = Math.floor(a * 24 + BAYER[y & 3][x & 3]) / 24;
        this.add(x, y, c, q);
      }
    }
  }
}
