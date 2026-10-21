// The tutorial: a scripted match that teaches the basics, on rails.
//
// Everything about it is fixed: the seed, both decks (stacked, so every draw
// is known), who goes first, and every move either side makes. The player is
// coached through each of their moves in turn, and anything else is refused,
// so the match plays out the same way every time and ends in a win.
//
// The script is a list of steps:
//   { text, point }        a tip; the player reads it and clicks Next
//   { text, do: [...] }    the player's moves, in any order (all of them, then the step is done)
//   { ai: [...] }          the opponent's whole turn (it ends its turn after them)
// Moves name things by card id rather than uid, so the script reads well:
//   { type: 'play', card, target, position }, { type: 'attack', from, to },
//   { type: 'heroPower', target }, { type: 'endTurn' }, { type: 'mulligan' }
// where a character is 'hero', 'enemyHero', 'mine:<cardId>' or 'theirs:<cardId>'
// (relative to whoever is moving; with several copies, the first one able to act).
// `point` names what a tip is about, for the UI to highlight: one of those,
// or 'mana', 'heroPower', 'endTurn', 'hand:<cardId>' or 'mulligan'.
//
// Pure, so it's tested in node (the script is played through to the win).
// ui.js shows the tips and highlights, and plays the opponent's turns.

import { Game } from './engine.js';

export const HUMAN = 0;
export const AI = 1;

/** The match itself. Decks are listed in draw order: the first cards are the opening hand. */
export const TUTORIAL_SETUP = {
  heroes: ['hale', 'ignatia'],
  seed: 20261021,
  firstPlayer: HUMAN,
  health: [30, 25],
  board: 'highkeep',
  decks: [
    [
      'n_mossling', 'v_captain', 'v_aegis',      // opening hand
      'v_justicar', 'v_hammer', 'v_cavalier',     // drawn on turns 1 to 3
      'v_banner', 'n_treant', 'n_colossus',       // turns 4 to 6
      ...Array(21).fill('n_scrapper'),
    ],
    [
      'n_mossling', 'n_scrapper', 'n_boar', 'n_ram',   // opening hand (and the Ember Coin)
      'n_sorcerer', 'n_wyvern', 'n_treant', 'n_sentinel', 'n_colossus', 'n_dervish',
      ...Array(20).fill('n_courier'),
    ],
  ],
};

