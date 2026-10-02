// Browser UI for Riftclash. The human is always player 0; the AI is player 1.

import { Game, MAX_MANA } from './engine.js';
import { CARDS, CLASSES, KEYWORD_LABELS, KEYWORD_HELP, cardText } from './cards.js';
import { nextAction, applyAction, mulliganChoice } from './ai.js';

const HUMAN = 0;
const AI = 1;
const $ = sel => document.querySelector(sel);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ui = {
  game: null,
  playerClass: null,
  aiClass: 'random',
  selection: null, // { type: 'hand' | 'attacker' | 'heroPower', uid? }
  busy: false,
  mulliganPicks: new Set(),
};

// ------------------------------------------------------------------ menu

function renderMenu() {
  $('#class-grid').innerHTML = Object.entries(CLASSES).map(([key, c]) => `
    <button class="class-tile${ui.playerClass === key ? ' chosen' : ''}" data-class="${key}" style="--cls:${c.color}">
      <span class="class-emoji">${c.emoji}</span>
      <span class="class-name">${c.name}</span>
      <span class="class-hero">${esc(c.hero)}</span>
      <span class="class-power"><b>${c.heroPower.name}</b> (${c.heroPower.cost}): ${esc(c.heroPower.text)}</span>
    </button>`).join('');
  $('#opponent-select').innerHTML = `<option value="random">Random</option>` +
    Object.entries(CLASSES).map(([k, c]) => `<option value="${k}"${ui.aiClass === k ? ' selected' : ''}>${c.name}</option>`).join('');
  $('#start-btn').disabled = !ui.playerClass;
}

$('#class-grid').addEventListener('click', e => {
  const tile = e.target.closest('[data-class]');
  if (!tile) return;
  ui.playerClass = tile.dataset.class;
  renderMenu();
});
$('#opponent-select').addEventListener('change', e => { ui.aiClass = e.target.value; });
$('#start-btn').addEventListener('click', startGame);
$('#again-btn').addEventListener('click', startGame);
$('#menu-btn').addEventListener('click', () => {
  $('#overlay').classList.add('hidden');
  showScreen('menu');
});

function showScreen(id) {
  for (const s of ['menu', 'mulligan', 'table']) $('#' + s).classList.toggle('hidden', s !== id);
  document.body.classList.toggle('in-game', id === 'table');
}

// ------------------------------------------------------------------ setup

function startGame() {
  const keys = Object.keys(CLASSES);
  const aiClass = ui.aiClass === 'random' ? keys[Math.floor(Math.random() * keys.length)] : ui.aiClass;
  ui.game = new Game({ classes: [ui.playerClass, aiClass], seed: Date.now() });
  ui.selection = null;
  ui.busy = false;
  ui.mulliganPicks = new Set();
  $('#log').innerHTML = '';
  $('#overlay').classList.add('hidden');
  ui.game.mulligan(AI, mulliganChoice(ui.game, AI));
  renderMulligan();
  showScreen('mulligan');
}

function renderMulligan() {
  const g = ui.game;
  $('#mulligan-title').textContent = g.current === HUMAN ? 'You go first' : 'You go second (+ Ember Coin)';
  $('#mulligan-cards').innerHTML = g.players[HUMAN].hand.map(inst => `
    <div class="mulligan-slot${ui.mulliganPicks.has(inst.uid) ? ' replace' : ''}" data-uid="${inst.uid}">
      ${cardHTML(inst.cardId)}
    </div>`).join('');
}

$('#mulligan-cards').addEventListener('click', e => {
  const slot = e.target.closest('[data-uid]');
  if (!slot) return;
  const uid = Number(slot.dataset.uid);
  ui.mulliganPicks.has(uid) ? ui.mulliganPicks.delete(uid) : ui.mulliganPicks.add(uid);
  renderMulligan();
});

$('#mulligan-btn').addEventListener('click', async () => {
  ui.game.mulligan(HUMAN, [...ui.mulliganPicks]);
  showScreen('table');
  await flushEvents();
  render();
  if (ui.game.current === AI) runAiTurn();
  else banner('Your turn');
});

// ------------------------------------------------------------------ rendering

