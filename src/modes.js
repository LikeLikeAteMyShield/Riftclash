// Game modes offered on the title screen. Each opens its own setup screen.
// To add a mode (e.g. boss battles), add an entry here with its emblem
// sprite (src/sprites/modes.js) and wire its `screen` in ui.js.

export const MODES = [
  {
    id: 'standard',
    name: 'Enter the Rift',
    text: 'Choose a champion and a deck, and battle an AI opponent.',
    icon: 'mode_standard',
    screen: 'play',              // the class and deck selection screen
  },
];

/** Modes the player can pick right now (all of them, for now; later some may need unlocking). */
export const availableModes = () => MODES.filter(m => !m.hidden);
