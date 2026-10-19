// Compare the human's play in a bundle of match transcripts with the AIs.
//
//   node tools/analyse-transcripts.js "Riftclash Transcripts.json" [--json out.json] [--top 40]
//
// Every transcript is replayed exactly (src/transcript.js). For each human
// turn, from the same starting position, it plays out:
//   H  what the human actually did
//   G  what the greedy AI (src/ai.js) would have done
//   M  what the Masochist planner (src/masochist.js) would have done
// and scores each one with Masochist's evaluate(), after the opponent replies
// with a greedy turn. That score is only a yardstick, not the truth.
//
// It also checks how well Masochist forecasts the human: it models the human's
// reply as a greedy turn and as an all-out rush, so a human turn that leaves
// the AI worse off than both models is a surprise.
//
// For the AI's own turns it compares what Masochist did with what greedy would
// have done, since Masochist's choices are a guide to better play.
//
// Prints a report; --json writes every turn's details too.

import fs from 'fs';
import { replay } from '../src/transcript.js';
import { CARDS } from '../src/cards.js';
import * as ai from '../src/ai.js';
import * as mas from '../src/masochist.js';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const jsonOut = opt('--json');
const top = Number(opt('--top') ?? 40);
const file = args[0];
if (!file) { console.error('usage: node tools/analyse-transcripts.js <bundle.json> [--json out.json] [--top 40]'); process.exit(1); }

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const games = raw.format === 'riftclash-transcripts' ? raw.games : [raw];
const HUMAN = 0;

// ---------------------------------------------------------------- helpers

const clip = x => Math.max(-300, Math.min(300, x));   // a won or lost position scores ±1e6; keep averages readable
const avg = xs => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '-';
const cardName = id => `${CARDS[id].name}(${CARDS[id].cost})`;

function nameOf(g, uid) {
  if (uid == null) return '-';
  const e = g.getEntity(uid);
  if (e) return e.kind === 'hero' ? `HERO${e.owner}` : `${CARDS[e.cardId].name}(${e.attack}/${e.health})`;
  for (const p of g.players) { const c = p.hand.find(h => h.uid === uid); if (c) return CARDS[c.cardId].name; }
  return `#${uid}`;
}

const describe = (g, a) => !a ? 'END'
  : a.type === 'play' ? `play ${nameOf(g, a.uid)}${a.target != null ? ` -> ${nameOf(g, a.target)}` : ''}`
  : a.type === 'heroPower' ? `HP${a.target != null ? ` -> ${nameOf(g, a.target)}` : ''}`
  : `${nameOf(g, a.uid)} atk ${nameOf(g, a.target)}`;

/** A recorded transcript action as an ai.js action. */
const toAction = a => a.type === 'playCard' ? { type: 'play', uid: a.uid, target: a.target, position: a.position }
  : a.type === 'useHeroPower' ? { type: 'heroPower', target: a.target }
  : a.type === 'attack' ? { type: 'attack', uid: a.uid, target: a.target } : null;

/** Masochist's second model of the human: every attack and burn at the enemy face. */
function rushTurn(game, pid) {
  for (let i = 0; i < 40 && game.winner === null; i++) {
    const them = game.opponentOf(pid).hero.uid;
    const acts = mas.legalActions(game, pid);
    const face = acts.find(a => a.target === them) ?? acts.find(a => a.type === 'play' && !a.target) ?? acts.find(a => a.type === 'attack');
    if (!face || !ai.applyAction(game, face)) break;
  }
  if (game.winner === null && game.current === pid) game.endTurn();
}

/** Play one turn on a copy with `policy(game, i)` choosing each action; the turn is not ended. */
function runTurn(g0, pid, policy) {
  const g = g0.clone();
  const me = g.players[pid], them = g.opponentOf(pid);
  const mana0 = me.mana, face0 = them.hero.health + them.hero.armor;
  const s = { acts: [], heroPower: 0, trades: 0, rejected: false };
  for (let i = 0; i < 60 && g.winner === null; i++) {
    const a = policy(g, i);
    if (!a) break;
    s.acts.push(describe(g, a));
    if (a.type === 'heroPower') s.heroPower++;
    if (a.type === 'attack' && g.getEntity(a.target)?.kind === 'minion') s.trades++;
    if (!ai.applyAction(g, a)) { s.rejected = true; break; }
  }
  s.manaSpent = mana0 - g.players[pid].mana;
  s.unspent = g.players[pid].mana;
  s.faceDmg = face0 - (them.hero.health + them.hero.armor);
  s.heroPowerIdle = g.winner === null && g.canUseHeroPower(pid);
  s.won = g.winner === pid;
  s.evalEnd = clip(mas.evaluate(g, pid));
  const r = g.clone();
  if (r.winner === null) r.endTurn();
  if (r.winner === null) ai.playTurn(r, r.current);
  s.evalReply = clip(mas.evaluate(r, pid));
  return s;
}

