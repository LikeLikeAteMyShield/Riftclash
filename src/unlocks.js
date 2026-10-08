// Hidden classes and unlocking them. A class marked `hidden` in cards.js
// (Celestial) doesn't appear anywhere (class picker, opponents, library,
// deck builder, quest record) until it's unlocked.
//
// For now the only way in is a secret code typed on the main menu, for
// play-testing: the classic up, up, down, down, left, right, left, right, B, A.
// It also opens every mode still locked behind quests (see isPlaytest and
// modes.js). Typing it again locks everything away again. Boss battles will
// unlock the class for real later, through setUnlocked().
//
// Pure apart from the storage defaults, so it's unit tested in node.

import { CLASSES } from './cards.js';

const STORE_KEY = 'riftclash-unlocks';

/** The secret code, as KeyboardEvent.key values (letters compared case-insensitively). */
export const SECRET_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/** Hidden classes the code unlocks for play-testing. */
export const PLAYTEST_CLASSES = Object.keys(CLASSES).filter(cls => CLASSES[cls].hidden);

/**
 * Watch a stream of key presses for a sequence. Returns a function that takes
 * each key and returns true on the press that completes the sequence.
 */
export function sequenceMatcher(sequence) {
  const seq = sequence.map(k => k.toLowerCase());
  let recent = [];
  return key => {
    recent = [...recent, String(key).toLowerCase()].slice(-seq.length);
    if (recent.length === seq.length && recent.every((k, i) => k === seq[i])) { recent = []; return true; }
    return false;
  };
}

/** { cls: { how, at } } for each unlocked hidden class. */
export function sanitizeUnlocks(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [cls, v] of Object.entries(raw)) {
    if (CLASSES[cls]?.hidden && v && typeof v === 'object') out[cls] = { how: String(v.how ?? 'unknown'), at: Number(v.at) || 0 };
  }
  return out;
}

const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function loadUnlocks(storage = defaultStorage()) {
  try { return sanitizeUnlocks(JSON.parse(storage?.getItem(STORE_KEY) ?? 'null')); } catch { return {}; }
}

/** Unlock (or lock again) a hidden class. `how` records why, e.g. 'playtest'. */
export function setUnlocked(cls, on, { how = 'playtest', storage = defaultStorage(), now = Date.now() } = {}) {
  if (!CLASSES[cls]?.hidden) return loadUnlocks(storage);
  const unlocks = loadUnlocks(storage);
  if (on) unlocks[cls] = { how, at: now }; else delete unlocks[cls];
  try { storage.setItem(STORE_KEY, JSON.stringify(unlocks)); } catch { /* storage unavailable */ }
  return unlocks;
}

/** Has the play-test code been used? It unlocks everything: hidden classes and locked modes. */
export const isPlaytest = (unlocks = loadUnlocks()) => Object.values(unlocks).some(u => u.how === 'playtest');

/** Can the player see and use this class? Neutral and normal classes always. */
export function isVisible(cls, unlocks = loadUnlocks()) {
  return cls === 'neutral' || (!!CLASSES[cls] && (!CLASSES[cls].hidden || !!unlocks[cls]));
}

/** The classes the player can see, in their usual order. */
export function visibleClasses(unlocks = loadUnlocks()) {
  return Object.keys(CLASSES).filter(cls => isVisible(cls, unlocks));
}

/** Toggle every play-test class together; returns true if they're now unlocked. */
export function togglePlaytest(storage = defaultStorage()) {
  const on = !PLAYTEST_CLASSES.every(cls => loadUnlocks(storage)[cls]);
  for (const cls of PLAYTEST_CLASSES) setUnlocked(cls, on, { how: 'playtest', storage });
  return on;
}