function cardHTML(cardId, { cost, extraClass = '' } = {}) {
  const c = CARDS[cardId];
  const color = CLASSES[c.cls]?.color ?? '#8a8f98';
  const stats = c.type === 'minion'
    ? `<span class="stat atk">${c.attack}</span><span class="stat hp">${c.health}</span>`
    : c.type === 'weapon'
      ? `<span class="stat atk">${c.attack}</span><span class="stat dur">${c.durability}</span>`
      : '';
  return `
    <div class="card ${c.type} ${extraClass}" style="--cls:${color}">
      <span class="cost">${cost ?? c.cost}</span>
      <div class="art">${c.emoji}</div>
      <div class="name">${esc(c.name)}</div>
      <div class="text"><span>${formatText(cardText(c))}</span></div>
      <div class="type-line">${c.cls === 'neutral' ? '' : CLASSES[c.cls].name + ' '}${c.type}</div>
      ${stats}
    </div>`;
}

function formatText(text) {
  let t = esc(text);
  for (const w of ['Battlecry', 'Deathrattle', 'Combo', 'Freeze', ...Object.values(KEYWORD_LABELS), 'Spell Damage']) {
    t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), `<b>${w}</b>`);
  }
  return t;
}

function targetSet() {
  const g = ui.game;
  const s = ui.selection;
  if (!s) return new Set();
  let list = [];
  if (s.type === 'hand') list = g.cardTargets(HUMAN, s.uid);
  else if (s.type === 'heroPower') list = g.validTargets(HUMAN, g.heroPower(HUMAN).target);
  else if (s.type === 'attacker') list = g.attackTargets(s.uid);
  return new Set(list.map(e => e.uid));
}

function minionHTML(m, targets) {
  const def = CARDS[m.cardId];
  const g = ui.game;
  const myTurn = g.current === HUMAN && !ui.busy;
  const cls = ['unit'];
  if (m.keywords.taunt) cls.push('taunt');
  if (m.keywords.divineShield) cls.push('shielded');
  if (m.keywords.stealth) cls.push('stealthed');
  if (m.frozen) cls.push('frozen');
  if (m.owner === HUMAN && myTurn && g.canAttack(m.uid)) cls.push('ready');
  if (ui.selection?.uid === m.uid && ui.selection.type === 'attacker') cls.push('selected');
  if (targets.has(m.uid)) cls.push('targetable');
  const hpCls = m.health < m.maxHealth ? 'damaged' : m.maxHealth > def.health ? 'buffed' : '';
  const atkCls = m.attack > def.attack ? 'buffed' : m.attack < def.attack ? 'damaged' : '';
  const icons = [
    def.deathrattle ? '<span title="Deathrattle">💀</span>' : '',
    def.endOfTurn || def.onDamaged || def.onFriendlySpell ? '<span title="Triggered effect">⚡</span>' : '',
    m.keywords.poisonous ? '<span title="Poisonous">☠️</span>' : '',
    m.keywords.lifesteal ? '<span title="Lifesteal">🩸</span>' : '',
    m.keywords.windfury ? '<span title="Windfury">🌪</span>' : '',
    m.spellDamage ? `<span title="Spell Damage">✦${m.spellDamage}</span>` : '',
  ].join('');
  return `
    <div class="${cls.join(' ')}" data-uid="${m.uid}" data-card="${m.cardId}" style="--cls:${CLASSES[def.cls]?.color ?? '#8a8f98'}">
      <div class="unit-art">${def.emoji}</div>
      ${m.sleeping && !m.keywords.charge && !m.keywords.rush && m.owner === g.current ? '<span class="zzz">z<sup>z</sup></span>' : ''}
      <div class="unit-icons">${icons}</div>
      <span class="stat atk ${atkCls}">${m.attack}</span>
      <span class="stat hp ${hpCls}">${m.health}</span>
    </div>`;
}

