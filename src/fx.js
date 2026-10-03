// Visual effects: a full-screen canvas for particles, projectiles and rings,
// plus small helpers for DOM animations. Honors prefers-reduced-motion.

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.createElement('canvas');
canvas.id = 'fx-canvas';
document.body.appendChild(canvas);
const g = canvas.getContext('2d');
let dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}
resize();
addEventListener('resize', resize);

const particles = [];
const rings = [];
const projectiles = [];
let running = false;

function loop(now) {
  try {
    draw(now);
  } catch (err) {
    // Never let a drawing error stall the game: drop everything in flight.
    console.error(err);
    particles.length = rings.length = 0;
    projectiles.splice(0).forEach(p => p.resolve());
  }
  if (particles.length || rings.length || projectiles.length) requestAnimationFrame(loop);
  else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
}

/** Fraction of an effect's lifetime elapsed, clamped to [0, 1]. */
const progress = (now, start, life) => Math.min(1, Math.max(0, (now - start) / life));

function draw(now) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  g.globalCompositeOperation = 'lighter';

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    const t = progress(now, p.start, p.duration);
    const e = t * t * (3 - 2 * t);
    // Quadratic bezier with an arc so shots don't fly in a flat line.
    const mx = (p.x0 + p.x1) / 2, my = (p.y0 + p.y1) / 2 - p.arc;
    const x = (1 - e) ** 2 * p.x0 + 2 * (1 - e) * e * mx + e * e * p.x1;
    const y = (1 - e) ** 2 * p.y0 + 2 * (1 - e) * e * my + e * e * p.y1;
    for (let k = 0; k < 3; k++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2, life: 280, born: now,
        size: p.size * (0.4 + Math.random() * 0.5), color: p.color, gravity: 0, drag: 0.9 });
    }
    drawGlow(x, y, p.size * 2.2, p.color, 1);
    drawGlow(x, y, p.size * 0.8, '#ffffff', 1);
    if (t >= 1) { projectiles.splice(i, 1); p.resolve(); }
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    const t = progress(now, r.born, r.life);
    if (t >= 1) { rings.splice(i, 1); continue; }
    g.beginPath();
    g.arc(r.x, r.y, r.maxR * (1 - (1 - t) ** 3), 0, Math.PI * 2);
    g.strokeStyle = r.color;
    g.globalAlpha = 1 - t;
    g.lineWidth = r.width * (1 - t) + 1;
    g.stroke();
    g.globalAlpha = 1;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const t = progress(now, p.born, p.life);
    if (t >= 1) { particles.splice(i, 1); continue; }
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity;
    p.x += p.vx; p.y += p.vy;
    const a = 1 - t;
    if (p.shape === 'shard') {
      g.save();
      g.translate(p.x, p.y);
      g.rotate((p.spin || 0) * (now - p.born) / 100);
      g.fillStyle = p.color;
      g.globalAlpha = a;
      g.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
      g.restore();
      g.globalAlpha = 1;
    } else {
      drawGlow(p.x, p.y, p.size * (0.5 + a * 0.5), p.color, a);
    }
  }

  g.globalCompositeOperation = 'source-over';
}

function drawGlow(x, y, r, color, alpha) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r * 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  g.globalAlpha = alpha;
  g.fillStyle = grad;
  g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  g.globalAlpha = 1;
}

function kick() {
  if (!running) { running = true; requestAnimationFrame(loop); }
}

/** Center point of an element (or a point passed through). */
export function centerOf(el) {
  if (!el) return null;
  if ('x' in el && 'y' in el && !(el instanceof Element)) return el;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function burst(at, { color = '#ffb347', count = 24, speed = 5, size = 4, life = 650, gravity = 0.12,
  shape = 'glow', angle = 0, spread = Math.PI * 2, drag = 0.94, rise = 0 } = {}) {
  const c = centerOf(at);
  if (!c) return;
  const n = reducedMotion ? Math.ceil(count / 4) : count;
  const colors = Array.isArray(color) ? color : [color];
  const now = performance.now();
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.35 + Math.random() * 0.65);
    particles.push({
      x: c.x + (Math.random() - 0.5) * 8, y: c.y + (Math.random() - 0.5) * 8,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - rise,
      life: life * (0.6 + Math.random() * 0.4), born: now, size: size * (0.6 + Math.random() * 0.8),
      color: colors[i % colors.length], gravity, drag, shape, spin: (Math.random() - 0.5) * 2,
    });
  }
  kick();
}

/** Particles drifting upward from an element's area (heals, buffs). */
export function sparkle(el, { color = '#7dff7d', count = 18, life = 900 } = {}) {
  const c = centerOf(el);
  if (!c) return;
  const r = el instanceof Element ? el.getBoundingClientRect() : { width: 60, height: 60 };
  const now = performance.now();
  const n = reducedMotion ? Math.ceil(count / 4) : count;
  for (let i = 0; i < n; i++) {
    particles.push({
      x: c.x + (Math.random() - 0.5) * r.width * 0.9, y: c.y + r.height * (0.1 + Math.random() * 0.35),
      vx: (Math.random() - 0.5) * 0.4, vy: -1 - Math.random() * 1.8, life: life * (0.6 + Math.random() * 0.4), born: now,
      size: 2.5 + Math.random() * 3, color: Array.isArray(color) ? color[i % color.length] : color, gravity: -0.02, drag: 0.98,
    });
  }
  kick();
}

export function ring(at, { color = '#ffd27a', maxR = 90, life = 520, width = 6 } = {}) {
  const c = centerOf(at);
  if (!c || reducedMotion) return;
  rings.push({ x: c.x, y: c.y, color, maxR, life, width, born: performance.now() });
  kick();
}

/** A glowing orb flying from one point to another. Resolves on arrival. */
export function projectile(from, to, { color = '#ff9a3c', duration = 360, size = 7 } = {}) {
  const a = centerOf(from), b = centerOf(to);
  if (!a || !b) return Promise.resolve();
  if (reducedMotion) duration = Math.min(duration, 150);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  return new Promise(resolve => {
    // Fallback timer: resolve even if frames stop (e.g. a background tab).
    const timer = setTimeout(resolve, duration + 250);
    projectiles.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, arc: Math.min(80, dist * 0.25), color, size,
      duration, start: performance.now(), resolve: () => { clearTimeout(timer); resolve(); } });
    kick();
  });
}

/** Shake an element; intensity roughly in pixels. */
export function shake(el, intensity = 6, duration = 380) {
  if (!el || reducedMotion || intensity <= 0) return;
  const k = [];
  for (let i = 0; i <= 8; i++) {
    const f = intensity * (1 - i / 8);
    k.push({ transform: `translate(${(Math.random() - 0.5) * 2 * f}px, ${(Math.random() - 0.5) * 2 * f}px)` });
  }
  k[k.length - 1] = { transform: 'translate(0, 0)' };
  el.animate(k, { duration, easing: 'linear' });
}

/** Full-screen color flash, e.g. for big area spells. */
export function flash(color = '#fff2c4', duration = 380, opacity = 0.35) {
  if (reducedMotion) return;
  const d = document.createElement('div');
  d.className = 'fx-flash';
  d.style.background = color;
  document.body.appendChild(d);
  d.animate([{ opacity }, { opacity: 0 }], { duration, easing: 'ease-out' }).finished.then(() => d.remove());
}

export const sleep = ms => new Promise(r => setTimeout(r, reducedMotion ? Math.min(ms, 120) : ms));
