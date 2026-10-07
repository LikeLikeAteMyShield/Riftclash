// Battle backgrounds: low-resolution pixel art scenes, drawn procedurally from
// layered data and animated subtly. Pure JS writing into an RGBA buffer, so it
// runs in the browser (via canvas) and in node tests alike.
//
// A scene is a list of layers drawn in order. Static layers are rendered once
// into a cached base image; animated layers (twinkling stars, drifting clouds,
// particles...) are drawn on top each frame as pure functions of time.
//
// Keep scenes dark and calm: the board's minions, cards and stats sit on top.
// test/backgrounds.test.js enforces brightness and "busyness" limits.

export const BG_WIDTH = 192;
export const BG_HEIGHT = 108;

// ---------------------------------------------------------------- scenes

export const BACKGROUNDS = {
  highkeep: {
    name: 'Dusk over Highkeep',
    layers: [
      { type: 'sky', stops: [[0, '#140e26'], [30, '#2a1838'], [58, '#4a2436'], [70, '#5a2e30']] },
      { type: 'glow', x: 150, y: 66, r: 40, color: '#7a3c28', alpha: 0.35 },
      { type: 'stars', count: 22, yMax: 26, color: '#c8b8e0', seed: 3 },
      { type: 'clouds', bands: [{ y: 18, len: 46, color: '#3a2440', speed: 1.2 }, { y: 31, len: 60, color: '#4a2a3a', speed: 0.7 }, { y: 11, len: 30, color: '#2e1e3c', speed: 1.6 }] },
      { type: 'ridge', y: 64, amp: 9, rough: 0.55, color: '#261830', seed: 11 },
      { type: 'castle', x: 128, base: 66, color: '#170e1e', window: '#e8a24a' },
      { type: 'ridge', y: 82, amp: 6, rough: 0.45, color: '#120a16', seed: 21 },
      { type: 'ground', y: 92, color: '#0c0710' },
    ],
  },

  frozenpass: {
    name: 'The Frozen Pass',
    layers: [
      { type: 'sky', stops: [[0, '#08101e'], [36, '#122638'], [62, '#1e3a4c']] },
      { type: 'stars', count: 40, yMax: 34, color: '#b8d0e8', seed: 5 },
      { type: 'aurora', y: 16, color: '#2a7a64', alpha: 0.28 },
      { type: 'ridge', y: 58, amp: 16, rough: 0.7, color: '#1c3042', cap: '#3c5a6e', seed: 7 },
      { type: 'ridge', y: 74, amp: 7, rough: 0.5, color: '#122232', seed: 17 },
      { type: 'pines', y: 84, count: 30, minH: 8, maxH: 15, color: '#0a1620', seed: 9 },
      { type: 'ground', y: 90, color: '#0a121a' },
      { type: 'particles', kind: 'snow', count: 55, color: '#9fb8c8', seed: 13 },
    ],
  },

  embers: {
    name: 'Field of Embers',
    layers: [
      { type: 'sky', stops: [[0, '#140808'], [34, '#2c100c'], [64, '#4a1c10']] },
      { type: 'glow', x: 60, y: 70, r: 50, color: '#6a2410', alpha: 0.3 },
      { type: 'smoke', columns: [{ x: 34, color: '#2a1414' }, { x: 98, color: '#261212' }, { x: 160, color: '#2c1616' }] },
      { type: 'ridge', y: 72, amp: 5, rough: 0.4, color: '#1e0c0a', seed: 31 },
      { type: 'ruins', base: 74, color: '#140808', towers: [[28, 22], [44, 12], [150, 26], [166, 16], [178, 9]] },
      { type: 'ground', y: 84, color: '#0e0606' },
      { type: 'banners', items: [[66, 84, 24, '#5a1a14'], [118, 86, 20, '#3a2a14'], [136, 84, 27, '#5a1a14']], pole: '#1a0c0a' },
      { type: 'particles', kind: 'embers', count: 34, color: '#ff8a3c', alt: '#ffc06a', seed: 19 },
    ],
  },

  moonwood: {
    name: 'Moonwood',
    layers: [
      { type: 'sky', stops: [[0, '#06121a'], [40, '#0e2228'], [70, '#163032']] },
      { type: 'glow', x: 44, y: 24, r: 26, color: '#3c5a52', alpha: 0.35 },
      { type: 'moon', x: 44, y: 24, r: 9, color: '#c4d4bc', shade: '#9aac98' },
      { type: 'stars', count: 18, yMax: 40, color: '#a8c0b8', seed: 23 },
      { type: 'canopy', y: 66, count: 14, r: [7, 12], color: '#0e2426', seed: 29 },
      { type: 'fog', y: 72, height: 10, color: '#2a4a48', alpha: 0.35 },
      { type: 'canopy', y: 80, count: 10, r: [8, 14], color: '#081a1c', seed: 37 },
      { type: 'trunks', color: '#050e10', xs: [6, 16, 176, 186] },
      { type: 'ground', y: 92, color: '#050d0e' },
      { type: 'particles', kind: 'fireflies', count: 16, color: '#c8f07a', seed: 41 },
    ],
  },

  rift: {
    name: 'The Riven Sanctum',
    layers: [
      { type: 'sky', stops: [[0, '#0a0616'], [40, '#170e2a'], [70, '#24123a']] },
      { type: 'stars', count: 55, yMax: 70, color: '#c8b8f0', seed: 43 },
      { type: 'rift', x: 152, y: 34, color: '#7a48c0', core: '#d2b8ff' },
      { type: 'rocks', items: [[30, 28, 6], [58, 16, 4], [118, 22, 3], [176, 58, 5]], color: '#1e1430' },
      { type: 'ruins', base: 80, color: '#120c1c', towers: [[14, 18], [26, 30], [40, 14], [92, 8], [100, 10], [182, 22]], arch: [70, 120, 22] },
      { type: 'ground', y: 86, color: '#0c0814' },
      { type: 'particles', kind: 'motes', count: 22, color: '#b48aff', seed: 47 },
    ],
  },

  // Boss boards (`boss: true`): never picked at random, only for Riftkin fights (a boss hero's `board` in cards.js).

  celestial: {
    name: 'The Celestial Realm',
    boss: true,
    layers: [
      { type: 'sky', stops: [[0, '#06061a'], [40, '#0e0c2c'], [76, '#1c1240']] },
      { type: 'nebula', clouds: [[150, 24, 44, 12, '#3a1c5a', 0.45], [60, 44, 50, 14, '#162a5a', 0.45], [104, 12, 30, 8, '#4a1c4a', 0.3]] },
      { type: 'stars', count: 70, yMax: 80, color: '#d8d0ff', seed: 53 },
      { type: 'planet', x: 30, y: 18, r: 11, color: '#3a3478', shade: '#1a1844', ring: '#6a5aa8' },
      { type: 'isles', color: '#1e1a3c', cap: '#3c3870', seed: 59, items: [
        { x: 20, y: 60, w: 22 }, { x: 96, y: 54, w: 46, temple: 7 }, { x: 172, y: 66, w: 26 }, { x: 56, y: 36, w: 10 }, { x: 140, y: 44, w: 8 },
      ] },
      { type: 'glow', x: 96, y: 40, r: 30, color: '#5a4ab0', alpha: 0.18 },
      { type: 'fog', y: 84, height: 12, color: '#2a2458', alpha: 0.4 },
      { type: 'ground', y: 94, color: '#0c0a1e' },
      { type: 'particles', kind: 'motes', count: 26, color: '#8fe0ff', seed: 61 },
    ],
  },

  citadel: {
    name: 'Citadel of Endless Night',
    boss: true,
    layers: [
      { type: 'sky', stops: [[0, '#04030a'], [34, '#0a0618'], [64, '#1a0c2a'], [84, '#2a1032']] },
      { type: 'glow', x: 40, y: 15, r: 36, color: '#3a1c6a', alpha: 0.3 },
      { type: 'stars', count: 30, yMax: 60, color: '#9a8ac0', seed: 67 },
      { type: 'eclipse', x: 40, y: 15, r: 9, color: '#020106', corona: '#9a6aff', rim: '#e8d8ff' },
      { type: 'ridge', y: 72, amp: 12, rough: 0.7, color: '#0e0818', seed: 71 },
      { type: 'fortress', x: 120, base: 80, color: '#06040c', edge: '#1e1430', window: '#a07aff', towers: [
        [-34, 7, 22, 9], [-22, 9, 38, 12], [-6, 12, 30, 0], [8, 8, 46, 14], [22, 7, 28, 10], [36, 6, 16, 7],
      ] },
      { type: 'ridge', y: 86, amp: 5, rough: 0.6, color: '#08050e', seed: 73 },
      { type: 'ground', y: 92, color: '#05030a' },
      { type: 'cracks', y: 92, count: 6, color: '#7a4ae0', seed: 79 },
      { type: 'fog', y: 78, height: 10, color: '#2a1a44', alpha: 0.35 },
      { type: 'particles', kind: 'motes', count: 22, color: '#7a5ac8', seed: 83 },
    ],
  },
};

