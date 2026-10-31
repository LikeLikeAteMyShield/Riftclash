// Card and class data for Riftclash.
//
// Art: every hero and card has an `emoji`. Set `portrait` (heroes) or
// `sprite` (cards) to a pixel art sprite id from src/sprites/ to use pixel
// art instead; the emoji remains the fallback.
//
// Cards are pure data. Effects are small objects interpreted by the engine
// (see resolveEffect in engine.js). Selectors used in `to`:
//   target, self, ownHero, enemyHero, allEnemyMinions, allFriendlyMinions,
//   otherFriendlyMinions, allMinions, allOtherMinions, allEnemies,
//   allFriendly, allOtherCharacters, randomEnemy, randomEnemyMinion,
//   randomFriendlyMinion, adjacent (the minions on either side of this one)
//
// `{ type: 'silence' }` removes all card text from a minion and undoes what
// other cards did to it (buffs, granted keywords, Freeze). See #silence in engine.js.
//
// `adjacentAura: { attack }` gives the minions on either side bonus Attack
// for as long as they stay next to it.
//
// Target specs (for cards / hero powers that ask the player to pick):
//   any, minion, enemyMinion, friendlyMinion, enemy, friendly
// Optional `targetFilter`: { maxAttack, minAttack, damaged, undamaged }

// Classes and heroes are separate. A class is a card pool and colour; a hero
// is who plays it: a name, a portrait and a hero power. Every class has a
// default hero (the one the player gets), and any number of heroes can share
// a class (for example, bosses using a class with their own hero power).

export const CLASSES = {
  pyromancer: { name: 'Pyromancer', emoji: '🔥', color: '#e2603a', defaultHero: 'ignatia' },
  warlord: { name: 'Warlord', emoji: '🪓', color: '#b53b3b', defaultHero: 'brakka' },
  stalker: { name: 'Stalker', emoji: '🏹', color: '#4f9a45', defaultHero: 'wren' },
  oracle: { name: 'Oracle', emoji: '🕯️', color: '#d9cf9a', defaultHero: 'lumen' },
  vanguard: { name: 'Vanguard', emoji: '🛡️', color: '#e0b23c', defaultHero: 'hale' },
  shade: { name: 'Shade', emoji: '🗡️', color: '#6b5a8e', defaultHero: 'vex' },
  // Hidden: players can't see or pick it until it's unlocked (src/unlocks.js).
  celestial: { name: 'Celestial', emoji: '🌌', color: '#6f7fe8', defaultHero: 'aurion', hidden: true },
};

// Shared by Aurion and most of the Riftkin.
const RIFT_STRENGTH = { name: 'Rift Grant Me Strength', cost: 2, sprite: 'power_celestial', text: 'Your hero gains +2 Attack this turn.',
  effects: [{ type: 'heroAttack', amount: 2 }] };

export const HEROES = {
  ignatia: {
    name: 'Ignatia the Kindled', cls: 'pyromancer', emoji: '🔥', portrait: 'hero_pyromancer',
    heroPower: { name: 'Spark', cost: 2, sprite: 'power_pyromancer', text: 'Deal 1 damage.', target: 'any',
      effects: [{ type: 'damage', amount: 1, to: 'target' }] },
  },
  brakka: {
    name: 'Brakka Ironjaw', cls: 'warlord', emoji: '🪓', portrait: 'hero_warlord',
    heroPower: { name: 'Brace', cost: 2, sprite: 'power_warlord', text: 'Gain 2 Armor.',
      effects: [{ type: 'armor', amount: 2 }] },
  },
  wren: {
    name: 'Wren Duskmantle', cls: 'stalker', emoji: '🏹', portrait: 'hero_stalker',
    heroPower: { name: 'Volley', cost: 2, sprite: 'power_stalker', text: 'Deal 2 damage to the enemy hero.',
      effects: [{ type: 'damage', amount: 2, to: 'enemyHero' }] },
  },
  lumen: {
    name: 'Sister Lumen', cls: 'oracle', emoji: '🕯️', portrait: 'hero_oracle',
    heroPower: { name: 'Mend', cost: 2, sprite: 'power_oracle', text: 'Restore 2 Health.', target: 'any',
      effects: [{ type: 'heal', amount: 2, to: 'target' }] },
  },
  hale: {
    name: 'Commander Hale', cls: 'vanguard', emoji: '🛡️', portrait: 'hero_vanguard',
    heroPower: { name: 'Muster', cost: 2, sprite: 'power_vanguard', text: 'Summon a 1/1 Recruit.',
      effects: [{ type: 'summon', card: 't_recruit' }] },
  },
  aurion: {
    name: 'Aurion, Lord of the Stars', cls: 'celestial', emoji: '🌌', portrait: 'hero_celestial',
    heroPower: RIFT_STRENGTH,
  },

  // ---------- The Riftkin: Celestial bosses ----------
  // `boss: true` heroes are never offered to the player; they're fought in "Challenge the Riftkin",
  // on their own battle board (`board`, a boss background id in backgrounds.js,
  // which also sets the music). Beating a hero with
  // `victoryMusic` plays that stinger instead of the standard victory theme.
  zarth: {
    name: 'Zarth the Colossus', title: 'The First Mountain', cls: 'celestial', boss: true, emoji: '🗿', portrait: 'hero_zarth', board: 'celestial',
    lore: 'Zarth raised the pillars that hold the Rift open. Ages of standing still have only made him heavier.',
    heroPower: RIFT_STRENGTH,
  },
  galkun: {
    name: "Void Serpent Gal'kun", title: 'Coil of the Endless Dark', cls: 'celestial', boss: true, emoji: '🐍', portrait: 'hero_galkun', board: 'celestial',
    lore: 'Gal\'kun swims the dark between the stars and swallows any light that strays too close.',
    heroPower: RIFT_STRENGTH,
  },
  ylva: {
    name: 'Ylva, Starlight Priestess', title: 'Keeper of the First Light', cls: 'celestial', boss: true, emoji: '🌙', portrait: 'hero_ylva', board: 'celestial',
    lore: 'Ylva sang the first stars awake. She still tends them, and she does not forgive those who dim them.',
    heroPower: RIFT_STRENGTH,
  },
  manus: {
    name: 'Manus Darkhammer', title: 'Forger of the Rift', cls: 'celestial', boss: true, emoji: '🔨', portrait: 'hero_manus', board: 'celestial',
    lore: 'Manus beat the Rift into shape on an anvil of cold iron, and he never put the hammer down.',
    heroPower: RIFT_STRENGTH,
  },
  grun: {
    name: 'Nightlord Grun', title: 'Lord of the Long Night', cls: 'celestial', boss: true, emoji: '👁️', portrait: 'hero_grun', board: 'citadel', victoryMusic: 'grunVictory',
    lore: 'Grun rules the hours when the stars go out, and the demons of the Rift come when he calls.',
    heroPower: { name: 'Wrath of the Night', cost: 2, sprite: 'power_grun', text: 'Summon a 6/6 Rift Demon.',
      effects: [{ type: 'summon', card: 't_riftdemon' }] },
  },
  vex: {
    name: 'Vex the Unseen', cls: 'shade', emoji: '🗡️', portrait: 'hero_shade',
    heroPower: { name: 'Blade Kit', cost: 2, sprite: 'power_shade', text: 'Equip a 1/2 Shiv.',
      effects: [{ type: 'weapon', card: 't_shiv' }] },
  },
};

/** The Riftkin bosses, in the order the doc lists them. */
export const RIFTKIN = ['zarth', 'galkun', 'ylva', 'manus', 'grun'];

