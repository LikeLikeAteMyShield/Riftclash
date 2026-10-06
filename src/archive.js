// The card library's backdrop: an ancient archive at night. Towering shelves
// of books flank a tall moonlit window; candles burn on the shelves, on iron
// candelabras and floating in the air; a rune circle turns slowly beneath a
// floating tome, and motes of magic drift up through the dark.
//
// Like the battle backgrounds, it is pure JS writing into an RGBA buffer (no
// DOM), so test/archive.test.js can check it stays dark and calm. The static
// hall is painted once; candles, motes and glows are drawn each frame as pure
// functions of time.

import { Canvas, BAYER, clamp, hex, rng } from './pixelbuf.js';

export const ARCHIVE_H = 160;

/** Width in low-res pixels for a viewport, so the scene fills it without much cropping. */
export function archiveWidth(viewW, viewH) {
  return clamp(Math.round(ARCHIVE_H * viewW / Math.max(1, viewH)), 120, 360);
}

const C = Object.fromEntries(Object.entries({
  wall: '#1a1420', wallHi: '#221a28', mortar: '#120e16', vault: '#0c0910',
  pillar: '#221a28', pillarHi: '#2e2436', pillarLo: '#140f18', rune: '#3ac8b8',
  wood: '#34200f', woodHi: '#523418', woodLo: '#1e1209', back: '#120c0a',
  floor: '#141016', floorLine: '#0c090e', floorHi: '#1e1820',
  glass: '#18263e', glassHi: '#2a4466', lead: '#0a080e', moon: '#a8c4dc',
  wax: '#d8ccb0', waxLo: '#9a8c72', iron: '#2a2630', ironHi: '#4a4450',
  flameCore: '#fff6c8', flame: '#ffc65a', flameOut: '#ff8a2a', glow: '#ff9a40',
  gold: '#8a6a2a', paper: '#cfc2a0', paperLo: '#9a8e70', cover: '#4a1e22', tomeGlow: '#7af0e0',
  mote1: '#7af0e0', mote2: '#b48cff', mote3: '#ffe08a', beam: '#6a8cb8', dust: '#c8d8f0',
}).map(([k, v]) => [k, hex(v)]));

const BOOKS = ['#4a2224', '#23402f', '#22324e', '#40301c', '#33243f', '#4a3e22', '#262226', '#56301e', '#1f3a40', '#3c1a2c'].map(hex);

// ---------------------------------------------------------------- layout

/**
 * Where everything goes for a given width: the window in the middle, a
 * pillar either side of it, then bookshelf bays and pillars out to the edges.
 * Pure and deterministic (tested).
 */
