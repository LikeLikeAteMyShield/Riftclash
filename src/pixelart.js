// Pixel art sprites: text grids + palettes, rendered to crisp, scalable SVG.
//
// A sprite is plain data:
//
//   {
//     palette: [SKIN, { r: '#b3302b', R: '#7c1c23' }], // one map or a list merged left to right
//     outline: '#120c18',   // optional: auto-outline the silhouette in this color
//     pixels: `
//       ..rr..
//       .rRRr.
//     `,
//   }
//
// Each character in `pixels` is one pixel; '.' is always transparent and any
// other character must be in the palette. Leading/trailing whitespace on each
// line is ignored, so grids can be indented in source.
//
// Sprites can also be built from layers, each a sprite id or an inline
// sprite, drawn in order with an optional offset:
//
//   { width: 32, height: 32, layers: ['card_frame', { sprite: 'goblin', x: 4, y: 6 }] }
//
// This module has no DOM dependency, so it runs in the browser and in node tests.

const sprites = new Map();
const svgCache = new Map();

export const TRANSPARENT = '.';

const isColor = c => typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c);

function mergePalette(palette = {}) {
  const list = Array.isArray(palette) ? palette : [palette];
  return Object.assign({}, ...list);
}

/** Parse a text grid into rows of characters, validating size and palette. */
function parseGrid(id, pixels, palette) {
  const rows = String(pixels).split('\n').map(r => r.trim()).filter(r => r.length);
  if (!rows.length) throw new Error(`Sprite "${id}": pixels are empty`);
  const width = rows[0].length;
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Sprite "${id}": row ${y} is ${row.length} pixels wide, expected ${width}`);
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch !== TRANSPARENT && !(ch in palette)) {
        throw new Error(`Sprite "${id}": unknown color "${ch}" at x=${x}, y=${y}`);
      }
    }
  });
  return rows;
}

/** Resolve a sprite definition into a grid of colors (null = transparent). */
function resolve(id, def) {
  let grid;
  if (def.layers) {
    const first = layerSprite(id, def.layers[0]);
    const width = def.width ?? first.width;
    const height = def.height ?? first.height;
    grid = Array.from({ length: height }, () => Array(width).fill(null));
    for (const layer of def.layers) {
      const src = layerSprite(id, layer);
      const ox = layer.x ?? 0, oy = layer.y ?? 0;
      src.grid.forEach((row, y) => row.forEach((c, x) => {
        if (c && grid[y + oy]?.[x + ox] !== undefined) grid[y + oy][x + ox] = c;
      }));
    }
  } else {
    const palette = mergePalette(def.palette);
    for (const [ch, color] of Object.entries(palette)) {
      if (ch.length !== 1) throw new Error(`Sprite "${id}": palette key "${ch}" must be one character`);
      if (ch === TRANSPARENT) throw new Error(`Sprite "${id}": "${TRANSPARENT}" is reserved for transparent`);
      if (!isColor(color)) throw new Error(`Sprite "${id}": palette "${ch}" is not a hex color: ${color}`);
    }
    grid = parseGrid(id, def.pixels, palette).map(row => [...row].map(ch => (ch === TRANSPARENT ? null : palette[ch])));
  }
  if (def.outline) grid = addOutline(grid, def.outline);
  return { width: grid[0].length, height: grid.length, grid };
}

function layerSprite(id, layer) {
  if (typeof layer === 'string') {
    const s = sprites.get(layer);
    if (!s) throw new Error(`Sprite "${id}": unknown layer sprite "${layer}"`);
    return s;
  }
  if (layer.sprite) return layerSprite(id, layer.sprite);
  return resolve(`${id}/layer`, layer);
}

/** Color every transparent pixel that touches the silhouette (4-neighbourhood). */
function addOutline(grid, color) {
  if (!isColor(color)) throw new Error(`Outline is not a hex color: ${color}`);
  const at = (x, y) => grid[y]?.[x] ?? null;
  return grid.map((row, y) => row.map((c, x) =>
    c ?? (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1) ? color : null)));
}

/** Register one sprite. Throws a descriptive error if the data is invalid. */
export function defineSprite(id, def) {
  if (sprites.has(id)) throw new Error(`Sprite "${id}" is already defined`);
  sprites.set(id, { id, ...resolve(id, def) });
}

/** Register a module's worth of sprites: { id: definition, ... }. */
export function defineSprites(defs) {
  for (const [id, def] of Object.entries(defs)) defineSprite(id, def);
}

export const hasSprite = id => sprites.has(id);
export const getSprite = id => sprites.get(id) ?? null;
export const listSprites = () => [...sprites.keys()];

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Render a sprite as an inline SVG string. Pixels of the same color are
 * merged into horizontal runs and drawn as one <path> per color.
 *
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.title]      accessible name; omitted = decorative
 * @param {string} [opts.className]
 * @param {Object<string,string>} [opts.swap]  recolor map, e.g. { '#b3302b': '#3e6fd1' }
 */
export function spriteSVG(id, { title = '', className = 'pixel-art', swap = null } = {}) {
  const key = JSON.stringify([id, title, className, swap]);
  if (svgCache.has(key)) return svgCache.get(key);
  const s = sprites.get(id);
  if (!s) return null;
  const swapLower = swap && Object.fromEntries(Object.entries(swap).map(([a, b]) => [a.toLowerCase(), b]));
  const paths = new Map();
  s.grid.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const c = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === c) run++;
      if (c) {
        const color = swapLower?.[c.toLowerCase()] ?? c;
        if (!paths.has(color)) paths.set(color, []);
        paths.get(color).push(`M${x} ${y}h${run}v1h-${run}z`);
      }
      x += run;
    }
  });
  const a11y = title ? `role="img" aria-label="${escapeHtml(title)}"` : 'aria-hidden="true"';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.width} ${s.height}" shape-rendering="crispEdges" class="${escapeHtml(className)}" ${a11y}>` +
    (title ? `<title>${escapeHtml(title)}</title>` : '') +
    [...paths].map(([color, d]) => `<path fill="${color}" d="${d.join('')}"/>`).join('') +
    '</svg>';
  svgCache.set(key, svg);
  return svg;
}

/** The same SVG as a data: URL, for <img src> or CSS backgrounds. */
export function spriteDataURL(id, opts) {
  const svg = spriteSVG(id, opts);
  return svg && `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Art for any game object (hero, card, token...): its `sprite` if one is
 * registered, otherwise its emoji. This is the single hook the UI uses, so
 * giving a card pixel art is just adding `sprite: 'id'` to its data.
 */
export function artHTML(def, { title = '', className = 'pixel-art' } = {}) {
  if (def?.sprite && sprites.has(def.sprite)) return spriteSVG(def.sprite, { title, className });
  return `<span class="emoji-art"${title ? ` role="img" aria-label="${escapeHtml(title)}"` : ''}>${escapeHtml(def?.emoji ?? '')}</span>`;
}
