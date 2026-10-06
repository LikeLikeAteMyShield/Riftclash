// The quest screen's backdrop: an adventurers' guild at first light. A big
// notice board crowded with pinned papers (a wanted poster, a route map, a
// dozen scribbled requests) hangs on a plank wall between two lanterns; dawn
// glows through a window, clouds and birds drift past, a warm sunbeam full of
// dust slants across the room, and a packed rucksack waits on the bench below.
//
// Pure JS writing into an RGBA buffer (see src/pixelbuf.js), so
// test/questboard.test.js can check it stays dark and calm.

import { Canvas, BAYER, clamp, hex, rng, hash3 } from './pixelbuf.js';

export const BOARD_H = 160;

/** Width in low-res pixels for a viewport, so the scene fills it without much cropping. */
export function questBoardWidth(viewW, viewH) {
  return clamp(Math.round(BOARD_H * viewW / Math.max(1, viewH)), 120, 360);
}

const C = Object.fromEntries(Object.entries({
  plank: '#2e1e14', plankHi: '#3a2618', plankLo: '#20140c', gap: '#140c08', dark: '#0a0705',
  frame: '#4a3018', frameHi: '#6a4624', frameLo: '#2a1a0c', cork: '#34241a', corkHi: '#3a281c', corkLo: '#2c1e14',
  paper: '#7a6e56', paperHi: '#8e8064', paperLo: '#625842', ink: '#3a2e22', inkRed: '#7a2a1e', inkBlue: '#2a3a5a',
  pinRed: '#c0392b', pinBlue: '#3a6ac0', pinGold: '#d8a83a', wax: '#8a1e1e',
  sky0: '#3a4a7a', sky1: '#a86a6a', sky2: '#f0a868', sun: '#ffe2a0', cloud: '#c88a7a', cloudHi: '#f0c0a0', bird: '#2a1a24',
  sill: '#4a3420', mullion: '#2a1a10', beam: '#ffd8a0', dust: '#ffe8c0',
  iron: '#2a2628', ironHi: '#4a4448', glass: '#3a2a18', flame: '#ffc65a', flameCore: '#fff2c0', glow: '#ff9a48',
  bench: '#3a2414', benchHi: '#5a3a20', canvas: '#5a5038', canvasHi: '#706448', strap: '#3a2414', rope: '#8a7048', ropeLo: '#5a4a30',
  floor: '#1a120c', floorHi: '#24180e',
}).map(([k, v]) => [k, hex(v)]));

// ---------------------------------------------------------------- layout

/** Where everything goes for a given width. Pure and deterministic (tested). */
export function planBoard(W, seed = 5) {
  const r = rng(seed);
  const cx = Math.round(W / 2);
  const floorY = 138;
  const bw = Math.round(Math.min(W - 24, Math.max(110, W * 0.6), 220)), bh = 96;
  const board = { x0: cx - (bw >> 1), x1: cx + (bw >> 1), y0: 16, y1: 16 + bh };
  // A window to the left of the board when there's room for one.
  const window = board.x0 >= 50 ? { x0: Math.max(6, board.x0 - 44), x1: board.x0 - 14, y0: 26, y1: 82 } : null;
  const lanterns = [board.x0 - 7, board.x1 + 7].filter(x => x > 3 && x < W - 4).map((x, i) => ({ x, y: 40, phase: i * 2.3 }));
  // Papers pinned all over the board, some overlapping.
  const papers = [];
  const kinds = ['note', 'note', 'note', 'list', 'wanted', 'map', 'note', 'seal'];
  for (let k = 0; k < Math.round(bw / 15); k++) {
    const kind = k === 1 ? 'wanted' : k === 3 ? 'map' : kinds[Math.floor(r() * kinds.length)];
    const w = kind === 'map' ? 30 : kind === 'wanted' ? 18 : 12 + Math.floor(r() * 10);
    const h = kind === 'map' ? 22 : kind === 'wanted' ? 24 : 10 + Math.floor(r() * 12);
    const x = board.x0 + 4 + Math.floor(r() * Math.max(1, bw - w - 8));
    const y = board.y0 + 4 + Math.floor(r() * Math.max(1, bh - h - 8));
    papers.push({ kind, x, y, w, h, pin: ['pinRed', 'pinBlue', 'pinGold'][Math.floor(r() * 3)], flutter: r() < 0.35, phase: r() * 10, tone: r() });
  }
  const bench = { x0: cx - Math.min(70, W / 2 - 6), x1: cx + Math.min(70, W / 2 - 6), y: floorY - 12 };
  const pack = { x: bench.x1 - 26, y: bench.y };
  return { W, H: BOARD_H, cx, floorY, board, window, lanterns, papers, bench, pack };
}

