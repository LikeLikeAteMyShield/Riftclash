// The deck builder's backdrop: a blacksmith's forge at night. A great stone
// hearth roars under its hood, breathing brighter each time the bellows pump;
// sparks fly up the chimney; an enchanted hammer rises over the anvil on its
// own and rings down on a glowing blade; steam curls off the quench barrel,
// and weapons on the walls catch the firelight.
//
// Pure JS writing into an RGBA buffer (see src/pixelbuf.js), so
// test/forge.test.js can check it stays dark enough and moves gently.

import { Canvas, BAYER, clamp, hex, rng, hash3 } from './pixelbuf.js';

export const FORGE_H = 160;
export const BELLOWS_PERIOD = 6;    // seconds per pump: every other bar of the forge music
export const HAMMER_PERIOD = 3;     // seconds per hammer blow: one bar of the forge music (80 BPM)
export const HAMMER_STRIKE = 0.86;  // when in its cycle the hammer lands (0..1)
/**
 * Scene time at the start of the forge music: with it, the hammer lands on the
 * first beat of every bar (the anvil in the song) and the bellows press as
 * the song's bellows breathe.
 */
export const MUSIC_OFFSET = HAMMER_STRIKE * HAMMER_PERIOD;
const pumpPhase = t => ((((t - MUSIC_OFFSET) % BELLOWS_PERIOD) + BELLOWS_PERIOD) % BELLOWS_PERIOD) / BELLOWS_PERIOD;

/** Width in low-res pixels for a viewport, so the scene fills it without much cropping. */
export function forgeWidth(viewW, viewH) {
  return clamp(Math.round(FORGE_H * viewW / Math.max(1, viewH)), 120, 360);
}

const C = Object.fromEntries(Object.entries({
  wall: '#221a18', wallHi: '#2c2220', wallLo: '#16100f', mortar: '#120c0b', dark: '#0a0707',
  beam: '#2e1c10', beamHi: '#4a2e18', beamLo: '#1a0f08',
  brick: '#3a2420', brickHi: '#4c3028', brickLo: '#241513', soot: '#120b0a',
  hood: '#2a201e', hoodHi: '#382a26',
  floor: '#1a1311', floorHi: '#241a16', floorLo: '#120d0b',
  iron: '#383842', ironHi: '#767684', ironLo: '#1c1c24', steel: '#8a90a0',
  wood: '#3a2414', woodHi: '#5a3a20', woodLo: '#22140a', leather: '#3a2418', leatherHi: '#56361f',
  band: '#26262c', water: '#14202a', waterHi: '#2a4050',
  coal0: '#3a0e06', coal1: '#8a2008', coal2: '#d8480e', coal3: '#ff8a26', coal4: '#ffd27a',
  flameCore: '#fff2b0', flame: '#ffb040', flameOut: '#ff6a1a', flameTip: '#c0300c',
  glow: '#ff7a28', spark: '#ffd27a', sparkHot: '#fff6d0',
  handle: '#6a4424', handleHi: '#8e6234', rune: '#5ae8ff', steam: '#8a8a90', blade: '#ff6a24', bladeHot: '#ffd890', gold: '#9a7430', red: '#5a1a14', blue: '#1e2e4a',
}).map(([k, v]) => [k, hex(v)]));

// ---------------------------------------------------------------- layout

/** Where everything goes for a given width. Pure and deterministic (tested). */
export function planForge(W, seed = 3) {
  const r = rng(seed);
  const cx = Math.round(W / 2);
  const floorY = 120;
  const hx = cx - 10;                                   // the hearth sits a little left of centre
  const hearth = { x: hx, x0: hx - 24, x1: hx + 24, top: 52, mouth: { x0: hx - 13, x1: hx + 13, top: 74, bed: 100 } };
  const hood = { x: hx, top: 16, bottom: 52, w0: 60, w1: 20 };
  const bellows = { x: hx - 40, y: floorY - 2 };
  const anvil = { x: cx + 44, y: 132 };                 // top face of the anvil, in front of the hearth
  const barrel = cx - 64 >= 10 ? { x: cx - 64, y: 126 } : null;   // no room for it on narrow screens
  const posts = [];
  for (let k = 1; cx + k * 86 - 40 < W + 6; k++) { posts.push(cx + k * 86 - 40); posts.push(cx - k * 86 - 40); }
  // Weapons hang on the walls wherever there's room: away from the hearth and the posts.
  const racks = [];
  const kinds = ['sword', 'axe', 'shield', 'sword', 'spear', 'hammer', 'shield'];
  for (let x = 6; x < W - 6; x += 11 + Math.floor(r() * 5)) {
    if (x > hearth.x0 - 30 && x < hearth.x1 + 8) continue;
    if (posts.some(p => Math.abs(p + 2 - x) < 9)) continue;
    racks.push({ x, y: 40 + Math.floor(r() * 10), kind: kinds[Math.floor(r() * kinds.length)], tone: r() });
  }
  return { W, H: FORGE_H, cx, floorY, hearth, hood, bellows, anvil, barrel, posts, racks };
}

