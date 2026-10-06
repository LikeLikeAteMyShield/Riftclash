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

/** Pyromancer: fire, frost, arcane violet and volcanic stone. */
export const PYROMANCER = {
  r: '#b3302b', // robe red
  R: '#7c1c23', // robe shadow
  o: '#f28a26', // flame orange
  O: '#ffd451', // flame yellow
  f: '#ff5f1f', // flame
  F: '#c2361a', // deep flame
  y: '#fff3c4', // white-hot
  a: '#9fe7ff', // ice
  A: '#4fb3e0', // ice shadow
  D: '#2a6f9e', // deep ice
  z: '#effcff', // frost white
  p: '#9a6ae0', // arcane violet
  P: '#5a3a9a', // arcane shadow
  q: '#5a4a44', // stone
  Q: '#3a2e2a', // stone shadow
  u: '#8a7a70', // stone highlight
  c: '#8a5a32', // leather
  C: '#5a3a20', // leather shadow
  g: '#e6b54a', // gold
  G: '#a5741f', // gold shadow
  h: '#6b3e26', // hair
  w: '#f5efe6', // parchment
  W: '#d8cdb4', // parchment shadow
};

/** Warlord: iron, blood red, leather, fur and earth. */
export const WARLORD = {
  i: '#8f98a3', // iron
  I: '#5b636e', // iron shadow
  l: '#c9d1d9', // steel highlight
  r: '#b53b3b', // red
  R: '#7a1f1a', // red shadow
  x: '#e8462e', // rage red
  c: '#7a5a3a', // leather
  C: '#4f3a26', // leather shadow
  u: '#8a6a50', // fur
  U: '#5a4434', // fur shadow
  g: '#d9a441', // gold
  G: '#9a6e22', // gold shadow
  h: '#3a2a20', // dark hair
  b: '#b0602a', // ginger
  B: '#6e3818', // ginger shadow
  n: '#7d6e62', // stone
  N: '#4e443c', // stone shadow
  d: '#8a6a4a', // earth
  D: '#5c4430', // earth shadow
  y: '#e8d9b0', // dust
  K: '#24191c', // black hood
  w: '#f0e6d2', // bone
};

/** Stalker: forest green, leather, wolf grey, plumage and storm. */
export const STALKER = {
  v: '#3f7a3a', // forest green
  V: '#26502a', // green shadow
  q: '#6fa64a', // leaf
  c: '#7a5230', // leather
  C: '#4a3220', // leather shadow
  b: '#9a6a3a', // plumage
  B: '#5e3f22', // plumage shadow
  o: '#e8a83a', // amber
  x: '#e8e0c4', // pale feather
  z: '#c23b2b', // red fletching
  g: '#5a8a3a', // croc green
  G: '#36572a', // croc shadow
  j: '#b5cf7a', // croc belly
  w: '#f5efe6', // teeth
  f: '#8a8f9a', // wolf grey
  F: '#565b66', // wolf shadow
  J: '#c4c8d0', // wolf light
  d: '#a06a3a', // stag brown
  D: '#6a4426', // stag shadow
  a: '#e8d9b0', // antler
  A: '#b7a98a', // antler shadow
  y: '#fff3a0', // spark
  Y: '#ffd451', // lightning
  i: '#a7b0bb', // steel
  l: '#e3e8ee', // steel highlight
  M: '#f3ecd0', // moon
  N: '#cfc6a2', // moon shadow
};

/** Oracle: white, gold, candlelight, violet and carved stone. */
export const ORACLE = {
  w: '#f2ede1', // white
  W: '#c9c1ae', // white shadow
  g: '#e6b54a', // gold
  G: '#a5741f', // gold shadow
  a: '#fff1b8', // holy light
  A: '#f5c84a', // halo
  j: '#5ec8e8', // gem
  c: '#f2e6c8', // wax
  o: '#ffb43a', // flame
  O: '#ffe27a', // flame light
  v: '#9a6ae0', // violet
  V: '#5a3a9a', // violet shadow
  q: '#9aa0a8', // stone
  Q: '#5d636b', // stone shadow
  u: '#c4c9cf', // stone highlight
  n: '#6b4a2e', // robe brown
  N: '#4a3220', // robe shadow
  i: '#d8dde3', // steel
  I: '#9aa3ad', // steel shadow
  b: '#8fc7f0', // sky
};

