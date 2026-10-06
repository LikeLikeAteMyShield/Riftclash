// Shows the archive (src/archive.js) behind the card library: a low-res
// canvas, sized to the viewport's shape and scaled up with crisp pixels.

import { createArchive, archiveWidth } from './archive.js';
import { reducedMotion } from './fx.js';

const FRAME_MS = 1000 / 20;   // a calm scene: 20fps is plenty

/** Returns { show(on) }. The scene only animates while shown and the tab is visible. */
export function mountArchive(canvas) {
  const g = canvas.getContext('2d');
  let scene = null, image = null, raf = null, shown = false, last = 0;
  const t0 = performance.now();

  function build() {
    const w = archiveWidth(innerWidth, innerHeight);
    if (scene?.width === w) return;
    scene = createArchive(w);
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
    if (now - last < FRAME_MS) return;
    last = now;
    draw((now - t0) / 1000);
  }

  function start() {
    if (reducedMotion) return draw(4);
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
  }

  addEventListener('resize', () => { if (shown) draw((performance.now() - t0) / 1000); });
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
