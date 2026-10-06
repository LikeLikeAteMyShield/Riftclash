// Player progress: win/loss stats and quests. Quests are like achievements:
// each one watches the stats and is marked complete (for good) once its goal
// is met. Everything here is pure except the storage defaults, so it's unit
// tested in node; ui.js records each finished game and shows the quest screen.

import { CLASSES } from './cards.js';

const STORE_KEY = 'riftclash-progress';
export const RESULTS = ['win', 'loss', 'draw'];

/**
 * Quest definitions. `progress(stats)` returns how far along the player is;
 * the quest completes when that reaches `goal`. To add a quest, add an entry.
 */
export const QUESTS = [
  {
    id: 'win5',
    title: 'Proven in Battle',
    text: 'Win 5 games.',
    goal: 5,
    progress: stats => stats.wins,
  },
];

const emptyRecord = () => ({ played: 0, wins: 0, losses: 0, draws: 0 });

export function emptyStats() {
  return { ...emptyRecord(), streak: 0, bestStreak: 0, byClass: {} };
}

export function emptyProgress() {
  return { stats: emptyStats(), quests: {} };   // quests: { id: { completedAt } }
}

const tally = (rec, result) => ({
  played: rec.played + 1,
  wins: rec.wins + (result === 'win'),
  losses: rec.losses + (result === 'loss'),
  draws: rec.draws + (result === 'draw'),
});

/** Stats after one more game, played as `cls`. */
export function recordResult(stats, { cls, result }) {
  if (!RESULTS.includes(result)) throw new Error(`Unknown result "${result}"`);
  const streak = result === 'win' ? stats.streak + 1 : 0;
  const byClass = { ...stats.byClass };
  if (CLASSES[cls]) byClass[cls] = tally(byClass[cls] ?? emptyRecord(), result);
  return { ...tally(stats, result), streak, bestStreak: Math.max(stats.bestStreak, streak), byClass };
}

/** Every quest with the player's progress: { ...quest, value, done, completedAt }. */
export function questStatus(progress) {
  return QUESTS.map(q => {
    const value = Math.min(q.goal, Math.max(0, q.progress(progress.stats)));
    const completedAt = progress.quests[q.id]?.completedAt ?? null;
    return { ...q, value, done: completedAt !== null, completedAt };
  });
}

/**
 * Mark any quests whose goal is now met as complete. Completed quests stay
 * complete. Returns the new progress and the quests completed just now.
 */
export function updateQuests(progress, now = Date.now()) {
  const quests = { ...progress.quests };
  const completed = [];
  for (const q of QUESTS) {
    if (quests[q.id]) continue;
    if (q.progress(progress.stats) >= q.goal) {
      quests[q.id] = { completedAt: now };
      completed.push(q);
    }
  }
  return { progress: { ...progress, quests }, completed };
}

/** Record a finished game and update quests in one step. */
export function applyGame(progress, game, now = Date.now()) {
  return updateQuests({ ...progress, stats: recordResult(progress.stats, game) }, now);
}

/** Win rate as a whole percentage, or null before any games (draws count as games played). */
export const winRate = rec => (rec.played ? Math.round(rec.wins / rec.played * 100) : null);

// ---------------------------------------------------------------- storage

const count = v => (Number.isInteger(v) && v >= 0 ? v : 0);
const cleanRecord = r => ({ played: count(r?.played), wins: count(r?.wins), losses: count(r?.losses), draws: count(r?.draws) });

/** Turn whatever was stored into well-formed progress; anything unreadable becomes zero. */
export function sanitizeProgress(raw) {
  const p = emptyProgress();
  if (!raw || typeof raw !== 'object') return p;
  const s = raw.stats ?? {};
  p.stats = { ...cleanRecord(s), streak: count(s.streak), bestStreak: count(s.bestStreak), byClass: {} };
  for (const cls of Object.keys(CLASSES)) if (s.byClass?.[cls]) p.stats.byClass[cls] = cleanRecord(s.byClass[cls]);
  for (const q of QUESTS) {
    const at = raw.quests?.[q.id]?.completedAt;
    if (Number.isFinite(at)) p.quests[q.id] = { completedAt: at };
  }
  return p;
}

const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function loadProgress(storage = defaultStorage()) {
  try { return sanitizeProgress(JSON.parse(storage?.getItem(STORE_KEY) ?? 'null')); } catch { return emptyProgress(); }
}

export function saveProgress(progress, storage = defaultStorage()) {
  try { storage.setItem(STORE_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}

/** Load, record a game, save. Returns { progress, completed } for the UI to celebrate. */
export function recordGame(game, storage = defaultStorage(), now = Date.now()) {
  const out = applyGame(loadProgress(storage), game, now);
  saveProgress(out.progress, storage);
  return out;
}