function heroHTML(pid, targets) {
  const g = ui.game;
  const p = g.players[pid];
  const c = CLASSES[p.heroClass];
  const h = p.hero;
  const hp = c.heroPower;
  const isHuman = pid === HUMAN;
  const myTurn = g.current === HUMAN && !ui.busy;
  const cls = ['hero'];
  if (h.frozen) cls.push('frozen');
  if (targets.has(h.uid)) cls.push('targetable');
  if (isHuman && myTurn && g.canAttack(h.uid)) cls.push('ready');
  if (ui.selection?.uid === h.uid) cls.push('selected');
  const hpUsable = isHuman && myTurn && g.canUseHeroPower(HUMAN);
  const crystals = Array.from({ length: MAX_MANA }, (_, i) =>
    `<i class="${i < p.mana ? 'full' : i < p.maxMana ? 'spent' : 'locked'}"></i>`).join('');
  const weapon = p.weapon ? `
    <div class="hero-weapon" data-card="${p.weapon.cardId}">
      <span>${CARDS[p.weapon.cardId].emoji}</span>
      <span class="stat atk">${p.weapon.attack}</span><span class="stat dur">${p.weapon.durability}</span>
    </div>` : '<div class="hero-weapon empty"></div>';
  return `
    <div class="hero-row ${isHuman ? 'you' : 'foe'}">
      <div class="side-info">
        <div class="deck-count" title="Cards left in deck">🂠 ${p.deck.length}</div>
        ${isHuman ? '' : `<div class="hand-count" title="Cards in hand">✋ ${p.hand.length}</div>`}
      </div>
      ${weapon}
      <div class="${cls.join(' ')}" data-uid="${h.uid}" style="--cls:${c.color}">
        <div class="portrait">${c.emoji}</div>
        <div class="hero-name">${esc(c.hero)}</div>
        ${h.attack > 0 ? `<span class="stat atk">${h.attack}</span>` : ''}
        <span class="stat hp ${h.health < h.maxHealth ? 'damaged' : ''}">${h.health}</span>
        ${h.armor > 0 ? `<span class="stat armor">${h.armor}</span>` : ''}
      </div>
      <button class="hero-power${p.heroPowerUsed ? ' used' : ''}${hpUsable ? ' usable' : ''}${ui.selection?.type === 'heroPower' && isHuman ? ' selected' : ''}"
        ${isHuman ? 'data-action="hero-power"' : ''} data-hp="${p.heroClass}" style="--cls:${c.color}" ${isHuman ? '' : 'tabindex="-1"'}>
        <span class="cost">${hp.cost}</span>
        <span class="hp-name">${hp.name}</span>
      </button>
      <div class="mana" title="Mana">
        <span class="mana-text">${p.mana}/${p.maxMana}</span>
        <div class="crystals">${crystals}</div>
      </div>
    </div>`;
}

function render() {
  const g = ui.game;
  if (!g) return;
  const targets = targetSet();
  const me = g.players[HUMAN];
  const foe = g.players[AI];
  const myTurn = g.current === HUMAN && !ui.busy && g.winner === null;

  const handCards = me.hand.map((inst, i) => {
    const playable = myTurn && g.canPlay(HUMAN, inst.uid);
    const selected = ui.selection?.type === 'hand' && ui.selection.uid === inst.uid;
    const n = me.hand.length;
    const rot = n > 1 ? (i - (n - 1) / 2) * Math.min(6, 40 / n) : 0;
    return `<div class="hand-card${playable ? ' playable' : ''}${selected ? ' selected' : ''}" data-hand="${inst.uid}" data-card="${inst.cardId}" style="--rot:${rot}deg">
      ${cardHTML(inst.cardId)}</div>`;
  }).join('');

  $('#table').innerHTML = `
    <div class="foe-hand">${foe.hand.map(() => '<div class="card-back"></div>').join('')}</div>
    ${heroHTML(AI, targets)}
    <div class="lane foe-lane">${foe.board.map(m => minionHTML(m, targets)).join('')}</div>
    <div class="midline">
      <button id="end-turn" class="btn end-turn${myTurn && !hasMovesLeft() ? ' nudge' : ''}" ${myTurn ? '' : 'disabled'}>
        ${g.current === HUMAN ? 'End turn' : 'Enemy turn'}
      </button>
    </div>
    <div class="lane you-lane">${me.board.map(m => minionHTML(m, targets)).join('')}</div>
    ${heroHTML(HUMAN, targets)}
    <div class="hand">${handCards}</div>`;
  $('#table').classList.toggle('targeting', !!ui.selection);
}

function hasMovesLeft() {
  const g = ui.game;
  const me = g.players[HUMAN];
  return me.hand.some(c => g.canPlay(HUMAN, c.uid)) || g.canUseHeroPower(HUMAN) ||
    [me.hero, ...me.board].some(e => g.canAttack(e.uid));
}

