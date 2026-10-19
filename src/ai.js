// A simple greedy AI. `nextAction` returns one action at a time so the UI can
// animate the AI's turn; it returns null when the AI wants to end its turn.

import { CARDS } from './cards.js';

const HOSTILE = new Set(['damage', 'destroy', 'freeze', 'bounce']);

function targetIntent(effects = []) {
  const targeted = effects.filter(e => e.to === 'target');
  if (!targeted.length) return null;
  return targeted.some(e => HOSTILE.has(e.type)) ? 'hostile' : 'friendly';
}

function damageAmount(effects = []) {
  return effects.filter(e => e.type === 'damage' && e.to === 'target').reduce((s, e) => s + e.amount, 0);
}

/** Rough value of an AoE spell or battlecry: enemy stats removed minus friendly stats lost. */
function aoeValue(game, pid, effects, isSpell = true) {
  let value = 0;
  const me = game.players[pid];
  const them = game.opponentOf(pid);
  for (const e of effects) {
    if (e.type !== 'damage' || e.to === 'target' || e.to.startsWith('random')) continue;
    const amt = e.amount + (isSpell ? game.spellDamage(pid) : 0);
    const hitsEnemies = ['allEnemyMinions', 'allMinions', 'allEnemies', 'allOtherCharacters', 'allOtherMinions'].includes(e.to);
    const hitsFriends = ['allMinions', 'allOtherCharacters', 'allOtherMinions'].includes(e.to);
    const score = m => (m.keywords.divineShield ? 0 : m.health <= amt ? m.attack + m.health : amt * 0.5);
    if (hitsEnemies) value += them.board.reduce((s, m) => s + score(m), 0);
    if (hitsFriends) value -= me.board.reduce((s, m) => s + score(m), 0);
  }
  return value;
}

const KEYWORD_WORTH = { taunt: 3, divineShield: 3, poisonous: 3, windfury: 2, lifesteal: 2, stealth: 1, charge: 0, rush: 0 };

/**
 * How much a minion loses when silenced (bigger = better to silence an enemy):
 * buffs above its printed stats, keywords, and text such as deathrattles and auras.
 */
export function silenceValue(game, m) {
  if (m.silenced) return 0;
  const def = CARDS[m.cardId];
  let v = (m.attack - m.aura - def.attack) + (m.maxHealth - def.health) + m.spellDamage * 2 + (m.frozen ? -2 : 0);
  for (const [k, on] of Object.entries(m.keywords)) if (on) v += KEYWORD_WORTH[k] ?? 1;
  if (def.deathrattle) v += 3;
  if (def.endOfTurn || def.onDamaged || def.onFriendlySpell) v += 3;
  if (def.adjacentAura) v += 2 * (def.adjacentAura.attack ?? 0);
  return v;
}

