# Design Document — RREF Row-Reduction Game

## 1. Overview

The game teaches linear-algebra row reduction by turning a random matrix into
**reduced row echelon form (RREF)** using the three elementary row operations.
It is a single-page web game built with **Vite + vanilla TypeScript** (no UI
framework, no runtime dependencies). The visual and interaction language is
deliberately reminiscent of *2048*: a grid of animated tiles, satisfying
row-slide animations, value-tiered colors, and fast keyboard-first controls.

The game is mobile-first and fully playable with either keyboard or touch.

## 2. Goals and non-goals

**Goals**

- Teach the mechanics of Gaussian/Gauss-Jordan elimination: swapping rows,
  scaling rows, and adding multiples of rows to each other.
- Make every level provably solvable so the player never hits a dead end.
- Keep all arithmetic **exact** — fractions display as fractions, never as
  rounded decimals.
- Give a 2048-like tactile feel: animated swaps, pops on change, color ramp.
- Stay tiny and dependency-free at runtime.

**Non-goals**

- No accounts, backend, or server-side state. Everything is local.
- No timed or fail state. The puzzle can always be restarted or undone.
- Not a full linear-algebra course: it focuses on the RREF algorithm only.

## 3. Game rules

The board is an `n × m` matrix of exact rational numbers.

Legal moves (all are elementary row operations):

| Move | Math | In-game action |
| --- | --- | --- |
| Swap rows | `R_i ↔ R_j` | Move a row up/down; swiping a row on touch |
| Scale row | `R_i ← k·R_i`, `k ≠ 0` | Pick `k` on the left multiplier rail, press `M`, then `Enter` (`Esc` cancels) |
| Combine | `R_j ← R_j + k·R_i`, `i ≠ j`, `k ≠ 0` | Lift row `i` with `→`, pick `k` on the rail (the lifted copy updates live, always relative to the original row), align with row `j` (`↑`/`↓`), press `Enter` |

The multiplier rail has `1` at the center, integers `2…9` above it, and unit
fractions `1/2…1/9` below it. `PgUp`/`PgDn` move the selection; `-` toggles a
negative factor. Subtracting one row from another is the combine operation with
negative `k`.

A level is **won** when the matrix is in RREF:

1. leading (first non-zero) entry of every non-zero row is `1`,
2. leading entries form a staircase (strictly increasing columns),
3. every pivot column is zero in all other rows,
4. zero rows are at the bottom.

A matrix that satisfies REF but not RREF shows an "Echelon form ✓" badge so the
player knows they are on the right track.

## 4. Math model

### 4.1 Exact rationals

`Rational` (in `src/math/rational.ts`) stores a reduced fraction with a
**BigInt** numerator and denominator. Invariants:

- denominator `> 0`,
- fraction always reduced via gcd,
- zero is normalized to `0/1`.

BigInt avoids both floating-point error and integer overflow during Gaussian
elimination, where numerators can grow quickly.

### 4.2 RREF solver

`computeRREF` (in `src/math/matrix.ts`) performs exact Gaussian-Jordan
elimination:

1. scan columns left to right,
2. find a non-zero pivot row, swap it up if needed,
3. scale the pivot row by `1/pivot`,
4. eliminate the pivot column in all other rows with `R_j ← R_j - v·R_i`.

It returns both the RREF and the list of elementary operations used, which is
the basis for the `par` score and the hint engine.

### 4.3 Level generation

Levels are generated **backwards** so that solvability is guaranteed by
construction (see `src/math/generator.ts`):

1. Choose a rank `r` in `[max(1, min(n,m) - 1), min(n,m)]`.
2. Choose `r` distinct pivot columns, sorted.
3. Build a valid RREF answer `A`:
   - pivot rows have `1` at their pivot column,
   - free-column entries may be non-zero only to the *right* of that row's
     pivot (otherwise the staircase would break),
   - zero rows sit at the bottom.