// ---------------------------------------------------------------- painting (static)

function paintRoom(c, P) {
  const { W, H, floorY } = P;
  // Vertical planks with dark seams and the odd knot.
  for (let y = 0; y < floorY; y++) {
    for (let x = 0; x < W; x++) {
      const plank = Math.floor(x / 9);
      const seam = x % 9 === 0;
      const tone = hash3(plank, Math.floor(y / 30), 2);
      const grain = hash3(x, y >> 2, 4) < 0.08;
      c.put(x, y, seam ? C.gap : grain ? C.plankLo : tone > 0.7 ? C.plankHi : C.plank);
      const edge = Math.abs(x - P.cx) / (W / 2);
      c.blend(x, y, C.dark, clamp(1 - y / 40, 0, 1) * 0.5 + edge * 0.35 + (BAYER[y & 3][x & 3] - 0.5) * 0.05);
    }
  }
  for (let y = floorY; y < H; y++) {
    for (let x = 0; x < W; x++) c.put(x, y, (x + (y >> 1) * 5) % 17 === 0 ? C.floorHi : C.floor);
  }
  c.rect(0, floorY, W - 1, floorY, C.plankHi);
}

function paintWindow(c, P) {
  const w = P.window;
  if (!w) return;
  // Dawn sky: deep blue above, rose, then gold at the horizon.
  for (let y = w.y0; y <= w.y1; y++) {
    const f = (y - w.y0) / (w.y1 - w.y0);
    for (let x = w.x0; x <= w.x1; x++) {
      const d = BAYER[y & 3][x & 3] * 0.12;
      c.put(x, y, C.sky0);
      c.blend(x, y, C.sky1, clamp(f * 1.6 - 0.2 + d, 0, 1));
      c.blend(x, y, C.sky2, clamp(f * 2 - 1.1 + d, 0, 1));
    }
  }
  // Distant hills against the sunrise.
  for (let x = w.x0; x <= w.x1; x++) {
    const hgt = Math.round(5 + Math.sin(x * 0.21) * 2 + Math.sin(x * 0.07 + 1) * 3);
    c.rect(x, w.y1 - hgt, x, w.y1, C.frameLo);
  }
  // Frame, cross mullions and sill.
  const mx = (w.x0 + w.x1) >> 1, my = (w.y0 + w.y1) >> 1;
  c.rect(w.x0 - 2, w.y0 - 2, w.x1 + 2, w.y0 - 1, C.mullion);
  c.rect(w.x0 - 2, w.y0, w.x0 - 1, w.y1, C.mullion);
  c.rect(w.x1 + 1, w.y0, w.x1 + 2, w.y1, C.mullion);
  c.rect(mx, w.y0, mx, w.y1, C.mullion);
  c.rect(w.x0, my, w.x1, my, C.mullion);
  c.rect(w.x0 - 4, w.y1 + 1, w.x1 + 4, w.y1 + 3, C.sill);
  c.rect(w.x0 - 4, w.y1 + 1, w.x1 + 4, w.y1 + 1, C.frameHi);
}