export function planArchive(W, seed = 1) {
  const r = rng(seed);
  const H = ARCHIVE_H, floorY = 128, topY = 18;
  const cx = Math.round(W / 2);
  const win = { x0: cx - 13, x1: cx + 13, top: 14, bottom: 84 };
  const pillarW = 8;
  const pillars = [];
  const bays = [];
  // Pillars flank the window, then repeat outward every bay.
  const bayW = 52;
  for (const dir of [-1, 1]) {
    let edge = dir < 0 ? win.x0 - 4 : win.x1 + 4;          // inner face of the first pillar
    for (;;) {
      const px = dir < 0 ? edge - pillarW : edge;
      pillars.push({ x0: px, x1: px + pillarW - 1 });
      const bx0 = dir < 0 ? px - bayW : px + pillarW, bx1 = bx0 + bayW - 1;
      if (bx1 < -bayW || bx0 > W + bayW) break;
      bays.push({ x0: bx0, x1: bx1, top: topY, bottom: floorY });
      edge = dir < 0 ? bx0 : bx1 + 1;
      if ((dir < 0 && edge < -pillarW) || (dir > 0 && edge > W + pillarW)) break;
    }
  }
  const shelves = [36, 54, 72, 90, 108, 126];
  // Candles on some shelves; candelabras either side of the rune circle; candles floating overhead.
  const candles = [];
  for (const b of bays) {
    for (const sy of shelves) {
      if (r() < 0.22) {
        const x = Math.round(b.x0 + 4 + r() * (b.x1 - b.x0 - 8));
        if (x > 1 && x < W - 2) candles.push({ kind: 'shelf', x, y: sy - 1, h: 3 + Math.floor(r() * 3), phase: r() * 10 });
      }
    }
  }
  const stands = [cx - 44, cx + 44].filter(x => x > 4 && x < W - 4).map(x => ({ x, y: floorY + 2 }));
  for (const s of stands) for (const dx of [-4, 0, 4]) candles.push({ kind: 'stand', x: s.x + dx, y: s.y - 30 - (dx ? 0 : 3), h: 4, phase: r() * 10 });
  const floating = Math.max(5, Math.round(W / 34));
  for (let k = 0; k < floating; k++) {
    candles.push({ kind: 'float', x: Math.round((k + 0.5 + (r() - 0.5) * 0.6) * W / floating), y: Math.round(22 + r() * 34), h: 5 + Math.floor(r() * 3), phase: r() * 10 });
  }
  const books = [];
  for (const b of bays) {
    for (let s = 0; s < shelves.length; s++) {
      const sy = shelves[s], prev = s ? shelves[s - 1] : b.top + 2;
      let x = b.x0 + 2;
      while (x < b.x1 - 2) {
        const w = 2 + Math.floor(r() * 3);
        if (x + w > b.x1 - 1) break;
        if (r() < 0.08) { x += 2 + Math.floor(r() * 4); continue; }            // a gap
        const hgt = Math.min(sy - prev - 3, 8 + Math.floor(r() * 7));
        books.push({ x, w, y: sy - 1, h: hgt, color: Math.floor(r() * BOOKS.length), band: r() < 0.5, lean: r() < 0.05 });
        x += w + (r() < 0.15 ? 1 : 0);
      }
    }
  }
  return { W, H, floorY, topY, cx, win, pillars, bays, shelves, candles, stands, books, circle: { x: cx, y: 143, rx: 34, ry: 6 }, tome: { x: cx, y: 116 } };
}

// ---------------------------------------------------------------- painting

function paintHall(c, P) {
  const { W, H, floorY } = P;
  // Back wall: stone blocks, darkening up into the vault.
  for (let y = 0; y < floorY; y++) {
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 7), off = row % 2 ? 6 : 0;
      const mortar = y % 7 === 0 || (x + off) % 12 === 0;
      const base = mortar ? C.mortar : ((x * 7 + row * 13) % 5 === 0 ? C.wallHi : C.wall);
      const dark = clamp(1 - y / 60, 0, 1) * 0.7;
      c.put(x, y, base);
      c.blend(x, y, C.vault, dark + BAYER[y & 3][x & 3] * 0.1);
    }
  }
  // Floor: flagstones in rough perspective.
  for (let y = floorY; y < H; y++) {
    const depth = (y - floorY) / (H - floorY);
    const rowH = 3 + Math.floor(depth * 8);
    for (let x = 0; x < W; x++) {
      const k = Math.floor((y - floorY) / rowH);
      const tileW = 10 + depth * 18;
      const xs = (x - P.cx) / tileW + (k % 2) * 0.5;
      const line = (y - floorY) % rowH === 0 || Math.abs(xs - Math.round(xs)) < 0.5 / tileW;
      c.put(x, y, line ? C.floorLine : ((x + y * 3) % 11 === 0 ? C.floorHi : C.floor));
    }
  }
  for (let x = 0; x < W; x++) c.put(x, floorY, C.floorHi);
}

