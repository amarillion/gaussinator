# RREF — A 2048-style Row-Reduction Game

A mobile-friendly HTML5 + TypeScript game that teaches linear algebra: turn a
random matrix into **reduced row echelon form (RREF)** using elementary row
operations. It plays like a puzzle in the spirit of 2048 — animated tiles,
row-slide gestures, and keyboard-first controls — but every move is real
linear algebra with **exact rational arithmetic** (fractions, never rounded
decimals).

## Features

- Exact `BigInt` rational math — fractions like `-3/4` are shown and combined exactly
- Three legal row operations: **swap** rows, **scale** a row by a non-zero k, **add k×row** to another row (subtract = negative k)
- A left-side **multiplier rail** picks k: 1 in the center, integers 2…9 above, unit fractions 1/2…1/9 below; `PgUp`/`PgDn` move, `-` toggles negative
- Levels grow from **2×3** to **4×6**, then endless 4×6 boards with deeper scrambles
- Every level is generated backward from a random RREF, so it is **always solvable**
- Win detection via exact RREF check, plus an "Echelon form ✓" progress badge
- **Undo**, **hint** (exact next-step suggestion with highlighted rows), move counter + **par** score, stars, and per-size best scores
- 2048-style tile animations, value-tiered colors, negative-value palette
- WebAudio sound effects (no assets), first-run tutorial overlay
- Fully playable with **keyboard** or **touch** (tap to select, swipe a row to swap)

## Getting started

Prerequisites: Node.js 20+ (developed on Node 24) and npm.

```bash
npm install     # install dev dependencies
npm run dev     # start the dev server (URL is printed, usually http://localhost:5173)
```

Other scripts:

```bash
npm test        # run the Vitest suite once
npm run build   # type-check (tsc) + production build into dist/
npm run preview # serve the production build locally
```

> Note: on first install, npm may report that `esbuild` has a postinstall
> script awaiting approval. If `npm run dev`/`build` fails with a missing
> esbuild binary, run `npm approve-scripts esbuild` (or the suggested command)
> and retry. In most environments the bundled binary already works.

## How to play

The goal is to reach **RREF**: leading entries are `1`, they form a staircase
down and to the right, every pivot column is zero elsewhere, and zero rows sit
at the bottom.

### Keyboard

| Keys | Action |
| --- | --- |
| `↑` `↓` (or `K` `J`) | Select row |
| `Shift+↑` / `Shift+↓` | Move (swap) the selected row |
| `PgUp` / `PgDn` | Move the multiplier-rail selection |
| `-` | Toggle a negative factor |
| `M` | Start in-place scaling of the selected row; `Enter` applies, `Esc` cancels |
| `→` | Lift a copy of the selected row to the right side (the copy always shows the original row × the selected factor) |
| `↑` `↓` while lifted | Align the lifted copy with a target row |
| `Enter` / `Space` while lifted | Add the lifted copy to the aligned target row |
| `Esc` / `←` while lifted | Cancel the lift and return the copy |
| `Esc` / `C` | Cancel lift / scale mode / reset `k` to 1 |
| `U` / `H` / `R` | Undo / Hint / Restart |
| `?` | Reopen tutorial |
| `Enter` / `Space` | Next level after a win |

### Touch

- **Tap** a row to select it
- **Swipe** a row up/down to swap it with its neighbor
- **Drag** up/down on the left multiplier dial to scrub the factor (tap a tile to jump to it, `±` for negative); the toolbar `×k` button starts/applies in-place scaling
- While a row is lifted, tap the target row to apply the lifted copy

## Project structure

```
src/
  main.ts             bootstrap and wiring
  audio.ts            WebAudio sound effects
  styles.css          theme, board, tiles, overlays
  math/
    rational.ts       BigInt exact rational numbers
    matrix.ts         matrix operations, isREF/isRREF, RREF solver
    generator.ts      level sizing, PRNG, solvable level generation
  game/
    state.ts          game state: moves, undo, k rail, win detection
    hint.ts           exact next-step hint engine
  ui/
    input.ts          keyboard, buttons
    components/
      factor-dial.ts  <factor-dial> multiplier dial custom element
      rref-board.ts   <rref-board> matrix board + lift rail custom element
      game-hud.ts     <game-hud> mode label, badge, hint box
      game-stats.ts   <game-stats> header stat tiles
      win-overlay.ts  <win-overlay> level-complete modal
      tutorial-overlay.ts <tutorial-overlay> how-to-play modal
origData/
  icon.svg            source logo (3x3 matrix, lifted middle row)
  makefile            rasterizes the PWA icons into public/ (run `make`)
docs/design.md        full design document
```

See `docs/design.md` for the architecture, math model, level generation
invariants, and animation notes.

## Contributing

Contributions are welcome. Please keep the core invariants intact:

1. **Exact math only** — game logic must use `Rational` (BigInt), never `number`/floating point, for values and comparisons.
2. **Every level solvable** — generation must stay a product of invertible elementary row operations; `computeRREF(start)` must equal the generated RREF.
3. **Exact win check** — the win condition is the exact `isRREF` predicate, no tolerance.
4. **Animation split** — `.tile` owns positioning transforms, `.cell` owns colors/content/pop animation; don't animate `transform` on `.cell`-positioning or vice versa.
5. **History completeness** — undo snapshots must include `rows`, `order`, `moves`, and `cursorPos`.

Workflow:

1. Fork and create a branch.
2. Make changes; keep TypeScript strict-clean (`npm run build` runs `tsc`).
3. Add or update Vitest tests for any math/game-logic change. Use the deterministic `mulberry32` PRNG for reproducible level tests.
4. Run `npm test` and `npm run build` before opening a PR.
5. For UI changes, manually verify both keyboard play and a mobile-sized viewport.

Guidelines:

- No runtime dependencies unless there is a very strong reason.
- Keep element ids in `index.html`, `render.ts`, and `input.ts` in sync.
- Guard all `localStorage` access with `try/catch`.
- Keep new UI touch targets ≥ 44px and preserve `touch-action: none` on the board.
