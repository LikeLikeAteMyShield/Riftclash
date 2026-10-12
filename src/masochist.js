// Masochist: an experimental AI that is as hard as it can be. It cheats.
//
// It plays out its options on exact copies of the game (Game#clone carries the
// random number state), so it knows what every random effect will do and
// what both players will draw, and it can read the human's hand. Each turn:
//
//   1. Lethal: an exhaustive search of its turn for any line that wins now.
//   2. Otherwise a beam search over whole turns (every card, target, board
//      slot, hero power and attack, in every order), keeping the strongest
//      positions by a hard-nosed evaluation.
//   3. The best few finishing positions are then played forward: its turn
//      ends, the human replies (modelled two ways: the greedy AI, and an
//      all-out rush at its face), and the worse outcome counts. Each is also
//      played out to the end of the game, so it can see which lines win.
//
// It always takes the line that leaves the human worst off. Pure (no DOM), so
// it's tested in node and runs in a Web Worker in the browser (masochistworker.js).

import { CARDS } from './cards.js';
import { nextAction as greedyAction, applyAction, playTurn as greedyTurn } from './ai.js';

const WIN = 1e6;

// ---------------------------------------------------------------- evaluation

/** What effective health is worth: every point counts more as a hero gets close to dying. */
function healthValue(h) {
  if (h <= 0) return -WIN / 10;
  if (h <= 5) return h * 4;
  if (h <= 12) return 20 + (h - 5) * 2.2;
  return 35.4 + (h - 12) * 1.1;
}

/** What a minion on the board is worth to its owner. */
export function minionValue(game, m) {
  const def = game.minionText(m);
  const k = m.keywords;
  let v = m.attack * 1.1 + m.health * 0.9 + 1;
  if (k.taunt) v += 1.5 + m.health * 0.35;
  if (k.divineShield) v += 1 + m.attack * 0.9;
  if (k.windfury) v += m.attack * 0.8;
  if (k.poisonous) v += 3;
  if (k.lifesteal) v += m.attack * 0.5;
  if (k.stealth) v += 1;
  v += (m.spellDamage || 0) * 1.5;
  if (def.deathrattle) v += 2;
  if (def.endOfTurn || def.onDamaged || def.onFriendlySpell || def.onHeroAttack) v += 2.5;
  if (def.adjacentAura) v += (def.adjacentAura.attack ?? 0) * 2;
  if (m.frozen) v -= m.attack * 0.5;
  return v;
}

/** Damage a side could throw at the other hero on its next turn (minions, weapon, and burn it can afford). */
function threat(game, pid) {
  const me = game.players[pid];
  const them = game.opponentOf(pid);
  if (them.board.some(m => m.keywords.taunt)) return 0;
  let dmg = me.board.reduce((s, m) => s + (m.frozen ? 0 : m.attack * (m.keywords.windfury ? 2 : 1)), 0);
  if (me.weapon) dmg += me.weapon.attack;
  const mana = Math.min(10, me.maxMana + 1);
  let left = mana;
  const burn = me.hand.map(c => CARDS[c.cardId])
    .filter(c => c.type === 'spell' && c.cost <= mana && (c.effects || []).some(e => e.type === 'damage' && ['target', 'enemyHero', 'allEnemies', 'allOtherCharacters'].includes(e.to)))
    .sort((a, b) => a.cost - b.cost);
  for (const c of burn) {
    if (c.cost > left) break;
    left -= c.cost;
    dmg += c.effects.filter(e => e.type === 'damage').reduce((s, e) => s + e.amount * (e.times || 1), 0);
  }
  return dmg;
}

/**
 * How good a position is for `pid`: heroes' health (on a curve), board,
 * hand, weapon, and how close each side is to finishing the other.
 */
export function evaluate(game, pid) {
  if (game.winner === pid) return WIN;
  if (game.winner === 'draw') return -WIN / 2;
  if (game.winner !== null) return -WIN;
  const me = game.players[pid];
  const them = game.opponentOf(pid);
  const side = p => {
    let v = healthValue(p.hero.health + p.hero.armor);
    for (const m of p.board) v += minionValue(game, m);
    v += p.hand.reduce((s, c) => s + 2.2 + CARDS[c.cardId].cost * 0.25, 0);
    if (p.weapon) v += p.weapon.attack * p.weapon.durability * 0.7;
    if (!p.deck.length) v -= 4 + p.fatigue;
    return v;
  };
  let score = side(me) - side(them);
  // Pressure: a side that can kill the other next turn is close to winning.
  const myEff = me.hero.health + me.hero.armor, theirEff = them.hero.health + them.hero.armor;
  const theirs = threat(game, them.id), mine = threat(game, pid);
  if (theirs >= myEff) score -= 120;
  else score -= 25 * (theirs / Math.max(1, myEff)) ** 2;
  if (mine >= theirEff) score += 60;
  else score += 12 * (mine / Math.max(1, theirEff)) ** 2;
  return score;
}