/** Heroes a player can play (bosses excluded). */
export const playerHeroes = () => Object.entries(HEROES).filter(([, h]) => !h.boss).map(([id, h]) => ({ id, ...h }));

/** The hero a class is played with by default (e.g. on the menu). */
export const defaultHero = cls => HEROES[CLASSES[cls].defaultHero];

/** Every hero who plays a class. */
export const heroesOf = cls => Object.entries(HEROES).filter(([, h]) => h.cls === cls).map(([id, h]) => ({ id, ...h }));

/** A class's icon: its default hero's portrait (for tabs, tiles and badges). */
export const classArt = cls => ({ sprite: defaultHero(cls).portrait, emoji: CLASSES[cls].emoji });

const RAW_CARDS = [
  // ---------- Tokens (not collectible) ----------
  { id: 't_coin', name: 'Ember Coin', type: 'spell', cost: 0, emoji: '🪙', sprite: 'card_t_coin', token: true,
    text: 'Gain 1 Mana Crystal this turn only.', effects: [{ type: 'mana', amount: 1 }] },
  { id: 't_recruit', name: 'Recruit', type: 'minion', cost: 1, attack: 1, health: 1, emoji: '🧑', sprite: 'card_t_recruit', token: true, cls: 'vanguard' },
  { id: 't_wolf', name: 'Dusk Wolf', type: 'minion', cost: 2, attack: 2, health: 2, emoji: '🐺', sprite: 'card_t_wolf', token: true, cls: 'stalker' },
  { id: 't_shardling', name: 'Shardling', type: 'minion', cost: 2, attack: 2, health: 2, emoji: '💎', sprite: 'card_t_shardling', token: true },
  { id: 't_shiv', name: 'Shiv', type: 'weapon', cost: 1, attack: 1, durability: 2, emoji: '🔪', sprite: 'card_t_shiv', token: true, cls: 'shade' },
  { id: 't_footsoldier', name: 'Goblin Footsoldier', type: 'minion', cost: 1, attack: 1, health: 1, emoji: '❔', sprite: 'card_t_footsoldier', token: true },
  { id: 't_spiderling', name: 'Spiderling', type: 'minion', cost: 1, attack: 1, health: 1, emoji: '🕷️', sprite: 'card_t_spiderling', token: true },

  // ---------- Neutral ----------
  { id: 'n_mossling', name: 'Mossling', type: 'minion', cost: 1, attack: 2, health: 1, emoji: '🌱', sprite: 'card_n_mossling' },
  { id: 'n_lanternmoth', name: 'Lantern Moth', type: 'minion', cost: 1, attack: 1, health: 1, emoji: '🦋', sprite: 'card_n_lanternmoth',
    text: 'Battlecry: Deal 1 damage.', target: 'any', battlecry: [{ type: 'damage', amount: 1, to: 'target' }] },
  { id: 'n_brambebeetle', name: 'Bramble Beetle', type: 'minion', cost: 1, attack: 1, health: 2, emoji: '🐞', sprite: 'card_n_brambebeetle',
    keywords: { taunt: true } },
  { id: 'n_scrapper', name: 'Alley Scrapper', type: 'minion', cost: 2, attack: 3, health: 2, emoji: '🥊', sprite: 'card_n_scrapper' },
  { id: 'n_glasswing', name: 'Glasswing Sentry', type: 'minion', cost: 2, attack: 2, health: 1, emoji: '🪽', sprite: 'card_n_glasswing',
    keywords: { divineShield: true } },
  { id: 'n_courier', name: 'Wandering Courier', type: 'minion', cost: 2, attack: 2, health: 2, emoji: '📜', sprite: 'card_n_courier',
    text: 'Deathrattle: Draw a card.', deathrattle: [{ type: 'draw', count: 1 }] },
  { id: 'n_leechbat', name: 'Leech Bat', type: 'minion', cost: 2, attack: 2, health: 2, emoji: '🦇', sprite: 'card_n_leechbat',
    keywords: { lifesteal: true } },
  { id: 'n_adder', name: 'Swamp Adder', type: 'minion', cost: 2, attack: 1, health: 2, emoji: '🐍', sprite: 'card_n_adder',
    keywords: { poisonous: true } },
  { id: 'n_tinker', name: 'Cog Tinker', type: 'minion', cost: 3, attack: 2, health: 3, emoji: '⚙️', sprite: 'card_n_tinker',
    text: 'Battlecry: Give a friendly minion +1/+1.', target: 'friendlyMinion',
    battlecry: [{ type: 'buff', attack: 1, health: 1, to: 'target' }] },
  { id: 'n_boar', name: 'Ironhide Boar', type: 'minion', cost: 3, attack: 2, health: 4, emoji: '🐗', sprite: 'card_n_boar',
    keywords: { taunt: true } },
  { id: 'n_herald', name: 'Galloping Herald', type: 'minion', cost: 3, attack: 3, health: 2, emoji: '🐎', sprite: 'card_n_herald',
    keywords: { rush: true } },
  { id: 'n_lurker', name: 'Bog Lurker', type: 'minion', cost: 3, attack: 3, health: 2, emoji: '🐊', sprite: 'card_n_lurker',
    keywords: { stealth: true } },
  { id: 'n_medic', name: 'Field Medic', type: 'minion', cost: 3, attack: 3, health: 2, emoji: '🩹', sprite: 'card_n_medic',
    text: 'Battlecry: Restore 4 Health to your hero.', battlecry: [{ type: 'heal', amount: 4, to: 'ownHero' }] },
  { id: 'n_monk', name: 'Whispering Monk', type: 'minion', cost: 3, attack: 2, health: 1, emoji: '🤫', sprite: 'card_n_monk',
    text: 'Battlecry: Silence a minion.', target: 'minion', battlecry: [{ type: 'silence', to: 'target' }] },
  { id: 'n_warhorn', name: 'Warhorn Totem', type: 'minion', cost: 2, attack: 0, health: 3, emoji: '📯', sprite: 'card_n_warhorn',
    text: 'Adjacent minions have +2 Attack.', adjacentAura: { attack: 2 } },
  { id: 'n_bannerbearer', name: 'Banner Bearer', type: 'minion', cost: 3, attack: 2, health: 3, emoji: '🎏', sprite: 'card_n_bannerbearer',
    text: 'Battlecry: Give adjacent minions +1/+1.', battlecry: [{ type: 'buff', attack: 1, health: 1, to: 'adjacent' }] },
  { id: 'n_sergeant', name: 'Shieldwall Sergeant', type: 'minion', cost: 4, attack: 3, health: 4, emoji: '🪖', sprite: 'card_n_sergeant',
    text: 'Battlecry: Give adjacent minions +1 Health and Taunt.',
    battlecry: [{ type: 'buff', health: 1, keywords: { taunt: true }, to: 'adjacent' }] },
  { id: 'n_golem', name: 'Shatterstone Golem', type: 'minion', cost: 4, attack: 3, health: 3, emoji: '🪨', sprite: 'card_n_golem',
    text: 'Deathrattle: Summon a 2/2 Shardling.', deathrattle: [{ type: 'summon', card: 't_shardling' }] },
  { id: 'n_stormcaller', name: 'Stormcaller Adept', type: 'minion', cost: 4, attack: 3, health: 4, emoji: '⚡', sprite: 'card_n_stormcaller',
    spellDamage: 1 },
  { id: 'n_ram', name: 'Thornback Ram', type: 'minion', cost: 4, attack: 4, health: 3, emoji: '🐏', sprite: 'card_n_ram',
    keywords: { charge: true } },
  { id: 'n_sorcerer', name: 'Hexbolt Sorcerer', type: 'minion', cost: 5, attack: 4, health: 4, emoji: '🧙', sprite: 'card_n_sorcerer',
    text: 'Battlecry: Deal 3 damage.', target: 'any', battlecry: [{ type: 'damage', amount: 3, to: 'target' }] },
  { id: 'n_dervish', name: 'Maypole of Doom', type: 'minion', cost: 5, attack: 3, health: 5, emoji: '🌪️', sprite: 'card_n_dervish',
    keywords: { windfury: true } },
  { id: 'n_sentinel', name: 'Granite Sentinel', type: 'minion', cost: 5, attack: 4, health: 6, emoji: '🗿', sprite: 'card_n_sentinel',
    keywords: { taunt: true } },
  { id: 'n_wyvern', name: 'Skyreaver Wyvern', type: 'minion', cost: 6, attack: 5, health: 6, emoji: '🐉', sprite: 'card_n_wyvern',
    keywords: { rush: true } },
  { id: 'n_treant', name: 'Elder Treant', type: 'minion', cost: 7, attack: 6, health: 8, emoji: '🌳', sprite: 'card_n_treant',
    keywords: { taunt: true } },
  { id: 'n_colossus', name: 'Colossus of the Rift', type: 'minion', cost: 9, attack: 9, health: 9, emoji: '🌀', sprite: 'card_n_colossus',
    text: 'Battlecry: Deal 3 damage to all other characters.',
    battlecry: [{ type: 'damage', amount: 3, to: 'allOtherCharacters' }] },
  { id: 'n_prisoner', name: 'Tortured Prisoner', type: 'minion', cost: 3, attack: 1, health: 4, emoji: '❔', sprite: 'card_n_prisoner',
    text: 'Whenever this takes damage, draw a card.', onDamaged: [{ type: 'draw', count: 1 }] },
  { id: 'n_troll', name: 'Armored Troll', type: 'minion', cost: 6, attack: 6, health: 8, emoji: '❔', sprite: 'card_n_troll' },
  { id: 'n_death', name: 'Bleeding Death', type: 'minion', cost: 8, attack: 5, health: 10, emoji: '❔', sprite: 'card_n_death',
    keywords: { charge: true, windfury: true }, text: 'Dies at the end of this turn.',
    endOfTurn: [{ type: 'destroy', to: 'self' }] },
  { id: 'n_aura', name: 'Healing Aura', type: 'spell', cost: 0, emoji: '❔', sprite: 'card_n_aura',
    text: 'Restore 2 Health', target: 'any', effects: [{ type: 'heal', amount: 2, to: 'target' }] },
  { id: 'n_scout', name: 'Goblin Scout', type: 'minion', cost: 2, attack: 2, health: 1, emoji: '❔', sprite: 'card_n_scout',
    text: 'Battlecry: Summon a 1/1 Goblin Footsoldier.', battlecry: [{ type: 'summon', card: 't_footsoldier' }] },

  // Neutral, second wave: mostly cheap cards, for more varied decks.
  { id: 'n_tunnelrat', name: 'Tunnel Rat', type: 'minion', cost: 1, attack: 1, health: 1, emoji: '🐀', sprite: 'card_n_tunnelrat',
    text: 'Deathrattle: Deal 1 damage to a random enemy.', deathrattle: [{ type: 'damage', amount: 1, to: 'randomEnemy' }] },
  { id: 'n_squire', name: 'Eager Squire', type: 'minion', cost: 1, attack: 1, health: 1, emoji: '🧒', sprite: 'card_n_squire',
    keywords: { divineShield: true } },
  { id: 'n_hedgehog', name: 'Quillback Hedgehog', type: 'minion', cost: 1, attack: 1, health: 2, emoji: '🦔', sprite: 'card_n_hedgehog',
    text: 'Whenever this takes damage, deal 1 damage to a random enemy.', onDamaged: [{ type: 'damage', amount: 1, to: 'randomEnemy' }] },
  { id: 'n_faun', name: 'Glade Faun', type: 'minion', cost: 1, attack: 1, health: 2, emoji: '🦌', sprite: 'card_n_faun',
    text: 'Battlecry: Give a friendly minion +1 Attack.', target: 'friendlyMinion',
    battlecry: [{ type: 'buff', attack: 1, to: 'target' }] },
  { id: 'n_pikeman', name: 'Bridge Pikeman', type: 'minion', cost: 2, attack: 2, health: 3, emoji: '🔱', sprite: 'card_n_pikeman' },
  { id: 'n_tortoise', name: 'Stoneshell Tortoise', type: 'minion', cost: 2, attack: 1, health: 4, emoji: '🐢', sprite: 'card_n_tortoise',
    keywords: { taunt: true } },
  { id: 'n_firebrand', name: 'Reckless Firebrand', type: 'minion', cost: 2, attack: 3, health: 3, emoji: '🧨', sprite: 'card_n_firebrand',
    text: 'Battlecry: Deal 3 damage to your hero.', battlecry: [{ type: 'damage', amount: 3, to: 'ownHero' }] },
  { id: 'n_fennec', name: 'Sand Fennec', type: 'minion', cost: 2, attack: 3, health: 1, emoji: '🦊', sprite: 'card_n_fennec',
    keywords: { rush: true } },
  { id: 'n_herbalist', name: 'Hedge Herbalist', type: 'minion', cost: 2, attack: 2, health: 2, emoji: '🌿', sprite: 'card_n_herbalist',
    text: 'Battlecry: Restore 3 Health.', target: 'any', battlecry: [{ type: 'heal', amount: 3, to: 'target' }] },
  { id: 'n_archer', name: 'Watchtower Archer', type: 'minion', cost: 3, attack: 3, health: 2, emoji: '🏹', sprite: 'card_n_archer',
    text: 'Battlecry: Deal 2 damage to a random enemy minion.', battlecry: [{ type: 'damage', amount: 2, to: 'randomEnemyMinion' }] },
  { id: 'n_spider', name: 'Cavern Broodmother', type: 'minion', cost: 3, attack: 2, health: 2, emoji: '🕷️', sprite: 'card_n_spider',
    text: 'Deathrattle: Summon two 1/1 Spiderlings.', deathrattle: [{ type: 'summon', card: 't_spiderling', count: 2 }] },
  { id: 'n_cook', name: 'Campfire Cook', type: 'minion', cost: 3, attack: 2, health: 4, emoji: '🍲', sprite: 'card_n_cook',
    text: 'At the end of your turn, restore 1 Health to all friendly characters.',
    endOfTurn: [{ type: 'heal', amount: 1, to: 'allFriendly' }] },
  { id: 'n_duelist', name: 'Twinblade Duelist', type: 'minion', cost: 3, attack: 2, health: 3, emoji: '⚔️', sprite: 'card_n_duelist',
    keywords: { windfury: true } },
  { id: 'n_hound', name: 'Mire Hound', type: 'minion', cost: 3, attack: 2, health: 3, emoji: '🐕', sprite: 'card_n_hound',
    keywords: { poisonous: true } },
  { id: 'n_knight', name: 'Questing Knight', type: 'minion', cost: 4, attack: 4, health: 3, emoji: '🤺', sprite: 'card_n_knight',
    keywords: { divineShield: true } },
  { id: 'n_ogre', name: 'Cave Ogre', type: 'minion', cost: 4, attack: 4, health: 5, emoji: '👹', sprite: 'card_n_ogre' },
  { id: 'n_galeshaman', name: 'Gale Shaman', type: 'minion', cost: 4, attack: 3, health: 3, emoji: '🌬️', sprite: 'card_n_galeshaman',
    text: 'Battlecry: Deal 1 damage to all enemies.', battlecry: [{ type: 'damage', amount: 1, to: 'allEnemies' }] },
  { id: 'n_mammoth', name: 'Plains Mammoth', type: 'minion', cost: 5, attack: 6, health: 5, emoji: '🦣', sprite: 'card_n_mammoth' },
  { id: 'n_ghoul', name: 'Ravenous Ghoul', type: 'minion', cost: 5, attack: 4, health: 5, emoji: '🧟', sprite: 'card_n_ghoul',
    keywords: { lifesteal: true } },
  { id: 'n_juggernaut', name: 'Ironclad Juggernaut', type: 'minion', cost: 6, attack: 5, health: 7, emoji: '🛡️', sprite: 'card_n_juggernaut',
    keywords: { taunt: true } },

  // ---------- Pyromancer ----------
  { id: 'p_cinderbolt', cls: 'pyromancer', name: 'Cinder Bolt', type: 'spell', cost: 2, emoji: '☄️', sprite: 'card_p_cinderbolt',
    text: 'Deal 3 damage.', target: 'any', effects: [{ type: 'damage', amount: 3, to: 'target' }] },
  { id: 'p_rimelance', cls: 'pyromancer', name: 'Rime Lance', type: 'spell', cost: 2, emoji: '❄️', sprite: 'card_p_rimelance',
    text: 'Deal 2 damage to a character and Freeze it.', target: 'any',
    effects: [{ type: 'damage', amount: 2, to: 'target' }, { type: 'freeze', to: 'target' }] },
  { id: 'p_sparkshower', cls: 'pyromancer', name: 'Spark Shower', type: 'spell', cost: 2, emoji: '✨', sprite: 'card_p_sparkshower',
    text: 'Deal 1 damage to a random enemy 3 times.',
    effects: [{ type: 'damage', amount: 1, to: 'randomEnemy', times: 3 }] },
  { id: 'p_runeweaver', cls: 'pyromancer', name: 'Runeweaver Apprentice', type: 'minion', cost: 2, attack: 1, health: 3, emoji: '📖', sprite: 'card_p_runeweaver',
    text: 'Whenever you cast a spell, gain +1 Attack.', onFriendlySpell: [{ type: 'buff', attack: 1, to: 'self' }] },
  { id: 'p_glacial', cls: 'pyromancer', name: 'Glacial Breath', type: 'spell', cost: 3, emoji: '🌬️', sprite: 'card_p_glacial',
    text: 'Freeze all enemy minions. Draw a card.',
    effects: [{ type: 'freeze', to: 'allEnemyMinions' }, { type: 'draw', count: 1 }] },
  { id: 'p_ashfall', cls: 'pyromancer', name: 'Ashfall', type: 'spell', cost: 3, emoji: '🌋', sprite: 'card_p_ashfall',
    text: 'Deal 2 damage to all enemy minions.', effects: [{ type: 'damage', amount: 2, to: 'allEnemyMinions' }] },
  { id: 'p_embercolossus', cls: 'pyromancer', name: 'Ember Colossus', type: 'minion', cost: 6, attack: 6, health: 6, emoji: '🔥', sprite: 'card_p_embercolossus',
    text: 'At the end of your turn, deal 2 damage to a random enemy.',
    endOfTurn: [{ type: 'damage', amount: 2, to: 'randomEnemy' }] },
  { id: 'p_starfall', cls: 'pyromancer', name: 'Starfall Meteor', type: 'spell', cost: 7, emoji: '🌠', sprite: 'card_p_starfall',
    text: 'Deal 5 damage to all enemy minions.', effects: [{ type: 'damage', amount: 5, to: 'allEnemyMinions' }] },
  { id: 'p_frostbite', cls: 'pyromancer', name: 'Frostbite', type: 'spell', cost: 1, emoji: '🧊', sprite: 'card_p_frostbite',
    text: 'Deal 1 damage to a minion and Freeze it.', target: 'minion',
    effects: [{ type: 'damage', amount: 1, to: 'target' }, { type: 'freeze', to: 'target' }] },
  { id: 'p_imp', cls: 'pyromancer', name: 'Cinder Imp', type: 'minion', cost: 1, attack: 1, health: 2, emoji: '😈', sprite: 'card_p_imp',
    spellDamage: 1 },
  { id: 'p_searing', cls: 'pyromancer', name: 'Searing Ray', type: 'spell', cost: 3, emoji: '🔆', sprite: 'card_p_searing',
    text: 'Deal 4 damage to a minion.', target: 'minion', effects: [{ type: 'damage', amount: 4, to: 'target' }] },
  { id: 'p_revenant', cls: 'pyromancer', name: 'Frost Revenant', type: 'minion', cost: 4, attack: 3, health: 5, emoji: '🥶', sprite: 'card_p_revenant',
    text: 'Whenever you cast a spell, Freeze a random enemy minion.', onFriendlySpell: [{ type: 'freeze', to: 'randomEnemyMinion' }] },

  // Legendary (one per deck). Unlocked by the class's Champion's Trial (see progress.js).
  { id: 'p_pyrrha', cls: 'pyromancer', legendary: true, name: 'Pyrrha Ashcrown', type: 'minion', cost: 8, attack: 6, health: 6, emoji: '👑', sprite: 'card_p_pyrrha',
    spellDamage: 2, text: 'Battlecry: Deal 2 damage to all enemies.', battlecry: [{ type: 'damage', amount: 2, to: 'allEnemies' }] },

  // ---------- Warlord ----------
  { id: 'w_stomp', cls: 'warlord', name: 'Shockwave Stomp', type: 'spell', cost: 1, emoji: '💥', sprite: 'card_w_stomp',
    text: 'Deal 1 damage to all minions.', effects: [{ type: 'damage', amount: 1, to: 'allMinions' }] },
  { id: 'w_axe', cls: 'warlord', name: 'Notched Axe', type: 'weapon', cost: 2, attack: 3, durability: 2, emoji: '🪓', sprite: 'card_w_axe' },
  { id: 'w_verdict', cls: 'warlord', name: "Headsman's Verdict", type: 'spell', cost: 2, emoji: '⚖️', sprite: 'card_w_verdict',
    text: 'Destroy a damaged enemy minion.', target: 'enemyMinion', targetFilter: { damaged: true },
    effects: [{ type: 'destroy', to: 'target' }] },
  { id: 'w_berserker', cls: 'warlord', name: 'Bloodrage Berserker', type: 'minion', cost: 3, attack: 2, health: 4, emoji: '😤', sprite: 'card_w_berserker',
    text: 'Whenever this minion takes damage, gain +2 Attack.', onDamaged: [{ type: 'buff', attack: 2, to: 'self' }] },
  { id: 'w_resolve', cls: 'warlord', name: 'Iron Resolve', type: 'spell', cost: 3, emoji: '🛡️', sprite: 'card_w_resolve',
    text: 'Gain 5 Armor. Draw a card.', effects: [{ type: 'armor', amount: 5 }, { type: 'draw', count: 1 }] },
  { id: 'w_bastion', cls: 'warlord', name: 'Bastion Warden', type: 'minion', cost: 4, attack: 3, health: 5, emoji: '🏰', sprite: 'card_w_bastion',
    keywords: { taunt: true }, text: 'Battlecry: Gain 3 Armor.', battlecry: [{ type: 'armor', amount: 3 }] },
  { id: 'w_earthshatter', cls: 'warlord', name: 'Earthshatter', type: 'spell', cost: 5, emoji: '🌍', sprite: 'card_w_earthshatter',
    text: 'Deal 3 damage to all minions.', effects: [{ type: 'damage', amount: 3, to: 'allMinions' }] },
  { id: 'w_champion', cls: 'warlord', name: 'Iron Champion', type: 'minion', cost: 7, attack: 7, health: 7, emoji: '🦾', sprite: 'card_w_champion',
    keywords: { rush: true } },
  { id: 'w_warcry', cls: 'warlord', name: 'Blood Cry', type: 'spell', cost: 1, emoji: '📣', sprite: 'card_w_warcry',
    text: 'Deal 1 damage to a minion and give it +2 Attack.', target: 'minion',
    effects: [{ type: 'damage', amount: 1, to: 'target' }, { type: 'buff', attack: 2, to: 'target' }] },
  { id: 'w_shieldbash', cls: 'warlord', name: 'Shield Bash', type: 'spell', cost: 2, emoji: '🛡️', sprite: 'card_w_shieldbash',
    text: 'Gain 2 Armor. Deal 2 damage to a minion.', target: 'minion',
    effects: [{ type: 'armor', amount: 2 }, { type: 'damage', amount: 2, to: 'target' }] },
  { id: 'w_pitfighter', cls: 'warlord', name: 'Scarred Pit Fighter', type: 'minion', cost: 2, attack: 2, health: 3, emoji: '🤼', sprite: 'card_w_pitfighter',
    text: 'Whenever this minion takes damage, gain 2 Armor.', onDamaged: [{ type: 'armor', amount: 2 }] },
  { id: 'w_chieftain', cls: 'warlord', name: 'Warband Chieftain', type: 'minion', cost: 5, attack: 5, health: 5, emoji: '👺', sprite: 'card_w_chieftain',
    text: 'Battlecry: Deal 1 damage to all other minions.', battlecry: [{ type: 'damage', amount: 1, to: 'allOtherMinions' }] },

  // Legendary (one per deck). Unlocked by the class's Champion's Trial (see progress.js).
  { id: 'w_gorrak', cls: 'warlord', legendary: true, name: 'Gorrak Skullsunder', type: 'minion', cost: 8, attack: 8, health: 8, emoji: '👑', sprite: 'card_w_gorrak',
    keywords: { rush: true }, text: 'Whenever this takes damage, gain +2 Attack.', onDamaged: [{ type: 'buff', attack: 2, to: 'self' }] },

  // ---------- Stalker ----------
  { id: 's_hawk', cls: 'stalker', name: 'Hunting Hawk', type: 'minion', cost: 1, attack: 1, health: 1, emoji: '🦅', sprite: 'card_s_hawk',
    keywords: { charge: true } },
  { id: 's_pinning', cls: 'stalker', name: 'Pinning Shot', type: 'spell', cost: 1, emoji: '🎯', sprite: 'card_s_pinning',
    text: 'Deal 2 damage to a minion.', target: 'minion', effects: [{ type: 'damage', amount: 2, to: 'target' }] },
  { id: 's_snapjaw', cls: 'stalker', name: 'Snapjaw Croc', type: 'minion', cost: 2, attack: 2, health: 3, emoji: '🦎', sprite: 'card_s_snapjaw',
    text: 'Deathrattle: Deal 2 damage to the enemy hero.', deathrattle: [{ type: 'damage', amount: 2, to: 'enemyHero' }] },
  { id: 's_instinct', cls: 'stalker', name: "Scout's Instinct", type: 'spell', cost: 2, emoji: '👁️', sprite: 'card_s_instinct',
    text: 'Draw 2 cards.', effects: [{ type: 'draw', count: 2 }] },
  { id: 's_pack', cls: 'stalker', name: 'Call the Pack', type: 'spell', cost: 3, emoji: '🐺', sprite: 'card_s_pack',
    text: 'Summon two 2/2 Dusk Wolves.', effects: [{ type: 'summon', card: 't_wolf', count: 2 }] },
  { id: 's_packmaster', cls: 'stalker', name: 'Packmaster', type: 'minion', cost: 4, attack: 4, health: 3, emoji: '🧔', sprite: 'card_s_packmaster',
    text: 'Battlecry: Give a friendly minion +2/+2 and Taunt.', target: 'friendlyMinion',
    battlecry: [{ type: 'buff', attack: 2, health: 2, keywords: { taunt: true }, to: 'target' }] },
  { id: 's_twinarrows', cls: 'stalker', name: 'Twin Arrows', type: 'spell', cost: 4, emoji: '🏹', sprite: 'card_s_twinarrows',
    text: 'Deal 3 damage to two random enemy minions.',
    effects: [{ type: 'damage', amount: 3, to: 'randomEnemyMinion', times: 2, distinct: true }] },
  { id: 's_stag', cls: 'stalker', name: 'Thunderhoof Stag', type: 'minion', cost: 5, attack: 5, health: 4, emoji: '🦌', sprite: 'card_s_stag',
    keywords: { rush: true } },
  { id: 's_viper', cls: 'stalker', name: 'Pit Viper', type: 'minion', cost: 1, attack: 1, health: 1, emoji: '🐍', sprite: 'card_s_viper',
    keywords: { poisonous: true } },
  { id: 's_barbed', cls: 'stalker', name: 'Barbed Shot', type: 'spell', cost: 2, emoji: '🪝', sprite: 'card_s_barbed',
    text: 'Deal 2 damage to a minion and 1 damage to the enemy hero.', target: 'minion',
    effects: [{ type: 'damage', amount: 2, to: 'target' }, { type: 'damage', amount: 1, to: 'enemyHero' }] },
  { id: 's_boar', cls: 'stalker', name: 'Bristleback Boar', type: 'minion', cost: 3, attack: 3, health: 3, emoji: '🐗', sprite: 'card_s_boar',
    keywords: { rush: true } },
  { id: 's_denmother', cls: 'stalker', name: 'Den Mother', type: 'minion', cost: 4, attack: 3, health: 3, emoji: '🐺', sprite: 'card_s_denmother',
    text: 'Deathrattle: Summon two 2/2 Dusk Wolves.', deathrattle: [{ type: 'summon', card: 't_wolf', count: 2 }] },

  // Legendary (one per deck). Unlocked by the class's Champion's Trial (see progress.js).
  { id: 's_kaelen', cls: 'stalker', legendary: true, name: 'Kaelen Stormhorn', type: 'minion', cost: 7, attack: 6, health: 5, emoji: '👑', sprite: 'card_s_kaelen',
    keywords: { rush: true }, text: 'Battlecry: Summon three 2/2 Dusk Wolves.', battlecry: [{ type: 'summon', card: 't_wolf', count: 3 }] },

  // ---------- Oracle ----------
  { id: 'o_ward', cls: 'oracle', name: 'Ward of Light', type: 'spell', cost: 1, emoji: '🔆', sprite: 'card_o_ward',
    text: 'Give a minion +2 Health. Draw a card.', target: 'minion',
    effects: [{ type: 'buff', health: 2, to: 'target' }, { type: 'draw', count: 1 }] },
  { id: 'o_candle', cls: 'oracle', name: 'Candle Keeper', type: 'minion', cost: 2, attack: 1, health: 3, emoji: '🕯️', sprite: 'card_o_candle',
    text: 'At the end of your turn, restore 2 Health to your hero.',
    endOfTurn: [{ type: 'heal', amount: 2, to: 'ownHero' }] },
  { id: 'o_humbling', cls: 'oracle', name: 'Humbling Light', type: 'spell', cost: 3, emoji: '🙏', sprite: 'card_o_humbling',
    text: 'Destroy a minion with 3 or less Attack.', target: 'minion', targetFilter: { maxAttack: 3 },
    effects: [{ type: 'destroy', to: 'target' }] },
  { id: 'o_theft', cls: 'oracle', name: 'Thought Theft', type: 'spell', cost: 2, emoji: '🧠', sprite: 'card_o_theft',
    text: "Copy 2 cards from your opponent's deck into your hand.", effects: [{ type: 'copyFromOpponentDeck', count: 2 }] },
  { id: 'o_hymnal', cls: 'oracle', name: 'Hymnal Guardian', type: 'minion', cost: 3, attack: 1, health: 5, emoji: '⛪', sprite: 'card_o_hymnal',
    keywords: { taunt: true } },
  { id: 'o_judgment', cls: 'oracle', name: 'Final Judgment', type: 'spell', cost: 4, emoji: '☀️', sprite: 'card_o_judgment',
    text: 'Destroy a minion with 5 or more Attack.', target: 'minion', targetFilter: { minAttack: 5 },
    effects: [{ type: 'destroy', to: 'target' }] },
  { id: 'o_nova', cls: 'oracle', name: 'Radiant Nova', type: 'spell', cost: 6, emoji: '💫', sprite: 'card_o_nova',
    text: 'Deal 2 damage to all enemies. Restore 2 Health to all friendly characters.',
    effects: [{ type: 'damage', amount: 2, to: 'allEnemies' }, { type: 'heal', amount: 2, to: 'allFriendly' }] },
  { id: 'o_seraph', cls: 'oracle', name: 'Divine Seraph', type: 'minion', cost: 7, attack: 5, health: 6, emoji: '👼', sprite: 'card_o_seraph',
    keywords: { taunt: true, lifesteal: true } },
  { id: 'o_novice', cls: 'oracle', name: 'Temple Novice', type: 'minion', cost: 1, attack: 1, health: 2, emoji: '🧎', sprite: 'card_o_novice',
    text: 'Battlecry: Restore 2 Health.', target: 'any', battlecry: [{ type: 'heal', amount: 2, to: 'target' }] },
  { id: 'o_smite', cls: 'oracle', name: 'Smite', type: 'spell', cost: 2, emoji: '⚡', sprite: 'card_o_smite',
    text: 'Deal 2 damage to a minion. Restore 2 Health to your hero.', target: 'minion',
    effects: [{ type: 'damage', amount: 2, to: 'target' }, { type: 'heal', amount: 2, to: 'ownHero' }] },
  { id: 'o_vision', cls: 'oracle', name: 'Vision of Dawn', type: 'spell', cost: 3, emoji: '🌅', sprite: 'card_o_vision',
    text: 'Draw 2 cards. Restore 3 Health to your hero.', effects: [{ type: 'draw', count: 2 }, { type: 'heal', amount: 3, to: 'ownHero' }] },
  { id: 'o_inquisitor', cls: 'oracle', name: 'Silent Inquisitor', type: 'minion', cost: 4, attack: 3, health: 4, emoji: '🤐', sprite: 'card_o_inquisitor',
    text: 'Battlecry: Silence a minion.', target: 'minion', battlecry: [{ type: 'silence', to: 'target' }] },

  // Legendary (one per deck). Unlocked by the class's Champion's Trial (see progress.js).
  { id: 'o_aurelia', cls: 'oracle', legendary: true, name: 'Saint Aurelia', type: 'minion', cost: 8, attack: 5, health: 8, emoji: '👑', sprite: 'card_o_aurelia',
    keywords: { taunt: true }, text: 'Battlecry: Restore 8 Health to all friendly characters.',
    battlecry: [{ type: 'heal', amount: 8, to: 'allFriendly' }] },

  // ---------- Vanguard ----------
  { id: 'v_aegis', cls: 'vanguard', name: 'Aegis Blessing', type: 'spell', cost: 1, emoji: '✝️', sprite: 'card_v_aegis',
    text: 'Give a minion +1 Attack and Divine Shield.', target: 'minion',
    effects: [{ type: 'buff', attack: 1, keywords: { divineShield: true }, to: 'target' }] },
  { id: 'v_captain', cls: 'vanguard', name: 'Militia Captain', type: 'minion', cost: 2, attack: 2, health: 2, emoji: '🎖️', sprite: 'card_v_captain',
    text: 'Battlecry: Summon a 1/1 Recruit.', battlecry: [{ type: 'summon', card: 't_recruit' }] },
  { id: 'v_shieldmaiden', cls: 'vanguard', name: 'Gleaming Shieldmaiden', type: 'minion', cost: 3, attack: 2, health: 3, emoji: '🛡️', sprite: 'card_v_shieldmaiden',
    keywords: { taunt: true, divineShield: true } },
  { id: 'v_banner', cls: 'vanguard', name: 'Rallying Banner', type: 'spell', cost: 4, emoji: '🚩', sprite: 'card_v_banner',
    text: 'Give all friendly minions +1/+1.', effects: [{ type: 'buff', attack: 1, health: 1, to: 'allFriendlyMinions' }] },
  { id: 'v_hammer', cls: 'vanguard', name: 'Oathkeeper Hammer', type: 'weapon', cost: 4, attack: 3, durability: 3, emoji: '🔨', sprite: 'card_v_hammer' },
  { id: 'v_hallowed', cls: 'vanguard', name: 'Hallowed Ground', type: 'spell', cost: 5, emoji: '🌟', sprite: 'card_v_hallowed',
    text: 'Deal 2 damage to all enemies.', effects: [{ type: 'damage', amount: 2, to: 'allEnemies' }] },
  { id: 'v_cavalier', cls: 'vanguard', name: 'Silverlance Cavalier', type: 'minion', cost: 5, attack: 4, health: 4, emoji: '🏇', sprite: 'card_v_cavalier',
    keywords: { rush: true, divineShield: true } },
  { id: 'v_justicar', cls: 'vanguard', name: 'High Justicar', type: 'minion', cost: 7, attack: 6, health: 6, emoji: '👑', sprite: 'card_v_justicar',
    text: 'Battlecry: Give all other friendly minions +2/+2.',
    battlecry: [{ type: 'buff', attack: 2, health: 2, to: 'otherFriendlyMinions' }] },
  { id: 'v_oath', cls: 'vanguard', name: "Squire's Oath", type: 'spell', cost: 1, emoji: '🤝', sprite: 'card_v_oath',
    text: 'Summon two 1/1 Recruits.', effects: [{ type: 'summon', card: 't_recruit', count: 2 }] },
  { id: 'v_standard', cls: 'vanguard', name: 'Standard Bearer', type: 'minion', cost: 2, attack: 2, health: 2, emoji: '🚩', sprite: 'card_v_standard',
    text: 'Adjacent minions have +1 Attack.', adjacentAura: { attack: 1 } },
  { id: 'v_shieldwright', cls: 'vanguard', name: 'Shieldwright', type: 'minion', cost: 3, attack: 3, health: 3, emoji: '🔰', sprite: 'card_v_shieldwright',
    text: 'Battlecry: Give a friendly minion Divine Shield.', target: 'friendlyMinion',
    battlecry: [{ type: 'buff', keywords: { divineShield: true }, to: 'target' }] },
  { id: 'v_paragon', cls: 'vanguard', name: 'Paragon of Valor', type: 'minion', cost: 4, attack: 3, health: 4, emoji: '🌞', sprite: 'card_v_paragon',
    text: 'Battlecry: Give all other friendly minions Divine Shield.',
    battlecry: [{ type: 'buff', keywords: { divineShield: true }, to: 'otherFriendlyMinions' }] },

  // Legendary (one per deck). Unlocked by the class's Champion's Trial (see progress.js).
  { id: 'v_aldric', cls: 'vanguard', legendary: true, name: 'King Aldric Lionheart', type: 'minion', cost: 9, attack: 7, health: 7, emoji: '👑', sprite: 'card_v_aldric',
    text: 'Battlecry: Fill your board with Recruits, then give your other minions +1/+1.',
    battlecry: [{ type: 'summon', card: 't_recruit', count: 6 }, { type: 'buff', attack: 1, health: 1, to: 'otherFriendlyMinions' }] },

  // ---------- Shade ----------
  { id: 'r_knife', cls: 'shade', name: 'Knife in the Dark', type: 'spell', cost: 0, emoji: '🌑', sprite: 'card_r_knife',
    text: 'Deal 2 damage to an undamaged minion.', target: 'minion', targetFilter: { undamaged: true },
    effects: [{ type: 'damage', amount: 2, to: 'target' }] },
  { id: 'r_shiv', cls: 'shade', name: 'Shadow Shiv', type: 'spell', cost: 1, emoji: '🔪', sprite: 'card_r_shiv',
    text: 'Deal 1 damage. Draw a card.', target: 'any',
    effects: [{ type: 'damage', amount: 1, to: 'target' }, { type: 'draw', count: 1 }] },
  { id: 'r_oil', cls: 'shade', name: 'Nightshade Oil', type: 'spell', cost: 1, emoji: '🧪', sprite: 'card_r_oil',
    text: 'Give your weapon +2 Attack.', requiresWeapon: true, effects: [{ type: 'buffWeapon', attack: 2 }] },
  { id: 'r_cutpurse', cls: 'shade', name: 'Alley Cutpurse', type: 'minion', cost: 2, attack: 2, health: 3, emoji: '🦹', sprite: 'card_r_cutpurse',
    text: 'Combo: Draw a card.', combo: [{ type: 'draw', count: 1 }] },
  { id: 'r_fadestep', cls: 'shade', name: 'Fade Step', type: 'spell', cost: 2, emoji: '💨', sprite: 'card_r_fadestep',
    text: "Return a minion to its owner's hand.", target: 'minion', effects: [{ type: 'bounce', to: 'target' }] },
  { id: 'r_fan', cls: 'shade', name: 'Fan of Blades', type: 'spell', cost: 2, emoji: '🌀', sprite: 'card_r_fan',
    text: 'Deal 1 damage to all enemy minions. Draw a card.',
    effects: [{ type: 'damage', amount: 1, to: 'allEnemyMinions' }, { type: 'draw', count: 1 }] },
  { id: 'r_prodigy', cls: 'shade', name: 'Gutter Prodigy', type: 'minion', cost: 3, attack: 3, health: 3, emoji: '🎭', sprite: 'card_r_prodigy',
    text: 'Combo: Gain +2/+2 and Stealth.', combo: [{ type: 'buff', attack: 2, health: 2, keywords: { stealth: true }, to: 'self' }] },
  { id: 'r_contract', cls: 'shade', name: 'Silent Contract', type: 'spell', cost: 4, emoji: '📃', sprite: 'card_r_contract',
    text: 'Destroy an enemy minion.', target: 'enemyMinion', effects: [{ type: 'destroy', to: 'target' }] },
  { id: 'r_urchin', cls: 'shade', name: 'Street Urchin', type: 'minion', cost: 1, attack: 2, health: 1, emoji: '🧢', sprite: 'card_r_urchin',
    text: 'Combo: Gain +1/+1 and Stealth.', combo: [{ type: 'buff', attack: 1, health: 1, keywords: { stealth: true }, to: 'self' }] },
  { id: 'r_smokebomb', cls: 'shade', name: 'Smoke Bomb', type: 'spell', cost: 1, emoji: '💣', sprite: 'card_r_smokebomb',
    text: 'Give a friendly minion Stealth. Draw a card.', target: 'friendlyMinion',
    effects: [{ type: 'buff', keywords: { stealth: true }, to: 'target' }, { type: 'draw', count: 1 }] },
  { id: 'r_peddler', cls: 'shade', name: 'Venom Peddler', type: 'minion', cost: 2, attack: 2, health: 2, emoji: '🧴', sprite: 'card_r_peddler',
    text: 'Battlecry: Give your weapon +1 Attack.', battlecry: [{ type: 'buffWeapon', attack: 1 }] },
  { id: 'r_assassin', cls: 'shade', name: 'Veiled Assassin', type: 'minion', cost: 4, attack: 3, health: 3, emoji: '🥷', sprite: 'card_r_assassin',
    keywords: { stealth: true }, text: 'Combo: Deal 2 damage to a random enemy minion.', combo: [{ type: 'damage', amount: 2, to: 'randomEnemyMinion' }] },

  // Legendary (one per deck). Unlocked by the class's Champion's Trial (see progress.js).
  { id: 'r_nyx', cls: 'shade', legendary: true, name: 'Nyx, Queen of Knives', type: 'minion', cost: 7, attack: 5, health: 5, emoji: '👑', sprite: 'card_r_nyx',
    keywords: { stealth: true }, text: 'Combo: Destroy a random enemy minion.', combo: [{ type: 'destroy', to: 'randomEnemyMinion' }] },

  // ---------- Celestial (hidden until unlocked: see src/unlocks.js) ----------
  // Summoned by Nightlord Grun's hero power.
  { id: 't_riftdemon', cls: 'celestial', name: 'Rift Demon', type: 'minion', cost: 6, attack: 6, health: 6, emoji: '😈', sprite: 'card_t_riftdemon', token: true },
  // Time and space: the power of the Rift itself. Played by Aurion, and by the Riftkin bosses.
  { id: 'c_acolyte', cls: 'celestial', name: 'Chrono Acolyte', type: 'minion', cost: 2, attack: 2, health: 2, emoji: '⏳', sprite: 'card_c_acolyte',
    text: 'Battlecry: Gain 1 Mana Crystal this turn only.', battlecry: [{ type: 'mana', amount: 1 }] },
  { id: 'c_wraith', cls: 'celestial', name: 'Cosmic Wraith', type: 'minion', cost: 3, attack: 3, health: 2, emoji: '👻', sprite: 'card_c_wraith' },
  { id: 'c_nucleus', cls: 'celestial', name: 'Unstable Nucleus', type: 'minion', cost: 3, attack: 4, health: 2, emoji: '⚛️', sprite: 'card_c_nucleus',
    keywords: { windfury: true }, text: 'Battlecry: Deal 3 damage to your hero.', battlecry: [{ type: 'damage', amount: 3, to: 'ownHero' }] },
  { id: 'c_seer', cls: 'celestial', name: 'Starborn Seer', type: 'minion', cost: 4, attack: 3, health: 4, emoji: '🔭', sprite: 'card_c_seer',
    spellDamage: 1, text: 'Battlecry: Draw a card.', battlecry: [{ type: 'draw', count: 1 }] },
  { id: 'c_revenant', cls: 'celestial', name: 'Revenant', type: 'minion', cost: 5, attack: 2, health: 3, emoji: '💀', sprite: 'card_c_revenant',
    text: 'Whenever your hero attacks, gain +1 Attack.', onHeroAttack: [{ type: 'buff', attack: 1, to: 'self' }] },
  { id: 'c_comet', cls: 'celestial', name: 'Comet Rider', type: 'minion', cost: 6, attack: 5, health: 4, emoji: '☄️', sprite: 'card_c_comet',
    keywords: { rush: true }, text: 'Battlecry: Deal 2 damage to a random enemy.', battlecry: [{ type: 'damage', amount: 2, to: 'randomEnemy' }] },
  { id: 'c_sentinel', cls: 'celestial', name: 'Skybridge Sentinel', type: 'minion', cost: 9, attack: 8, health: 10, emoji: '🌉', sprite: 'card_c_sentinel',
    keywords: { taunt: true } },
  { id: 'c_horizon', cls: 'celestial', name: 'Event Horizon', type: 'spell', cost: 2, emoji: '⭕', sprite: 'card_c_horizon',
    text: 'Freeze a character. Draw a card.', target: 'any', effects: [{ type: 'freeze', to: 'target' }, { type: 'draw', count: 1 }] },
  { id: 'c_starfire', cls: 'celestial', name: 'Starfire Bolt', type: 'spell', cost: 3, emoji: '🌟', sprite: 'card_c_starfire',
    text: 'Deal 5 damage.', target: 'any', effects: [{ type: 'damage', amount: 5, to: 'target' }] },
  { id: 'c_gravity', cls: 'celestial', name: 'Gravity Well', type: 'spell', cost: 4, emoji: '🌀', sprite: 'card_c_gravity',
    text: 'Deal 2 damage to all enemy minions and Freeze them.',
    effects: [{ type: 'damage', amount: 2, to: 'allEnemyMinions' }, { type: 'freeze', to: 'allEnemyMinions' }] },
  { id: 'c_oblivion', cls: 'celestial', name: 'Oblivion', type: 'spell', cost: 8, emoji: '🕳️', sprite: 'card_c_oblivion',
    text: 'Destroy all minions.', effects: [{ type: 'destroy', to: 'allMinions' }] },
  { id: 'c_glaive', cls: 'celestial', name: 'Glaive of the Rift', type: 'weapon', cost: 3, attack: 3, durability: 2, emoji: '⚔️', sprite: 'card_c_glaive',
    text: 'After your hero first attacks with this, it gains +2 Attack.', afterFirstStrike: [{ type: 'buffWeapon', attack: 2 }] },
  { id: 'c_bow', cls: 'celestial', name: 'Lightshard Bow', type: 'weapon', cost: 4, attack: 2, durability: 4, emoji: '🏹', sprite: 'card_c_bow',
    keywords: { windfury: true } },
  // Legendary (one per deck). Celestial has no Champion's Trial, so it comes with the class.
  { id: 'c_aster', cls: 'celestial', legendary: true, name: 'Aster, the Rift Unbound', type: 'minion', cost: 9, attack: 8, health: 8, emoji: '👑', sprite: 'card_c_aster',
    text: 'Battlecry: Deal 1 damage to a random enemy 8 times.', battlecry: [{ type: 'damage', amount: 1, to: 'randomEnemy', times: 8 }] },
  { id: 'c_mote', cls: 'celestial', name: 'Stardust Mote', type: 'minion', cost: 1, attack: 2, health: 1, emoji: '✨', sprite: 'card_c_mote',
    text: 'Deathrattle: Deal 1 damage to a random enemy.', deathrattle: [{ type: 'damage', amount: 1, to: 'randomEnemy' }] },
  { id: 'c_pulsar', cls: 'celestial', name: 'Pulsar Warden', type: 'minion', cost: 2, attack: 2, health: 3, emoji: '💠', sprite: 'card_c_pulsar',
    keywords: { taunt: true } },
];