/** The backgrounds an ordinary match can get (boss boards are kept for their bosses). */
export const randomBackgrounds = () => Object.keys(BACKGROUNDS).filter(id => !BACKGROUNDS[id].boss);

/** Pick a background id for an ordinary match. Avoids repeating `previous` when there is a choice. */
export function pickBackground(rand = Math.random, previous = null) {
  const pool = randomBackgrounds();
  const ids = pool.filter(id => id !== previous || pool.length === 1);
  return ids[Math.floor(rand() * ids.length)];
}

// ---------------------------------------------------------------- drawing helpers

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Canvas {
  constructor(w, h, data) { this.w = w; this.h = h; this.d = data ?? new Uint8ClampedArray(w * h * 4); }
  put(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
  }
  blend(x, y, c, a) {
    x |= 0; y |= 0;
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    for (let k = 0; k < 3; k++) this.d[i + k] += (c[k] - this.d[i + k]) * Math.min(1, a);
  }
  rect(x0, y0, x1, y1, c) {
    for (let y = Math.max(0, y0 | 0); y <= Math.min(this.h - 1, y1); y++) for (let x = Math.max(0, x0 | 0); x <= Math.min(this.w - 1, x1); x++) this.put(x, y, c);
  }
}

/** 1D midpoint-displacement heights across the width. */
function ridgeHeights(w, y, amp, rough, seed) {
  const r = rng(seed);
  const n = 64;
  const pts = new Array(n + 1).fill(0);
  pts[0] = r() * 2 - 1; pts[n] = r() * 2 - 1;
  for (let step = n, scale = 1; step > 1; step /= 2, scale *= rough) {
    for (let i = step / 2; i < n; i += step) pts[i] = (pts[i - step / 2] + pts[i + step / 2]) / 2 + (r() * 2 - 1) * scale;
  }
  return Array.from({ length: w }, (_, x) => {
    const f = (x / (w - 1)) * n, i = Math.floor(f), t = f - i;
    return y - (pts[i] * (1 - t) + (pts[Math.min(n, i + 1)] ?? pts[i]) * t) * amp;
  });
}