export const STEPS = [
  // ---- The opening hand
  { text: 'Welcome to Riftclash! This practice battle walks you through the basics. You are Commander Hale, a Vanguard.', point: 'mulligan' },
  { text: 'These are your opening cards. In a real game you can click cards to swap them for new ones before the battle starts. This hand is just right, so keep it: click Confirm.',
    do: [{ type: 'mulligan' }] },

  // ---- Turn 1: heroes, mana, playing a minion
  { text: 'This is you. Your hero has 30 Health. Bring the enemy hero to 0 Health to win.', point: 'hero' },
  { text: 'Your opponent is Ignatia the Kindled. She\'s going easy on you today: she starts with only 25 Health.', point: 'enemyHero' },
  { text: 'Cards cost mana. You gain a mana crystal every turn (up to 10), and they all refill at the start of your turn. You have 1 to spend.', point: 'mana' },
  { text: 'A card\'s cost is in its top corner. Mossling costs 1: drag it onto the board, or click it, to play it.',
    do: [{ type: 'play', card: 'n_mossling', position: 0 }] },
  { text: 'Minions can\'t attack on the turn they arrive. Mossling will be ready next turn.', point: 'mine:n_mossling' },
  { text: 'High Justicar costs 7 mana, so it will have to wait. You\'re out of mana: click End Turn.',
    do: [{ type: 'endTurn' }] },
  { ai: [{ type: 'play', card: 'n_mossling', position: 0 }] },

  // ---- Turn 2: attacking and trading, Battlecry
  { text: 'Ignatia played a Mossling too. A minion\'s Attack is on the left and its Health on the right.', point: 'theirs:n_mossling' },
  { text: 'Your Mossling is ready. Click it, then click the enemy Mossling to attack. Minions that fight deal their Attack to each other at the same time.',
    do: [{ type: 'attack', from: 'mine:n_mossling', to: 'theirs:n_mossling' }] },
  { text: 'Both Mosslings were destroyed. Trading minions like this keeps the enemy\'s board under control.' },
  { text: 'Play Militia Captain. A Battlecry happens when you play the card from your hand: this one brings a 1/1 Recruit along.',
    do: [{ type: 'play', card: 'v_captain', position: 0 }] },
  { text: 'That\'s your mana spent. End your turn.', do: [{ type: 'endTurn' }] },
  { ai: [{ type: 'play', card: 'n_scrapper', position: 0 }] },

  // ---- Turn 3: spells and targets, Divine Shield, the hero power, going face
  { text: 'Alley Scrapper hits for 3: enough to destroy your Captain in a fair fight. Let\'s make it unfair.', point: 'theirs:n_scrapper' },
  { text: 'Spells take effect straight away. Cast Aegis Blessing on your Militia Captain: +1 Attack and Divine Shield, which blocks the next damage it would take.',
    do: [{ type: 'play', card: 'v_aegis', target: 'mine:v_captain' }] },
  { text: 'Now attack the Alley Scrapper with your Captain. The shield takes the hit.',
    do: [{ type: 'attack', from: 'mine:v_captain', to: 'theirs:n_scrapper' }] },
  { text: 'Every hero has a Hero Power, usable once a turn. Commander Hale\'s summons a Recruit for 2 mana. Click it.',
    do: [{ type: 'heroPower' }] },
  { text: 'Minions can attack the enemy hero, too. Send your first Recruit at Ignatia.',
    do: [{ type: 'attack', from: 'mine:t_recruit', to: 'enemyHero' }] },
  { text: 'Out of mana again. End your turn.', do: [{ type: 'endTurn' }] },
  { ai: [{ type: 'play', card: 'n_boar', position: 0 }] },

  // ---- Turn 4: Taunt, weapons and hero attacks
  { text: 'Ironhide Boar has Taunt (the shield border). While the enemy has a Taunt minion, your attacks must go through it.', point: 'theirs:n_boar' },
  { text: 'Weapons let your hero fight. Equip the Oathkeeper Hammer.',
    do: [{ type: 'play', card: 'v_hammer' }] },
  { text: 'Click your hero, then attack the Boar. Heroes take damage back from the minions they hit, just like minions do.',
    do: [{ type: 'attack', from: 'hero', to: 'theirs:n_boar' }] },
  { text: 'The Boar has 1 Health left. Finish it off with a Recruit.',
    do: [{ type: 'attack', from: 'mine:t_recruit', to: 'theirs:n_boar' }] },
  { text: 'The way is clear. Attack Ignatia with your Captain and your other Recruit.',
    do: [{ type: 'attack', from: 'mine:v_captain', to: 'enemyHero' }, { type: 'attack', from: 'mine:t_recruit', to: 'enemyHero' }] },
  { text: 'End your turn.', do: [{ type: 'endTurn' }] },
  { ai: [{ type: 'play', card: 'n_ram', position: 0 }, { type: 'attack', from: 'mine:n_ram', to: 'enemyHero' }] },

  // ---- Turn 5: Charge and Rush
  { text: 'Thornback Ram has Charge: it can attack the turn it\'s played. That cost you 4 Health.', point: 'theirs:n_ram' },
  { text: 'Silverlance Cavalier has Rush (it can attack minions straight away) and Divine Shield. Play it.',
    do: [{ type: 'play', card: 'v_cavalier', position: 0 }] },
  { text: 'Charge into the Ram with your Cavalier.',
    do: [{ type: 'attack', from: 'mine:v_cavalier', to: 'theirs:n_ram' }] },
  { text: 'Now hit Ignatia with everything else: your hero, your Captain and your Recruit.',
    do: [{ type: 'attack', from: 'hero', to: 'enemyHero' }, { type: 'attack', from: 'mine:v_captain', to: 'enemyHero' }, { type: 'attack', from: 'mine:t_recruit', to: 'enemyHero' }] },
  { text: 'End your turn.', do: [{ type: 'endTurn' }] },
  { ai: [{ type: 'play', card: 'n_sorcerer', target: 'enemyHero', position: 0 }] },

  // ---- Turn 6: counting lethal
  { text: 'Ignatia\'s Sorcerer used its Battlecry on you. But she\'s down to 13 Health, and your hero and minions can deal 11. Not quite enough...', point: 'enemyHero' },
  { text: '...unless you make them stronger. Rallying Banner gives all your minions +1 Attack and +1 Health. Cast it.',
    do: [{ type: 'play', card: 'v_banner' }] },
  { text: 'That\'s 14 damage: lethal! Attack Ignatia with everything you have.',
    do: [{ type: 'attack', from: 'hero', to: 'enemyHero' }, { type: 'attack', from: 'mine:v_captain', to: 'enemyHero' },
      { type: 'attack', from: 'mine:t_recruit', to: 'enemyHero' }, { type: 'attack', from: 'mine:v_cavalier', to: 'enemyHero' }] },
];

