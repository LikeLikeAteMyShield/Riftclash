// Shows the battle background (src/backgrounds.js) on a canvas behind the board.
// The scene is rendered at low resolution and scaled up with crisp pixels.

import { createScene, pickBackground, BG_WIDTH, BG_HEIGHT } from './backgrounds.js';
import { reducedMotion } from './fx.js';

const FRAME_MS = 1000 / 15;  // pixel art doesn't need 60fps, and this is cheap

let canvas = null, g = null, image = null;
let scene = null, lastId = null;
let raf = null, shown = false, lastFrame = 0, t0 = 0;

export function mountBackdrop(el) {
  canvas = el;
  canvas.width = BG_WIDTH;
  canvas.height = BG_HEIGHT;
  g = canvas.getContext('2d');
  image = g.createImageData(BG_WIDTH, BG_HEIGHT);
}

/** Pick a fresh random background for a new match. Returns its name. */
export function newBackdrop() {
  return setBackdrop(pickBackground(Math.random, lastId));
}

/** Show a specific background by id. Returns its name. */
export function setBackdrop(id) {
  lastId = id;
  scene = createScene(id);
  t0 = performance.now();
  draw(0);
  return scene.name;
}

export const backdropId = () => scene?.id ?? null;

export function showBackdrop(on) {
  if (!canvas || on === shown) return;
  shown = on;
  canvas.classList.toggle('visible', on);
  document.body.classList.toggle('has-backdrop', on);
  if (on && !reducedMotion) raf = requestAnimationFrame(tick);
  else if (!on && raf) { cancelAnimationFrame(raf); raf = null; }
}

function tick(now) {
  if (!shown) return;
  if (now - lastFrame >= FRAME_MS) {
    lastFrame = now;
    draw((now - t0) / 1000);
  }
  raf = requestAnimationFrame(tick);  // rAF pauses by itself in background tabs
}

function draw(t) {
  if (!scene || !g) return;
  image.data.set(scene.render(t));
  g.putImageData(image, 0, 0);
}