// ------------------------------------------------------------------ feedback

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 1600);
}

async function banner(msg) {
  const b = $('#banner');
  b.textContent = msg;
  b.classList.remove('hidden');
  await sleep(900);
  b.classList.add('hidden');
}

function floatText(uid, text, kind) {
  const el = document.querySelector(`[data-uid="${uid}"]`);
  if (!el) return;
  const f = document.createElement('span');
  f.className = `float ${kind}`;
  f.textContent = text;
  el.appendChild(f);
}

/** Animate pending engine events on the current DOM, then re-render. */
async function flushEvents() {
  const events = ui.game.takeEvents();
  let visual = false;
  for (const ev of events) {
    switch (ev.type) {
      case 'log': {
        const li = document.createElement('li');
        li.textContent = ev.msg;
        $('#log').prepend(li);
        break;
      }
      case 'attack': {
        const a = document.querySelector(`[data-uid="${ev.attacker}"]`);
        const t = document.querySelector(`[data-uid="${ev.target}"]`);
        if (a && t) {
          const ar = a.getBoundingClientRect(), tr = t.getBoundingClientRect();
          a.style.setProperty('--dx', `${(tr.left - ar.left) * 0.7}px`);
          a.style.setProperty('--dy', `${(tr.top - ar.top) * 0.7}px`);
          a.classList.add('lunge');
          await sleep(220);
        }
        visual = true;
        break;
      }
      case 'damage': floatText(ev.uid, `-${ev.amount}`, 'dmg'); document.querySelector(`[data-uid="${ev.uid}"]`)?.classList.add('hit'); visual = true; break;
      case 'heal': floatText(ev.uid, `+${ev.amount}`, 'heal'); visual = true; break;
      case 'armor': floatText(ev.uid, `+${ev.amount} 🛡`, 'armor'); visual = true; break;
      case 'shield': floatText(ev.uid, 'Blocked!', 'shield'); visual = true; break;
      case 'freeze': floatText(ev.uid, 'Frozen', 'freeze'); visual = true; break;
      case 'death': document.querySelector(`[data-uid="${ev.uid}"]`)?.classList.add('dying'); visual = true; break;
      case 'burn': if (ev.player === HUMAN) toast(`Hand full! ${CARDS[ev.cardId].name} was burned.`); break;
      case 'play': if (ev.player === AI) await showAiPlay(ev.cardId); break;
    }
  }
  if (visual) await sleep(550);
  render();
  if (ui.game.winner !== null) showResult();
}

async function showAiPlay(cardId) {
  const tip = $('#tooltip');
  tip.innerHTML = cardHTML(cardId);
  tip.className = 'ai-play';
  await sleep(900);
  tip.className = 'hidden';
}

function showResult() {
  const w = ui.game.winner;
  $('#result-title').textContent = w === 'draw' ? 'Draw' : w === HUMAN ? 'Victory!' : 'Defeat';
  $('#overlay').classList.remove('hidden');
}

// ------------------------------------------------------------------ input

async function act(fn) {
  ui.selection = null;
  ui.busy = true;
  const ok = fn();
  if (!ok && ui.game.lastError) toast(ui.game.lastError);
  await flushEvents();
  ui.busy = false;
  render();
}