function paintBoard(c, P) {
  const b = P.board;
  // Cork backing, mottled, inside a heavy frame.
  for (let y = b.y0; y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      const n = hash3(x >> 1, y >> 1, 9);
      c.put(x, y, n < 0.25 ? C.corkLo : n > 0.85 ? C.corkHi : C.cork);
    }
  }
  c.rect(b.x0 - 4, b.y0 - 4, b.x1 + 4, b.y0 - 1, C.frame);
  c.rect(b.x0 - 4, b.y1 + 1, b.x1 + 4, b.y1 + 4, C.frame);
  c.rect(b.x0 - 4, b.y0, b.x0 - 1, b.y1, C.frame);
  c.rect(b.x1 + 1, b.y0, b.x1 + 4, b.y1, C.frame);
  c.rect(b.x0 - 4, b.y0 - 4, b.x1 + 4, b.y0 - 4, C.frameHi);
  c.rect(b.x0 - 4, b.y1 + 4, b.x1 + 4, b.y1 + 4, C.frameLo);
  for (const p of P.papers) paintPaper(c, p);
  // A carved sign above: "QUESTS" isn't needed (the page says it); a simple crest plate.
  c.rect(P.cx - 12, b.y0 - 10, P.cx + 12, b.y0 - 5, C.frameHi);
  c.rect(P.cx - 11, b.y0 - 9, P.cx + 11, b.y0 - 6, C.frame);
  for (let k = -8; k <= 8; k += 4) c.put(P.cx + k, b.y0 - 8, C.pinGold);
}

function paintPaper(c, p) {
  const base = p.tone < 0.5 ? C.paper : C.paperLo;
  for (let y = p.y; y < p.y + p.h; y++) {
    for (let x = p.x; x < p.x + p.w; x++) {
      // Torn, uneven bottom edge.
      if (y === p.y + p.h - 1 && hash3(x, y, 1) < 0.4) continue;
      c.put(x, y, x === p.x ? C.paperLo : y === p.y ? C.paperHi : base);
    }
  }
  const ink = p.kind === 'wanted' ? C.inkRed : C.ink;
  if (p.kind === 'map') {
    // A route: dotted line winding to a red X, a little coastline.
    for (let k = 0; k < 20; k++) if (k % 2 === 0) c.put(p.x + 3 + k, p.y + 15 - Math.round(Math.sin(k * 0.45) * 5), C.ink);
    c.put(p.x + 24, p.y + 8, C.inkRed); c.put(p.x + 26, p.y + 8, C.inkRed); c.put(p.x + 25, p.y + 9, C.inkRed);
    c.put(p.x + 24, p.y + 10, C.inkRed); c.put(p.x + 26, p.y + 10, C.inkRed);
    for (let y = 3; y < p.h - 3; y++) c.put(p.x + 4 + Math.round(Math.sin(y * 0.6) * 1.5), p.y + y, C.inkBlue);
  } else if (p.kind === 'wanted') {
    // A sketched face under a heading.
    c.rect(p.x + 3, p.y + 2, p.x + p.w - 4, p.y + 3, ink);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - 3.5, (y - 4) * 0.85);
      if (d > 3.2 && d < 4.3) c.put(p.x + 5 + x, p.y + 6 + y, C.ink);
    }
    c.put(p.x + 7, p.y + 10, C.ink); c.put(p.x + 10, p.y + 10, C.ink); c.rect(p.x + 7, p.y + 13, p.x + 10, p.y + 13, C.ink);
    c.rect(p.x + 4, p.y + p.h - 5, p.x + p.w - 5, p.y + p.h - 5, ink);
  } else {
    // Lines of scribbled writing.
    for (let y = p.y + 3; y < p.y + p.h - 2; y += 2) {
      const len = Math.floor((p.w - 5) * (0.5 + hash3(p.x, y, 3) * 0.5));
      for (let x = 0; x < len; x++) if (hash3(p.x + x, y, 5) > 0.25) c.put(p.x + 2 + x, y, C.ink);
    }
    if (p.kind === 'seal') { c.rect(p.x + p.w - 6, p.y + p.h - 6, p.x + p.w - 3, p.y + p.h - 3, C.wax); }
  }
  // The pin.
  const px = p.x + (p.w >> 1);
  c.put(px, p.y + 1, C[p.pin]); c.put(px + 1, p.y + 1, C[p.pin]); c.put(px, p.y, C[p.pin]);
}