function paintWindow(c, P) {
  const { win } = P;
  const mid = (win.x0 + win.x1) / 2, half = (win.x1 - win.x0) / 2;
  for (let y = win.top; y <= win.bottom; y++) {
    for (let x = win.x0 - 2; x <= win.x1 + 2; x++) {
      // A pointed (lancet) arch: the sides curve in toward the top.
      const archH = 16;
      let inside = Math.abs(x - mid) <= half;
      if (y < win.top + archH) {
        const k = (win.top + archH - y) / archH;
        inside = Math.abs(x - mid) <= half * Math.sqrt(1 - k * k) - k * 2;
      }
      const frame = !inside && (Math.abs(x - mid) <= half + 2) && (y >= win.top + 6 || Math.abs(x - mid) <= half * 0.6);
      if (frame) { c.put(x, y, C.pillarHi); continue; }
      if (!inside) continue;
      // Glass: brighter toward the moon in the upper right; diamond leading and a central mullion.
      const moon = Math.max(0, 1 - Math.hypot(x - (mid + 5), y - (win.top + 18)) / 22);
      c.put(x, y, C.glass);
      c.blend(x, y, C.glassHi, 0.2 + moon * 0.8 + (BAYER[y & 3][x & 3] - 0.5) * 0.12);
      const lead = (x - mid + y) % 9 === 0 || (x - mid - y) % 9 === 0 || Math.abs(x - mid) < 0.6 || y === win.top + 40;
      if (lead) c.put(x, y, C.lead);
    }
  }
  // The moon itself, through the glass.
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) c.put(mid + 5 + x, win.top + 18 + y, x + y < 0 ? C.moon : C.dust);
  // Sill.
  c.rect(win.x0 - 3, win.bottom + 1, win.x1 + 3, win.bottom + 2, C.pillarHi);
  c.rect(win.x0 - 3, win.bottom + 3, win.x1 + 3, win.bottom + 3, C.pillarLo);
}

function paintPillars(c, P) {
  for (const p of P.pillars) {
    for (let y = 0; y < P.floorY; y++) {
      for (let x = p.x0; x <= p.x1; x++) {
        const edgeL = x === p.x0, edgeR = x === p.x1;
        c.put(x, y, edgeL ? C.pillarHi : edgeR ? C.pillarLo : C.pillar);
        c.blend(x, y, C.vault, clamp(1 - y / 50, 0, 1) * 0.6);
      }
    }
    // Base and capital.
    c.rect(p.x0 - 1, P.floorY - 4, p.x1 + 1, P.floorY - 1, C.pillarHi);
    c.rect(p.x0 - 1, 16, p.x1 + 1, 17, C.pillarLo);
  }
}

function paintShelves(c, P) {
  for (const b of P.bays) {
    // Dark interior, side posts, cornice.
    c.rect(b.x0, b.top, b.x1, b.bottom, C.back);
    c.rect(b.x0, b.top, b.x0 + 1, b.bottom, C.woodLo);
    c.rect(b.x1 - 1, b.top, b.x1, b.bottom, C.woodLo);
    c.rect(b.x0 - 1, b.top - 3, b.x1 + 1, b.top, C.wood);
    c.rect(b.x0 - 1, b.top - 3, b.x1 + 1, b.top - 3, C.woodHi);
    for (const sy of P.shelves) {
      c.rect(b.x0, sy, b.x1, sy + 1, C.wood);
      c.rect(b.x0, sy, b.x1, sy, C.woodHi);
    }
  }
  for (const bk of P.books) {
    const col = BOOKS[bk.color];
    const lo = col.map(v => v * 0.7), hi = col.map(v => Math.min(255, v * 1.3));
    for (let y = bk.y - bk.h + 1; y <= bk.y; y++) {
      for (let x = 0; x < bk.w; x++) {
        const lean = bk.lean ? Math.floor((bk.y - y) / 4) : 0;
        c.put(bk.x + x + lean, y, x === 0 ? lo : x === bk.w - 1 && bk.w > 2 ? hi : col);
      }
    }
    if (bk.band) for (let x = 0; x < bk.w; x++) c.put(bk.x + x, bk.y - bk.h + 3, C.gold);
  }
  // Dusk inside the shelves: the upper shelves fade into the dark of the vault.
  for (const b of P.bays) {
    for (let y = b.top; y <= b.bottom; y++) {
      const a = clamp(1 - (y - b.top) / 50, 0, 1) * 0.55;
      for (let x = b.x0; x <= b.x1; x++) c.blend(x, y, C.vault, a);
    }
  }
}

