// Card rendering shared by the game and the card library.

import { CARDS, CLASSES, KEYWORD_LABELS, KEYWORD_HELP, cardText } from './cards.js';
import { artHTML } from './pixelart.js';

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Card text with keywords in bold. */
export function formatText(text) {
  let t = esc(text);
  for (const w of ['Battlecry', 'Deathrattle', 'Combo', 'Freeze', 'Silence', ...Object.values(KEYWORD_LABELS), 'Spell Damage']) {
    t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), `<b>${w}</b>`);
  }
  return t;
}

/** A full card face. */
export function cardHTML(cardId, { cost, extraClass = '' } = {}) {
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
      <div class="art">${artHTML(c)}</div>
      <div class="name">${esc(c.name)}</div>
      <div class="text"><span>${formatText(cardText(c))}</span></div>
      <div class="type-line">${c.cls === 'neutral' ? '' : CLASSES[c.cls].name + ' '}${c.type}</div>
      ${stats}
    </div>`;
}

/** Keyword ids a card uses, for help text. */
export function cardKeywords(card) {
  return [
    ...Object.keys(card.keywords).filter(k => card.keywords[k]),
    ...(card.spellDamage ? ['spellDamage'] : []),
    ...(card.battlecry ? ['battlecry'] : []),
    ...(card.deathrattle ? ['deathrattle'] : []),
    ...(card.combo ? ['combo'] : []),
    ...(card.effects?.some(e => e.type === 'freeze') ? ['freeze'] : []),
    ...([...(card.effects ?? []), ...(card.battlecry ?? [])].some(e => e.type === 'silence') ? ['silence'] : []),
    ...(/adjacent/i.test(card.text ?? '') ? ['adjacent'] : []),
  ];
}

const keywordLabel = k => KEYWORD_LABELS[k] ?? k[0].toUpperCase() + k.slice(1).replace('Damage', ' Damage');

/** One help line per keyword on the card. */
export function keywordHelpHTML(card) {
  return cardKeywords(card).map(k => `<div class="kw-help"><b>${keywordLabel(k)}</b>: ${KEYWORD_HELP[k]}</div>`).join('');
}
