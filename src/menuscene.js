// The main menu's animated battle scene: a storm sky torn open by the Rift,
// a burning castle, two armies marching to meet, and six heroes trading blows
// in front of them, all moving to the beat of the menu music.
//
// It is drawn at low resolution (180 pixels tall, as wide as the screen's
// aspect ratio needs) and scaled up with crisp pixels, like the battle boards.
// What happens when (lineup, poses, the event schedule) lives in
// src/menuplan.js; this file does the drawing.

import { getSprite } from './pixelart.js';
import { beatClock } from './music.js';
import { reducedMotion } from './fx.js';
import {
  SCENE_H, MENU_BPM, CYCLE, GROUND, FIG, clamp, sceneWidth, layoutHeroes, eventsBetween, poseAt,
} from './menuplan.js';

// ---------------------------------------------------------------- drawing

const SKY = [ // [y fraction, rgb] from the top of the sky to the horizon
  [0, [12, 7, 26]], [0.3, [32, 12, 44]], [0.55, [70, 18, 52]], [0.72, [130, 34, 46]], [0.82, [190, 70, 34]], [0.9, [226, 120, 50]],
];
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const HORIZON = Math.round(SCENE_H * 0.74);

function lerpColor(stops, f) {
  for (let i = 1; i < stops.length; i++) {
    if (f <= stops[i][0]) {
      const [f0, a] = stops[i - 1], [f1, b] = stops[i];
      const t = (f - f0) / (f1 - f0);
      return a.map((v, k) => v + (b[k] - v) * t);
    }
  }
  return stops.at(-1)[1];
}

/** Deterministic pseudo-random numbers, so a given width always builds the same landscape. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Value noise that tiles horizontally every `period` pixels, summed over
 * octaves. `scale` is the size of the largest features in pixels.
 */