function paintStands(c, P) {
  for (const s of P.stands) {
    c.rect(s.x, s.y - 30, s.x, s.y - 1, C.iron);
    c.rect(s.x - 3, s.y - 1, s.x + 3, s.y, C.iron);
    c.rect(s.x - 4, s.y - 27, s.x + 4, s.y - 27, C.ironHi);
    c.put(s.x - 4, s.y - 28, C.iron); c.put(s.x + 4, s.y - 28, C.iron);
  }
}

function paintBeam(c, P) {
  // A shaft of moonlight from the window, slanting down to the floor.
  const { win, floorY } = P;
  for (let y = win.bottom - 30; y < floorY + 14; y++) {
    const k = (y - (win.bottom - 30)) / (floorY + 14 - win.bottom + 30);
    const x0 = win.x0 + 2 - k * 30, x1 = win.x1 - 2 - k * 18;
    // Brightest in the middle of the shaft, fading at its edges and toward the floor.
    for (let x = Math.floor(x0); x <= x1; x++) {
      const across = 1 - Math.abs((x - x0) / (x1 - x0) * 2 - 1);
      c.blend(x, y, C.beam, (0.05 + across * 0.09) * (1 - k * 0.5) + (BAYER[y & 3][x & 3] - 0.5) * 0.02);
    }
  }
}

// ---------------------------------------------------------------- animation

function flameAt(c, x, y, h, t, phase) {
  // Flicker: height and lean wobble, the core stays put.
  const f = Math.sin(t * 7.3 + phase) * 0.5 + Math.sin(t * 13.1 + phase * 2) * 0.3;
  const lean = Math.round(Math.sin(t * 2.1 + phase) * 0.6);
  const tall = 2 + (f > 0.2 ? 1 : 0);
  c.halo(x, y - 2, 10 + f, C.glow, 0.3);
  c.put(x + lean, y - tall, C.flameOut);
  c.put(x, y - 1, C.flame);
  c.put(x, y, C.flameCore);
  if (tall > 2) c.put(x + lean, y - 2, C.flame);
}

function candle(c, cd, t) {
  let { x, y } = cd;
  if (cd.kind === 'float') {
    y += Math.round(Math.sin(t * 0.7 + cd.phase) * 2);
    x += Math.round(Math.sin(t * 0.31 + cd.phase * 1.7) * 1);
  }
  // Wax (with a drip) then the flame above the wick.
  for (let k = 0; k < cd.h; k++) { c.put(x, y - k, k === cd.h - 1 ? C.wax : C.waxLo); }
  if (cd.kind !== 'shelf') c.put(x + 1, y - cd.h + 2, C.wax);
  c.put(x, y - cd.h, C.lead);
  flameAt(c, x, y - cd.h - 1, cd.h, t, cd.phase);
}

function motes(c, P, t) {
  const { W, H } = P;
  const n = Math.round(W / 4);
  for (let k = 0; k < n; k++) {
    // Each mote rises slowly on its own loop, swaying, and twinkles.
    const sx = ((k * 73.13) % 1 + (k * 0.618034) % 1) % 1;
    const speed = 3 + (k % 5);
    const span = H + 20;
    const y = H + 10 - ((t * speed + k * 37.7) % span);
    const x = sx * W + Math.sin(t * 0.6 + k) * 4;
    const tw = Math.sin(t * 2 + k * 1.3) * 0.5 + 0.5;
    const col = [C.mote1, C.mote2, C.mote3][k % 3];
    c.add(x, y, col, 0.35 + tw * 0.45);
    if (tw > 0.85) { c.add(x + 1, y, col, 0.2); c.add(x - 1, y, col, 0.2); c.add(x, y - 1, col, 0.2); c.add(x, y + 1, col, 0.2); }
  }
}

