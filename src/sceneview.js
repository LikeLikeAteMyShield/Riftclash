// Shows a pixel-buffer scene (src/archive.js, src/forge.js) on a canvas: sized
// to the viewport's shape, scaled up with crisp pixels, animated only while
// shown and the tab is visible, and still under "reduce motion".

import { reducedMotion } from './fx.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {(viewW: number, viewH: number) => number} opts.width   scene width for a viewport
 * @param {(width: number) => { width: number, height: number, render(t: number): Uint8ClampedArray }} opts.create
 * @param {number} [opts.fps]      frames per second (calm scenes need few)
 * @param {number} [opts.stillAt]  the moment (seconds) shown under reduced motion
 * @returns {{ show(on: boolean): void }}
 */
export function mountScene(canvas, { width, create, fps = 20, stillAt = 4 }) {
  const g = canvas.getContext('2d');
  const frameMs = 1000 / fps;
  let scene = null, image = null, raf = null, shown = false, last = 0;
  const t0 = performance.now();

  function build() {
    const w = width(innerWidth, innerHeight);
    if (scene?.width === w) return;
    scene = create(w);
    canvas.width = w;
    canvas.height = scene.height;
    image = g.createImageData(w, scene.height);
  }

  function draw(t) {
    build();
    image.data.set(scene.render(t));
    g.putImageData(image, 0, 0);
  }

  function tick(now) {
    raf = shown && !document.hidden ? requestAnimationFrame(tick) : null;
    if (now - last < frameMs) return;
    last = now;
    draw((now - t0) / 1000);
  }

  function start() {
    if (reducedMotion) return draw(stillAt);
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
  }

  addEventListener('resize', () => { if (shown) draw(reducedMotion ? stillAt : (performance.now() - t0) / 1000); });
  document.addEventListener('visibilitychange', () => { if (shown) start(); });

  return {
    show(on) {
      if (on === shown) return;
      shown = on;
      canvas.classList.toggle('visible', on);
      if (on) start();
      else if (raf) { cancelAnimationFrame(raf); raf = null; }
    },
  };
}