// ---------------------------------------------------------------- analysis

const humanTurns = [], aiTurns = [], mulligans = [];
const order = { attackBeforePlay: 0 };
const faceWithTrade = { face: 0, chances: 0 };
const forecast = { worseThanBoth: 0, betterThanBoth: 0, between: 0, closerGreedy: 0, closerRush: 0, surprises: [] };

for (const [gi, t] of games.entries()) {
  for (const a of t.actions.filter(a => a.type === 'mulligan')) {
    const g = replay(t, { upTo: a.n });
    const hand = g.players[a.player].hand;
    mulligans.push({ gi, player: a.player, hand: hand.map(c => cardName(c.cardId)), returned: a.returned.map(cardName),
      greedy: ai.mulliganChoice(g, a.player).map(u => cardName(hand.find(c => c.uid === u).cardId)) });
  }

  const byTurn = new Map();
  for (const a of t.actions) if (a.type !== 'mulligan') byTurn.set(a.turn, [...(byTurn.get(a.turn) ?? []), a]);

  for (const [turn, acts] of byTurn) {
    const pid = acts[0].player;
    const g = replay(t, { upTo: acts[0].n });
    const actual = acts.filter(a => a.type !== 'endTurn').map(toAction);
    const rec = {
      gi, turn, pid, classes: t.meta.classes, mana: g.players[pid].maxMana,
      myHP: g.players[pid].hero.health + g.players[pid].hero.armor,
      oppHP: g.opponentOf(pid).hero.health + g.opponentOf(pid).hero.armor,
      boards: `${g.players[pid].board.length}v${g.opponentOf(pid).board.length}`,
      H: runTurn(g, pid, (_, i) => actual[i] ?? null),
      G: runTurn(g, pid, gg => ai.nextAction(gg, pid)),
    };
    if (pid !== HUMAN) { aiTurns.push(rec); continue; }

    const plan = mas.planTurn(g, pid, { ms: 1500 });
    rec.M = runTurn(g, pid, (_, i) => plan[i] ?? null);
    rec.firstSame = describe(g, actual[0]) === describe(g, ai.nextAction(g, pid));
    humanTurns.push(rec);

    // Ordering: did the human attack before playing a card?
    const types = acts.map(a => a.type);
    const firstAttack = types.indexOf('attack');
    if (firstAttack >= 0 && types.lastIndexOf('playCard') > firstAttack) order.attackBeforePlay++;

    // Face or trade: attacks where a minion could have killed something and survived.
    const gg = g.clone();
    for (const a of acts) {
      if (a.type === 'endTurn') continue;
      if (a.type === 'attack') {
        const at = gg.getEntity(a.uid), targets = gg.attackTargets(a.uid), hero = gg.opponentOf(pid).hero;
        const trade = at.kind === 'minion' && targets.some(m => m.kind === 'minion' && !m.keywords.divineShield
          && at.attack >= m.health && (m.attack < at.health || at.keywords.divineShield));
        if (trade && targets.includes(hero)) { faceWithTrade.chances++; if (a.target === hero.uid) faceWithTrade.face++; }
      }
      ai.applyAction(gg, toAction(a));
    }

    // Masochist's forecast of this turn (greedy and rush models), scored from the AI's side.
    const opp = 1 - pid;
    const gG = g.clone(); ai.playTurn(gG, pid);
    const gR = g.clone(); rushTurn(gR, pid);
    const gH = replay(t, { upTo: acts.at(-1).n + 1 });
    const eG = clip(mas.evaluate(gG, opp)), eR = clip(mas.evaluate(gR, opp)), eH = clip(mas.evaluate(gH, opp));
    if (eH < Math.min(eG, eR) - 2) { forecast.worseThanBoth++; forecast.surprises.push({ gi, turn, actual: eH, greedy: eG, rush: eR }); }
    else if (eH > Math.max(eG, eR) + 2) forecast.betterThanBoth++;
    else forecast.between++;
    if (Math.abs(eH - eG) < Math.abs(eH - eR)) forecast.closerGreedy++; else forecast.closerRush++;
  }
  process.stderr.write(`game ${gi + 1}/${games.length} replayed\n`);
}

// ---------------------------------------------------------------- report