/** The tutorial match, before anything has happened. */
export function createTutorialGame(opts = {}) {
  const { heroes, seed, firstPlayer, health, decks } = TUTORIAL_SETUP;
  return new Game({ heroes, seed, firstPlayer, health, decks, stacked: true, ...opts });
}

/** A character named in the script, as seen by `pid`: the entity, or null. */
export function findRef(game, pid, ref, { attacker = false } = {}) {
  const me = game.players[pid], them = game.players[1 - pid];
  if (ref === 'hero') return me.hero;
  if (ref === 'enemyHero') return them.hero;
  const [side, cardId] = String(ref).split(':');
  const board = side === 'mine' ? me.board : side === 'theirs' ? them.board : [];
  const copies = board.filter(m => m.cardId === cardId);
  return (attacker ? copies.find(m => game.canAttack(m.uid)) : null) ?? copies[0] ?? null;
}

/**
 * A scripted move as the engine takes it, resolved against the game as it is
 * now: { type: 'play', uid, target, position } and so on (the same shape
 * as ai.js's actions, plus 'endTurn' and 'mulligan'). Null if it can't be found.
 */
export function resolveMove(game, pid, move) {
  const uidOf = (ref, opts) => (ref == null ? null : findRef(game, pid, ref, opts)?.uid ?? undefined);
  if (move.type === 'play') {
    const uid = game.players[pid].hand.find(c => c.cardId === move.card)?.uid;
    const target = uidOf(move.target);
    if (uid == null || target === undefined) return null;
    return { type: 'play', uid, cardId: move.card, target, position: move.position ?? null };
  }
  if (move.type === 'attack') {
    const uid = uidOf(move.from, { attacker: true }), target = uidOf(move.to);
    return uid == null || target == null ? null : { type: 'attack', uid, target };
  }
  if (move.type === 'heroPower') {
    const target = uidOf(move.target);
    return target === undefined ? null : { type: 'heroPower', target };
  }
  return { type: move.type };
}

const sameMove = (want, got, sources = [want.uid]) => want.type === got.type && (
  want.type === 'play' ? want.uid === got.uid && (want.target ?? null) === (got.target ?? null)
    : want.type === 'attack' ? sources.includes(got.uid) && want.target === got.target
      : want.type === 'heroPower' ? (want.target ?? null) === (got.target ?? null)
        : want.type === 'mulligan' ? !got.uids?.length
          : true);

/**
 * A tutorial in progress: the game, where the script has got to, and the
 * rules that keep the player on it. Create one, then play through `game` as
 * usual: the player's moves that aren't the next ones in the script are
 * refused (with `lastError` saying why), as in any illegal move.
 */
export class Tutorial {
  constructor({ steps = STEPS, game = createTutorialGame() } = {}) {
    this.steps = steps;
    this.game = game;
    this.index = 0;
    this.done = new Set();   // which of the current step's moves have been made
    this.aiDone = 0;         // how many of the current opponent turn's moves have been made
    this.game.mulligan(AI, []);
    this.#guard();
  }

  get step() { return this.steps[this.index] ?? null; }

  /** Is the script over (and the match won)? */
  get complete() { return this.game.winner === HUMAN && this.index >= this.steps.length; }

  /** Is the current step a tip waiting for Next? */
  get waiting() { return !!this.step && !this.step.do && !this.step.ai; }

  /** Move past a tip. */
  next() {
    if (!this.waiting) return false;
    this.#advance();
    return true;
  }

  /**
   * The moves the player still has to make this step, resolved to uids.
   * `sources` lists every character that may make an attack: any ready copy
   * of the minion the script names (two Recruits are as good as each other).
   */
  pending() {
    const s = this.step;
    if (!s?.do) return [];
    const g = this.game;
    return s.do.flatMap((move, index) => {
      const action = this.done.has(index) ? null : resolveMove(g, HUMAN, move);
      if (!action) return [];
      const copies = action.type === 'attack' && String(move.from).startsWith('mine:')
        ? g.players[HUMAN].board.filter(m => m.cardId === g.getEntity(action.uid).cardId && g.canAttack(m.uid)).map(m => m.uid) : [];
      return [{ index, move, action, sources: copies.length ? copies : [action.uid] }];
    });
  }

