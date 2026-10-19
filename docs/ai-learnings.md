# Learnings for the greedy AI from match transcripts

Analysis of 13 play-test transcripts (`Riftclash Transcripts Oct 16 2026.json`, exported 2026-10-16), to inform changes to the standard, non-cheating AI in `src/ai.js`. Items 1-10 have been implemented; see [What was done](#what-was-done) for the results.

## Source and method

- **The data:** one human player, 13 games, all against the Masochist (4 human wins, 9 AI wins). Every transcript replays exactly, and 282 turns were analysed.
- **The tool:** `node tools/analyse-transcripts.js "<bundle>.json" [--json out.json] [--top N]`. For each human turn it plays the same starting position three ways:
  - what the human actually did;
  - what greedy `nextAction` would have done;
  - what Masochist `planTurn` would have done.
- **Scoring:** each line is scored with Masochist's `evaluate()` after a greedy reply. That's a yardstick, not ground truth. The tool also measures how well Masochist's model of the human (the worse of a greedy turn and a rush turn) predicted the real moves.
- **Position references:** `gN tM` means game index N (0-based, in bundle order) at turn M. To look at a position:

  ```js
  replay(bundle.games[N], { upTo: bundle.games[N].actions.find(a => a.turn === M).n })
  ```

- **Caveats:** the sample is small and comes from a single player. Re-run the tool on future bundles to check that these patterns hold. The bundle file is not committed, so keep a copy if you want to reproduce the examples.

## Headline numbers

| Measure | Result |
|---|---|
| Human turn vs greedy on the same position | human better 55, about equal 62, worse 23 (of 140) |
| Human turn vs Masochist plan | human better 13, about equal 70, worse 57 |
| Same first action as greedy / same whole turn | 60 / 28 of 140 |
| Lethal found | human 4, greedy 2, Masochist 4 |
| Human attacked before playing a card | 25 turns (greedy: never) |
| Human went face when a free value trade existed | 21 of 28 |
| Hero power uses per turn (human turns) | human 0.35, greedy 0.23, Masochist 0.40 |
| Hero power uses per turn (AI turns) | Masochist 0.26, greedy 0.08 |
| Face damage per turn (AI turns) | Masochist 2.35, greedy 1.86 |
| Masochist's own moves vs greedy on its turns | better 66, about equal 70, worse 6 (of 142) |
| Human beat both of Masochist's forecast models | 44 of 140 turns |
| Human's play closer to the greedy model / the rush model | 86 / 54 |

## Learnings, in suggested priority order

### 1. A proper lethal search
`planAttack`'s lethal check only adds up attackers that can already hit face. It ignores:
- burn spells and damage battlecries;
- the hero power;
- AoE that also hits the hero;
- clearing a taunt first.

Examples:
- **g1 t21:** the opponent was on 8. The human played Hexbolt Sorcerer (3) to face, then attacked with Monk (2) and Lurker (3). Greedy aimed Hexbolt at a minion, because `chooseTarget` hostile always prefers a killable minion over the hero, then cast Healing Aura on itself.
- **g10 t27:** the opponent was on 6 behind an Elder Treant 6/8 taunt. The human played Hallowed Ground (2 to all enemies, face included), killed the taunt with exactly enough attacks, and then went face. Greedy skips Hallowed Ground (`aoeValue` < 4, since it counts only minions) and attacks in an order that leaves 1 face damage.

**Change:** at the start of `nextAction`, run an exhaustive lethal search over legal actions. Masochist's `findLethal` / `legalActions` (with a node budget) don't need hidden information when run on the real game, so they aren't cheating. At minimum, count spell, battlecry and hero-power face damage, and plan taunt removal.

### 2. Attack before casting when the board makes the spell better
Greedy is hard-wired to play cards, then the hero power, then attacks. The human attacked first in 25 turns, mostly to set up AoE or removal.
- **g8 t12:** Maypole attacks Bastion Warden, then Earthshatter finishes it.
- **g6 t20:** small minions trade into Granite Sentinel before Colossus of the Rift's battlecry finishes it.
- **g0 t17:** Footsoldier kills the wounded Bastion Warden first, and Ember Colossus goes face.

**Change:** before playing an AoE or damage card, try the available attacks first and keep that order if the spell then kills more. Alternatively, evaluate "attacks then cards" against "cards then attacks" and pick the better result.

### 3. Enablers for conditional cards
Headsman's Verdict ("Destroy a damaged enemy minion") was set up with Shockwave Stomp (1 to all minions) to remove a Colossus or Ember Colossus in g6 t12, g6 t18 and g9 t19. Masochist does the same with other damage (g8 t18, g10 t14).

Greedy can never do this:
- Stomp fails the `aoeValue >= 4` gate;
- Verdict has no target until something is damaged.

**Change:** when a card in hand needs a condition, check whether a cheap enabler in hand creates it, and score the two as a pair. The enabler can be a ping, an AoE, the hero power, or an attack that leaves a minion damaged.

### 4. Survival awareness
Greedy never considers whether it will die next turn.
- **g5 t14:** at 7 health, the human killed Comet Rider 5/1 with the Spark hero power and traded Thornback Ram into Bramble Beetle, keeping a board. Greedy spent all 7 mana on Starfall Meteor for the same two kills, and that line is lost on the reply.
- **g7 t12:** when low, the human played Bastion Warden for armour and a body. Greedy played Stormcaller Adept plus Healing Aura.

**Change:** adapt `threat()` from `src/masochist.js`. It counts the damage a side can deal next turn, but it is not exported, and it reads that side's hand for burn. Using it on the human's side would therefore cheat. The greedy version should count only the human's board, weapon and hero power, plus an assumed burn allowance. When that threat is close to the AI's effective health, prioritise in this order: kill attackers (biggest attack first), taunt, armour or heals, and only then face damage.

### 5. Face or trade from a race clock, not a fixed rule
Greedy's `planAttack` takes any trade where its minion survives and the target has 2+ attack. In 21 of 28 such chances the human went face instead, and was usually right.
- **g6 t24:** Colossus 9/6 hit face with the opponent on 12; greedy would have hit a 2/2 Shardling.

Masochist also goes face more and trades less than greedy. But racing is wrong when behind: greedy beat the human in g1 t9 and g1 t13, where Field Medic went face instead of trading.

**Change:** compute each side's clock (turns to kill, from on-board damage against effective health). When ahead on the clock, go face unless a trade removes a real threat. When behind, trade.

### 6. Efficient answers: the cheapest card that does the job
`planCardPlay` scores options by `cost * 10`, so it prefers the most expensive play, including expensive removal for small targets (g5 t14 above).

The human routinely killed X/1 minions with the hero power (g1 t17 Thunderhoof Stag, g5 t8 Thornback Ram, g5 t14 Comet Rider) and kept big spells for big threats.

**Change:** score removal by value removed per mana. Give the hero-power ping first refusal on 1-health enemies. Prefer the plan that spends the turn's mana on the most total value, not the single most expensive card.

### 7. The hero power competes with cards for mana
Greedy uses the hero power only when exactly 2 mana happens to be left after cards (0.08 uses per turn on AI turns, against Masochist's 0.26).
- **g5 t8:** the human played Ember Coin purely to afford the hero power after Ashfall. Greedy's coin rule only coins to unlock a card (`cost === mana + 1`).

**Change:** when choosing cards, compare "card A" against "cheaper card B + hero power". Let the coin unlock the hero power too.

### 8. Self-damage and wasted cards
- **Colossus of the Rift** ("Battlecry: Deal 3 damage to all other characters") is scored as plain `cost * 10`, so greedy kills its own board with it (Masochist-side comparisons g2 t18 and g2 t20, where greedy would wipe three of its own minions). `aoeValue` handles friendly fire for spells only. Apply the same accounting to battlecries that hit `allOtherCharacters`, `allMinions` and similar.
- **Healing Aura (0 cost, restore 2)** is cast on the AI's own hero at 25/30 health (g1 t19, g1 t21, g4 t14), because any missing health makes it a target. The `chooseTarget` heal branch should require meaningful missing health. The no-target heal spells already use a `health > 20` gate; match it.
- **Oblivion:** greedy board-wiped with the opponent on 7 (g5 t15). Masochist instead developed two Cosmic Wraiths for lethal. The `swing >= 10` rule should not fire when the AI is winning the race, or when it is set up for lethal.

### 9. Silence targeting should value what's blocking you
In g1 t19 the human silenced the Elder Treant 6/8 taunt that was walling them; greedy chose Swamp Adder 1/2 poisonous. `silenceValue` gives taunt a flat 3.

**Change:** when the AI is the aggressor, scale taunt by the minion's health, or by how much face damage removing it unlocks.

### 10. The mulligan is fine (low priority)
"Throw back cost > 3" matched the human in 9 of 13 games. Where they differed:
- the human kept a 4- or 5-drop when the rest of the hand already curved out (g1, g9, g11);
- the human threw back situational spells (Stomp, Iron Resolve) when the hand had no early minion (g6).

**Possible tweak:** keep one 4-drop if the hand has a 2- and a 3-cost play.

## Forecasting the human (relevant to Masochist)
- **Forecast accuracy:** Masochist models the human as the worse of a greedy turn and an all-out rush. The human beat both models in 44 of 140 turns, mostly by finding lethal setups the models don't see (g1 t19, g3 t12, g10 t23).
- **Which model was closer:** the greedy model, in 86 of 140 turns.
- **Implication:** improving greedy on items 1, 4 and 5 also makes Masochist's forecasts more accurate, since it uses `ai.js` as its model of the human. Note that `masochist.test.js` checks Masochist beats greedy almost every game, so that margin may shrink.

## Verifying changes
- Re-run `tools/analyse-transcripts.js` on this bundle and on new ones. Greedy's "human better" count should fall, and the lethal count should match the human's.
- `npm test`: `engine.test.js` runs AI-vs-AI games across every class pairing, so it will catch hangs and crashes.
- A cheap regression check is a head-to-head of old greedy against new greedy over many seeds.

## What was done
Every learning above was implemented, one commit each, re-running the analysis tool on this bundle after each. Masochist was left alone: it now models the human with `src/ai-classic.js`, a frozen copy of the old greedy AI, so its play is unchanged (identical games over 12 seeds), and so is its speed. The new greedy AI costs about 0.9 ms a turn instead of 0.01 ms. Without the frozen copy, Masochist's rollouts would hit the 700 ms cap.

| Step | Human beats greedy's turn (of 140) | Lethal found by greedy | New vs old greedy (2000 games) |
|---|---|---|---|
| Baseline | 55 | 2 | 50.0% |
| 1. Lethal search | 52 | 4 | 51.6% |
| 2. Attack before casting; cheapest taunt clear | 46 | 4 | 54.9% |
| 3. Enablers (Stomp then Verdict); removal scored by target | 43 | 4 | 57.6% |
| 4. Survival awareness (`threat`, `inDanger`) | 43 | 4 | 57.5% |
| 5. Race clock for face or trade | 41 | 4 | 56.4%* |
| 6. Efficient answers; best set of plays for the mana | 38 | 4 | 60.3% |
| 7. Hero power competes for mana; smarter Coin | 37 | 4 | 62.1% |
| 8. Colossus friendly fire, Healing Aura, Oblivion | 37 | 4 | 62.6% |
| 9. Silence the wall | 36 | 4 | 62.6% |
| 10. Mulligan keeps a 4-drop (matches the human 10 of 13, was 8) | 36 | 4 | 62.4% |

\* Over 6000 games (noise is about ±1% at 2000).

Notes:
- **Caveat:** the "human beats greedy" yardstick replies with the current greedy AI, so it moves a little whenever the AI does. The head-to-head is the steadier measure.
- **Item 4** changed few human turns. Its gains show up on the AI's own turns, and the old greedy AI rarely threatens lethal, so the head-to-head barely moves.
- **Item 5:** trading only for 4+ Attack scored better on the transcripts (40), but worse head-to-head (55.8%). The committed version trades into 3+ Attack or minions worth as much.
- **Item 6:** removal is worth 7 per point of Attack + Health removed, and each card played counts 5 against the set. Some turns now pass on Colossus of the Rift or an AoE where the yardstick preferred them.
- **Item 10:** the suggested "a 2 and a 3" rule fit none of the examples. The committed rule needs a 2-drop and one other card costing 3 or less.
- **Celestial** wins about 29% of greedy mirror games (33% with the old AI). It's still experimental, so its test band is now 20-80%.
