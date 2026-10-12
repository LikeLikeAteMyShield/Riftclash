// Match transcripts: a full record of a game, for studying how people play
// (and where the AI goes wrong).
//
// A transcript holds the exact starting state (Game#snapshot, random number
// state included) and every action both players took, in order. The engine
// is deterministic, so replay() rebuilds the whole match move for move. For
// reading by eye it also carries a summary of the position at the end of
// every turn, and the battle log.
//
// Pure apart from the storage defaults, so it's tested in node. ui.js starts
// one per match (while the play-test code is on), saves it when the game ends,
// and offers downloads.

import { Game } from './engine.js';
import { CARDS, HEROES } from './cards.js';

export const FORMAT = 'riftclash-transcript';
export const VERSION = 1;
const STORE_KEY = 'riftclash-transcripts';
export const MAX_SAVED = 50;

const ACTIONS = ['mulligan', 'playCard', 'useHeroPower', 'attack', 'endTurn'];

/** A readable name for whatever has a uid: a minion, a hero, or a card in hand. */
function nameOf(game, uid) {
  if (uid == null) return null;
  const e = game.getEntity(uid);
  if (e) return e.kind === 'hero' ? `${HEROES[game.players[e.owner].heroId].name} (P${e.owner} hero)` : `${CARDS[e.cardId].name} (P${e.owner}, ${e.attack}/${e.health})`;
  for (const p of game.players) {
    const c = p.hand.find(h => h.uid === uid);
    if (c) return CARDS[c.cardId].name;
  }
  return `#${uid}`;
}

/** What an action is, in words and ids, captured before it happens (while its pieces still exist). */
function describe(game, type, args) {
  if (type === 'mulligan') {
    const [player, uids = []] = args;
    const hand = game.players[player].hand;
    return { player, returned: uids.map(u => hand.find(c => c.uid === u)?.cardId).filter(Boolean), uids: [...uids], kept: hand.filter(c => !uids.includes(c.uid)).map(c => c.cardId) };
  }
  const player = game.current;
  if (type === 'playCard') {
    const [uid, { target = null, position = null } = {}] = args;
    const cardId = game.players[player].hand.find(c => c.uid === uid)?.cardId;
    return { player, uid, cardId, card: CARDS[cardId]?.name, target, targetName: nameOf(game, target), position };
  }
  if (type === 'useHeroPower') {
    const [target = null] = args;
    return { player, power: game.heroPower(player).name, target, targetName: nameOf(game, target) };
  }
  if (type === 'attack') {
    const [uid, target] = args;
    return { player, uid, attacker: nameOf(game, uid), target, targetName: nameOf(game, target) };
  }
  return { player };
}

/** The position in brief: both heroes, boards, hands (both: this is for study) and decks. */
export function summarize(game) {
  return {
    turn: game.turn,
    current: game.current,
    players: game.players.map(p => ({
      hero: { health: p.hero.health, armor: p.hero.armor, attack: p.hero.attack },
      weapon: p.weapon && { card: CARDS[p.weapon.cardId].name, attack: p.weapon.attack, durability: p.weapon.durability },
      mana: `${p.mana}/${p.maxMana}`,
      board: p.board.map(m => {
        const kw = Object.keys(m.keywords).filter(k => m.keywords[k]);
        return `${CARDS[m.cardId].name} ${m.attack}/${m.health}${kw.length ? ` [${kw.join(', ')}]` : ''}${m.silenced ? ' (silenced)' : ''}${m.frozen ? ' (frozen)' : ''}`;
      }),
      hand: p.hand.map(c => CARDS[c.cardId].name),
      deck: p.deck.length,
    })),
  };
}

/**
 * Start recording a game: call before any action is taken (straight after
 * `new Game`). `meta` describes the match (mode, opponent AI, board, decks...).
 * Returns the transcript, which fills in as the game is played.
 */
export function startTranscript(game, meta = {}) {
  const t = {
    format: FORMAT, version: VERSION,
    startedAt: new Date().toISOString(), endedAt: null,
    meta: {
      ...meta,
      heroes: game.players.map(p => p.heroId),
      classes: game.players.map(p => p.heroClass),
      players: ['human', meta.ai ?? 'ai'],
    },
    start: game.snapshot(),
    actions: [],
    turns: [],
    result: null,
    log: [],
  };
  for (const type of ACTIONS) {
    const original = game[type].bind(game);
    game[type] = (...args) => {
      const before = { n: t.actions.length, turn: game.turn, type, ...describe(game, type, args) };
      const ok = original(...args);
      if (ok) {
        t.actions.push(before);
        // A summary at the end of every turn (and when the game ends mid-turn).
        if (type === 'endTurn' || game.winner !== null) t.turns.push({ after: before.n, ...summarize(game) });
      }
      return ok;
    };
  }
  return t;
}

/** Close a transcript once the game is over. */
export function finishTranscript(t, game) {
  t.endedAt = new Date().toISOString();
  t.result = { winner: game.winner, turns: game.turn, outcome: game.winner === 0 ? 'human win' : game.winner === 1 ? 'ai win' : game.winner === 'draw' ? 'draw' : 'unfinished' };
  t.log = [...game.log];
  return t;
}

/** Arguments to call a recorded action with again. */
function argsFor(a) {
  if (a.type === 'mulligan') return [a.player, a.uids];
  if (a.type === 'playCard') return [a.uid, { target: a.target, position: a.position }];
  if (a.type === 'useHeroPower') return [a.target];
  if (a.type === 'attack') return [a.uid, a.target];
  return [];
}

/**
 * Rebuild a match from its transcript: the starting state, then every action
 * in order. Stops at `upTo` actions if given (to look at a position mid-game).
 * Throws if an action no longer applies (e.g. the card rules changed since).
 */
export function replay(t, { upTo = Infinity } = {}) {
  if (t?.format !== FORMAT) throw new Error('Not a Riftclash transcript');
  const g = Game.restore(t.start, { silent: true });
  for (const a of t.actions.slice(0, upTo)) {
    if (a.type !== 'mulligan' && g.current !== a.player) throw new Error(`Action ${a.n}: expected player ${a.player} to act`);
    if (!g[a.type](...argsFor(a))) throw new Error(`Action ${a.n} (${a.type}) no longer applies: ${g.lastError ?? 'rejected'}`);
  }
  return g;
}

// ---------------------------------------------------------------- storage

const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/** Keep only well-formed transcripts. */
export function sanitizeTranscripts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(t => t && typeof t === 'object' && t.format === FORMAT && t.start && Array.isArray(t.actions)).slice(-MAX_SAVED);
}

export function loadTranscripts(storage = defaultStorage()) {
  try { return sanitizeTranscripts(JSON.parse(storage?.getItem(STORE_KEY) ?? '[]')); } catch { return []; }
}

/** Save a finished match, keeping the latest MAX_SAVED (dropping the oldest if storage runs out of room). */
export function saveTranscript(t, storage = defaultStorage()) {
  let all = [...loadTranscripts(storage), t].slice(-MAX_SAVED);
  while (all.length) {
    try { storage.setItem(STORE_KEY, JSON.stringify(all)); return true; } catch { all = all.slice(1); }
  }
  return false;
}

export function clearTranscripts(storage = defaultStorage()) {
  try { storage.removeItem(STORE_KEY); } catch { /* storage unavailable */ }
}

/** Everything saved, as one file to hand over for analysis. */
export function exportBundle(transcripts) {
  return { format: 'riftclash-transcripts', version: VERSION, exportedAt: new Date().toISOString(), count: transcripts.length, games: transcripts };
}
