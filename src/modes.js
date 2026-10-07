// Game modes offered on the title screen. Each opens its own setup screen.
// To add a mode, add an entry here with its emblem sprite
// (src/sprites/modes.js) and wire its `screen` in ui.js.
//
// A mode with `unlockedWith: cls` stays off the title screen until that
// hidden class is unlocked (see unlocks.js).

import { HEROES, RIFTKIN } from './cards.js';
import { loadUnlocks, isVisible } from './unlocks.js';

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
    // For now the whole mode unlocks with Celestial (the play-test code).
    // Unlocking the bosses one at a time through quests comes later.
    unlockedWith: 'celestial',
  },
];

/** Modes the player can pick right now. */
export const availableModes = (unlocks = loadUnlocks()) =>
  MODES.filter(m => !m.unlockedWith || isVisible(m.unlockedWith, unlocks));

/** The bosses of Challenge the Riftkin, in order, as hero definitions with their ids. */
export const bossChoices = () => RIFTKIN.map(id => ({ id, ...HEROES[id] }));
