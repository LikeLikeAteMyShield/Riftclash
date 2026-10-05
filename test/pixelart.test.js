import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSprite, defineSprites, getSprite, hasSprite, listSprites, spriteSVG, spriteDataURL, artHTML } from '../src/pixelart.js';
import '../src/sprites/index.js';
import { CARDS, CLASSES } from '../src/cards.js';

const RED = '#ff0000', BLUE = '#0000ff';

test('every class has a registered 32x32 portrait', () => {
  for (const [key, c] of Object.entries(CLASSES)) {
    assert.ok(hasSprite(c.portrait), `${key} portrait "${c.portrait}" is not registered`);
    const s = getSprite(c.portrait);
    assert.equal(s.width, 32, key);
    assert.equal(s.height, 32, key);
  }
});

test('every card sprite reference exists', () => {
  for (const card of Object.values(CARDS)) {
    if (card.sprite) assert.ok(hasSprite(card.sprite), `${card.id} uses unknown sprite "${card.sprite}"`);
  }
});

test('grids are parsed with indentation ignored and "." transparent', () => {
  defineSprite('t_basic', {
    palette: { r: RED, b: BLUE },
    pixels: `
      r.b
      bbr
    `,
  });
  assert.deepEqual(getSprite('t_basic').grid, [[RED, null, BLUE], [BLUE, BLUE, RED]]);
  assert.ok(listSprites().includes('t_basic'));
});

test('invalid sprites fail with a precise message', () => {
  assert.throws(() => defineSprite('t_ragged', { palette: { r: RED }, pixels: 'rr\nr' }), /row 1 is 1 pixels wide, expected 2/);
  assert.throws(() => defineSprite('t_color', { palette: { r: RED }, pixels: 'rq' }), /unknown color "q" at x=1, y=0/);
  assert.throws(() => defineSprite('t_hex', { palette: { r: 'red' }, pixels: 'r' }), /not a hex color/);
  assert.throws(() => defineSprite('t_dot', { palette: { '.': RED }, pixels: '.' }), /reserved/);
  assert.throws(() => defineSprite('t_basic', { palette: { r: RED }, pixels: 'r' }), /already defined/);
});

test('palettes merge left to right', () => {
  defineSprite('t_merge', { palette: [{ r: RED, b: RED }, { b: BLUE }], pixels: 'rb' });
  assert.deepEqual(getSprite('t_merge').grid, [[RED, BLUE]]);
});

test('outline wraps the silhouette', () => {
  defineSprite('t_outline', { palette: { r: RED }, outline: BLUE, pixels: '...\n.r.\n...' });
  assert.deepEqual(getSprite('t_outline').grid, [[null, BLUE, null], [BLUE, RED, BLUE], [null, BLUE, null]]);
});

test('layers compose in order with offsets', () => {
  defineSprites({
    t_bg: { palette: { b: BLUE }, pixels: 'bbb\nbbb' },
    t_dot: { palette: { r: RED }, pixels: 'r' },
    t_combo: { layers: ['t_bg', { sprite: 't_dot', x: 2, y: 1 }, { palette: { r: RED }, pixels: 'r.', x: 0, y: 0 }] },
  });
  assert.deepEqual(getSprite('t_combo').grid, [[RED, BLUE, BLUE], [BLUE, BLUE, RED]]);
  assert.throws(() => defineSprite('t_badlayer', { layers: ['nope'] }), /unknown layer sprite "nope"/);
});

test('SVG merges runs into one path per color and supports recoloring', () => {
  defineSprite('t_svg', { palette: { r: RED, b: BLUE }, pixels: 'rrb\n.rr' });
  const svg = spriteSVG('t_svg');
  assert.match(svg, /viewBox="0 0 3 2"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.ok(svg.includes(`<path fill="${RED}" d="M0 0h2v1h-2zM1 1h2v1h-2z"/>`), svg);
  assert.ok(svg.includes(`<path fill="${BLUE}" d="M2 0h1v1h-1z"/>`), svg);
  assert.match(svg, /aria-hidden="true"/);
  assert.equal(spriteSVG('t_svg'), svg, 'cached');
  const swapped = spriteSVG('t_svg', { swap: { [RED]: '#00ff00' }, title: 'A & B' });
  assert.ok(swapped.includes('fill="#00ff00"') && !swapped.includes(`fill="${RED}"`));
  assert.match(swapped, /<title>A &amp; B<\/title>/);
  assert.match(spriteDataURL('t_svg'), /^data:image\/svg\+xml,%3Csvg/);
  assert.equal(spriteSVG('missing'), null);
});

test('artHTML uses a sprite when there is one and falls back to the emoji', () => {
  assert.match(artHTML({ sprite: 't_svg', emoji: 'x' }), /^<svg/);
  assert.equal(artHTML({ sprite: 'missing', emoji: '🐉' }), '<span class="emoji-art">🐉</span>');
  assert.equal(artHTML({ emoji: '<b>' }), '<span class="emoji-art">&lt;b&gt;</span>');
});

// Classes whose card art has landed; add each class as its wave is finished.
const CLASSES_WITH_ART = ['vanguard', 'pyromancer'];

test('every card in a finished art wave has pixel art', () => {
  for (const cls of CLASSES_WITH_ART) {
    const cards = Object.values(CARDS).filter(c => c.cls === cls);
    assert.ok(cards.length >= 8, cls);
    for (const card of cards) assert.ok(hasSprite(card.sprite), `${card.id} has no sprite`);
  }
});