// ---------------------------------------------------------------- painting (static)

function paintRoom(c, P) {
  const { W, H, floorY } = P;
  // Rough stone wall, darker toward the rafters and the edges.
  for (let y = 0; y < floorY; y++) {
    const row = Math.floor(y / 6), off = (row * 7) % 11;
    for (let x = 0; x < W; x++) {
      const col = Math.floor((x + off) / 11);
      const mortar = y % 6 === 0 || (x + off) % 11 === 0;
      const tone = hash3(col, row, 7);
      c.put(x, y, mortar ? C.mortar : tone < 0.3 ? C.wallLo : tone > 0.8 ? C.wallHi : C.wall);
      const edge = Math.abs(x - P.cx) / (W / 2);
      c.blend(x, y, C.dark, clamp(1 - y / 70, 0, 1) * 0.6 + edge * 0.25 + (BAYER[y & 3][x & 3] - 0.5) * 0.06);
    }
  }
  // Packed earth floor with flagstones.
  for (let y = floorY; y < H; y++) {
    const depth = (y - floorY) / (H - floorY);
    for (let x = 0; x < W; x++) {
      const tw = 9 + depth * 16, th = 3 + Math.floor(depth * 7);
      const k = Math.floor((y - floorY) / th);
      const xs = (x - P.cx) / tw + (k % 2) * 0.5;
      const line = (y - floorY) % th === 0 || Math.abs(xs - Math.round(xs)) < 0.5 / tw;
      c.put(x, y, line ? C.floorLo : hash3(x >> 2, y >> 1, 3) < 0.15 ? C.floorHi : C.floor);
    }
  }
  // Rafters and posts.
  c.rect(0, 9, W - 1, 13, C.beam); c.rect(0, 9, W - 1, 9, C.beamHi); c.rect(0, 13, W - 1, 13, C.beamLo);
  for (const x of P.posts) { c.rect(x, 0, x + 4, floorY, C.beam); c.rect(x, 0, x, floorY, C.beamHi); c.rect(x + 4, 0, x + 4, floorY, C.beamLo); }
}

function paintHearth(c, P) {
  const { hearth: h, hood } = P;
  // Hood: a stone funnel up into the chimney.
  for (let y = 0; y <= hood.bottom; y++) {
    const k = clamp((y - hood.top) / (hood.bottom - hood.top), 0, 1);
    const half = (hood.w1 + (hood.w0 - hood.w1) * k) / 2;
    for (let x = Math.floor(hood.x - half); x <= hood.x + half; x++) {
      const edge = x - (hood.x - half) < 1.5 ? C.hoodHi : (hood.x + half) - x < 1.5 ? C.wallLo : C.hood;
      c.put(x, y, edge);
      if (y % 7 === 0 && y > hood.top) c.put(x, y, C.mortar);
    }
  }
  c.rect(hood.x - hood.w0 / 2 - 1, hood.bottom - 2, hood.x + hood.w0 / 2 + 1, hood.bottom, C.hoodHi);
  // Brick body.
  for (let y = h.top; y < P.floorY; y++) {
    for (let x = h.x0; x <= h.x1; x++) {
      const row = Math.floor((y - h.top) / 4), off = row % 2 ? 3 : 0;
      const mortar = (y - h.top) % 4 === 0 || (x + off - h.x0) % 7 === 0;
      const tone = hash3(Math.floor((x + off) / 7), row, 11);
      c.put(x, y, mortar ? C.brickLo : tone > 0.75 ? C.brickHi : C.brick);
    }
  }
  // The mouth: a rounded arch, soot-blackened inside, with a stone lip.
  const m = h.mouth;
  const mid = (m.x0 + m.x1) / 2, half = (m.x1 - m.x0) / 2;
  for (let y = m.top; y <= m.bed + 4; y++) {
    for (let x = m.x0 - 2; x <= m.x1 + 2; x++) {
      const archY = m.top + 8 - Math.sqrt(Math.max(0, 1 - ((x - mid) / half) ** 2)) * 8;
      if (Math.abs(x - mid) <= half && y >= archY) c.put(x, y, C.soot);
      else if (Math.abs(x - mid) <= half + 2 && y >= archY - 2) c.put(x, y, C.brickHi);
    }
  }
  c.rect(m.x0 - 3, m.bed + 5, m.x1 + 3, m.bed + 7, C.brickHi);
  c.rect(m.x0 - 3, m.bed + 7, m.x1 + 3, m.bed + 7, C.brickLo);
}