export const CARDS = Object.fromEntries(RAW_CARDS.map(c => [c.id, { cls: 'neutral', keywords: {}, ...c }]));

export const KEYWORD_LABELS = {
  taunt: 'Taunt', charge: 'Charge', rush: 'Rush', divineShield: 'Divine Shield', windfury: 'Windfury',
  stealth: 'Stealth', lifesteal: 'Lifesteal', poisonous: 'Poisonous',
};

export const KEYWORD_HELP = {
  taunt: 'Enemies must attack this minion.',
  charge: 'Can attack immediately.',
  rush: 'Can attack minions immediately.',
  divineShield: 'The first time this takes damage, ignore it.',
  windfury: 'Can attack twice each turn.',
  stealth: "Can't be targeted by enemies until it attacks.",
  lifesteal: 'Damage dealt also heals your hero.',
  poisonous: 'Destroy any minion damaged by this.',
  spellDamage: 'Your spells deal extra damage.',
  battlecry: 'Does something when played from hand.',
  deathrattle: 'Does something when it dies.',
  combo: 'Bonus if you already played a card this turn.',
  adjacent: 'The minions directly to the left and right.',
  freeze: "Frozen characters lose their next attack.",
  silence: 'Remove all card text and enchantments from a minion: keywords, triggers, auras and any buffs.',
};