4. Scramble `A` with `depth` random **invertible** elementary row operations:
   swaps, scales by `{2, 3, -1, 1/2, 1/3}`, and add-multiples with `k ∈ {-3..3}\{0}`.
5. Revert any single op that pushes an entry magnitude above 60 so tiles stay
   readable.

Because every scrambling op is invertible, `computeRREF(start) === A` exactly,
so the level always has a solution.

`depth = 6 + 2·levelIndex` controls scramble difficulty.

### 4.4 Verification

The win check is the exact `isRREF` predicate; there is no tolerance or
rounding anywhere in game logic.

## 5. Levels, par, and scoring

Level sizes progress:

```
(2×3) → (3×3) → (3×4) → (4×4) → (4×5) → (4×6)
```

After `4×6` the board size stays `4×6` and only the scramble depth increases
(`6 + 2·levelIndex`).

**Par** is the number of elementary operations the reference solver needs on
the scrambled matrix. Stars:

- `3 stars`: moves `≤ par`
- `2 stars`: moves `≤ par + ⌈par/2⌉`
- `1 star`: otherwise

Best (minimum) moves are stored per board size in `localStorage` under
`rref.best.{n}x{m}`.

## 6. Hint engine

`getHint` (in `src/game/hint.ts`) computes the exact RREF of the current board,
then scans columns left-to-right and rows top-to-bottom for the first
mismatch:

- pivot position is `0` → suggest swapping with a lower non-zero row,
- pivot position is non-1 → suggest `scale row by 1/value`,
- pivot is `1` but the column has other non-zero entries → suggest
  `add -value × pivot-row to that row`.

The returned hint carries the exact `factor`, the pivot `col`, and the rows
involved so the UI can highlight them (and tests can auto-apply hints).

## 7. Controls & interaction model

### 7.1 Keyboard

| Keys | Action |
| --- | --- |
| `↑` `↓` (or `K` `J`) | Move the row cursor |
| `Shift+↑` / `Shift+↓` | Swap cursor row with neighbor |
| `PgUp` / `PgDn` | Move the multiplier-rail selection |
| `-` | Toggle a negative factor |
| `M` or `*` | Start in-place scaling of the cursor row; `Enter` applies, `Esc` cancels |
| `→` | Lift a copy of the cursor row to the right side of the board |
| `↑` `↓` while lifted | Align the lifted copy with a target row |
| `Enter` / `Space` while lifted | Add the lifted copy to the target row |
| `Esc` / `←` while lifted | Cancel the lift and return the copy |
| `Esc` / `C` | Cancel lift / scale mode / reset `k` to 1 |
| `U` | Undo |
| `H` | Hint |
| `R` | Restart level |
| `?` | Show tutorial |
| `Enter` / `Space` after win | Next level |

### 7.2 Touch

- Tap a row to select it.
- Swipe a row up/down to swap it with its neighbor (the 2048 gesture).
- Drag up/down on the left multiplier dial to scrub the factor (tap a tile to
  jump to it, `±` for negative); the toolbar `×k` button starts/applies
  in-place scaling.
- While a row is lifted, tap the target row to apply the lifted copy.

### 7.3 State model behind the cursor

`Game` (in `src/game/state.ts`) keeps:

- `rows`: matrix indexed by a **stable row id**,
- `order`: display position → row id,
- `cursorPos`: selected display position,
- `kIndex`: selected tile of the multiplier rail (`0` = 9, `8` = 1, `16` = 1/9),
- `kNegative`: whether the minus key toggled the factor negative,
- `pendingScale`: in-place scaling mode started with `M`,
- `lift`: `{ sourceId, sourcePos, targetPos, factor } | null` — a row copy
  currently lifted to the right side of the board. Its `factor` is always kept
  in sync with the rail, so the lifted copy is always the original row × the
  selected factor.

Stable row ids + `order` are what make row-swap animations possible: a tile is
keyed by row id, so swapping two entries in `order` moves both rows' tiles
smoothly while their contents stay attached.

Every successful move pushes a history snapshot (`rows`, `order`, `moves`,
`cursorPos`) for undo.