const compare = (turns, a, b) => {
  let better = 0, worse = 0, equal = 0;
  for (const t of turns) { const d = t[a].evalReply - t[b].evalReply; if (d > 2) better++; else if (d < -2) worse++; else equal++; }
  return `${better} better, ${equal} about equal, ${worse} worse`;
};
const stats = (turns, k) => `mana spent ${avg(turns.map(t => t[k].manaSpent))}, unspent ${avg(turns.map(t => t[k].unspent))}, face dmg ${avg(turns.map(t => t[k].faceDmg))}, trades ${avg(turns.map(t => t[k].trades))}, hero power ${avg(turns.map(t => t[k].heroPower))}, HP left unused ${turns.filter(t => t[k].heroPowerIdle).length}`;
const show = (t, labels) => {
  console.log(`\n### g${t.gi} t${t.turn} ${t.classes.join(' v ')}  mana ${t.mana}  hp ${t.myHP} v ${t.oppHP}  boards ${t.boards}  diff ${t.d.toFixed(1)}`);
  for (const [k, label] of labels) console.log(`  ${label}: ${t[k].acts.join(' | ') || '(nothing)'}  [${t[k].evalReply.toFixed(1)}]`);
};

const results = games.map(g => g.result?.outcome ?? 'unfinished');
console.log(`# ${games.length} games: ${results.filter(r => r === 'human win').length} human wins, ${results.filter(r => r === 'ai win').length} AI wins`);
console.log(`opponents: ${[...new Set(games.map(g => g.meta.ai))].join(', ')}`);
const rejected = [...humanTurns, ...aiTurns].filter(t => ['H', 'G', 'M'].some(k => t[k]?.rejected)).length;
if (rejected) console.log(`WARNING: ${rejected} turns had a rejected action`);

console.log(`\n## Human turns (${humanTurns.length})`);
console.log(`human:     ${stats(humanTurns, 'H')}`);
console.log(`greedy:    ${stats(humanTurns, 'G')}`);
console.log(`masochist: ${stats(humanTurns, 'M')}`);
console.log(`human vs greedy:    ${compare(humanTurns, 'H', 'G')}`);
console.log(`human vs masochist: ${compare(humanTurns, 'H', 'M')}`);
console.log(`same first action as greedy: ${humanTurns.filter(t => t.firstSame).length}; same whole turn: ${humanTurns.filter(t => t.H.acts.join() === t.G.acts.join()).length}`);
console.log(`lethal found: human ${humanTurns.filter(t => t.H.won).length}, greedy ${humanTurns.filter(t => t.G.won).length}, masochist ${humanTurns.filter(t => t.M.won).length}`);
console.log(`attacked before playing a card: ${order.attackBeforePlay} turns (greedy never does)`);
console.log(`went face when a free value trade was there: ${faceWithTrade.face} of ${faceWithTrade.chances}`);

console.log(`\n## Masochist's forecast of the human`);
console.log(`human beat both models (a surprise): ${forecast.worseThanBoth}; between them: ${forecast.between}; worse than both: ${forecast.betterThanBoth}`);
console.log(`closer to the greedy model: ${forecast.closerGreedy}, to the rush model: ${forecast.closerRush}`);
for (const s of forecast.surprises.filter(s => s.actual < -100)) console.log(`  big surprise: g${s.gi} t${s.turn} (actual ${s.actual.toFixed(1)}, greedy ${s.greedy.toFixed(1)}, rush ${s.rush.toFixed(1)})`);

console.log(`\n## AI turns (${aiTurns.length}): what the AI did vs greedy`);
console.log(`ai:     ${stats(aiTurns, 'H')}`);
console.log(`greedy: ${stats(aiTurns, 'G')}`);
console.log(`ai vs greedy: ${compare(aiTurns, 'H', 'G')}`);

console.log(`\n## Mulligans`);
for (const m of mulligans.filter(m => m.player === HUMAN)) console.log(`g${m.gi}: hand ${m.hand.join(', ')} | human returned ${m.returned.join(', ') || '-'} | greedy would return ${m.greedy.join(', ') || '-'}`);

const byDiff = (turns, a) => turns.map(t => ({ ...t, d: t[a].evalReply - t.G.evalReply })).sort((x, y) => y.d - x.d);
const human = byDiff(humanTurns, 'H');
console.log(`\n## Human turns that beat greedy most`);
human.slice(0, top).filter(t => t.d > 2).forEach(t => show(t, [['H', 'HUMAN'], ['G', 'GREEDY'], ['M', 'MASO']]));
console.log(`\n## Greedy turns that beat the human most`);
human.slice(-Math.ceil(top / 2)).filter(t => t.d < -2).reverse().forEach(t => show(t, [['H', 'HUMAN'], ['G', 'GREEDY'], ['M', 'MASO']]));
console.log(`\n## AI turns that beat greedy most`);
byDiff(aiTurns, 'H').slice(0, Math.ceil(top / 2)).filter(t => t.d > 2).forEach(t => show(t, [['H', 'AI'], ['G', 'GREEDY']]));

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ humanTurns, aiTurns, mulligans, order, faceWithTrade, forecast }, null, 1));
  console.error(`wrote ${jsonOut}`);
}
