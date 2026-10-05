// Shared palettes. Sprites list these first and add their own colors after,
// so a character keeps the same meaning across every sprite that uses it.

/** Faces: outline, skin tones, eyes and mouth. */
export const SKIN = {
  k: '#1b1424', // dark line
  s: '#eab38c', // skin
  S: '#c4835f', // skin shadow
  H: '#f7d6b5', // skin highlight
  e: '#241a2c', // eyes
  m: '#9a4141', // mouth
};

/** Silhouette outline used by `outline:` on portraits. */
export const OUTLINE = '#120c18';

/** Vanguard: steel, gold and royal blue, plus wood and crimson accents. */
export const VANGUARD = {
  i: '#a7b0bb', // iron
  I: '#6b7480', // iron shadow
  l: '#e3e8ee', // steel highlight
  g: '#e6b54a', // gold
  G: '#a5741f', // gold shadow
  y: '#fff1b8', // holy light
  t: '#2f56a8', // Vanguard blue
  T: '#1f3b78', // blue shadow
  b: '#4a7ee0', // bright blue
  B: '#24479a', // deep blue
  w: '#f5efe6', // white
  W: '#c9c1ae', // white shadow
  c: '#8a5a32', // wood
  C: '#5a3a20', // wood shadow
  r: '#c0392b', // crimson
  R: '#7a1f1a', // crimson shadow
};