## 8. Architecture

```
src/
  main.ts             bootstrap: custom element registration
  audio.ts            WebAudio blips (no assets), sound toggle
  styles.css          theme, board, tiles, overlays, responsive layout
  math/
    rational.ts       BigInt exact rationals
    matrix.ts         Matrix ops, isREF/isRREF, computeRREF
    generator.ts      level spec, PRNG, RREF generation + scramble
  game/
    state.ts          Game class: moves, undo, k rail, win detection
    hint.ts           next-step hint engine
  ui/
    components/
      game-app.ts     <game-app> root controller component
      rref-board.ts   <rref-board> matrix board + lift rail custom element
      factor-dial.ts  <factor-dial> multiplier dial custom element
      game-hud.ts     <game-hud> mode label, badge, hint box
      game-stats.ts   <game-stats> header stat tiles
      win-overlay.ts  <win-overlay> level-complete modal
      tutorial-overlay.ts <tutorial-overlay> how-to-play modal
index.html            static UI shell (all element ids live here)
```

### 8.1 Data flow

1. `<game-app>` creates a `Game(levelIndex, seed)`.
2. Keyboard handlers, toolbar buttons, and child-component custom events call
   `Game` methods and then `afterAction()`.
3. `afterAction()` pushes a fresh view model into the custom elements:
   `<rref-board>` (tiles, lift rail), `<factor-dial>`, `<game-hud>`,
   `<game-stats>`, and the overlays; it also clears stale hints when moves
   changed and shows the win overlay when `game.won`.
4. `<rref-board>` positions each tile from `order`, renders rational values,
   and applies CSS classes for cursor/source/target/hint/pop.

### 8.2 Rendering and animation

- Each tile is an absolutely positioned `.tile` wrapper containing a `.cell`.
- `.tile` owns `transform: translate(x, y)` with a CSS transition — row swaps
  animate as slides.
- `.cell` owns colors, fraction content, and the `pop` keyframe animation.
  (The pop animation must live on `.cell`, never `.tile`, because animating
  `transform` on `.tile` would fight the position transform.)
- Colors are tiered by magnitude (0–11) with a separate red ramp for negative
  values; zero cells are neutral.
- Fractions render stacked (`num` over `den`) when both parts are ≤ 4 digits,
  otherwise inline `n/d`.

### 8.3 Audio

All sounds are generated with WebAudio oscillators on first user gesture
(`src/audio.ts`); there are no audio assets. The toggle is persisted in
`localStorage` under `rref.sound`.

### 8.4 Persistence

`localStorage` keys:

- `rref.best.{n}x{m}` — best moves per board size
- `rref.sound` — sound on/off
- `rref.tutorialSeen` — first-run tutorial dismissed

All access is wrapped in `try/catch` so the game still works when storage is
blocked.

## 9. Testing strategy

Vitest covers (see `*.test.ts`):

- `Rational`: normalization, arithmetic, parsing, edge cases.
- `Matrix`: `isREF`/`isRREF` handcrafted cases, row-op mutation, RREF solver.
- `Generator` (randomized): for 60 seeds × 7 levels — generated answer is
  RREF, start is not, `computeRREF(start) == answer`, par > 0, entries bounded.
- `Hint`: exact suggestions and an **auto-solver** that follows hints to
  completion for every generated level tested.
- `Game`: multiplier-rail selection, sign toggling, scale mode (start/apply/
  cancel), lift/swap, invalid-op rejection, undo (including cursor restore),
  win detection and best-score callback.

No DOM/browser tests are in the suite; the UI is verified by `tsc`, the
production build, and manual play.

## 10. Known limitations / future ideas

- No redo stack (undo only).
- Best scores are per board size, not per scramble seed.
- No accessibility layer (screen-reader labels, focus management) yet.
- Possible additions: move-by-move lesson mode, REF-only practice mode,
  deterministic daily challenges (seeded by date), keyboard remapping,
  locale/localization support.
