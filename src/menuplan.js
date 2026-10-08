// The main menu battle's choreography: who stands where, which pose each hero
// is in on any beat, and the schedule of attacks. Pure data and functions (no
// DOM), so they are unit tested; src/menuscene.js does the drawing.

import { SONGS } from './songs.js';

export const SCENE_H = 180;
export const MENU_BPM = SONGS.menu.bpm;   // the menu theme's tempo, so the scene keeps time even with music off
export const CYCLE = 16;          // beats in one round of the choreography (four bars)
export const GROUND = SCENE_H - 4;  // heroes' feet
export const FIG = 32;              // hero sprite size

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Scene width in low-res pixels for a viewport, so the canvas fills it without cropping much. */
export function sceneWidth(viewW, viewH) {
  return clamp(Math.round(SCENE_H * viewW / Math.max(1, viewH)), 90, 400);
}

// Who fights, front line first. Narrow screens keep the most exciting pairs.
const LINEUPS = {
  1: [['warlord'], ['shade']],
  2: [['warlord', 'pyromancer'], ['shade', 'stalker']],
  3: [['vanguard', 'warlord', 'pyromancer'], ['shade', 'stalker', 'oracle']],
};

/**
 * Where each hero stands: the left army faces right, the right army faces
 * left, with a gap in the middle where they clash.
 * @returns {{ cls: string, side: 'L'|'R', rank: number, x: number, y: number, facing: 1|-1 }[]}
 */
export function layoutHeroes(W) {
  const n = W >= 250 ? 3 : W >= 160 ? 2 : 1;
  const gap = Math.round(Math.min(34, W * 0.12));
  const front = Math.round(W / 2 - gap - 26);
  const step = n > 1 ? Math.min(34, Math.floor((front + 2) / (n - 1))) : 0;
  const out = [];
  LINEUPS[n].forEach((names, s) => names.forEach((cls, rank) => {
    const xl = front - rank * step;
    out.push({
      cls, side: s ? 'R' : 'L', rank,
      x: s ? W - xl - FIG : xl,
      y: GROUND - FIG - rank * 3,          // the back ranks stand on rocks
      facing: s ? -1 : 1,
    });
  }));
  return out;
}

/**
 * What happens in each round, by beat. `who` must be in the lineup for the
 * event to happen (lightning always strikes).
 */
export const SCHEDULE = [
  { beat: 0, who: 'pyromancer', type: 'fireball' },
  { beat: 8, who: 'pyromancer', type: 'fireball' },
  { beat: 2, who: 'stalker', type: 'arrow' },
  { beat: 6, who: 'stalker', type: 'arrow' },
  { beat: 10, who: 'stalker', type: 'arrow' },
  { beat: 14, who: 'stalker', type: 'arrow' },
  { beat: 6, who: 'warlord', type: 'slam' },
  { beat: 9, who: 'shade', type: 'vanish' },
  { beat: 10, who: 'shade', type: 'slash' },
  { beat: 11, who: 'shade', type: 'appear' },
  { beat: 13.5, who: 'shade', type: 'dagger' },
  { beat: 12.5, who: 'oracle', type: 'heal' },
  { beat: 4, who: null, type: 'lightning' },
  { beat: 12, who: null, type: 'lightning' },
];

/** Events whose time falls in (from, to], in order. Times repeat every CYCLE beats. */
export function eventsBetween(from, to) {
  const out = [];
  if (!(to > from)) return out;
  for (let k = Math.floor(from / CYCLE); k * CYCLE <= to; k++) {
    for (const e of SCHEDULE) {
      const at = k * CYCLE + e.beat;
      if (at > from && at <= to) out.push({ ...e, at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * A hero's pose at a beat: which sprite frame, and for the Warlord how far
 * through his leap he is (0 = home, 1 = landed in the middle).
 */
export function poseAt(cls, beat) {
  const b16 = ((beat % CYCLE) + CYCLE) % CYCLE;
  const b8 = b16 % 8, b4 = b16 % 4;
  switch (cls) {
    case 'warlord':
      if (b16 >= 3 && b16 < 4) return { frame: 'windup', leap: 0, crouch: 1 };
      if (b16 >= 4 && b16 < 6) return { frame: 'windup', leap: (b16 - 4) / 2, air: true };
      if (b16 >= 6 && b16 < 7) return { frame: 'strike', leap: 1 };
      if (b16 >= 7 && b16 < 8) return { frame: 'strike', leap: 1 - (b16 - 7), air: true };
      return { frame: 'strike', leap: 0 };
    case 'pyromancer': return { frame: b8 < 1 ? 'throw' : 'ready' };
    case 'stalker': return { frame: b4 >= 2 && b4 < 2.6 ? 'loose' : 'draw' };
    case 'vanguard': return { frame: b16 >= 12 && b16 < 13.2 ? 'thrust' : 'guard' };
    case 'oracle': return { frame: (b8 >= 0.5 && b8 < 2.5) || (b16 >= 12.5 && b16 < 14) ? 'cast' : 'idle' };
    case 'shade':
      if (b16 >= 9 && b16 < 11) return { frame: 'dash', hidden: true };
      if (b16 >= 11 && b16 < 11.6) return { frame: 'dash' };
      return { frame: 'stand' };
    default: return { frame: 'idle' };
  }
}