/** Full card text including keyword line, for display. */
export function cardText(card) {
  const kw = Object.keys(card.keywords || {}).filter(k => card.keywords[k]).map(k => KEYWORD_LABELS[k]);
  if (card.spellDamage) kw.push(`Spell Damage +${card.spellDamage}`);
  return [kw.join('. '), card.text].filter(Boolean).join('. ').replace(/\.\./g, '.');
}

/** How many copies of a card a deck may hold: 1 for a legendary, 2 for anything else. */
export const maxCopies = cardId => (CARDS[cardId]?.legendary ? 1 : 2);

export function collectibleCards(cls) {
  return Object.values(CARDS).filter(c => !c.token && (c.cls === cls || c.cls === 'neutral'));
}

/** A sensible mana curve for 30 cards: how many to have at costs 0-1, 2, 3, 4, 5 and 6+. */
export const CURVE_TARGET = [4, 7, 7, 5, 4, 3];
/** Which CURVE_TARGET bracket a mana cost falls in. */
export const curveBracket = cost => (cost <= 1 ? 0 : Math.min(cost - 1, 5));

const DECK_SIZE = 30;
// A class card is this many times as likely to be picked as a neutral one, so
// decks feel like their class (about half the deck) without being all of it.
const CLASS_WEIGHT = 6;
// How likely a picked card goes in as a pair rather than a single copy.
const PAIR_CHANCE = 0.6;
// Pick weight for a card whose cost bracket is already full, so the curve
// guides the deck rather than fixing it.
const FULL_BRACKET = 0.15;