/** Shade: violet, shadow, steel, poison green and parchment. */
export const SHADE = {
  v: '#4a2f6b', // violet
  V: '#2e1c45', // violet shadow
  q: '#6d4a9a', // violet light
  N: '#2a1c38', // deep shadow
  x: '#c58cff', // glow
  X: '#f4e2ff', // bright glow
  d: '#d5dbe2', // steel
  D: '#7d8794', // steel shadow
  p: '#7ad14a', // poison
  P: '#3e7a22', // poison shadow
  g: '#d9b44a', // gold
  G: '#8a6c2a', // gold shadow
  c: '#6b4a2e', // leather
  C: '#45301e', // leather shadow
  u: '#6b5a7a', // smoke
  U: '#45384f', // smoke shadow
  w: '#efe6d2', // parchment
  W: '#c9bd9c', // parchment shadow
  r: '#b02a2a', // wax red
  R: '#6e1616', // wax shadow
  a: '#b8e6d8', // glass
  A: '#7fb5a6', // glass shadow
};

/** Neutral: a broad set for creatures and people of every kind. */
export const NEUTRAL = {
  g: '#5fae4a', // leaf green
  G: '#3c7a32', // green shadow
  V: '#2f5a48', // swamp water
  b: '#8a5a32', // brown
  B: '#5a3a20', // brown shadow
  t: '#c8946a', // tan
  T: '#8a5f40', // tan shadow
  i: '#a7b0bb', // iron
  I: '#6b7480', // iron shadow
  l: '#e3e8ee', // steel highlight
  y: '#ffd451', // gold
  Y: '#d99a2a', // gold shadow
  o: '#f28a26', // orange
  r: '#c0392b', // red
  R: '#7a1f1a', // red shadow
  u: '#4a7ee0', // blue
  U: '#24479a', // blue shadow
  p: '#9a6ae0', // violet
  P: '#5a3a9a', // violet shadow
  c: '#9fe7ff', // crystal
  C: '#4fb3e0', // crystal shadow
  w: '#f5efe6', // white
  W: '#c9c1ae', // white shadow
  n: '#8a8f9a', // grey
  N: '#4c505a', // grey shadow
  q: '#8a7d72', // stone
  Q: '#55493f', // stone shadow
  a: '#e8d9b0', // bone
  A: '#b7a98a', // bone shadow
  d: '#3a2a20', // dark hair
  x: '#f4e2ff', // sparkle
  z: '#22182a', // void
};

/** Celestial: night sky, rift cyan, violet nebulae, starlight and gold. */
export const CELESTIAL = {
  n: '#1c2050', // night
  N: '#11133a', // deep night
  d: '#08081a', // void
  i: '#3a44a0', // indigo
  I: '#262d78', // indigo shadow
  v: '#7a5ae0', // violet
  V: '#4c3aa0', // violet shadow
  c: '#8fe0ff', // rift cyan
  C: '#3aa0e0', // cyan shadow
  w: '#f4f6ff', // starlight
  W: '#b8c4f0', // starlight shadow
  g: '#f4cc4a', // gold
  G: '#b08a2a', // gold shadow
  p: '#ff7ad8', // nebula
  P: '#b0409a', // nebula shadow
  o: '#ff9a3a', // starfire
  O: '#ffe08a', // white gold
  a: '#c8ccdc', // silver
  A: '#7a809c', // silver shadow
  r: '#5a5f78', // stone
  R: '#3a3d52', // stone shadow
};