// ---------------------------------------------------------------- layers
// Each layer type has `draw` (static, into the cached base) and/or `animate`
// (each frame, on top). Both receive (canvas, layer, ctx).

const LAYERS = {
  sky: {
    draw(c, L) {
      const stops = L.stops.map(([y, col]) => [y, hex(col)]);
      for (let y = 0; y < c.h; y++) {
        let i = 0;
        while (i < stops.length - 1 && stops[i + 1][0] <= y) i++;
        const [y0, c0] = stops[i], [y1, c1] = stops[Math.min(stops.length - 1, i + 1)];
        const t = y1 === y0 ? 0 : Math.min(1, (y - y0) / (y1 - y0));
        // Ordered dithering through small in-between steps: retro texture without grain.
        const STEPS = 6;
        for (let x = 0; x < c.w; x++) {
          const level = Math.min(STEPS, Math.floor(t * STEPS + BAYER[y % 4][x % 4])) / STEPS;
          c.put(x, y, c0.map((v, k) => Math.round(v + (c1[k] - v) * level)));
        }
      }
    },
  },
  glow: {
    draw(c, L) {
      const col = hex(L.color);
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
        const d = Math.hypot(x - L.x, (y - L.y) * 1.3) / L.r;
        if (d < 1) c.blend(x, y, col, L.alpha * (1 - d) ** 2);
      }
    },
  },
  moon: {
    draw(c, L) {
      const col = hex(L.color), sh = hex(L.shade);
      for (let y = -L.r; y <= L.r; y++) for (let x = -L.r; x <= L.r; x++) {
        if (x * x + y * y <= L.r * L.r) c.put(L.x + x, L.y + y, (x - 3) ** 2 + (y + 2) ** 2 < 6 || (x + 4) ** 2 + (y - 3) ** 2 < 4 || x + y > L.r * 0.9 ? sh : col);
      }
    },
  },
  stars: {
    init(L, ctx) {
      const r = rng(L.seed);
      L._stars = Array.from({ length: L.count }, () => ({ x: Math.floor(r() * ctx.w), y: Math.floor(r() * L.yMax), p: r() * 6.28, s: 0.6 + r() * 1.6 }));
    },
    animate(c, L, { t, base }) {
      const col = hex(L.color);
      for (const s of L._stars) {
        // Only on open sky (not behind something drawn in front of it).
        if (!base.sky[s.y * c.w + s.x]) continue;
        c.blend(s.x, s.y, col, 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.s + s.p)));
      }
    },
  },
  clouds: {
    animate(c, L, { t, base }) {
      for (const b of L.bands) {
        const col = hex(b.color);
        const x0 = ((t * b.speed) % (c.w + b.len)) - b.len;
        for (let k = 0; k < b.len; k++) {
          const edge = Math.min(k, b.len - k) / 6;
          const thick = edge >= 1 ? 2 : 1;
          for (let dy = 0; dy < thick; dy++) {
            const x = Math.floor(x0 + k), y = b.y + dy;
            if (x >= 0 && x < c.w && base.sky[y * c.w + x]) c.blend(x, y, col, 0.55);
          }
        }
      }
    },
  },
  aurora: {
    animate(c, L, { t, base }) {
      const col = hex(L.color);
      for (let x = 0; x < c.w; x++) {
        const yy = L.y + Math.sin(x / 17 + t * 0.25) * 4 + Math.sin(x / 7 - t * 0.4) * 1.5;
        const a = L.alpha * (0.6 + 0.4 * Math.sin(x / 11 + t * 0.6));
        for (let k = 0; k < 7; k++) {
          const y = Math.floor(yy + k);
          if (y >= 0 && base.sky[y * c.w + x]) c.blend(x, y, col, a * (1 - k / 7));
        }
      }
    },
  },
  ridge: {
    draw(c, L, ctx) {
      const col = hex(L.color), cap = L.cap && hex(L.cap);
      const hs = ridgeHeights(c.w, L.y, L.amp, L.rough, L.seed);
      hs.forEach((top, x) => {
        for (let y = Math.max(0, Math.floor(top)); y < c.h; y++) {
          const isCap = cap && y - top < 2 && top < L.y - L.amp * 0.35;
          c.put(x, y, isCap ? cap : col);
          ctx.sky[y * c.w + x] = 0;
        }
      });
    },
  },
  ground: {
    draw(c, L, ctx) {
      c.rect(0, L.y, c.w - 1, c.h - 1, hex(L.color));
      for (let y = L.y; y < c.h; y++) for (let x = 0; x < c.w; x++) ctx.sky[y * c.w + x] = 0;
    },
  },
  pines: {
    draw(c, L, ctx) {
      const r = rng(L.seed), col = hex(L.color);
      for (let i = 0; i < L.count; i++) {
        const x = Math.floor(r() * c.w), h = L.minH + r() * (L.maxH - L.minH);
        for (let k = 0; k < h; k++) {
          const half = Math.floor((k / h) * h * 0.33);
          for (let dx = -half; dx <= half; dx++) { c.put(x + dx, L.y - h + k, col); ctx.sky[(Math.floor(L.y - h + k)) * c.w + x + dx] = 0; }
        }
      }
      c.rect(0, L.y, c.w - 1, L.y + 6, col);
    },
  },
  canopy: {
    draw(c, L, ctx) {
      const r = rng(L.seed), col = hex(L.color);
      for (let i = 0; i < L.count; i++) {
        const cx = (i + r() * 0.8) * (c.w / L.count), rad = L.r[0] + r() * (L.r[1] - L.r[0]);
        for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
          if (x * x + y * y * 1.4 <= rad * rad) { c.put(cx + x, L.y + y, col); ctx.sky[(Math.floor(L.y + y)) * c.w + Math.floor(cx + x)] = 0; }
        }
      }
      c.rect(0, L.y, c.w - 1, c.h - 1, col);
    },
  },
  trunks: {
    draw(c, L) {
      const col = hex(L.color);
      for (const x of L.xs) {
        c.rect(x - 2, 0, x + 2, c.h - 1, col);
        for (let k = 0; k < 4; k++) c.rect(x + (x < c.w / 2 ? 2 : -10), 14 + k * 17, x + (x < c.w / 2 ? 10 : -2), 15 + k * 17, col);
      }
    },
  },
  castle: {
    draw(c, L, ctx) {
      const col = hex(L.color);
      const x = L.x, b = L.base;
      const block = (x0, y0, x1) => c.rect(x0, y0, x1, b + 6, col);
      block(x - 18, b - 14, x + 18);                 // curtain wall
      for (let k = -18; k <= 18; k += 4) c.rect(x + k, b - 16, x + k + 1, b - 15, col);
      block(x - 22, b - 26, x - 15); block(x + 15, b - 26, x + 22);   // corner towers
      for (const tx of [x - 22, x - 19, x + 15, x + 18]) c.rect(tx, b - 28, tx + 1, b - 27, col);
      block(x - 6, b - 36, x + 6);                   // keep
      for (let k = -6; k <= 5; k += 3) c.rect(x + k, b - 38, x + k + 1, b - 37, col);
      for (let k = 0; k < 8; k++) c.rect(x - Math.floor(k / 3), b - 46 + k, x + Math.floor(k / 3), b - 46 + k, col);  // spire
      for (let y = b - 46; y < c.h; y++) for (let xx = x - 24; xx <= x + 24; xx++) if (y >= 0 && xx >= 0 && xx < c.w) ctx.sky[y * c.w + xx] = 0;
      L._windows = [[x - 19, b - 21], [x + 18, b - 21], [x - 2, b - 31], [x + 2, b - 31], [x - 10, b - 8], [x + 10, b - 8], [x, b - 24]];
    },
    animate(c, L, { t }) {
      const col = hex(L.window);
      L._windows.forEach(([wx, wy], i) => {
        const f = 0.55 + 0.25 * Math.sin(t * (2.1 + i * 0.37) + i * 1.7) + 0.15 * Math.sin(t * 7.3 + i);
        c.blend(wx, wy, col, f); c.blend(wx, wy + 1, col, f * 0.8);
      });
    },
  },
  ruins: {
    draw(c, L, ctx) {
      const col = hex(L.color);
      for (const [x, h] of L.towers) {
        c.rect(x - 3, L.base - h, x + 3, c.h - 1, col);
        c.rect(x - 4, L.base - h + 2, x - 4, L.base - h + 4, col);
        c.put(x + 4, L.base - h + 1, col);
        for (let y = L.base - h; y < c.h; y++) for (let xx = x - 4; xx <= x + 4; xx++) if (xx >= 0 && xx < c.w && y >= 0) ctx.sky[y * c.w + xx] = 0;
      }
      if (L.arch) {
        const [x0, x1, h] = L.arch, mid = (x0 + x1) / 2, rad = (x1 - x0) / 2;
        for (let x = x0; x <= x1; x++) {
          const inner = Math.sqrt(Math.max(0, (rad - 5) ** 2 - (x - mid) ** 2));
          const top = L.base - h - Math.sqrt(Math.max(0, rad ** 2 - (x - mid) ** 2)) * 0.5;
          for (let y = Math.floor(top); y < c.h; y++) {
            const hollow = Math.abs(x - mid) < rad - 5 && y > L.base - h - inner * 0.5 + 3;
            if (!hollow || y >= L.base) { c.put(x, y, col); ctx.sky[y * c.w + x] = 0; }
          }
        }
      }
    },
  },
  banners: {
    animate(c, L, { t }) {
      const pole = hex(L.pole);
      L.items.forEach(([x, base, h, color], i) => {
        c.rect(x, base - h, x, c.h - 1, pole);
        const col = hex(color);
        for (let k = 1; k <= 9; k++) {
          const wave = Math.round(Math.sin(t * 2 + k * 0.6 + i) * (k / 9) * 1.5);
          const len = k > 6 ? 6 - (k - 6) * 2 : 6;  // tattered, tapering tail
          for (let y = 0; y < len; y++) c.put(x + k, base - h + 1 + y + wave, col);
        }
      });
    },
  },
  smoke: {
    animate(c, L, { t }) {
      for (const col of L.columns) {
        const rgb = hex(col.color);
        for (let y = 0; y < 76; y++) {
          const w = 3 + (76 - y) * 0.12;
          const x = col.x + Math.sin(y / 9 + t * 0.5 + col.x) * (3 + (76 - y) * 0.05);
          for (let dx = -w; dx <= w; dx++) c.blend(x + dx, y, rgb, 0.5 * (1 - Math.abs(dx) / (w + 1)));
        }
      }
    },
  },
  fog: {
    animate(c, L, { t }) {
      const col = hex(L.color);
      for (let x = 0; x < c.w; x++) {
        const a = L.alpha * (0.6 + 0.4 * Math.sin(x / 13 + t * 0.3));
        for (let k = 0; k < L.height; k++) c.blend(x, L.y + k + Math.sin(x / 21 - t * 0.2) * 1.5, col, a * Math.sin((k / L.height) * Math.PI));
      }
    },
  },
  rift: {
    animate(c, L, { t }) {
      const col = hex(L.color), core = hex(L.core);
      const pulse = 0.85 + 0.15 * Math.sin(t * 1.3);
      for (let y = -24; y <= 24; y++) for (let x = -14; x <= 14; x++) {
        const d = Math.hypot(x / 7, y / 20);
        if (d < 1.6) c.blend(L.x + x, L.y + y, col, 0.35 * (1 - d / 1.6) * pulse);
        if (d < 0.5) c.blend(L.x + x, L.y + y, core, 0.6 * (1 - d / 0.5) * pulse);
      }
      for (let k = 0; k < 18; k++) {
        const a = t * 0.8 + k * 0.35, rr = 4 + k * 0.7;
        c.blend(L.x + Math.cos(a) * rr * 0.45, L.y + Math.sin(a) * rr * 1.1, core, 0.45);
      }
    },
  },
  rocks: {
    animate(c, L, { t }) {
      const col = hex(L.color);
      L.items.forEach(([x, y, r], i) => {
        const yy = y + Math.sin(t * 0.6 + i * 1.9) * 1.5;
        for (let dy = -r; dy <= r; dy++) {
          const w = dy < 0 ? r - Math.abs(dy) * 0.4 : r - dy * 0.9;
          for (let dx = -w; dx <= w; dx++) c.put(x + dx, yy + dy, col);
        }
      });
    },
  },
  nebula: {
    draw(c, L) {
      // Soft, wispy clouds of colour: an ellipse falloff broken up by a few sine waves.
      for (const [cx, cy, rx, ry, color, alpha] of L.clouds) {
        const col = hex(color);
        for (let y = Math.max(0, cy - ry * 2); y < Math.min(c.h, cy + ry * 2); y++) for (let x = Math.max(0, cx - rx * 2); x < Math.min(c.w, cx + rx * 2); x++) {
          const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
          const wisp = 0.55 + 0.25 * Math.sin(x / 5 + y / 3) + 0.2 * Math.sin(x / 11 - y / 4 + cx);
          if (d < 1.6) c.blend(x, y, col, alpha * wisp * (1 - d / 1.6) ** 1.5);
        }
      }
    },
  },
  planet: {
    draw(c, L, ctx) {
      const col = hex(L.color), sh = hex(L.shade), ring = hex(L.ring);
      const ringAt = (x, y) => { const e = ((x - L.x) / (L.r * 1.9)) ** 2 + ((y - L.y) / (L.r * 0.42)) ** 2; return e <= 1 && e >= 0.6; };
      // The back half of the ring, the planet, then the front half over it.
      for (let y = L.y - L.r; y <= L.y; y++) for (let x = L.x - L.r * 2; x <= L.x + L.r * 2; x++) if (ringAt(x, y)) c.blend(x, y, ring, 0.7);
      for (let y = -L.r; y <= L.r; y++) for (let x = -L.r; x <= L.r; x++) {
        if (x * x + y * y > L.r * L.r) continue;
        const lit = (x + y * 0.6) / L.r;   // lit from the lower left
        const dark = Math.min(1, Math.max(0, (lit + 0.2) * 0.9 + BAYER[(L.y + y) & 3][(L.x + x) & 3] * 0.35 - 0.15));
        c.put(L.x + x, L.y + y, col.map((v, k) => Math.round(v + (sh[k] - v) * dark)));
        ctx.sky[(L.y + y) * c.w + L.x + x] = 0;
      }
      for (let y = L.y; y <= L.y + L.r; y++) for (let x = L.x - L.r * 2; x <= L.x + L.r * 2; x++) if (ringAt(x, y)) c.blend(x, y, ring, 0.7);
    },
  },
  isles: {
    draw(c, L, ctx) {
      // Floating islands: a flat top with a lighter rim, a jagged rocky underside, maybe a temple of pillars.
      const r = rng(L.seed), col = hex(L.color), cap = hex(L.cap);
      for (const { x, y, w, temple } of L.items) {
        const depth = w * 0.55;
        for (let dx = -w / 2; dx <= w / 2; dx++) {
          const f = 1 - Math.abs(dx) / (w / 2);
          const bottom = y + 2 + depth * f ** 0.8 * (0.75 + r() * 0.25);
          for (let yy = y; yy <= bottom; yy++) { c.put(x + dx, yy, yy < y + 1 ? cap : col); ctx.sky[(yy | 0) * c.w + ((x + dx) | 0)] = 0; }
        }
        if (!temple) continue;
        // A small colonnade: a step, pillars, a beam and a pediment.
        const half = Math.floor(w * 0.3), top = y - 12;
        c.rect(x - half - 1, y - 1, x + half + 1, y - 1, col);
        for (let k = 0; k < temple; k++) {
          const px = Math.round(x - half + k * (2 * half) / (temple - 1));
          c.rect(px, top + 2, px, y - 2, cap);
        }
        c.rect(x - half - 1, top, x + half + 1, top + 1, cap);
        for (let k = 0; k <= 4; k++) c.rect(x - half - 1 + k * 3, top - k - 1, x + half + 1 - k * 3, top - k - 1, k ? col : cap);
        for (let yy = top - 6; yy < y; yy++) for (let xx = x - half - 1; xx <= x + half + 1; xx++) ctx.sky[yy * c.w + xx] = 0;
      }
    },
  },
  eclipse: {
    draw(c, L, ctx) {
      // The moon that never leaves: a black disc in front of the sun.
      const col = hex(L.color);
      for (let y = -L.r; y <= L.r; y++) for (let x = -L.r; x <= L.r; x++) {
        if (x * x + y * y > L.r * L.r) continue;
        c.put(L.x + x, L.y + y, col); ctx.sky[(L.y + y) * c.w + L.x + x] = 0;
      }
    },
    animate(c, L, { t, base }) {
      // Its corona: a pale rim and a violet halo with slowly turning streamers.
      const corona = hex(L.corona), rim = hex(L.rim);
      const R = L.r + 12;
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
        const d = Math.hypot(x, y);
        if (d <= L.r || d > R) continue;
        const px = L.x + x, py = L.y + y;
        if (py < 0 || py >= c.h || px < 0 || px >= c.w || !base.sky[py * c.w + px]) continue;
        const a = Math.atan2(y, x);
        const streak = 0.6 + 0.4 * Math.sin(a * 5 + t * 0.15) * Math.sin(a * 3 - t * 0.1);
        const fall = (1 - (d - L.r) / (R - L.r)) ** 2;
        c.blend(px, py, corona, 0.5 * fall * streak);
        if (d < L.r + 1.5) c.blend(px, py, rim, 0.35 + 0.08 * Math.sin(t * 0.7 + a * 2));
      }
    },
  },
  fortress: {
    draw(c, L, ctx) {
      // A citadel on a crag: a curtain wall between towers of different heights,
      // each with a steep conical roof (or battlements) and a crescent finial.
      const col = hex(L.color), edge = hex(L.edge);
      const { x, base } = L;
      const mark = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(c.h - 1, y1); y++) for (let xx = Math.max(0, x0); xx <= Math.min(c.w - 1, x1); xx++) ctx.sky[y * c.w + xx] = 0; };
      // the crag
      for (let dx = -50; dx <= 50; dx++) {
        const top = base - 2 + Math.round((Math.abs(dx) / 50) ** 1.6 * 12) - (Math.abs(dx) % 7 === 3 ? 1 : 0);
        c.rect(x + dx, top, x + dx, c.h - 1, col); mark(x + dx, top, x + dx, c.h - 1);
      }
      // the curtain wall with crenels
      c.rect(x - 38, base - 14, x + 40, base, col); mark(x - 38, base - 16, x + 40, base);
      for (let k = -38; k <= 40; k += 3) c.put(x + k, base - 15, col);
      L._windows = [];
      for (const [dx, w, h, roof] of L.towers) {
        const x0 = x + dx - (w >> 1), x1 = x0 + w - 1, top = base - h;
        c.rect(x0, top, x1, base, col); mark(x0, top, x1, base);
        c.rect(x0, top, x0, base, edge);
        if (roof) {
          for (let k = 0; k < roof; k++) {
            const half = Math.round(((roof - k) / roof) * (w / 2 + 1));
            const cx = (x0 + x1) / 2;
            c.rect(Math.round(cx - half), top - k, Math.round(cx + half), top - k, col);
            c.put(Math.round(cx - half), top - k, edge);
            mark(Math.round(cx - half), top - k, Math.round(cx + half), top - k);
          }
          // crescent finial
          const fx = Math.round((x0 + x1) / 2), fy = top - roof - 3;
          for (const [px, py] of [[0, 3], [0, 2], [-1, 1], [-1, 0], [0, -1], [1, 1]]) { c.put(fx + px, fy + py, col); mark(fx + px, fy + py, fx + px, fy + py); }
        } else {
          for (let k = x0 - 1; k <= x1 + 1; k += 2) c.put(k, top - 1, col);
          c.rect(x0 - 1, top, x1 + 1, top + 1, col); mark(x0 - 1, top - 1, x1 + 1, top + 1);
        }
        for (let wy = top + 4; wy < base - 6; wy += 7) L._windows.push([Math.round((x0 + x1) / 2), wy]);
      }
    },
    animate(c, L, { t }) {
      const col = hex(L.window);
      L._windows.forEach(([wx, wy], i) => {
        const f = 0.45 + 0.2 * Math.sin(t * (0.9 + i * 0.23) + i * 1.3);
        c.blend(wx, wy, col, f); c.blend(wx, wy + 1, col, f * 0.7);
      });
    },
  },
  cracks: {
    init(L, ctx) {
      // Fissures across the ground: short jagged polylines.
      const r = rng(L.seed);
      L._cracks = Array.from({ length: L.count }, () => {
        let x = r() * ctx.w, y = L.y + 2 + r() * (ctx.h - L.y - 4);
        const pts = [];
        for (let k = 0; k < 10 + r() * 14; k++) { pts.push([x | 0, y | 0]); x += r() < 0.5 ? 1 : 2; y += r() < 0.3 ? 1 : r() < 0.5 ? -1 : 0; y = Math.max(L.y + 1, Math.min(ctx.h - 1, y)); }
        return { pts, p: r() * 6.28 };
      });
    },
    animate(c, L, { t }) {
      const col = hex(L.color);
      for (const { pts, p } of L._cracks) {
        const a = 0.35 + 0.2 * Math.sin(t * 0.8 + p);
        for (const [x, y] of pts) c.blend(x, y, col, a);
      }
    },
  },
  particles: {
    init(L) {
      const r = rng(L.seed);
      L._p = Array.from({ length: L.count }, () => ({ x: r(), y: r(), v: 0.5 + r(), p: r() * 6.28 }));
    },
    animate(c, L, { t }) {
      const col = hex(L.color), alt = L.alt ? hex(L.alt) : col;
      for (const p of L._p) {
        let x, y, a, colr = col;
        if (L.kind === 'snow') {
          y = (p.y * c.h + t * 6 * p.v) % c.h;
          x = (p.x * c.w + Math.sin(t * 0.7 + p.p) * 3 + t * 2) % c.w;
          a = 0.55;
        } else if (L.kind === 'embers') {
          y = c.h - ((p.y * c.h + t * 9 * p.v) % c.h);
          x = (p.x * c.w + Math.sin(t * 1.3 + p.p) * 4) % c.w;
          a = 0.45 + 0.4 * Math.sin(t * 5 + p.p);
          if (Math.sin(t * 3 + p.p * 3) > 0.5) colr = alt;
        } else if (L.kind === 'fireflies') {
          x = (p.x * c.w + Math.sin(t * 0.4 * p.v + p.p) * 10 + c.w) % c.w;
          y = 50 + p.y * 40 + Math.cos(t * 0.5 * p.v + p.p) * 6;
          a = Math.max(0, Math.sin(t * 1.1 * p.v + p.p)) * 0.8;
        } else {
          y = c.h - ((p.y * c.h + t * 3 * p.v) % c.h);
          x = (p.x * c.w + Math.sin(t * 0.5 + p.p) * 5) % c.w;
          a = 0.3 + 0.3 * Math.sin(t * 2 + p.p);
        }
        c.blend(x, y, colr, a);
      }
    },
  },
};

// ---------------------------------------------------------------- scenes

/**
 * Build a scene. `render(t)` returns the frame at time t (seconds) as an
 * RGBA Uint8ClampedArray of BG_WIDTH x BG_HEIGHT, reusing one buffer.
 */
export function createScene(id) {
  const def = BACKGROUNDS[id];
  if (!def) throw new Error(`Unknown background "${id}"`);
  const w = BG_WIDTH, h = BG_HEIGHT;
  const layers = def.layers.map(L => {
    if (!LAYERS[L.type]) throw new Error(`Background "${id}": unknown layer type "${L.type}"`);
    return { ...L };
  });
  const ctx = { w, h, sky: new Uint8Array(w * h).fill(1) };
  const base = new Canvas(w, h);
  for (const L of layers) {
    LAYERS[L.type].init?.(L, ctx);
    LAYERS[L.type].draw?.(base, L, ctx);
  }
  const frame = new Canvas(w, h);
  const animated = layers.filter(L => LAYERS[L.type].animate);
  return {
    id, name: def.name, width: w, height: h,
    render(t = 0) {
      frame.d.set(base.d);
      for (const L of animated) LAYERS[L.type].animate(frame, L, { t, base: ctx });
      return frame.d;
    },
  };
}
