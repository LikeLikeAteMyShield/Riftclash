# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Riftclash is a browser card battle game (Hearthstone-like, original card set) written in vanilla JS ES modules. There are no dependencies and no build step. The README is the player-facing and feature reference; this file covers how the code fits together.

## Commands

```bash
npm start                                     # static server at http://localhost:8080 (PORT=xxxx to change)
npm test                                      # node --test test/*.test.js
node --test test/engine.test.js               # one test file
node --test --test-name-pattern="silence" test/   # tests whose name matches
```

- ES modules don't load over `file://`, so the page always needs a server. The game is also deployed as a static site (GitHub Pages).
- `/sprites.html` shows every registered sprite. It reports bad sprite data (short rows, unknown colours) with the exact row and column.
- There is no linter or formatter config. Match the surrounding style: 2-space indent, single quotes, semicolons, dense one-line helpers.

## Architecture

### Rules engine is separate from the UI
- `src/engine.js` (`Game`) holds all game rules and has no DOM. It is deterministic for a given `seed` (mulberry32), which is why tests can run full AI games.
- The human is always player 0 and the AI is player 1. The UI never changes game state directly; it calls `playCard` / `attack` / `useHeroPower` / `endTurn` / `mulligan`.

### Cards are data
- `src/cards.js` holds `CLASSES` and `CARDS`. Effects are small objects (`{ type: 'damage', amount, to: 'target' }`) that the engine interprets in `#runEffects` / `#resolveEffect`.
- Hooks: `effects`, `battlecry`, `deathrattle`, `combo`, `endOfTurn`, `onDamaged`, `onFriendlySpell`, `adjacentAura`.
- Target selectors are listed at the top of `cards.js`.
- A new mechanic usually means a new effect `type` in the engine, plus AI handling in `src/ai.js`, plus a UI event handler.
- Whenever the engine needs a minion's behaviour, look it up through `game.minionText(m)`, never `CARDS[m.cardId]`. A silenced minion returns text-less data, so this is what keeps Silence working.

### Engine events drive the animations
- The engine pushes events (`play`, `damage`, `summon`, `death`, `silence`, ...) carrying presentation metadata (`fx`/`fxSeq` grouping, `from`, `spell`, `combat`, `cardId`).
- `flushEvents()` in `src/ui.js` replays them as animations, sounds and effects, then re-renders.
- New engine events need a matching case in the UI's effect handlers, or they won't be shown.

### AI
- `src/ai.js` is a greedy AI. `nextAction` returns one action at a time so the UI can animate the AI's turn.
- `playTurn` runs a whole turn, and is used in tests.
- `engine.test.js` runs 108 AI-vs-AI games across every class pairing, so engine or AI changes that hang or crash games fail the tests.

### `src/ui.js` is the app shell
- It renders the board, handles input (drag and click placement), and directs the animations.
- `showScreen(id)` switches between `menu`, `library`, `decks`, `quests`, `mulligan` and `table`.
- When the screen changes, the same function also:
  - selects the music track (`playTrack`)
  - shows or hides that screen's animated backdrop
  - toggles body classes the CSS relies on (`on-menu`, `in-archive`, `in-forge`, `on-board`, `has-backdrop`, `in-game`, `busy`)
- Other screens are mounted lazily from their own modules:
  - `library.js`: the card library
  - `deckbuilder.js` with `decks.js`: the deck builder
  - `questscreen.js` with `progress.js`: the quest board
- `cardview.js` renders card faces for every screen.

### Node-testable vs browser-only modules
- **Browser-only:** `music.js`, `sfx.js`, `fx.js` and `ui.js` touch `document`, `matchMedia` or Web Audio when imported, so tests can't import them.
- **Pure, so tests can import them:** game logic, data, and anything the tests check (cards, engine, ai, decks, progress, songs, pixelart, scenes).
- **Rule:** keep anything you want to test in a pure module. For example, `menuplan.js` holds the main-menu choreography and was split out of `menuscene.js`, which does the drawing, for exactly this reason.

### Pixel art
- `src/pixelart.js` defines sprites as text grids plus palettes, rendered to SVG with optional auto-outline and layers.
- Sprite modules live in `src/sprites/`, use the shared class palettes in `palettes.js`, and are registered in `src/sprites/index.js`.
- Cards and hero powers point at their art with `sprite: 'id'`; classes use `portrait`. A card's `emoji` is the fallback.
- `test/pixelart.test.js` requires every card (including tokens) and every hero power to have a registered sprite, so a new card needs art.

### Screen backdrops
- **Battle boards:** `backgrounds.js` (layered scene data) shown by `backdrop.js`.
- **Library, deck builder and quests:** `archive.js`, `forge.js` and `questboard.js` paint into RGBA buffers using helpers from `pixelbuf.js`. Each exports `create<Scene>(width)` returning `{ width, height, render(t) }`. `render(t)` is a pure function of time.
- They are shown by `sceneview.js` → `mountScene(canvas, { width, create, fps, stillAt, time })`. This sizes the canvas to the viewport's aspect, runs only while that screen is shown and the tab is visible, and draws a still frame under `prefers-reduced-motion`.
- **Tests enforce readability limits** on each scene: mean and 95th-percentile brightness, how many pixels may change sharply between frames, and determinism. A brighter or busier scene needs its colours toned down, not the thresholds raised.
- **Main menu:** `menuscene.js` is the exception. It's a canvas-2D battle scene; its choreography is in `menuplan.js`.

### Music
- `src/songs.js` holds songs in a tracker notation: one 16-step string per bar.
  - Notes: `D5` starts a note, `-` holds it, `.` rests.
  - Drums: `k`/`s`/`h` are kick, snare and hi-hat; `a`/`t`/`b` are anvil, hammer tap and bellows.
  - `compileSong` validates a song and turns it into timed events. `test/songs.test.js` asserts each screen has a track and checks each track's relative tempo, volume and density.
- `src/music.js` synthesises the songs live (NES-style pulse, triangle and noise voices) with crossfades between tracks.
- `beatClock()` exposes the playing track's position in beats, so visuals can keep time:
  - The menu scene locks onto it.
  - The forge scene maps it to scene time with `MUSIC_OFFSET`. One forge bar (80 BPM) is one `HAMMER_PERIOD`, and a test enforces this.

### Persistence
- Everything is saved in `localStorage` under `riftclash-*` keys (decks, deck choice, progress, quests-seen, library tab, music, muted).
- Every read and write is wrapped in try/catch, and loaded data goes through a `sanitize*` function (unknown cards, classes or quests are dropped; bad numbers become 0). Keep that pattern for new saved data.
- Quests are entries in `QUESTS` in `src/progress.js`: `{ id, title, text, goal, progress(stats) }`. Completion is stored with a timestamp and is permanent.