function paintRacks(c, P) {
  for (const w of P.racks) {
    const { x, y } = w;
    c.put(x, y - 2, C.ironHi);                                    // peg
    if (w.kind === 'sword') {
      c.rect(x, y, x, y + 22, C.steel); c.rect(x + 1, y, x + 1, y + 21, C.ironHi);
      c.rect(x - 2, y + 22, x + 3, y + 22, C.gold); c.rect(x, y + 23, x + 1, y + 27, C.woodLo); c.put(x, y + 28, C.gold);
    } else if (w.kind === 'axe') {
      c.rect(x, y, x, y + 26, C.wood);
      c.rect(x + 1, y + 1, x + 4, y + 6, C.iron); c.rect(x + 4, y, x + 5, y + 7, C.steel);
    } else if (w.kind === 'spear') {
      c.rect(x, y - 6, x, y + 30, C.wood);
      c.rect(x - 1, y - 10, x + 1, y - 7, C.steel); c.put(x, y - 11, C.steel);
    } else if (w.kind === 'hammer') {
      c.rect(x, y + 4, x, y + 24, C.wood); c.rect(x - 3, y, x + 3, y + 4, C.iron); c.rect(x - 3, y, x + 3, y, C.ironHi);
    } else {
      // A round shield with a boss, in one of the house colours.
      const col = w.tone < 0.5 ? C.red : C.blue;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= 6.4) c.put(x + dx, y + 8 + dy, d > 5.2 ? C.band : col);
      }
      c.rect(x - 1, y + 7, x + 1, y + 9, C.ironHi);
    }
  }
}

function paintBellows(c, P) {
  const { x, y } = P.bellows;
  c.rect(x - 2, y - 3, x + 12, y, C.woodLo);                     // stand
  c.rect(x + 12, y - 8, x + 18, y - 7, C.iron);                   // nozzle into the hearth
}

function paintAnvil(c, P) {
  const { x, y } = P.anvil;
  // Stump.
  c.rect(x - 8, y + 9, x + 8, P.H - 4, C.wood); c.rect(x - 8, y + 9, x - 7, P.H - 4, C.woodHi); c.rect(x + 7, y + 9, x + 8, P.H - 4, C.woodLo);
  c.rect(x - 9, y + 8, x + 9, y + 9, C.woodHi);
  // Anvil: a broad face with a horn to the left, a narrow waist and a wide foot.
  c.rect(x - 9, y, x + 10, y + 3, C.iron); c.rect(x - 9, y, x + 10, y, C.ironHi);
  c.rect(x - 16, y, x - 10, y + 2, C.iron); c.rect(x - 16, y, x - 10, y, C.ironHi); c.put(x - 17, y, C.iron); c.put(x - 18, y, C.ironLo);
  c.rect(x - 4, y + 4, x + 5, y + 5, C.ironLo);
  c.rect(x - 7, y + 6, x + 8, y + 7, C.iron); c.rect(x - 7, y + 6, x + 8, y + 6, C.ironHi);
}

function paintBarrel(c, P) {
  if (!P.barrel) return;
  const { x, y } = P.barrel;
  for (let yy = y; yy < y + 20; yy++) {
    const bulge = Math.round(Math.sin(Math.PI * (yy - y) / 20) * 1.5);
    for (let xx = x - 8 - bulge; xx <= x + 8 + bulge; xx++) {
      const stave = (xx - x + 20) % 4 === 0;
      c.put(xx, yy, stave ? C.woodLo : xx < x - 4 ? C.woodHi : C.wood);
    }
    if (yy === y + 3 || yy === y + 15) c.rect(x - 9 - bulge, yy, x + 9 + bulge, yy, C.band);
  }
  c.rect(x - 7, y, x + 7, y + 1, C.water); c.rect(x - 4, y, x + 2, y, C.waterHi);
}

