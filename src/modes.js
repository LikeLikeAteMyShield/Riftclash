// Game modes offered on the title screen. Each opens its own setup screen.
// To add a mode, add an entry here with its emblem sprite
// (src/sprites/modes.js) and wire its `screen` in ui.js.
//
// A mode with `unlock: { quests, hint }` is locked until every one of those
// quests is complete (or the play-test code is used, see unlocks.js). The
// title screen shows it locked, with the hint and how far along the player is.

import { HEROES, RIFTKIN } from './cards.js';
import { CHAMPION_QUESTS, loadProgress } from './progress.js';
import { loadUnlocks, isPlaytest } from './unlocks.js';

export const MODES = [
  {
    id: 'standard',
    name: 'Enter the Rift',
    text: 'Choose a champion and a deck, and battle an AI opponent.',
    icon: 'mode_standard',
    screen: 'play',              // the class and deck selection screen
  },
  {
    id: 'riftkin',
    name: 'Challenge the Riftkin',
    text: 'Face the five celestial beings who made the Rift, each with their own powers.',
    icon: 'mode_riftkin',
    screen: 'bosses',            // the boss, class and deck selection screen
    // Opens once the player has won 5 games with every class: the Champion's Trials.
    unlock: {
      quests: CHAMPION_QUESTS.map(q => q.id),
      hint: 'Complete every Champion\'s Trial on the Quest Board to unlock.',
    },
  },
];

/** How many of a mode's unlock quests are complete: { done, total } (0 / 0 for a mode that's always open). */
export function unlockProgress(mode, progress = loadProgress()) {
  const quests = mode.unlock?.quests ?? [];
  return { done: quests.filter(id => progress.quests[id]).length, total: quests.length };
}

/** Can the player pick this mode? Always, unless it has unlock quests still to complete (the play-test code skips them). */
export function isModeUnlocked(mode, unlocks = loadUnlocks(), progress = loadProgress()) {
  if (!mode.unlock || isPlaytest(unlocks)) return true;
  const { done, total } = unlockProgress(mode, progress);
  return done === total;
}

/** Modes the player can pick right now. */
export const availableModes = (unlocks = loadUnlocks(), progress = loadProgress()) =>
  MODES.filter(m => isModeUnlocked(m, unlocks, progress));

/** The bosses of Challenge the Riftkin, in order, as hero definitions with their ids. */
export const bossChoices = () => RIFTKIN.map(id => ({ id, ...HEROES[id] }));