/**
 * Build a random 30-card deck from a class's cards and the neutrals (at most
 * 2 copies of each, 1 of a legendary). Cards are drawn one at a time, weighted towards cost
 * brackets the deck is still short of (CURVE_TARGET) and towards class cards;
 * each pick goes in as a single copy or a pair. `locked` card ids (unearned
 * quest rewards, see rewards.js) are left out.
 */
export function buildDeck(cls, rand = Math.random, locked = new Set()) {
  const pool = Object.values(CARDS).filter(c => !c.token && !locked.has(c.id) && (c.cls === cls || c.cls === 'neutral'));
  const copies = {};
  const have = CURVE_TARGET.map(() => 0);
  const ids = [];
  const add = c => { ids.push(c.id); copies[c.id] = (copies[c.id] ?? 0) + 1; have[curveBracket(c.cost)]++; };
  while (ids.length < DECK_SIZE) {
    const options = pool.filter(c => (copies[c.id] ?? 0) < maxCopies(c.id));
    if (!options.length) break;
    const weights = options.map(c => {
      const b = curveBracket(c.cost);
      return (c.cls === cls ? CLASS_WEIGHT : 1) * Math.max(CURVE_TARGET[b] - have[b], FULL_BRACKET);
    });
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < options.length - 1 && (r -= weights[i]) >= 0) i++;
    const card = options[i];
    add(card);
    const b = curveBracket(card.cost);
    if (ids.length < DECK_SIZE && copies[card.id] < maxCopies(card.id) && have[b] < CURVE_TARGET[b] && rand() < PAIR_CHANCE) add(card);
  }
  return ids;
}