// ---------------------------------------------------------------- moves

/** Board slots worth trying for a minion: every gap when neighbours matter, otherwise just the right end. */
function positions(game, pid, card) {
  const board = game.players[pid].board;
  const matters = card.adjacentAura || (card.battlecry || []).some(e => e.to === 'adjacent') || board.some(m => game.minionText(m).adjacentAura);
  return matters ? Array.from({ length: board.length + 1 }, (_, i) => i) : [board.length];
}

/** Every legal action for `pid` right now (identical cards in hand only once). */
export function legalActions(game, pid) {
  const acts = [];
  if (game.winner !== null || game.current !== pid || game.phase !== 'play') return acts;
  const p = game.players[pid];
  const seenCards = new Set();
  for (const inst of p.hand) {
    if (seenCards.has(inst.cardId) || !game.canPlay(pid, inst.uid)) continue;
    seenCards.add(inst.cardId);
    const card = CARDS[inst.cardId];
    const targets = game.cardTargets(pid, inst.uid).map(t => t.uid);
    const slots = card.type === 'minion' ? positions(game, pid, card) : [null];
    for (const target of targets.length ? targets : [null]) {
      for (const position of slots) acts.push({ type: 'play', uid: inst.uid, target, position });
    }
  }
  if (game.canUseHeroPower(pid)) {
    const hp = game.heroPower(pid);
    const targets = hp.target ? game.validTargets(pid, hp.target).map(t => t.uid) : [null];
    for (const target of targets) acts.push({ type: 'heroPower', target });
  }
  for (const a of [...p.board, p.hero]) {
    if (!game.canAttack(a.uid)) continue;
    for (const t of game.attackTargets(a.uid)) acts.push({ type: 'attack', uid: a.uid, target: t.uid });
  }
  return acts;
}

/** A compact fingerprint of a position, so the same position reached in a different order is searched once. */
function stateKey(game) {
  const ps = game.players.map(p => [
    p.hero.health, p.hero.armor, p.hero.attack, p.hero.attacksThisTurn, p.hero.frozen ? 1 : 0, p.mana, p.heroPowerUsed ? 1 : 0,
    p.weapon ? `${p.weapon.cardId}/${p.weapon.attack}/${p.weapon.durability}` : '-', p.hand.length, p.deck.length,
    p.hand.map(c => c.cardId).join(','),
    p.board.map(m => `${m.cardId}:${m.attack}:${m.health}:${m.maxHealth}:${m.attacksThisTurn}:${m.frozen ? 1 : 0}:${m.silenced ? 1 : 0}:${Object.keys(m.keywords).filter(k => m.keywords[k]).join('')}`).join('|'),
  ].join(';'));
  return `${game.rand.state}#${game.winner}#${ps.join('#')}`;
}

function step(game, action) {
  const next = game.clone();
  return applyAction(next, action) ? next : null;
}

// ---------------------------------------------------------------- search

/** Look for any line that wins this turn: depth-first over every action, each position visited once. */
function findLethal(game, pid, budget) {
  const seen = new Set();
  const dfs = (g, plan) => {
    if (budget.nodes <= 0 || budget.late?.()) return null;
    for (const act of legalActions(g, pid)) {
      if (--budget.nodes <= 0) return null;
      const next = step(g, act);
      if (!next) continue;
      if (next.winner === pid) return [...plan, act];
      if (next.winner !== null) continue;
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      const found = dfs(next, [...plan, act]);
      if (found) return found;
    }
    return null;
  };
  return dfs(game, []);
}

/** An all-out rush at the other hero: every attack and burn spell aimed at its face. A second model of the human. */
function rushTurn(game, pid) {
  for (let i = 0; i < 40 && game.winner === null; i++) {
    const them = game.opponentOf(pid).hero.uid;
    const acts = legalActions(game, pid);
    const face = acts.find(a => (a.type === 'attack' || a.type === 'heroPower' || a.type === 'play') && a.target === them)
      ?? acts.find(a => a.type === 'play' && !a.target)
      ?? acts.find(a => a.type === 'attack');
    if (!face || !applyAction(game, face)) break;
  }
  if (game.winner === null && game.current === pid) game.endTurn();
}