  /** The pending move this one makes, if any. */
  #matching(got) { return this.pending().find(p => sameMove(p.action, got, p.sources)); }

  /** Is it the opponent's scripted turn? */
  get aiTurn() { return !!this.step?.ai; }

  /** The opponent's next scripted move (an ai.js action), or null once its turn's moves are all made. */
  aiAction() {
    const s = this.step;
    if (!s?.ai) return null;
    const move = s.ai[this.aiDone];
    if (!move) { this.#advance(); return null; }
    this.aiDone++;
    return resolveMove(this.game, AI, move);
  }

  /** Why the player can't make a move right now, or null if it's the next one in the script. */
  check(got) {
    if (this.game.winner !== null) return 'The battle is over.';
    if (!this.step) return null;
    if (this.waiting) return 'Read the tip, then click Next.';
    if (this.aiTurn) return 'Wait for your opponent.';
    if (this.#matching(got)) return null;
    if (got.type === 'mulligan') return 'Keep this hand for now: click Confirm.';
    return 'Not yet. Follow the tip: the highlighted move is the one to make.';
  }

  #advance() {
    this.index++;
    this.done = new Set();
    this.aiDone = 0;
  }

  /** Wrap the game's moves so only the scripted ones get through (the opponent's moves aren't checked). */
  #guard() {
    const g = this.game;
    const wrap = (name, toMove, call) => {
      const original = g[name].bind(g);
      g[name] = (...args) => {
        if (name !== 'mulligan' ? g.current !== HUMAN : args[0] !== HUMAN) return original(...args);
        const got = toMove(...args);
        const why = this.check(got);
        if (why) { g.lastError = why; return false; }
        const p = this.#matching(got);
        const ok = call(original, p?.action, args);
        if (ok && p) {
          this.done.add(p.index);
          if (this.done.size === this.step.do.length) this.#advance();
        }
        return ok;
      };
    };
    wrap('mulligan', (pid, uids = []) => ({ type: 'mulligan', uids }), (orig) => orig(HUMAN, []));
    // A minion goes where the script puts it, wherever it was dropped, so the board always matches the script.
    wrap('playCard', (uid, { target = null } = {}) => ({ type: 'play', uid, target }),
      (orig, want, [uid, opts = {}]) => orig(uid, { ...opts, position: want?.position ?? opts.position ?? null }));
    wrap('attack', (uid, target) => ({ type: 'attack', uid, target }), (orig, want, args) => orig(...args));
    wrap('useHeroPower', (target = null) => ({ type: 'heroPower', target }), (orig, want, args) => orig(...args));
    wrap('endTurn', () => ({ type: 'endTurn' }), (orig) => orig());
  }
}

/**
 * Play the whole script out with no one watching (for tests): tips are
 * clicked through, the player's moves made, and the opponent's turns played.
 * `onTip(step, tutorial)` sees each tip before it's clicked through.
 * Returns the tutorial; throws if the script ever stops matching the game.
 */
export function playThrough(tutorial = new Tutorial({ game: createTutorialGame({ silent: true }) }), { onTip } = {}) {
  const g = tutorial.game;
  for (let guard = 0; tutorial.step && guard < 500; guard++) {
    const s = tutorial.step;
    if (tutorial.waiting) { onTip?.(s, tutorial); tutorial.next(); continue; }
    if (s.ai) {
      const a = tutorial.aiAction();
      if (!a) { if (!g.endTurn()) throw new Error('The opponent could not end its turn'); continue; }
      const ok = a.type === 'play' ? g.playCard(a.uid, { target: a.target, position: a.position })
        : a.type === 'attack' ? g.attack(a.uid, a.target) : a.type === 'heroPower' ? g.useHeroPower(a.target) : false;
      if (!ok) throw new Error(`Step ${tutorial.index}: the opponent's ${a.type} failed (${g.lastError})`);
      continue;
    }
    const [p] = tutorial.pending();
    if (!p) throw new Error(`Step ${tutorial.index}: a scripted move can't be found on the board`);
    const a = p.action;
    const ok = a.type === 'mulligan' ? g.mulligan(HUMAN, [])
      : a.type === 'play' ? g.playCard(a.uid, { target: a.target })
        : a.type === 'attack' ? g.attack(a.uid, a.target)
          : a.type === 'heroPower' ? g.useHeroPower(a.target) : g.endTurn();
    if (!ok) throw new Error(`Step ${tutorial.index}: ${a.type} failed (${g.lastError})`);
  }
  return tutorial;
}