// ---------------------------------------------------------------- animation

/** Firelight, 0..1+: a restless flicker, swelling just after each pump of the bellows. */
export function fireLevel(t) {
  const p = pumpPhase(t);
  const boost = p < 0.25 ? 0 : 0.3 * Math.exp(-(p - 0.25) * 5);
  return 0.78 + Math.sin(t * 3.1) * 0.08 + Math.sin(t * 7.7 + 1) * 0.04 + boost;
}

/** The hammer's height above the anvil (pixels) at time t: rises, hangs, then drops. */
export function hammerLift(t) {
  const q = (t % HAMMER_PERIOD) / HAMMER_PERIOD;
  if (q < 0.55) { const k = q / 0.55; return 22 * k * k * (3 - 2 * k); }
  if (q < 0.8) return 22 + Math.sin((q - 0.55) * 25) * 0.8;
  if (q < HAMMER_STRIKE) return 22 * (1 - ((q - 0.8) / (HAMMER_STRIKE - 0.8)) ** 2);
  return 0;
}

function bellows(c, P, t) {
  const { x, y } = P.bellows;
  const p = pumpPhase(t);
  const squeeze = p < 0.25 ? Math.sin(p / 0.25 * Math.PI) : 0;   // pressed down, then springs back
  const open = Math.round(7 - squeeze * 4);
  // Leather wedge between two boards, hinged at the nozzle.
  for (let k = 0; k <= 12; k++) {
    const hgt = Math.round(open * (1 - k / 14));
    c.rect(x + k, y - 4 - hgt, x + k, y - 4, k % 3 ? C.leather : C.leatherHi);
    c.put(x + k, y - 5 - hgt, C.woodHi);
  }
  c.rect(x, y - 3, x + 12, y - 3, C.wood);
  c.rect(x - 3, y - 6 - open, x, y - 5 - open, C.woodHi);         // handle
}

function fire(c, P, t, level) {
  const m = P.hearth.mouth;
  // Glow: the hearth lights the room, and pools on the floor in front of it.
  c.halo(P.hearth.x, m.bed - 8, 62, C.glow, 0.32 * level);
  c.halo(P.hearth.x, P.floorY + 10, 40, C.glow, 0.16 * level);
  // Coals: each one shimmers through the embers' colours.
  const coals = [C.coal0, C.coal1, C.coal2, C.coal3, C.coal4];
  for (let y = m.bed - 2; y <= m.bed + 4; y++) {
    for (let x = m.x0 + 1; x <= m.x1 - 1; x++) {
      const heat = hash3(x, y, Math.floor(t * 4 + hash3(x, y) * 4)) * 0.6 + (y < m.bed + 1 ? 0.3 : 0.1) + (level - 0.8) * 0.8;
      c.put(x, y, coals[clamp(Math.floor(heat * 5), 0, 4)]);
    }
  }
  // Flames: tongues of different heights licking up from the bed.
  for (let x = m.x0 + 2; x <= m.x1 - 2; x++) {
    const n = Math.sin(x * 0.9 + t * 5) * 0.5 + Math.sin(x * 0.37 - t * 3.3) * 0.5;
    const h = Math.max(0, Math.round((5 + n * 6) * level * (1 - Math.abs(x - P.hearth.x) / 20)));
    for (let k = 0; k < h; k++) {
      const f = k / h;
      c.put(x, m.bed - 3 - k, f < 0.25 ? C.flameCore : f < 0.55 ? C.flame : f < 0.85 ? C.flameOut : C.flameTip);
    }
  }
  // Sparks rising into the hood and up the chimney.
  for (let k = 0; k < 16; k++) {
    const speed = 14 + (k % 5) * 4, span = m.bed - 4;
    const life = ((t * speed + k * 23.7) % span) / span;
    const y = m.bed - 6 - life * span;
    const narrow = 1 - life * 0.7;
    const x = P.hearth.x + (hash3(k, 1) - 0.5) * 22 * narrow + Math.sin(t * 2 + k) * 2;
    c.add(x, y, life < 0.5 ? C.sparkHot : C.spark, (1 - life) * 0.9);
  }
}