/** How a finishing position holds up once the turn ends and the human replies (the worse of two replies). */
function afterReply(game, pid) {
  let worst = Infinity;
  for (const reply of [greedyTurn, rushTurn]) {
    const g = game.clone();
    if (g.winner === null) g.endTurn();
    if (g.winner === null && g.current !== pid) reply(g, g.current);
    worst = Math.min(worst, evaluate(g, pid));
  }
  return worst;
}

/**
 * Play the game out to the end from a finishing position, both sides on the
 * greedy AI. With the random numbers known this is an exact forecast of how
 * that line ends (if both played greedily): a win is worth more the sooner it comes.
 */
function rollout(game, pid, maxTurns) {
  const g = game.clone();
  if (g.winner === null) g.endTurn();
  for (let t = 0; t < maxTurns && g.winner === null; t++) greedyTurn(g, g.current);
  if (g.winner === pid) return 200 - g.turn;
  if (g.winner === null) return 0;
  return g.winner === 'draw' ? -100 : -200 + g.turn;
}

/**
 * Plan the AI's whole turn: a list of actions to take in order (empty = just
 * end the turn). Budget options keep it quick: `beam` positions kept per
 * step, `finalists` scored against the human's reply, `nodes` for the lethal search.
 */
export function planTurn(game, pid, { beam = 40, finalists = 24, nodes = 12000, maxDepth = 16, rollouts = 40, ms = 700 } = {}) {
  if (game.winner !== null || game.current !== pid) return [];
  // A time cap, so a huge turn on a slow device still answers promptly.
  const deadline = performance.now() + ms;
  const late = () => performance.now() > deadline;
  const root = game.clone();
  const lethal = findLethal(root, pid, { nodes, late });
  if (lethal) return lethal;

  const seen = new Set([stateKey(root)]);
  const ends = [{ game: root, plan: [], score: evaluate(root, pid) }];
  let frontier = [ends[0]];
  for (let depth = 0; depth < maxDepth && frontier.length && !late(); depth++) {
    const next = [];
    for (const node of frontier) {
      for (const act of legalActions(node.game, pid)) {
        const g = step(node.game, act);
        if (!g) continue;
        if (g.winner === pid) return [...node.plan, act];
        const key = stateKey(g);
        if (seen.has(key)) continue;
        seen.add(key);
        const child = { game: g, plan: [...node.plan, act], score: evaluate(g, pid) };
        next.push(child);
        ends.push(child);
      }
    }
    next.sort((a, b) => b.score - a.score);
    frontier = next.slice(0, beam);
  }
  // The strongest-looking finishes, played forward against the human's reply.
  ends.sort((a, b) => b.score - a.score);
  let best = null;
  for (const end of ends.slice(0, finalists)) {
    if (best && late()) break;
    const score = afterReply(end.game, pid) + end.score * 0.05 + (rollouts ? rollout(end.game, pid, rollouts) : 0);
    if (!best || score > best.score) best = { plan: end.plan, score };
  }
  return best ? best.plan : [];
}

/**
 * Choose cards to mulligan, knowing the deck order: try every set of cards to
 * throw back and keep the opening (hand plus the next few draws) that curves out best.
 */
export function chooseMulligan(game, pid) {
  const hand = game.players[pid].hand;
  let best = { uids: [], score: -Infinity };
  for (let mask = 0; mask < 1 << hand.length; mask++) {
    const uids = hand.filter((_, i) => mask & (1 << i)).map(c => c.uid);
    const g = game.clone();
    g.mulligan(pid, uids);
    const p = g.players[pid];
    const draws = p.deck.slice(-4).reverse();   // the deck is drawn from its end
    const cards = [...p.hand, ...draws].map(c => CARDS[c.cardId]);
    let score = 0;
    // Something to play on each of the first four turns, and nothing too heavy early.
    for (let turn = 1; turn <= 4; turn++) {
      const available = cards.slice(0, p.hand.length + turn).filter(c => c.cost <= turn);
      score += available.some(c => c.cost === turn) ? 3 : available.length ? 1 : 0;
    }
    score += cards.reduce((s, c) => s + (c.type === 'minion' ? c.attack + c.health : c.cost) * 0.1, 0);
    score -= p.hand.filter(c => CARDS[c.cardId].cost > 5).length * 2;
    if (score > best.score) best = { uids, score };
  }
  return best.uids;
}

/** Play a whole turn as the Masochist (for tests and simulations). */
export function playTurn(game, pid, opts) {
  for (const action of planTurn(game, pid, opts)) {
    if (game.winner !== null || !applyAction(game, action)) break;
  }
  if (game.winner === null && game.current === pid) game.endTurn();
}

export { greedyAction };