$('#table').addEventListener('click', e => {
  const g = ui.game;
  if (!g || ui.busy || g.current !== HUMAN || g.winner !== null) return;

  if (e.target.closest('#end-turn')) { endPlayerTurn(); return; }

  const handEl = e.target.closest('[data-hand]');
  const entEl = e.target.closest('[data-uid]');
  const hpEl = e.target.closest('[data-action="hero-power"]');
  const sel = ui.selection;

  // Resolve a pending targeting selection.
  if (sel && entEl) {
    const uid = Number(entEl.dataset.uid);
    if (targetSet().has(uid)) {
      if (sel.type === 'hand') return act(() => g.playCard(sel.uid, { target: uid }));
      if (sel.type === 'heroPower') return act(() => g.useHeroPower(uid));
      if (sel.type === 'attacker') return act(() => g.attack(sel.uid, uid));
    }
  }

  if (handEl) {
    const uid = Number(handEl.dataset.hand);
    if (sel?.type === 'hand' && sel.uid === uid) { ui.selection = null; return render(); }
    const blocker = g.playBlocker(HUMAN, uid);
    if (blocker) { toast(blocker); return; }
    if (g.cardTargets(HUMAN, uid).length) { ui.selection = { type: 'hand', uid }; return render(); }
    return act(() => g.playCard(uid));
  }

  if (hpEl) {
    if (sel?.type === 'heroPower') { ui.selection = null; return render(); }
    if (!g.canUseHeroPower(HUMAN)) {
      toast(g.players[HUMAN].heroPowerUsed ? 'Hero power already used' : 'Not enough mana');
      return;
    }
    if (g.heroPower(HUMAN).target) { ui.selection = { type: 'heroPower' }; return render(); }
    return act(() => g.useHeroPower());
  }

  if (entEl) {
    const uid = Number(entEl.dataset.uid);
    const ent = g.getEntity(uid);
    if (ent?.owner === HUMAN) {
      if (sel?.uid === uid) { ui.selection = null; return render(); }
      if (g.canAttack(uid)) { ui.selection = { type: 'attacker', uid }; return render(); }
      if (ent.kind === 'minion') {
        toast(ent.frozen ? 'Frozen!' : ent.sleeping && ent.attacksThisTurn === 0 ? 'Needs a turn to get ready' : ent.attack <= 0 ? 'No attack' : 'Already attacked');
      }
      return;
    }
  }

  if (sel) { ui.selection = null; render(); }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.selection) { ui.selection = null; render(); }
});
document.addEventListener('contextmenu', e => {
  if (ui.selection) { e.preventDefault(); ui.selection = null; render(); }
});

// Hover previews
const tip = $('#tooltip');
document.addEventListener('mouseover', e => {
  if (tip.classList.contains('ai-play')) return;
  const el = e.target.closest('[data-card], [data-hp]');
  if (!el || el.closest('.hand-card') || el.closest('.mulligan-slot')) { tip.className = 'hidden'; return; }
  let html;
  if (el.dataset.hp) {
    const hp = CLASSES[el.dataset.hp].heroPower;
    html = `<div class="power-tip"><b>${hp.name}</b> (${hp.cost} mana)<br>${esc(hp.text)}</div>`;
  } else {
    const card = CARDS[el.dataset.card];
    const kws = [...Object.keys(card.keywords).filter(k => card.keywords[k]),
      ...(card.spellDamage ? ['spellDamage'] : []), ...(card.battlecry ? ['battlecry'] : []),
      ...(card.deathrattle ? ['deathrattle'] : []), ...(card.combo ? ['combo'] : [])];
    html = cardHTML(card.id) + kws.map(k => `<div class="kw-help"><b>${KEYWORD_LABELS[k] ?? k[0].toUpperCase() + k.slice(1).replace('Damage', ' Damage')}</b>: ${KEYWORD_HELP[k]}</div>`).join('');
  }
  tip.innerHTML = html;
  const r = el.getBoundingClientRect();
  const right = r.right + 240 < window.innerWidth;
  tip.style.left = `${right ? r.right + 12 : Math.max(8, r.left - 232)}px`;
  tip.style.top = `${Math.min(window.innerHeight - 340, Math.max(8, r.top - 40))}px`;
  tip.className = 'hover';
});

// ------------------------------------------------------------------ turns

async function endPlayerTurn() {
  ui.selection = null;
  ui.busy = true;
  ui.game.endTurn();
  await flushEvents();
  if (ui.game.winner === null) await runAiTurn();
}

async function runAiTurn() {
  const g = ui.game;
  ui.busy = true;
  render();
  await banner("Opponent's turn");
  await flushEvents();
  for (let i = 0; i < 60 && g.winner === null; i++) {
    const action = nextAction(g, AI);
    if (!action) break;
    if (action.type === 'attack') {
      document.querySelector(`[data-uid="${action.uid}"]`)?.classList.add('selected');
      await sleep(350);
    }
    if (!applyAction(g, action)) break;
    await flushEvents();
    await sleep(350);
  }
  if (g.winner === null) {
    g.endTurn();
    await flushEvents();
  }
  ui.busy = false;
  render();
  if (g.winner === null) banner('Your turn');
}

renderMenu();