function paintBench(c, P) {
  const { bench, pack } = P;
  c.rect(bench.x0, bench.y, bench.x1, bench.y + 2, C.bench);
  c.rect(bench.x0, bench.y, bench.x1, bench.y, C.benchHi);
  for (const x of [bench.x0 + 4, bench.x1 - 4]) c.rect(x - 1, bench.y + 3, x + 1, P.floorY - 1, C.bench);
  // A packed rucksack: rounded canvas body, a flap with a buckle, a red bedroll strapped on top.
  const { x, y } = pack;
  for (let yy = y - 15; yy < y; yy++) {
    const inset = yy < y - 12 ? y - 12 - yy : 0;
    c.rect(x + inset, yy, x + 14 - inset, yy, C.canvas);
    c.put(x + inset, yy, C.canvasHi); c.put(x + inset + 1, yy, C.canvasHi);
  }
  c.rect(x + 2, y - 12, x + 12, y - 8, C.canvasHi);                  // flap
  c.rect(x + 2, y - 8, x + 12, y - 8, C.strap);
  c.put(x + 7, y - 7, C.pinGold);                                     // buckle
  c.rect(x - 1, y - 20, x + 15, y - 16, C.inkRed);                    // bedroll
  c.rect(x - 1, y - 20, x + 15, y - 20, C.pinRed);
  c.rect(x - 2, y - 19, x - 2, y - 17, C.wax); c.rect(x + 16, y - 19, x + 16, y - 17, C.wax);
  c.rect(x + 3, y - 20, x + 3, y - 16, C.strap); c.rect(x + 11, y - 20, x + 11, y - 16, C.strap);
  // A coil of rope and a rolled map beside it.
  const rx = bench.x0 + 18;
  for (let a = 0; a < Math.PI * 2; a += 0.3) c.put(rx + Math.round(Math.cos(a) * 5), bench.y - 3 + Math.round(Math.sin(a) * 2.5), C.rope);
  for (let a = 0; a < Math.PI * 2; a += 0.4) c.put(rx + Math.round(Math.cos(a) * 3), bench.y - 3 + Math.round(Math.sin(a) * 1.5), C.ropeLo);
  c.rect(rx + 12, bench.y - 3, rx + 30, bench.y - 1, C.paperLo); c.rect(rx + 12, bench.y - 3, rx + 30, bench.y - 3, C.paper);
  c.rect(rx + 20, bench.y - 3, rx + 21, bench.y - 1, C.inkRed);
}

function paintLanterns(c, P) {
  for (const l of P.lanterns) {
    c.rect(l.x, 0, l.x, l.y - 7, C.iron);                    // chain
    c.rect(l.x - 3, l.y - 6, l.x + 3, l.y - 5, C.ironHi);
    c.rect(l.x - 3, l.y - 4, l.x + 3, l.y + 3, C.glass);
    c.rect(l.x - 3, l.y - 4, l.x - 3, l.y + 3, C.iron); c.rect(l.x + 3, l.y - 4, l.x + 3, l.y + 3, C.iron);
    c.rect(l.x - 4, l.y + 4, l.x + 4, l.y + 4, C.ironHi);
  }
}

// ---------------------------------------------------------------- animation

function sky(c, P, t) {
  const w = P.window;
  if (!w) return;
  // The sun just over the hills, breathing slowly; clouds drift; a few birds cross.
  const sx = Math.round(w.x0 + (w.x1 - w.x0) * 0.62), sy = w.y1 - 9;
  c.halo(sx, sy, 14, C.sun, 0.35 + Math.sin(t * 0.4) * 0.05);
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9 && sy + y < w.y1 - 4) c.put(sx + x, sy + y, C.sun);
  const span = w.x1 - w.x0 + 30;
  for (let k = 0; k < 3; k++) {
    const cxl = w.x0 - 15 + ((t * (1.2 + k * 0.5) + k * 17) % span);
    const cy = w.y0 + 8 + k * 9;
    for (let x = 0; x < 12 - k * 2; x++) {
      const px = Math.round(cxl + x);
      if (px <= w.x0 || px >= w.x1 || px === ((w.x0 + w.x1) >> 1)) continue;
      c.put(px, cy, C.cloud);
      if (x > 2 && x < 9 - k * 2) c.put(px, cy - 1, C.cloudHi);
    }
  }
  const birdT = t % 14;
  if (birdT < 7) {
    for (let k = 0; k < 3; k++) {
      const bx = Math.round(w.x1 - (birdT / 7) * (w.x1 - w.x0) + k * 4), by = w.y0 + 14 + k * 2 + Math.round(Math.sin(t * 2 + k) * 1);
      if (bx <= w.x0 || bx >= w.x1) continue;
      const flap = Math.floor(t * 6 + k) % 2;
      c.put(bx, by, C.bird); c.put(bx - 1, by - flap, C.bird); c.put(bx + 1, by - flap, C.bird);
    }
  }
}