/** Silence the enemy minion that loses the most; failing that, whichever minion it hurts least. */
function chooseSilenceTarget(game, pid, card, targets) {
  const scored = targets.filter(t => t.kind === 'minion')
    .map(t => ({ t, score: (t.owner === pid ? -1 : 1) * silenceValue(game, t) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return { ok: true, target: null };
  // A silence spell is only worth casting on something; a minion's body is worth playing anyway,
  // unless the only targets are our own minions that would lose a lot.
  if (card.type === 'spell' && best.score < 3) return { ok: false };
  if (best.score < -2) return { ok: false };
  return { ok: true, target: best.t.uid };
}

function chooseTarget(game, pid, card, targets) {
  if (!targets.length) return { ok: true, target: null };
  const effects = card.type === 'spell' ? card.effects : card.battlecry;
  if (effects.some(e => e.type === 'silence' && e.to === 'target')) return chooseSilenceTarget(game, pid, card, targets);
  const intent = targetIntent(effects);
  const enemies = targets.filter(t => t.owner !== pid);
  const friends = targets.filter(t => t.owner === pid);

  if (intent === 'hostile') {
    const minions = enemies.filter(t => t.kind === 'minion');
    const dmg = damageAmount(effects) + (card.type === 'spell' ? game.spellDamage(pid) : 0);
    const destroys = effects.some(e => e.type === 'destroy' || e.type === 'bounce');
    if (destroys) {
      const best = minions.sort((a, b) => (b.attack + b.health) - (a.attack + a.health))[0];
      if (!best) return { ok: false };
      // Don't waste removal on tiny minions.
      if (card.type === 'spell' && best.attack + best.health < card.cost * 2 && card.cost > 1) return { ok: false };
      return { ok: true, target: best.uid };
    }
    const killable = minions.filter(m => !m.keywords.divineShield && m.health <= dmg).sort((a, b) => b.attack - a.attack);
    if (killable.length) return { ok: true, target: killable[0].uid };
    const hero = enemies.find(t => t.kind === 'hero');
    if (hero) return { ok: true, target: hero.uid };
    if (minions.length) return { ok: true, target: minions.sort((a, b) => b.attack - a.attack)[0].uid };
    // Only friendly targets: battlecry minions must still be played; spells wait.
    if (card.type === 'minion') {
      const ownHero = friends.find(t => t.kind === 'hero');
      if (ownHero && ownHero.health > dmg + 5) return { ok: true, target: ownHero.uid };
      const fodder = friends.filter(t => t.kind === 'minion').sort((a, b) => b.health - a.health)[0];
      return fodder ? { ok: true, target: fodder.uid } : { ok: false };
    }
    return { ok: false };
  }

  // Friendly intent: heals go to the most damaged friend, buffs to the best minion.
  const isHeal = effects.some(e => e.type === 'heal' && e.to === 'target');
  if (isHeal) {
    // Only where it matters: a hero at 20 or less, or a minion missing 2 or more.
    const hurt = friends.filter(t => t.kind === 'hero' ? t.health <= 20 && t.health < t.maxHealth : t.maxHealth - t.health >= 2).sort((a, b) => (b.maxHealth - b.health) - (a.maxHealth - a.health));
    return hurt.length ? { ok: true, target: hurt[0].uid } : { ok: card.type === 'minion', target: friends[0]?.uid ?? targets[0].uid };
  }
  const friendMinions = friends.filter(t => t.kind === 'minion').sort((a, b) => (b.attack + b.health) - (a.attack + a.health));
  if (friendMinions.length) return { ok: true, target: friendMinions[0].uid };
  if (card.type === 'minion') return { ok: true, target: targets[0].uid };
  return { ok: false };
}

/** Pick a board slot for a minion so adjacency effects land well. */
export function choosePosition(game, pid, card) {
  const board = game.players[pid].board;
  const touchesNeighbors = card.adjacentAura || (card.battlecry || []).some(e => e.to === 'adjacent');
  if (touchesNeighbors) {
    // The gap whose neighbors are worth the most (both sides beats one).
    let best = board.length, bestScore = -1;
    for (let i = 0; i <= board.length; i++) {
      const score = [board[i - 1], board[i]].filter(Boolean)
        .reduce((sum, m) => sum + (card.adjacentAura ? m.attack : m.attack + m.health) + 10, 0);
      if (score > bestScore) { best = i; bestScore = score; }
    }
    return best;
  }
  // Anything that attacks wants to stand next to an aura minion.
  if (card.attack > 0) {
    const totem = board.findIndex(m => game.minionText(m).adjacentAura);
    if (totem >= 0) return board[totem + 1] && !board[totem - 1] ? totem : totem + 1;
  }
  return board.length;
}

/** The best set of plays this turn (see bestPlays), and its total value. */
function planPlays(game, pid) {
  const p = game.players[pid];
  const options = [];
  // In danger of dying next turn, taunts, armour and healing come first.
  const danger = inDanger(game, pid);
  const survival = card => !danger ? 0 : (card.keywords.taunt ? 15 + card.health : 0)
    + effectsOf(card).filter(e => e.type === 'armor' || (e.type === 'heal' && ['ownHero', 'allFriendly', 'target'].includes(e.to))).reduce((s, e) => s + e.amount * 4, 0);
  for (const inst of p.hand) {
    if (!game.canPlay(pid, inst.uid)) continue;
    const card = CARDS[inst.cardId];
    if (card.id === 't_coin') continue;   // see below
    // Never play a card whose battlecry would kill our own hero (e.g. Unstable Nucleus).
    const selfHarm = (card.battlecry ?? []).filter(e => e.type === 'damage' && e.to === 'ownHero').reduce((n, e) => n + e.amount, 0);
    if (selfHarm && selfHarm >= p.hero.health + p.hero.armor - 2) continue;
    if (card.type === 'spell' && !card.target && card.effects.some(e => e.type === 'destroy' && e.to === 'allMinions')) {
      // A board wipe (Oblivion) only when we lose much less than they do, and never while winning the race.
      const worth = m => m.attack + m.health;
      const swing = game.opponentOf(pid).board.reduce((n, m) => n + worth(m), 0) - p.board.reduce((n, m) => n + worth(m), 0);
      if (swing >= 10 && raceClock(game, pid) > raceClock(game, 1 - pid)) options.push({ inst, cost: card.cost, score: card.cost * 10 + swing + survival(card), target: null });
      continue;
    }
    const draws = effectsOf(card).filter(e => e.type === 'draw').reduce((n, e) => n + e.count, 0) * 10;
    if (card.type === 'spell' && !card.target) {
      const aoe = aoeValue(game, pid, card.effects);
      const hasAoe = card.effects.some(e => e.type === 'damage' && e.to !== 'target' && !e.to.startsWith('random'));
      if (hasAoe && aoe < 4) continue;
      if (card.effects.some(e => e.type === 'freeze') && game.opponentOf(pid).board.length < 2) continue;
      if (card.effects.some(e => e.to === 'randomEnemyMinion') && !game.opponentOf(pid).board.length) continue;
      if (card.effects.some(e => e.type === 'heal') && !hasAoe && p.hero.health > 20) continue;
      // An AoE is worth what it clears, not what it costs.
      options.push({ inst, cost: card.cost, score: (hasAoe ? REMOVAL * aoe + draws : card.cost * 10) + survival(card), target: null });
      continue;
    }
    const { ok, target } = chooseTarget(game, pid, card, game.cardTargets(pid, inst.uid));
    if (!ok) continue;
    if (card.type === 'weapon' && p.weapon) continue;
    // Removal is worth what it removes, so a cheap answer beats an expensive one for the same job.
    const fx = card.type === 'spell' ? card.effects : card.battlecry ?? [];
    const victim = target != null ? game.getEntity(target) : null;
    const enemyMinion = victim?.owner !== pid && victim?.kind === 'minion';
    const dmg = damageAmount(fx) + (card.type === 'spell' ? game.spellDamage(pid) : 0);
    const kills = enemyMinion && (fx.some(e => (e.type === 'destroy' || e.type === 'bounce') && e.to === 'target') || (dmg >= victim.health && !victim.keywords.divineShield));
    const removed = kills ? REMOVAL * (victim.attack + victim.health) * (fx.some(e => e.type === 'bounce') ? 0.5 : 1) : 0;
    // A battlecry that hits everything (Colossus of the Rift) counts our own losses too.
    const splash = card.type === 'minion' ? REMOVAL * aoeValue(game, pid, fx, false) : 0;
    // A heal is worth the health it restores (so a free Healing Aura still gets played when it matters).
    const healed = victim?.owner === pid ? fx.filter(e => e.type === 'heal' && e.to === 'target').reduce((n, e) => n + Math.min(e.amount, victim.maxHealth - victim.health), 0) * 5 : 0;
    const score = card.type === 'spell' && enemyMinion ? removed + draws : card.cost * 10 + (card.type === 'minion' ? 2 : 0) + (fx.some(e => e.type === 'destroy') ? removed : 0) + splash + healed;
    // In danger, killing an attacker is as good as armour.
    const saved = danger && kills ? victim.attack * 4 : 0;
    options.push({ inst, cost: card.cost, score: score + survival(card) + saved, target, victim: kills ? target : null });
  }
  const power = heroPowerOption(game, pid, danger);
  if (power) options.push(power);
  const set = bestPlays(options, p.mana);
  return { set, total: set.reduce((s, o) => s + o.score - (o.heroPower ? 0 : CARD), 0) };
}

function planCardPlay(game, pid) {
  const plan = planPlays(game, pid);
  // The Coin, when one more mana buys a better turn (a bigger card, or the hero power alongside).
  const coin = game.players[pid].hand.find(c => c.cardId === 't_coin');
  if (coin) {
    const g = game.clone();
    if (g.playCard(coin.uid) && planPlays(g, pid).total - CARD > plan.total + 5) return { type: 'play', uid: coin.uid, target: null, position: null };
  }
  const pick = plan.set[0];
  if (!pick) return null;
  if (pick.heroPower) return { type: 'heroPower', target: pick.target };
  const card = CARDS[pick.inst.cardId];
  const position = card.type === 'minion' ? choosePosition(game, pid, card) : null;
  return { type: 'play', uid: pick.inst.uid, target: pick.target, position };
}

/** Score per point of Attack + Health a card removes from the enemy board (a 5/5 removed is about a 5/5 played). */
const REMOVAL = 7;

/**
 * The hero power as a candidate play, scored like a card: a ping that kills
 * is removal, otherwise what it adds (armour, a token, face damage, a weapon,
 * hero Attack when the hero can swing, a heal when hurt).
 */
function heroPowerOption(game, pid, danger) {
  const hp = game.heroPower(pid);
  const action = planHeroPower(game, pid);
  if (!action) return null;
  const target = action.target != null ? game.getEntity(action.target) : null;
  let score = 0, victim = null;
  for (const e of hp.effects) {
    if (e.type === 'damage' && target?.kind === 'minion' && target.health <= e.amount) { score += REMOVAL * (target.attack + target.health); victim = target.uid; }
    else if (e.type === 'damage') score += e.amount * 6;
    if (e.type === 'heroAttack') score += e.amount * 6;
    if (e.type === 'armor') score += e.amount * 5 + (danger ? e.amount * 4 : 0);
    if (e.type === 'heal' && target) score += Math.min(e.amount, target.maxHealth - target.health) * (danger ? 9 : 5);
    if (e.type === 'summon') score += (CARDS[e.card].attack + CARDS[e.card].health) * 5;
    if (e.type === 'weapon') score += CARDS[e.card].attack * CARDS[e.card].durability * 5;
  }
  return score > 0 ? { heroPower: true, cost: hp.cost, score, target: action.target, victim } : null;
}

/** What a card in hand is worth when choosing plays: the same mana spent in fewer cards is better. */
const CARD = 5;

/**
 * The set of plays that fits in `mana` for the most total score, best first.
 * Two plays aimed at killing the same minion never both count.
 */
function bestPlays(options, mana) {
  let best = { score: 0, set: [] };
  const sorted = [...options].sort((a, b) => b.score - a.score);
  const dfs = (i, left, set, score, victims) => {
    if (score > best.score) best = { score, set: [...set] };
    for (let j = i; j < sorted.length; j++) {
      const o = sorted[j];
      if (o.cost > left || o.score <= 0 || (o.victim != null && victims.has(o.victim))) continue;
      if (o.heroPower && set.some(x => x.heroPower)) continue;
      set.push(o);
      if (o.victim != null) victims.add(o.victim);
      dfs(j + 1, left - o.cost, set, score + o.score - (o.heroPower ? 0 : CARD), victims);
      if (o.victim != null) victims.delete(o.victim);
      set.pop();
    }
  };
  dfs(0, mana, [], 0, new Set());
  return best.set;
}

function planHeroPower(game, pid) {
  if (!game.canUseHeroPower(pid)) return null;
  const hp = game.heroPower(pid);
  const p = game.players[pid];
  if (!hp.target) {
    if (hp.effects.some(e => e.type === 'weapon') && p.weapon) return null;
    // Extra hero Attack this turn is only worth it if the hero can swing right now.
    if (hp.effects.some(e => e.type === 'heroAttack')) {
      const h = p.hero;
      const canSwing = !h.frozen && h.attacksThisTurn < game.maxAttacks(h) && game.attackTargets(h.uid).length > 0;
      if (!canSwing) return null;
    }
    return { type: 'heroPower', target: null };
  }
  const targets = game.validTargets(pid, hp.target);
  const isHeal = hp.effects.some(e => e.type === 'heal');
  if (isHeal) {
    const hurt = targets.filter(t => t.owner === pid && t.health < t.maxHealth)
      .sort((a, b) => (b.maxHealth - b.health) - (a.maxHealth - a.health));
    return hurt.length ? { type: 'heroPower', target: hurt[0].uid } : null;
  }
  const amt = hp.effects.find(e => e.type === 'damage')?.amount ?? 1;
  const kill = targets.filter(t => t.owner !== pid && t.kind === 'minion' && !t.keywords.divineShield && t.health <= amt)
    .sort((a, b) => b.attack - a.attack)[0];
  if (kill) return { type: 'heroPower', target: kill.uid };
  const face = targets.find(t => t.owner !== pid && t.kind === 'hero');
  return face ? { type: 'heroPower', target: face.uid } : null;
}

/** The attack that kills one of `targets` for the least loss, or null. */
function cheapestKill(game, pid, attackers, targets) {
  const hero = game.players[pid].hero;
  let best = null;
  for (const a of attackers) {
    const reachable = game.attackTargets(a.uid);
    for (const t of targets) {
      if (!reachable.includes(t)) continue;
      const kills = !t.keywords.divineShield && (a.attack >= t.health || (a.kind === 'minion' && a.keywords.poisonous));
      if (!kills || (a.kind === 'hero' && t.attack >= hero.health - 10)) continue;
      const dies = a.kind === 'minion' && !a.keywords.divineShield && t.attack >= a.health;
      const cost = (dies ? minionWorth(game, a) : 0) + (a.kind === 'hero' ? t.attack * 1.5 : 0) + a.attack * 0.1 - minionWorth(game, t);
      if (!best || cost < best.cost) best = { cost, uid: a.uid, target: t.uid };
    }
  }
  return best && { type: 'attack', uid: best.uid, target: best.target };
}

/** Turns `pid`'s board (minions and weapon) needs to kill the other hero, if nothing changed: Infinity with no damage. */
function raceClock(game, pid) {
  const p = game.players[pid], foe = game.opponentOf(pid).hero;
  const dmg = p.board.reduce((s, m) => s + m.attack * (m.keywords.windfury ? 2 : 1), 0) + (p.weapon?.attack ?? 0);
  return dmg > 0 ? Math.ceil((foe.health + foe.armor) / dmg) : Infinity;
}

function planAttack(game, pid) {
  const p = game.players[pid];
  const enemyHero = game.opponentOf(pid).hero;
  const attackers = [...p.board, p.hero].filter(e => game.canAttack(e.uid));
  if (!attackers.length) return null;

  // Lethal check: if everything can go face and that's enough, do it.
  const faceAttackers = attackers.filter(a => game.attackTargets(a.uid).includes(enemyHero));
  const faceDmg = faceAttackers.reduce((s, a) => s + a.attack * (game.maxAttacks(a) - a.attacksThisTurn), 0);
  if (faceAttackers.length && faceDmg >= enemyHero.health + enemyHero.armor) {
    return { type: 'attack', uid: faceAttackers[0].uid, target: enemyHero.uid };
  }

  // In danger of dying next turn: kill whatever hits hardest, before anything goes face.
  if (inDanger(game, pid)) {
    const foes = game.opponentOf(pid).board.filter(m => !m.frozen && m.attack > 0).sort((x, y) => y.attack - x.attack);
    for (const foe of foes) {
      const kill = cheapestKill(game, pid, attackers, [foe]);
      if (kill) return kill;
    }
  }

  // A taunt in the way: clear it with whatever kills it for the least, so the big hitters go face.
  const taunts = game.opponentOf(pid).board.filter(m => m.keywords.taunt && !m.keywords.stealth);
  if (taunts.length && !faceAttackers.length) {
    const kill = cheapestKill(game, pid, attackers, taunts);
    if (kill) return kill;
  }

  // Racing: when our board kills them no later than theirs kills us, go face and trade only for real threats.
  const ahead = raceClock(game, pid) <= raceClock(game, 1 - pid);
  const worthTrading = t => !ahead || t.attack >= 3 || minionWorth(game, t) >= 7;

  for (const a of attackers) {
    const targets = game.attackTargets(a.uid);
    const minions = targets.filter(t => t.kind === 'minion');
    const kills = t => a.attack >= t.health || (a.kind === 'minion' && a.keywords.poisonous);
    const survives = t => a.kind === 'minion' && (a.keywords.divineShield || t.attack < a.health);

    if (a.kind === 'hero') {
      // Heroes only hit face, or a taunt they can kill cheaply.
      if (targets.includes(enemyHero)) return { type: 'attack', uid: a.uid, target: enemyHero.uid };
      const t = minions.filter(m => kills(m) && m.attack < p.hero.health - 10)[0];
      if (t) return { type: 'attack', uid: a.uid, target: t.uid };
      continue;
    }

    // Value trade: kill something and survive.
    // Behind on the race, even a 1-attack minion is worth killing for free.
    const value = minions.filter(t => !t.keywords.divineShield && kills(t) && survives(t) && worthTrading(t)).sort((x, y) => y.attack - x.attack)[0];
    if (value && (value.attack >= (ahead ? 2 : 1) || !targets.includes(enemyHero))) return { type: 'attack', uid: a.uid, target: value.uid };
    // Even trade into something at least as valuable.
    const even = minions.filter(t => !t.keywords.divineShield && kills(t) && worthTrading(t) && t.attack + t.health >= a.attack + a.health)
      .sort((x, y) => (y.attack + y.health) - (x.attack + x.health))[0];
    if (even) return { type: 'attack', uid: a.uid, target: even.uid };
    if (targets.includes(enemyHero)) return { type: 'attack', uid: a.uid, target: enemyHero.uid };
    // Forced to hit a taunt (or rush minion with only minion targets).
    if (minions.length) {
      const t = minions.sort((x, y) => x.health - y.health)[0];
      return { type: 'attack', uid: a.uid, target: t.uid };
    }
  }
  return null;
}

// ---------------------------------------------------------------- lethal search

const RANDOM_EFFECT = e => e.to?.startsWith('random') || e.type === 'copyFromOpponentDeck';
const effectsOf = card => [...(card.effects ?? []), ...(card.battlecry ?? []), ...(card.combo ?? [])];

/** Whether a card can change this turn's damage: burn, a body that can swing, an aura, a buff, removal for a taunt... */
function helpsLethal(card) {
  const fx = effectsOf(card);
  if (fx.some(RANDOM_EFFECT)) return false;   // its outcome isn't ours to know
  if (card.type === 'weapon' || card.id === 't_coin') return true;
  if (card.type === 'minion' && (card.keywords.charge || card.adjacentAura || card.spellDamage)) return true;
  return fx.some(e => ['damage', 'destroy', 'bounce', 'silence', 'buff', 'mana', 'heroAttack', 'buffWeapon', 'weapon'].includes(e.type) && e.to !== 'ownHero');
}

/** Generous upper bound on the face damage `pid` could deal this turn, so most turns skip the search. */
function maxDamage(game, pid) {
  const p = game.players[pid];
  const swings = e => e.frozen ? 0 : game.maxAttacks(e) - e.attacksThisTurn;
  const ready = p.board.filter(m => !m.sleeping || m.keywords.charge);
  let dmg = ready.reduce((s, m) => s + m.attack * swings(m), 0) + p.hero.attack * swings(p.hero);
  dmg += p.board.reduce((s, m) => s + (game.minionText(m).deathrattle ?? []).filter(e => e.type === 'damage' && e.to === 'enemyHero').reduce((n, e) => n + e.amount, 0), 0);
  const mana = p.mana + p.hand.filter(c => c.cardId === 't_coin').length;
  const bodies = ready.length + 2;
  const add = (card, isSpell) => {
    for (const e of effectsOf(card)) {
      if (e.type === 'damage' && e.to !== 'ownHero') dmg += (e.amount + (isSpell ? game.spellDamage(pid) + 2 : 0)) * (e.times ?? 1);
      if (e.type === 'buff' && e.attack) dmg += e.attack * bodies * 2;
      if (e.type === 'heroAttack' || e.type === 'buffWeapon') dmg += (e.amount ?? e.attack ?? 0) * 2;
      if (e.type === 'weapon') dmg += CARDS[e.card].attack;
      if (e.type === 'destroy' || e.type === 'bounce' || e.type === 'silence') dmg += 3;   // a taunt out of the way
    }
  };
  for (const c of p.hand) {
    const card = CARDS[c.cardId];
    if (card.cost > mana) continue;
    if (card.type === 'minion' && card.keywords.charge) dmg += card.attack * (card.keywords.windfury ? 2 : 1);
    if (card.type === 'minion' && card.adjacentAura) dmg += card.adjacentAura.attack * 2;
    if (card.type === 'weapon') dmg += card.attack * (card.keywords.windfury ? 2 : 1);
    add(card, card.type === 'spell');
  }
  if (game.canUseHeroPower(pid)) add(game.heroPower(pid), false);
  return dmg;
}

/** Every action that might matter for lethal: attacks (face first), then cards and the hero power. */
function lethalActions(game, pid, handUids) {
  const p = game.players[pid];
  const enemyHero = game.opponentOf(pid).hero.uid;
  const acts = [];
  for (const a of [...p.board, p.hero]) {
    if (!game.canAttack(a.uid)) continue;
    const ts = game.attackTargets(a.uid);
    for (const t of [...ts.filter(t => t.uid === enemyHero), ...ts.filter(t => t.uid !== enemyHero)]) acts.push({ type: 'attack', uid: a.uid, target: t.uid });
  }
  const seen = new Set();
  for (const inst of p.hand) {
    const card = CARDS[inst.cardId];
    // Only cards we held at the start: anything drawn since would be peeking at the deck.
    if (!handUids.has(inst.uid) || seen.has(card.id) || !helpsLethal(card) || !game.canPlay(pid, inst.uid)) continue;
    seen.add(card.id);
    const position = card.type === 'minion' ? choosePosition(game, pid, card) : null;
    const targets = game.cardTargets(pid, inst.uid).map(t => t.uid);
    for (const target of targets.length ? targets : [null]) acts.push({ type: 'play', uid: inst.uid, target, position });
  }
  if (game.canUseHeroPower(pid)) {
    const hp = game.heroPower(pid);
    if (!hp.effects.some(RANDOM_EFFECT)) {
      for (const target of hp.target ? game.validTargets(pid, hp.target).map(t => t.uid) : [null]) acts.push({ type: 'heroPower', target });
    }
  }
  return acts;
}

const lethalKey = game => game.players.map(p => [p.hero.health, p.hero.armor, p.hero.attack, p.hero.attacksThisTurn, p.mana, p.heroPowerUsed,
  p.weapon ? `${p.weapon.attack}/${p.weapon.durability}` : '', p.hand.map(c => c.uid).join(','),
  p.board.map(m => `${m.uid}:${m.attack}:${m.health}:${m.attacksThisTurn}:${m.keywords.taunt ? 1 : 0}${m.keywords.divineShield ? 1 : 0}`).join('|')].join(';')).join('#');

/**
 * A line that wins this turn, or null. A depth-first search over every attack,
 * card and hero power, on copies of the game. It's not cheating: cards with a
 * random outcome are left out, and so is anything drawn along the way.
 */
export function findLethal(game, pid, budget = 1500) {
  const them = game.opponentOf(pid).hero;
  if (maxDamage(game, pid) < them.health + them.armor) return null;
  const handUids = new Set(game.players[pid].hand.map(c => c.uid));
  const seen = new Set();
  let nodes = budget;
  const dfs = (g, plan) => {
    for (const act of lethalActions(g, pid, handUids)) {
      if (--nodes < 0) return null;
      const next = g.clone();
      if (!applyAction(next, act)) continue;
      if (next.winner === pid) return [...plan, act];
      if (next.winner !== null) continue;
      const key = lethalKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      const found = dfs(next, [...plan, act]);
      if (found) return found;
    }
    return null;
  };
  return dfs(game, []);
}

// ---------------------------------------------------------------- looking ahead

/** What effective health is worth: every point counts more as a hero gets close to dying. */
function healthValue(h) {
  if (h <= 0) return -1000;
  if (h <= 5) return h * 4;
  if (h <= 12) return 20 + (h - 5) * 2.2;
  return 35.4 + (h - 12) * 1.1;
}

/** What a minion on the board is worth to its owner. */
function minionWorth(game, m) {
  const def = game.minionText(m);
  const k = m.keywords;
  let v = m.attack * 1.1 + m.health * 0.9 + 1;
  if (k.taunt) v += 1.5 + m.health * 0.35;
  if (k.divineShield) v += 1 + m.attack * 0.9;
  if (k.windfury) v += m.attack * 0.8;
  if (k.poisonous) v += 3;
  if (k.lifesteal) v += m.attack * 0.5;
  v += (m.spellDamage || 0) * 1.5;
  if (def.deathrattle) v += 2;
  if (def.endOfTurn || def.onDamaged || def.onFriendlySpell || def.onHeroAttack) v += 2.5;
  if (def.adjacentAura) v += (def.adjacentAura.attack ?? 0) * 2;
  if (m.frozen) v -= m.attack * 0.5;
  return v;
}

const BURN_ALLOWANCE = 3;

/**
 * Damage `pid`'s opponent could deal to `pid`'s hero on its next turn, from
 * what's on the table: its minions (less what it takes to get through our
 * taunts), its weapon and hero power, and an allowance for burn in a hand we can't see.
 */
export function threat(game, pid) {
  const me = game.players[pid];
  const them = game.opponentOf(pid);
  const hits = them.board.filter(m => !m.frozen && m.attack > 0).flatMap(m => Array(m.keywords.windfury ? 2 : 1).fill(m.attack)).sort((a, b) => a - b);
  // Each taunt soaks up the smallest attacks it takes to kill it.
  for (const t of me.board.filter(m => m.keywords.taunt)) {
    for (let soaked = 0; soaked < t.health && hits.length;) soaked += hits.shift();
  }
  let dmg = hits.reduce((s, a) => s + a, 0);
  const w = them.weapon && !them.hero.frozen ? them.weapon.attack * (CARDS[them.weapon.cardId].keywords?.windfury ? 2 : 1) : 0;
  dmg += w;
  const hp = game.heroPower(them.id);
  for (const e of hp.effects) {
    if (e.type === 'damage') dmg += e.amount;
    if (e.type === 'heroAttack') dmg += e.amount;
    if (e.type === 'weapon' && !w) dmg += CARDS[e.card].attack;
    if (e.type === 'summon' && CARDS[e.card].keywords?.charge) dmg += CARDS[e.card].attack;
  }
  return dmg + (them.hand.length ? BURN_ALLOWANCE : 0);
}

/** Whether `pid` could die on the opponent's next turn if it doesn't look after itself. */
export function inDanger(game, pid) {
  const h = game.players[pid].hero;
  return threat(game, pid) + 4 >= h.health + h.armor;
}

/** How good a position is for `pid`, from what it can see: health, boards, weapons, hand sizes, and the threat of dying. */
function positionValue(game, pid) {
  if (game.winner === pid) return 1e6;
  if (game.winner !== null) return -1e6;
  const side = p => healthValue(p.hero.health + p.hero.armor) + p.board.reduce((s, m) => s + minionWorth(game, m), 0)
    + (p.weapon ? p.weapon.attack * p.weapon.durability * 0.7 : 0) + p.hand.length * 1.5;
  const me = game.players[pid].hero;
  const eff = me.health + me.armor, danger = threat(game, pid);
  const pressure = danger >= eff ? 120 : 25 * (danger / Math.max(1, eff)) ** 2;
  return side(game.players[pid]) - side(game.opponentOf(pid)) - pressure;
}

/**
 * A copy of the game to try moves on that knows no more than the AI does:
 * both decks are reshuffled and the random numbers changed, so draws and
 * random effects on the copy say nothing about the real ones.
 */
function blindClone(game) {
  const g = game.clone();
  let s = (g.rand.state ^ 0x5bd1e995) >>> 0;
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (const p of g.players) {
    for (let i = p.deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p.deck[i], p.deck[j]] = [p.deck[j], p.deck[i]]; }
  }
  g.rand.state = Math.floor(rand() * 4294967296) >>> 0;
  return g;
}

/** One step of the plain greedy policy: cards, then the hero power, then attacks. */
const greedyStep = (game, pid) => planCardPlay(game, pid) ?? planHeroPower(game, pid) ?? planAttack(game, pid);

/** Play the rest of the turn on `game` (a copy): `first` picks actions until it returns null, then plain greedy. */
function finishTurn(game, pid, first) {
  for (let i = 0, phase = first; i < 40 && game.winner === null; i++) {
    const a = (phase && phase(game, pid)) ?? (phase = null, greedyStep(game, pid));
    if (!a || !applyAction(game, a)) break;
  }
  return positionValue(game, pid);
}

/** Whether a card's value depends on the state of the enemy board: removal, AoE, or a condition like "damaged". */
function boardSensitive(card) {
  if (card.targetFilter) return true;
  return effectsOf(card).some(e => ['damage', 'destroy', 'bounce'].includes(e.type) && e.to !== 'ownHero');
}

/**
 * Attack first when that makes the card we're about to play better (wounded
 * minions for an AoE to finish, a target for "destroy a damaged minion"):
 * play out the turn both ways on copies and keep the better order.
 */
function attackFirst(game, pid, play) {
  if (!play || play.type !== 'play' || !boardSensitive(CARDS[game.players[pid].hand.find(c => c.uid === play.uid).cardId])) return null;
  const attack = planAttack(game, pid);
  if (!attack || game.getEntity(attack.target)?.kind !== 'minion') return null;
  const cardsFirst = finishTurn(blindClone(game), pid, null);
  const attacksFirst = finishTurn(blindClone(game), pid, planAttack);
  return attacksFirst > cardsFirst + 0.5 ? attack : null;
}

const AOE_ENEMY_MINIONS = ['allEnemyMinions', 'allMinions', 'allEnemies', 'allOtherCharacters', 'allOtherMinions'];

/**
 * Cards like "Destroy a damaged enemy minion" need something to set them up.
 * When one has no target yet, try each enabler (an AoE or ping in hand, the
 * hero power, an attack that wounds without killing) followed by the card,
 * on copies, and return the enabler of the best pair if it beats the plain turn.
 */
function planEnabler(game, pid) {
  const p = game.players[pid];
  const needy = p.hand.map(c => ({ c, card: CARDS[c.cardId] }))
    .filter(({ c, card }) => card.targetFilter?.damaged && card.cost <= p.mana && !game.canPlay(pid, c.uid));
  if (!needy.length) return null;
  const wanted = game.opponentOf(pid).board.filter(m => !m.keywords.stealth && !m.keywords.divineShield && m.health === m.maxHealth);
  if (!wanted.length) return null;
  const cheapest = Math.min(...needy.map(n => n.card.cost));
  const room = p.mana - cheapest;

  const options = [];
  for (const inst of p.hand) {
    const card = CARDS[inst.cardId];
    if (card.targetFilter?.damaged || card.cost > room || !game.canPlay(pid, inst.uid)) continue;
    const fx = card.type === 'spell' ? card.effects : card.battlecry ?? [];
    const dmg = fx.filter(e => e.type === 'damage' && e.to === 'target').reduce((s, e) => s + e.amount, 0) + (card.type === 'spell' ? game.spellDamage(pid) : 0);
    const position = card.type === 'minion' ? choosePosition(game, pid, card) : null;
    if (fx.some(e => e.type === 'damage' && AOE_ENEMY_MINIONS.includes(e.to)) && !card.target) options.push({ type: 'play', uid: inst.uid, target: null, position });
    else if (dmg > 0) for (const t of wanted) if (t.health > dmg && game.cardTargets(pid, inst.uid).includes(t)) options.push({ type: 'play', uid: inst.uid, target: t.uid, position });
  }
  const hp = game.heroPower(pid);
  const hpDmg = hp.target ? hp.effects.find(e => e.type === 'damage' && e.to === 'target')?.amount : 0;
  if (hpDmg && hp.cost <= room && game.canUseHeroPower(pid)) {
    for (const t of wanted) if (t.health > hpDmg) options.push({ type: 'heroPower', target: t.uid });
  }
  for (const a of [...p.board, p.hero]) {
    if (!game.canAttack(a.uid)) continue;
    for (const t of game.attackTargets(a.uid)) if (wanted.includes(t) && a.attack < t.health) options.push({ type: 'attack', uid: a.uid, target: t.uid });
  }
  if (!options.length) return null;

  // Each option: the enabler, then the card it sets up, then plain greedy for the rest of the turn.
  const followUp = (g, pid2) => {
    const ready = needy.find(n => g.canPlay(pid2, n.c.uid));
    if (!ready) return null;
    const { ok, target } = chooseTarget(g, pid2, ready.card, g.cardTargets(pid2, ready.c.uid));
    return ok ? { type: 'play', uid: ready.c.uid, target, position: null } : null;
  };
  let best = { value: finishTurn(blindClone(game), pid, null) + 1, action: null };
  for (const action of options) {
    const g = blindClone(game);
    if (!applyAction(g, action)) continue;
    let done = false;
    const value = finishTurn(g, pid, (gg, pp) => done ? null : (done = true, followUp(gg, pp)));
    if (value > best.value) best = { value, action };
  }
  return best.action;
}

export function nextAction(game, pid) {
  if (game.winner !== null || game.current !== pid) return null;
  const lethal = findLethal(game, pid);
  if (lethal) return lethal[0];
  const enabler = planEnabler(game, pid);
  if (enabler) return enabler;
  const play = planCardPlay(game, pid);
  return attackFirst(game, pid, play) ?? play ?? planHeroPower(game, pid) ?? planAttack(game, pid);
}

/** Pick cards to throw back during the mulligan. */
export function mulliganChoice(game, pid) {
  return game.players[pid].hand.filter(c => CARDS[c.cardId].cost > 3).map(c => c.uid);
}

/** Apply an action produced by nextAction. Returns false if the engine rejected it. */
export function applyAction(game, action) {
  if (action.type === 'play') return game.playCard(action.uid, { target: action.target, position: action.position });
  if (action.type === 'heroPower') return game.useHeroPower(action.target);
  if (action.type === 'attack') return game.attack(action.uid, action.target);
  return false;
}

/** Play out an entire AI turn synchronously (used by tests / simulations). */
export function playTurn(game, pid, maxActions = 60) {
  for (let i = 0; i < maxActions; i++) {
    const action = nextAction(game, pid);
    if (!action || !applyAction(game, action)) break;
  }
  if (game.winner === null && game.current === pid) game.endTurn();
}