function hammer(c, P, t) {
  const { x, y } = P.anvil;
  const lift = Math.round(hammerLift(t));
  const q = (t % HAMMER_PERIOD) / HAMMER_PERIOD;
  const since = q >= HAMMER_STRIKE ? (q - HAMMER_STRIKE) * HAMMER_PERIOD : q * HAMMER_PERIOD + (1 - HAMMER_STRIKE) * HAMMER_PERIOD;
  // The blade on the anvil: glowing hot, flaring white for a moment on each blow.
  const flare = Math.max(0, 1 - since / 0.35);
  for (let k = -6; k <= 8; k++) c.put(x + k, y - 1, flare > 0.4 ? C.bladeHot : C.blade);
  c.put(x + 9, y - 1, C.coal2); c.rect(x - 11, y - 1, x - 7, y - 1, C.woodLo);
  c.halo(x, y - 2, 10 + flare * 6, C.glow, 0.18 + flare * 0.35);
  // The enchanted hammer, hovering with a faint rune-light.
  const hy = y - 7 - lift;
  if (lift > 2) c.halo(x + 1, hy + 2, 12, C.rune, 0.14);
  c.rect(x - 3, hy, x + 5, hy + 5, C.iron); c.rect(x - 3, hy, x + 5, hy, C.ironHi); c.rect(x - 3, hy + 5, x + 5, hy + 5, C.ironLo);
  c.put(x + 1, hy + 2, C.rune);                                   // a glowing rune on the head
  c.rect(x + 1, hy - 13, x + 2, hy - 1, C.handle); c.rect(x + 1, hy - 13, x + 1, hy - 1, C.handleHi);
  if (lift > 2) for (let k = 0; k < 4; k++) c.add(x + 1 + Math.round(Math.sin(t * 3 + k * 2) * 7), hy - 6 + k * 4, C.rune, 0.55);
  // Sparks thrown off by the blow, arcing out and falling.
  if (since < 0.7) {
    for (let k = 0; k < 14; k++) {
      const a = -Math.PI / 2 + (hash3(k, 7) - 0.5) * 2.6;
      const v = 30 + hash3(k, 9) * 40;
      const sx = x + Math.cos(a) * v * since;
      const sy = y - 2 + Math.sin(a) * v * since + 90 * since * since;
      c.add(sx, sy, since < 0.25 ? C.sparkHot : C.spark, 1 - since / 0.7);
    }
  }
}

function steam(c, P, t) {
  if (!P.barrel) return;
  const { x, y } = P.barrel;
  for (let k = 0; k < 7; k++) {
    const life = ((t * 0.3 + k / 7) % 1);
    const sx = x - 5 + (k * 1.7) % 10 + Math.sin(t * 1.3 + k) * 2 * life;
    const sy = y - 1 - life * 26;
    c.blend(sx, sy, C.steam, 0.22 * (1 - life));
    c.blend(sx + 1, sy, C.steam, 0.12 * (1 - life));
  }
}

function embers(c, P, t) {
  // A few embers drifting through the room on the hearth's draught.
  const { W } = P;
  for (let k = 0; k < Math.round(W / 10); k++) {
    const speed = 4 + (k % 4) * 2, span = FORGE_H + 10;
    const life = ((t * speed + k * 41.3) % span) / span;
    const y = FORGE_H - life * span;
    const x = (hash3(k, 3) * W + Math.sin(t * 0.7 + k) * 5 + t * 1.5) % W;
    c.add(x, y, C.coal3, (0.5 + Math.sin(t * 3 + k) * 0.3) * (1 - life));
  }
}

// ---------------------------------------------------------------- scene

/**
 * Build the forge for a width. `render(t)` returns the frame at time t
 * (seconds) as an RGBA buffer of width x FORGE_H, reusing one buffer.
 */
export function createForge(W, seed = 3) {
  const P = planForge(W, seed);
  const base = new Canvas(W, FORGE_H);
  paintRoom(base, P);
  paintRacks(base, P);
  paintHearth(base, P);
  paintBellows(base, P);
  paintBarrel(base, P);
  paintAnvil(base, P);
  const frame = new Canvas(W, FORGE_H);
  return {
    width: W, height: FORGE_H, plan: P,
    render(t = 0) {
      frame.d.set(base.d);
      const level = fireLevel(t);
      fire(frame, P, t, level);
      bellows(frame, P, t);
      steam(frame, P, t);
      hammer(frame, P, t);
      embers(frame, P, t);
      return frame.d;
    },
  };
}