function sunbeam(c, P, t) {
  const w = P.window;
  if (!w) return;
  // Warm light slanting from the window down across the board and bench.
  for (let y = w.y0; y < P.floorY; y++) {
    const k = (y - w.y0) / (P.floorY - w.y0);
    const x0 = w.x0 + k * 70, x1 = w.x1 + k * 95;
    for (let x = Math.floor(x0); x <= x1; x++) {
      const across = 1 - Math.abs((x - x0) / (x1 - x0) * 2 - 1);
      c.add(x, y, C.beam, (0.035 + across * 0.05) * (1 - k * 0.6) * (0.9 + Math.sin(t * 0.4) * 0.1) + (BAYER[y & 3][x & 3] - 0.5) * 0.012);
    }
  }
  for (let k = 0; k < 22; k++) {
    const life = (t * (0.04 + (k % 4) * 0.012) + k * 0.137) % 1;
    const y = w.y0 + life * (P.floorY - w.y0);
    const kk = life;
    const x0 = w.x0 + kk * 70, x1 = w.x1 + kk * 95;
    const x = x0 + ((k * 0.618 + Math.sin(t * 0.3 + k) * 0.06) % 1) * (x1 - x0);
    c.add(x, y, C.dust, 0.2 + 0.15 * Math.sin(t * 1.2 + k));
  }
}

function flutter(c, P, t) {
  // A breeze from the window lifts the loose corners of some papers.
  for (const p of P.papers) {
    if (!p.flutter) continue;
    const lift = Math.sin(t * 1.7 + p.phase) > 0.55 ? 1 : 0;
    if (!lift) continue;
    const x = p.x + p.w - 1, y = p.y + p.h - 1;
    c.put(x, y, C.corkLo); c.put(x - 1, y, C.corkLo); c.put(x, y - 1, C.corkLo);
    c.put(x - 1, y - 2, C.paperHi); c.put(x - 2, y - 1, C.paperHi); c.put(x - 1, y - 1, C.paperHi);
  }
}

function lanterns(c, P, t) {
  for (const l of P.lanterns) {
    const f = Math.sin(t * 6.1 + l.phase) * 0.5 + Math.sin(t * 11.3 + l.phase * 2) * 0.3;
    c.halo(l.x, l.y, 24 + f * 2, C.glow, 0.24);
    c.put(l.x, l.y - 1, f > 0.3 ? C.flame : C.flameCore);
    c.put(l.x, l.y, C.flameCore);
    c.put(l.x, l.y + 1, C.flame);
    if (f > 0) c.put(l.x, l.y - 2, C.flame);
  }
}

// ---------------------------------------------------------------- scene

/**
 * Build the quest board for a width. `render(t)` returns the frame at time t
 * (seconds) as an RGBA buffer of width x BOARD_H, reusing one buffer.
 */
export function createQuestBoard(W, seed = 5) {
  const P = planBoard(W, seed);
  const base = new Canvas(W, BOARD_H);
  paintRoom(base, P);
  paintWindow(base, P);
  paintBoard(base, P);
  paintBench(base, P);
  paintLanterns(base, P);
  const frame = new Canvas(W, BOARD_H);
  return {
    width: W, height: BOARD_H, plan: P,
    render(t = 0) {
      frame.d.set(base.d);
      sky(frame, P, t);
      flutter(frame, P, t);
      sunbeam(frame, P, t);
      lanterns(frame, P, t);
      return frame.d;
    },
  };
}