function makeNoise(seed, period, scale = period / 4) {
  const r = rng(seed);
  const size = 256, lattice = Array.from({ length: size * size }, r);
  const at = (x, y) => lattice[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const smooth = t => t * t * (3 - 2 * t);
  const octave = (x, y, cell) => {
    const cells = Math.max(1, Math.round(period / cell));
    const fx = x / period * cells, fy = y / period * cells;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
    const wx = v => ((v % cells) + cells) % cells;
    const a = at(wx(x0), y0), b = at(wx(x0 + 1), y0), c = at(wx(x0), y0 + 1), d = at(wx(x0 + 1), y0 + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return (x, y) => octave(x, y, scale) * 0.5 + octave(x, y, scale / 2) * 0.3 + octave(x, y, scale / 4) * 0.2;
}

function spriteCanvas(id, flip) {
  const s = getSprite(id);
  const c = document.createElement('canvas');
  c.width = s.width; c.height = s.height;
  const g = c.getContext('2d');
  s.grid.forEach((row, y) => row.forEach((col, x) => {
    if (!col) return;
    g.fillStyle = col;
    g.fillRect(flip ? s.width - 1 - x : x, y, 1, 1);
  }));
  return c;
}

/**
 * Animate the scene on `canvas`. Returns { show(on) }: the scene only runs
 * while shown, and pauses in background tabs.
 */
export function mountMenuScene(canvas) {
  const g = canvas.getContext('2d');
  let W = 0, image = null, sky = null, far = null, fg = null, heroes = [], soldiers = [];
  let cloudFar = null, cloudNear = null;
  const CLOUD_W = 512, CLOUD_H = 90;
  const figures = {};
  let particles = [], projectiles = [], effects = [];
  let shake = 0, flash = 0, beatPrev = null, last = 0, t0 = performance.now(), phase = 0, raf = null, shown = false;
  let rift = null;

  function figure(cls, frame, facing) {
    const key = `${cls}_${frame}_${facing}`;
    return figures[key] ??= spriteCanvas(`champ_${cls}_${frame}`, facing < 0);
  }

  // -------------------------------------------------------------- build (per width)

  function build() {
    const w = sceneWidth(innerWidth, innerHeight);
    if (w === W) return;
    W = w;
    canvas.width = W; canvas.height = SCENE_H;
    image = g.createImageData(W, SCENE_H);
    heroes = layoutHeroes(W);
    const r = rng(7);

    // Sky: dithered gradient with a few stars near the top.
    sky = new Uint8ClampedArray(W * SCENE_H * 4);
    for (let y = 0; y < SCENE_H; y++) {
      for (let x = 0; x < W; x++) {
        const f = Math.min(1, y / HORIZON);
        const c = lerpColor(SKY, f);
        const d = (BAYER[y & 3][x & 3] / 16 - 0.5) * 10;
        const i = (y * W + x) * 4;
        sky[i] = c[0] + d; sky[i + 1] = c[1] + d; sky[i + 2] = c[2] + d; sky[i + 3] = 255;
      }
    }
    for (let k = 0; k < W / 3; k++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * 50), i = (y * W + x) * 4, v = 120 + r() * 100;
      sky[i] = v; sky[i + 1] = v * 0.9; sky[i + 2] = v + 20;
    }

    // Clouds: two tileable density maps, scrolled toward the Rift every frame.
    // Features are wider than tall (y is stretched) so they read as banks of storm cloud.
    const nf = makeNoise(11, CLOUD_W, 64), nn = makeNoise(23, CLOUD_W, 48);
    cloudFar = new Float32Array(CLOUD_W * CLOUD_H);
    cloudNear = new Float32Array(CLOUD_W * CLOUD_H);
    for (let y = 0; y < CLOUD_H; y++) {
      const band = Math.sin(Math.PI * y / CLOUD_H) ** 0.6;
      for (let x = 0; x < CLOUD_W; x++) {
        cloudFar[y * CLOUD_W + x] = nf(x, y * 2.5) * band;
        cloudNear[y * CLOUD_W + x] = nn(x, y * 2.5 + 300) * band;
      }
    }

    // The Rift: a jagged crack down from the top of the sky.
    const top = 4, bottom = 66;
    rift = { cx: Math.round(W / 2), cy: 34, top, bottom, pts: [] };
    let jx = 0;
    for (let y = top; y <= bottom; y++) {
      jx = clamp(jx + (r() - 0.5) * 2.2, -4, 4);
      rift.pts.push({ y, x: rift.cx + Math.round(jx), w: 1 + 4.5 * Math.sin(Math.PI * (y - top) / (bottom - top)) ** 0.8 });
    }

    // Far layer: mountains and a burning castle on the left shoulder.
    far = document.createElement('canvas');
    far.width = W; far.height = SCENE_H;
    const f = far.getContext('2d');
    const ridge = makeNoise(31, 256);
    for (let x = 0; x < W; x++) {
      const h = Math.round(HORIZON - 10 - ridge(x * 1.4, 3) * 34);
      f.fillStyle = '#2a1028'; f.fillRect(x, h, 1, SCENE_H - h);
      f.fillStyle = '#5c2338'; f.fillRect(x, h, 1, 1);
      const h2 = Math.round(HORIZON + 2 - ridge(x * 2.6 + 90, 40) * 16);
      f.fillStyle = '#1a0a18'; f.fillRect(x, h2, 1, SCENE_H - h2);
      f.fillStyle = '#3d1528'; f.fillRect(x, h2, 1, 1);
    }
    const castleX = Math.round(W * 0.16), castleBase = Math.round(HORIZON - 4 - ridge(castleX * 1.4, 3) * 34) + 3;
    const towers = [[-9, 22, 5], [-3, 14, 9], [7, 26, 5], [13, 12, 7]];
    for (const [dx, h, w] of towers) {
      f.fillStyle = '#160812'; f.fillRect(castleX + dx, castleBase - h, w, h + 6);
      for (let k = 0; k < w; k += 2) f.fillRect(castleX + dx + k, castleBase - h - 1, 1, 1);
      f.fillStyle = '#ffb347'; f.fillRect(castleX + dx + (w >> 1), castleBase - h + 4, 1, 2);
    }
    rift.castle = { x: castleX, y: castleBase - 22, flames: towers.map(([dx, h, w]) => ({ x: castleX + dx + (w >> 1), y: castleBase - h - 1 })) };

    // Foreground: dark ground with rocks under the back ranks.
    fg = document.createElement('canvas');
    fg.width = W; fg.height = SCENE_H;
    const q = fg.getContext('2d');
    const gnoise = makeNoise(41, 128);
    for (let x = 0; x < W; x++) {
      const h = Math.round(GROUND - 1 - gnoise(x * 3, 5) * 4);
      q.fillStyle = '#0d070c'; q.fillRect(x, h, 1, SCENE_H - h);
      q.fillStyle = '#3a1a22'; q.fillRect(x, h, 1, 1);
    }
    for (const h of heroes) {
      if (!h.rank) continue;
      const lift = h.rank * 3;
      q.fillStyle = '#140a10'; q.fillRect(h.x + 4, GROUND - lift, 24, lift + 2);
      q.fillStyle = '#4a2430'; q.fillRect(h.x + 5, GROUND - lift, 22, 1);
    }

    // Soldiers on the midground hills, marching in from both sides.
    soldiers = [];
    const per = Math.max(4, Math.round(W / 14));
    for (const side of [-1, 1]) {
      for (let k = 0; k < per; k++) soldiers.push({ side, p: k / per, row: k % 3, seed: r() });
    }
  }

  // -------------------------------------------------------------- simulation

  const heroOf = cls => heroes.find(h => h.cls === cls);
  const front = side => heroes.find(h => h.side === side && h.rank === 0);
  const chest = h => ({ x: h.x + 16, y: h.y + 16 });
  const beatSec = 60 / MENU_BPM;

  function spawn(n, x, y, opts) {
    for (let k = 0; k < n; k++) {
      const a = (opts.angle ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * (opts.spread ?? Math.PI * 2);
      const sp = (opts.speed ?? 30) * (0.4 + Math.random() * 0.8);
      const colors = opts.colors;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: opts.gravity ?? 0, drag: opts.drag ?? 0.9,
        life: 0, max: (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6), color: colors[Math.floor(Math.random() * colors.length)],
        size: opts.size ?? 1,
      });
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
  }

  function fire(e) {
    if (e.who && !heroOf(e.who)) return;
    const me = e.who && heroOf(e.who);
    switch (e.type) {
      case 'fireball': {
        const target = front(me.side === 'L' ? 'R' : 'L');
        const from = { x: me.x + (me.facing > 0 ? 25 : 7), y: me.y + 6 };
        const to = { x: chest(target).x - 8 * me.facing, y: chest(target).y - 2 };
        projectiles.push({ kind: 'fireball', from, to, t: 0, dur: 1.25 * beatSec, arc: 16, side: me.side });
        break;
      }
      case 'arrow': {
        const target = front(me.side === 'L' ? 'R' : 'L');
        const from = { x: me.x + (me.facing > 0 ? 29 : 3), y: me.y + 13 };
        const to = { x: chest(target).x - 6 * me.facing, y: chest(target).y - 3 };
        projectiles.push({ kind: 'arrow', from, to, t: 0, dur: 0.6 * beatSec, arc: 4, side: me.side });
        break;
      }
      case 'dagger': {
        const target = front(me.side === 'L' ? 'R' : 'L');
        const from = { x: me.x + (me.facing > 0 ? 24 : 8), y: me.y + 8 };
        const to = { x: chest(target).x - 6 * me.facing, y: chest(target).y };
        projectiles.push({ kind: 'dagger', from, to, t: 0, dur: 0.5 * beatSec, arc: 3, side: me.side });
        break;
      }
      case 'slam': {
        const x = W / 2, y = GROUND;
        effects.push({ kind: 'shockwave', x, y, t: 0, dur: 0.7 });
        spawn(26, x, y - 1, { angle: -Math.PI / 2, spread: 2.4, speed: 70, gravity: 160, life: 0.9, colors: ['#8a6a4a', '#5c4430', '#e8d9b0', '#3a2a20'] });
        spawn(10, x, y - 2, { angle: -Math.PI / 2, spread: 1.2, speed: 40, gravity: -6, drag: 0.6, life: 1.2, colors: ['#4a3a3a', '#5a4848'], size: 2 });
        shake = Math.max(shake, 0.35);
        break;
      }
      case 'vanish':
      case 'appear': {
        const at = chest(me);
        spawn(18, at.x, at.y, { speed: 26, drag: 0.7, gravity: -10, life: 0.7, colors: ['#45384f', '#6b5a7a', '#2e1c45'], size: 2 });
        break;
      }
      case 'slash': {
        const x = W / 2 + 2 * me.facing, y = GROUND - 16;
        effects.push({ kind: 'slash', x, y, facing: me.facing, t: 0, dur: 0.35 });
        spawn(14, x, y, { speed: 50, life: 0.35, colors: ['#c58cff', '#f4e2ff'] });
        break;
      }
      case 'heal': {
        for (const h of heroes.filter(h => h.side === me.side)) {
          effects.push({ kind: 'pillar', x: h.x + 16, y: h.y + 31, t: 0, dur: 0.9 });
          spawn(10, h.x + 16, h.y + 22, { angle: -Math.PI / 2, spread: 0.8, speed: 26, drag: 0.95, life: 1, colors: ['#fff1b8', '#f5c84a', '#ffffff'] });
        }
        break;
      }
      case 'lightning': {
        const tx = W / 2 + (Math.random() - 0.5) * Math.min(W * 0.3, 60);
        const pts = [];
        let x = rift.pts.at(-1).x, y = rift.bottom;
        while (y < GROUND) { pts.push([x, y]); y += 4 + Math.random() * 6; x += (tx - x) * 0.25 + (Math.random() - 0.5) * 8; }
        pts.push([tx, GROUND]);
        effects.push({ kind: 'bolt', pts, t: 0, dur: 0.28 });
        spawn(20, tx, GROUND - 1, { angle: -Math.PI / 2, spread: 2.6, speed: 60, gravity: 120, life: 0.6, colors: ['#f4e2ff', '#c58cff', '#ffffff'] });
        flash = 0.55; shake = Math.max(shake, 0.25);
        break;
      }
    }
  }

  function impact(p) {
    const defender = front(p.side === 'L' ? 'R' : 'L');
    // The Vanguard's shield or the Oracle's light turns attacks aside.
    const guarded = defender.cls === 'vanguard' || heroes.some(h => h.side === defender.side && h.cls === 'oracle');
    if (p.kind === 'fireball') {
      spawn(34, p.to.x, p.to.y, { speed: 55, drag: 0.85, gravity: 20, life: 0.6, colors: ['#ff5f1f', '#f28a26', '#ffd451', '#fff3c4'] });
      spawn(8, p.to.x, p.to.y, { angle: -Math.PI / 2, spread: 1.5, speed: 16, gravity: -12, drag: 0.8, life: 1.1, colors: ['#3a2e2a', '#5a4a44'], size: 2 });
      if (guarded) effects.push({ kind: 'barrier', x: p.to.x, y: p.to.y, facing: p.side === 'L' ? -1 : 1, t: 0, dur: 0.45 });
      shake = Math.max(shake, 0.15);
    } else {
      const deflect = defender.cls === 'vanguard';
      spawn(deflect ? 10 : 6, p.to.x, p.to.y, { speed: 40, life: 0.3, colors: deflect ? ['#fff1b8', '#e6b54a', '#ffffff'] : ['#e8e0c4', '#c23b2b'] });
      if (deflect) particles.push({ x: p.to.x, y: p.to.y, vx: (p.side === 'L' ? 1 : -1) * 20, vy: -40, g: 140, drag: 0.98, life: 0, max: 0.6, color: '#e8e0c4', size: 1 });
    }
  }

  function step(dt, beat) {
    // Ambient: embers rising from the battlefield, motes drawn into the Rift, flames on the castle.
    if (Math.random() < dt * W * 0.08) {
      particles.push({ x: Math.random() * W, y: SCENE_H, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 18, g: 0, drag: 1, life: 0, max: 3 + Math.random() * 3, color: Math.random() < 0.7 ? '#f28a26' : '#ffd451', size: 1, sway: Math.random() * 6 });
    }
    if (Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 20;
      particles.push({ x: rift.cx + Math.cos(a) * d, y: rift.cy + Math.sin(a) * d * 0.8, vx: 0, vy: 0, g: 0, drag: 1, life: 0, max: 1.6, color: Math.random() < 0.5 ? '#c58cff' : '#9fe7ff', size: 1, orbit: { a, d } });
    }
    if (Math.random() < dt * 22) {
      const fl = rift.castle.flames[Math.floor(Math.random() * rift.castle.flames.length)];
      particles.push({ x: fl.x + (Math.random() - 0.5) * 3, y: fl.y, vx: (Math.random() - 0.3) * 3, vy: -6 - Math.random() * 6, g: 0, drag: 1, life: 0, max: 0.8 + Math.random() * 0.6, color: Math.random() < 0.5 ? '#ff5f1f' : '#ffd451', size: 1, smoke: true });
    }

    for (const p of particles) {
      p.life += dt;
      if (p.orbit) {
        const k = p.life / p.max;
        p.orbit.a += dt * 2.4;
        const d = p.orbit.d * (1 - k);
        p.x = rift.cx + Math.cos(p.orbit.a) * d; p.y = rift.cy + Math.sin(p.orbit.a) * d * 0.8;
        continue;
      }
      p.vy += p.g * dt;
      const drag = Math.pow(p.drag, dt * 10);
      p.vx *= drag; p.vy *= drag;
      p.x += (p.vx + (p.sway ? Math.sin(p.life * 3 + p.sway) * 4 : 0)) * dt;
      p.y += p.vy * dt;
      if (p.smoke && p.life > p.max * 0.4) p.color = '#3a2228';
    }
    particles = particles.filter(p => p.life < p.max && p.y < SCENE_H + 4);

    for (const p of projectiles) {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      if (p.kind === 'fireball') {
        const pos = lerpArc(p, k);
        spawn(2, pos.x, pos.y, { speed: 6, gravity: -14, drag: 0.7, life: 0.35, colors: ['#ff5f1f', '#f28a26', '#ffd451'] });
      }
      if (k >= 1 && !p.done) { p.done = true; impact(p); }
    }
    projectiles = projectiles.filter(p => !p.done);
    for (const e of effects) e.t += dt;
    effects = effects.filter(e => e.t < e.dur);
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt * 2.2);
  }

  const lerpArc = (p, k) => ({
    x: p.from.x + (p.to.x - p.from.x) * k,
    y: p.from.y + (p.to.y - p.from.y) * k - Math.sin(Math.PI * k) * p.arc,
  });

  // -------------------------------------------------------------- render

  function render(beat, time) {
    const bf = beat - Math.floor(beat);
    const downbeat = Math.floor(beat) % 4 === 0;
    const pulse = Math.exp(-bf * 5) * (downbeat ? 1 : 0.6);

    // Sky, clouds and the Rift's glow, per pixel.
    const data = image.data;
    data.set(sky);
    const scroll = time * 9;
    const glowR = 70 + pulse * 10;
    for (let y = 0; y < CLOUD_H + 10; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const dx = x - rift.cx, dy = (y - rift.cy) * 1.3;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const glow = Math.max(0, 1 - dist / glowR) ** 2 * (0.7 + pulse * 0.5);
        // Clouds on each side drift in toward the Rift.
        const dir = dx < 0 ? 1 : -1;
        let cx = Math.floor(x - dir * scroll), cy = y - 6;
        let dens = 0;
        if (cy >= 0 && cy < CLOUD_H) {
          cx = ((cx % CLOUD_W) + CLOUD_W) % CLOUD_W;
          dens = cloudFar[cy * CLOUD_W + cx];
          const cx2 = ((Math.floor(x - dir * scroll * 2.2) % CLOUD_W) + CLOUD_W) % CLOUD_W;
          dens = Math.max(dens, cloudNear[cy * CLOUD_W + cx2] * 0.95);
        }
        const th = 0.5 + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.05;
        if (dens > th) {
          // Thin edges catch the light; thick cores stay dark, lit from below by the fires and the Rift.
          const edge = 1 - Math.min(1, (dens - th) * 7);
          const lit = edge * 0.35 + glow * 1.3;
          data[i] = 34 + lit * 160; data[i + 1] = 14 + lit * 52; data[i + 2] = 40 + lit * 150;
        }
        if (glow > 0.02) {
          data[i] = Math.min(255, data[i] + glow * 150);
          data[i + 1] = Math.min(255, data[i + 1] + glow * 40);
          data[i + 2] = Math.min(255, data[i + 2] + glow * 200);
        }
      }
    }
    g.putImageData(image, 0, 0);

    const sx = shake > 0 ? Math.round((Math.random() - 0.5) * 4 * Math.min(1, shake * 4)) : 0;
    const sy = shake > 0 ? Math.round((Math.random() - 0.5) * 3 * Math.min(1, shake * 4)) : 0;
    // Layers under a shake are also drawn unshaken first, so no sky shows at the edges.
    if (sx || sy) { g.drawImage(far, 0, 0); g.drawImage(fg, 0, 0); }
    g.save();
    g.translate(sx, sy);

    drawRift(pulse, time);
    g.drawImage(far, 0, 0);
    drawSoldiers(beat);
    for (const e of effects) if (e.kind === 'bolt') drawBolt(e);
    g.drawImage(fg, 0, 0);
    for (const e of effects) if (e.kind === 'pillar') drawPillar(e);
    drawHeroes(beat);
    for (const e of effects) if (e.kind !== 'bolt' && e.kind !== 'pillar') drawEffect(e);
    for (const p of projectiles) drawProjectile(p);
    for (const p of particles) {
      g.globalAlpha = Math.min(1, 1.6 * (1 - p.life / p.max));
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    g.globalAlpha = 1;
    g.restore();

    if (flash > 0) {
      g.fillStyle = `rgba(230, 210, 255, ${flash * 0.5})`;
      g.fillRect(0, 0, W, SCENE_H);
    }
  }

  function drawRift(pulse, time) {
    const widen = 1 + pulse * 0.35;
    for (const [pad, color] of [[2.5, '#6d2fb0'], [1, '#c58cff'], [-0.6, '#f4e2ff']]) {
      g.fillStyle = color;
      for (const p of rift.pts) {
        const flick = Math.sin(time * 9 + p.y * 0.7) * 0.4;
        const w = Math.max(0, (p.w + flick) * widen + pad);
        if (w < 0.5) continue;
        g.fillRect(Math.round(p.x - w / 2), p.y, Math.max(1, Math.round(w)), 1);
      }
    }
    // Crackling tendrils off the edges.
    g.fillStyle = '#c58cff';
    for (let k = 0; k < 5; k++) {
      const p = rift.pts[Math.floor((Math.sin(time * 3 + k * 7.1) * 0.5 + 0.5) * (rift.pts.length - 1))];
      const dir = k % 2 ? 1 : -1;
      for (let s = 1; s < 4 + pulse * 4; s++) g.fillRect(p.x + dir * (p.w / 2 + s), p.y + Math.round(Math.sin(s + k + time * 5)), 1, 1);
    }
  }

  function drawSoldiers(beat) {
    const bob = beat - Math.floor(beat) < 0.2 ? 1 : 0;
    const line = W / 2;
    for (const s of soldiers) {
      // Each soldier marches from its edge to the clash line, then starts again.
      const p = (s.p + beat * 0.012) % 1;
      const x = Math.round(s.side < 0 ? p * (line - 6) : W - p * (line - 6));
      const y = HORIZON + 8 + s.row * 3 - (s.row === 1 ? bob : 0);
      g.globalAlpha = Math.min(1, (1 - p) * 6, p * 8);
      const fwd = s.side < 0 ? 1 : -1;
      // A dark silhouette: helmeted head, body, a spear leaning forward with a glinting tip.
      g.fillStyle = '#100810';
      g.fillRect(x, y - 4, 2, 4);
      g.fillRect(x, y - 6, 2, 2);
      g.fillStyle = '#2a1c26';
      g.fillRect(x + (fwd > 0 ? 2 : -1), y - 7, 1, 5);
      g.fillStyle = s.side < 0 ? '#8f98a3' : '#9a6ae0';
      g.fillRect(x + (fwd > 0 ? 2 : -1), y - 8, 1, 1);
      if (s.seed < 0.12) { g.fillStyle = s.side < 0 ? '#2f56a8' : '#7a1f1a'; g.fillRect(x + (fwd > 0 ? 3 : -3), y - 7, 2, 2); }
    }
    g.globalAlpha = 1;
    // Sparks where the lines meet.
    if (Math.random() < 0.3) {
      g.fillStyle = Math.random() < 0.5 ? '#ffd451' : '#ffffff';
      g.fillRect(Math.round(line + (Math.random() - 0.5) * 10), HORIZON + 4 + Math.floor(Math.random() * 8), 1, 1);
    }
  }

  function drawHeroes(beat) {
    const b = beat - Math.floor(beat);
    for (const h of heroes) {
      const pose = poseAt(h.cls, beat);
      if (pose.hidden) continue;
      let x = h.x, y = h.y;
      if (h.cls === 'warlord' && pose.leap > 0) {
        const reach = W / 2 - (h.x + 16) - 4 * h.facing;
        const k = pose.leap, ease = k * k * (3 - 2 * k);
        x += Math.round(reach * ease);
        y = Math.round(GROUND - FIG - (pose.air ? Math.sin(Math.PI * k) * 26 : 0));
      }
      if (pose.crouch) y += 1;
      if (!pose.air && b < 0.15) y += 1;     // a dip on every beat
      // Shadow.
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(x + 9, pose.leap > 0 ? GROUND : GROUND - h.rank * 3, 14, 1);
      g.drawImage(figure(h.cls, pose.frame, h.facing), x, y);
    }
    // The Shade's strike: an after-image dashing across the gap.
    const shade = heroOf('shade');
    if (shade) {
      const b16 = ((beat % CYCLE) + CYCLE) % CYCLE;
      if (b16 >= 9.4 && b16 < 10.6) {
        const k = (b16 - 9.4) / 1.2;
        const tx = W / 2 - 16 + 6 * shade.facing;
        const x = Math.round(shade.x + (tx - shade.x) * Math.min(1, k * 1.6));
        for (let a = 3; a >= 1; a--) {
          g.globalAlpha = 0.15 * a;
          g.drawImage(figure('shade', 'dash', shade.facing), x - a * 5 * shade.facing, GROUND - FIG);
        }
        g.globalAlpha = 1;
        g.drawImage(figure('shade', 'dash', shade.facing), x, GROUND - FIG);
      }
    }
  }

  function drawProjectile(p) {
    const k = Math.min(1, p.t / p.dur);
    const pos = lerpArc(p, k);
    const x = Math.round(pos.x), y = Math.round(pos.y);
    const dirx = Math.sign(p.to.x - p.from.x) || 1;
    if (p.kind === 'fireball') {
      g.fillStyle = '#ff5f1f'; g.fillRect(x - 2, y - 2, 5, 5);
      g.fillStyle = '#ffd451'; g.fillRect(x - 1, y - 1, 3, 3);
      g.fillStyle = '#fff3c4'; g.fillRect(x, y, 1, 1);
    } else if (p.kind === 'arrow') {
      g.fillStyle = '#7a5230'; g.fillRect(dirx > 0 ? x - 5 : x, y, 6, 1);
      g.fillStyle = '#e3e8ee'; g.fillRect(dirx > 0 ? x + 1 : x - 1, y, 1, 1);
      g.fillStyle = '#c23b2b'; g.fillRect(dirx > 0 ? x - 5 : x + 5, y - 1, 1, 3);
    } else {
      g.fillStyle = '#d5dbe2'; g.fillRect(dirx > 0 ? x - 2 : x, y, 3, 1);
      g.fillStyle = '#c58cff'; g.fillRect(dirx > 0 ? x - 4 : x + 3, y, 2, 1);
    }
  }

  function drawEffect(e) {
    const k = e.t / e.dur;
    if (e.kind === 'shockwave') {
      const rx = 6 + k * 40, ry = 1 + k * 4;
      g.fillStyle = `rgba(232, 217, 176, ${1 - k})`;
      for (let a = 0; a < Math.PI; a += 0.08) {
        g.fillRect(Math.round(e.x + Math.cos(a) * rx), Math.round(e.y - Math.sin(a) * ry), 1, 1);
        g.fillRect(Math.round(e.x - Math.cos(a) * rx), Math.round(e.y - Math.sin(a) * ry), 1, 1);
      }
    } else if (e.kind === 'slash') {
      g.fillStyle = `rgba(244, 226, 255, ${1 - k})`;
      for (let a = -1.2; a <= 1.2; a += 0.1) {
        const r = 10 + k * 3;
        g.fillRect(Math.round(e.x + Math.cos(a) * r * e.facing), Math.round(e.y + Math.sin(a) * r), 2, 1);
      }
    } else if (e.kind === 'barrier') {
      // A wall of golden light that catches the fireball.
      g.fillStyle = `rgba(255, 241, 184, ${1 - k})`;
      for (let a = -1.1; a <= 1.1; a += 0.12) {
        g.fillRect(Math.round(e.x + 3 * e.facing + Math.cos(a) * 3 * e.facing), Math.round(e.y + Math.sin(a) * 12), 1, 2);
      }
    }
  }

  function drawPillar(e) {
    const k = e.t / e.dur;
    g.fillStyle = `rgba(255, 241, 184, ${0.35 * (1 - k)})`;
    g.fillRect(e.x - 5, 0, 10, e.y);
    g.fillStyle = `rgba(255, 255, 255, ${0.4 * (1 - k)})`;
    g.fillRect(e.x - 1, 0, 3, e.y);
  }

  function drawBolt(e) {
    const k = e.t / e.dur;
    const visible = k < 0.25 || (k > 0.45 && k < 0.6);   // a double flicker
    if (!visible) return;
    for (const [w, color] of [[3, '#9a6ae0'], [1, '#ffffff']]) {
      g.fillStyle = color;
      for (let i = 1; i < e.pts.length; i++) {
        const [x0, y0] = e.pts[i - 1], [x1, y1] = e.pts[i];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let s = 0; s <= n; s++) {
          g.fillRect(Math.round(x0 + (x1 - x0) * s / n - (w >> 1)), Math.round(y0 + (y1 - y0) * s / n), w, 1);
        }
      }
    }
  }

  // -------------------------------------------------------------- clock

  /** Beats since the scene started, locked to the menu music when it's playing. */
  function currentBeat(now) {
    const own = (now - t0) / 1000 * MENU_BPM / 60 + phase;
    const music = beatClock();
    if (music?.id !== 'menu') return own;
    // Ease our clock onto the music's, or jump if it's far out (e.g. the song just started).
    let diff = (music.beat - own) % CYCLE;
    if (diff > CYCLE / 2) diff -= CYCLE;
    if (diff < -CYCLE / 2) diff += CYCLE;
    phase += Math.abs(diff) > 1 ? diff : diff * 0.1;
    return own + (Math.abs(diff) > 1 ? diff : diff * 0.1);
  }

  function frame(now) {
    raf = shown ? requestAnimationFrame(frame) : null;
    if (now - last < 1000 / 30) return;          // 30fps is plenty for pixel art
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    build();
    const beat = currentBeat(now);
    // Fire the events since the last frame; after a long gap, skip them rather than burst.
    if (beatPrev !== null && beat - beatPrev < 2) for (const e of eventsBetween(beatPrev, beat)) fire(e);
    beatPrev = beat;
    step(dt, beat);
    render(beat, now / 1000);
  }

  /** One still frame mid-battle, for reduced motion. */
  function still() {
    build();
    particles = []; projectiles = []; effects = [];
    let beat = 5.0;
    for (let k = 0; k < 40; k++) {
      const next = beat + 1 / 30 * MENU_BPM / 60;
      for (const e of eventsBetween(beat, next)) fire(e);
      step(1 / 30, next);
      beat = next;
    }
    shake = 0; flash = 0;
    render(beat, 0);
  }

  addEventListener('resize', () => { if (shown && reducedMotion) still(); });
  document.addEventListener('visibilitychange', () => {
    if (!shown || reducedMotion) return;
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
    else if (!document.hidden && !raf) { last = 0; beatPrev = null; raf = requestAnimationFrame(frame); }
  });

  return {
    show(on) {
      if (on === shown) return;
      shown = on;
      canvas.classList.toggle('visible', on);
      if (!on) { if (raf) cancelAnimationFrame(raf); raf = null; return; }
      if (reducedMotion) return still();
      last = 0; beatPrev = null;
      raf = requestAnimationFrame(frame);
    },
  };
}