function dust(c, P, t) {
  // Specks drifting down through the moonbeam.
  const { win, floorY } = P;
  for (let k = 0; k < 18; k++) {
    const span = floorY - win.bottom + 30;
    const y = win.bottom - 30 + ((t * (1.2 + (k % 4) * 0.4) + k * 11.3) % span);
    const kk = (y - (win.bottom - 30)) / (span + 14);
    const x0 = win.x0 + 2 - kk * 30, x1 = win.x1 - 2 - kk * 18;
    const x = x0 + ((k * 0.381966 + Math.sin(t * 0.4 + k) * 0.05) % 1) * (x1 - x0);
    c.add(x, y, C.dust, 0.18 + 0.12 * Math.sin(t * 1.5 + k));
  }
}

function runes(c, P, t) {
  // Faint glyphs on the pillars, breathing in and out at different times.
  for (const [i, p] of P.pillars.entries()) {
    const a = (Math.sin(t * 0.5 + i * 1.7) * 0.5 + 0.5) * 0.35;
    const x = Math.round((p.x0 + p.x1) / 2);
    for (const y of [40, 41, 43, 44, 45, 47, 60, 61, 62, 64, 66, 67]) c.add(x + ((y * 7) % 3) - 1, y, C.rune, a);
  }
  // The floor circle: an ellipse of glyph dots turning slowly, with a soft glow.
  const { x, y, rx, ry } = P.circle;
  const pulse = Math.sin(t * 0.8) * 0.5 + 0.5;
  for (let a = 0; a < Math.PI * 2; a += 0.05) c.add(x + Math.cos(a) * rx, y + Math.sin(a) * ry, C.rune, 0.18 + pulse * 0.1);
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2 + t * 0.12;
    c.add(x + Math.cos(a) * (rx - 4), y + Math.sin(a) * (ry - 1), C.rune, 0.45 + pulse * 0.2);
  }
}

function tome(c, P, t) {
  // An open book floating above the circle, pages glowing.
  const x = P.tome.x, y = P.tome.y + Math.round(Math.sin(t * 0.9) * 2);
  c.halo(x, y - 2, 16, C.tomeGlow, 0.12 + Math.sin(t * 0.8) * 0.04);
  c.rect(x - 7, y, x + 7, y + 1, C.cover);
  for (let k = 0; k <= 6; k++) {
    const sag = k > 4 ? 1 : 0;
    c.put(x - 1 - k, y - 1 + sag - (k < 2 ? 1 : 0), C.paper);
    c.put(x + 1 + k, y - 1 + sag - (k < 2 ? 1 : 0), C.paper);
    c.put(x - 1 - k, y + (k < 2 ? -1 : 0), C.paperLo);
    c.put(x + 1 + k, y + (k < 2 ? -1 : 0), C.paperLo);
  }
  c.put(x, y, C.cover);
  // Glyphs lifting off the pages.
  for (let k = 0; k < 5; k++) {
    const life = (t * 0.35 + k / 5) % 1;
    c.add(x + Math.sin(k * 2.3 + t * 0.7) * 5, y - 3 - life * 18, C.mote1, (1 - life) * 0.7);
  }
}

// ---------------------------------------------------------------- scene

/**
 * Build the archive for a width. `render(t)` returns the frame at time t
 * (seconds) as an RGBA buffer of width x ARCHIVE_H, reusing one buffer.
 */
export function createArchive(W, seed = 1) {
  const P = planArchive(W, seed);
  const base = new Canvas(W, ARCHIVE_H);
  paintHall(base, P);
  paintWindow(base, P);
  paintShelves(base, P);
  paintPillars(base, P);
  paintStands(base, P);
  paintBeam(base, P);
  const frame = new Canvas(W, ARCHIVE_H);
  return {
    width: W, height: ARCHIVE_H, plan: P,
    render(t = 0) {
      frame.d.set(base.d);
      runes(frame, P, t);
      dust(frame, P, t);
      tome(frame, P, t);
      for (const cd of P.candles) candle(frame, cd, t);
      motes(frame, P, t);
      return frame.d;
    },
  };
}
