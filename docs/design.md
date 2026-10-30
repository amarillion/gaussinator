# Design Document — Gaussinator

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
| Scale row | `R_i ← k·R_i`, `k ≠ 0` | Adjust the left factor drawer; the selected row is scaled immediately |
| Combine | `R_j ← R_j + k·R_i`, `i ≠ j`, `k ≠ 0` | Lift row `i` with `→`; the right drawer opens and its factor updates the lifted copy live (always relative to the original row). Align with row `j` (`↑`/`↓`), press `Enter` |

Each drawer contains a numerator/denominator dial pair. Numerators scroll
through `-20…-1` and `1…20` (zero is excluded); denominators scroll through
`1…20`, shown as `1/1…1/20`. A centered needle marks the selected value, and
the scale snaps to the nearest entry when a drag or flick slows below the
tuned threshold. `PgUp`/`PgDn` move the active drawer's numerator,
`Shift+PgUp`/`Shift+PgDn` move its denominator, and `-` flips its numerator's
sign. Subtracting one row from another is the combine operation with negative
`k`.

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

Live scaling is coalesced for scoring: a run of dial changes on the same
selected row shares **one** move increment and **one** history snapshot. Undo
therefore reverts the whole run. Moving the cursor, starting a lift, swapping,
combining, or any other completed move ends the run, so later scaling of the
same row starts a new move.

Swap sequences are coalesced the same way. Consecutive swaps that move the same
row — including a continuous handle drag or repeated `Shift+↑`/`Shift+↓` — share
one move and one history snapshot. Moving a different row, scaling, lifting, or
another completed move starts a new swap run.

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
| `PgUp` / `PgDn` | Change the active drawer's numerator |
| `Shift+PgUp` / `Shift+PgDn` | Change the active drawer's denominator |
| `-` | Flip the active factor's sign |
| `→` | Lift a copy of the cursor row to the right side; the right drawer opens |
| `↑` `↓` while lifted | Align the lifted copy with a target row |
| `Enter` / `Space` while lifted | Add the lifted copy to the target row |
| `Esc` / `←` while lifted | Cancel the lift and return the copy |
| `Esc` / `C` | Cancel lift / reset the active factor to 1 |
| `U` | Undo |
| `H` | Hint |
| `R` | Restart level |
| `?` | Show tutorial |
| `Enter` / `Space` after win | Next level |

### 7.2 Touch

- Tap a row to select it.
- Drag the handle on the right of a row up/down to reorder it. Handles are
  hidden while a row is lifted.
- Swipe up/down to swap rows with a neighbor (the 2048 gesture).
- Swipe right to shift (lift) a row; swipe left on the original row to cancel
  the shift or on another row to apply it.
- The left drawer is open by default. Drag or flick its numerator
  (`-20…-1` or `1…20`) and denominator (`1…20`) dials; the selected row scales
  immediately. The scale moves under a fixed center needle, carries momentum
  after a flick, eases to the nearest value, and can be tapped to jump to a
  visible number.
- Lifting a row closes the left drawer and opens the right one. Its dials set
  the lifted copy's factor and update the preview immediately.
- While a row is lifted, tap the target row to apply the lifted copy, or
  swipe the lifted rail itself: up/down aligns it, left applies it to the
  aligned row (or returns it while aligned with its source), and right
  returns it. The rail is a child of `<rref-board>` and only becomes
  pointer-active while a lift exists, so both surfaces share one gesture
  handler instead of duplicating it at a higher DOM level.

### 7.3 State model behind the cursor

`Game` (in `src/game/state.ts`) keeps:

- `rows`: matrix indexed by a **stable row id**,
- `order`: display position → row id,
- `cursorPos`: selected display position,
- `kNumerator` / `kDenominator`: left-drawer factor for scaling the selected
  row; the numerator is non-zero and in `[-20, -1] ∪ [1, 20]`, the denominator
  in `[1, 20]`,
- `liftNumerator` / `liftDenominator`: right-drawer factor for the lifted row,
- `scaleStreakRowId`: the row id whose current run of live scaling shares one
  move/history snapshot (cleared when the run ends),
- `swapStreakRowId`: the row id whose current run of swaps shares one
  move/history snapshot (cleared when the run ends),
- `lift`: `{ sourceId, sourcePos, targetPos, factor } | null` — a row copy
  currently lifted to the right side of the board. Its `factor` is always kept
  in sync with the right drawer, so the lifted copy is always the original row
  × the right-drawer factor.

Stable row ids + `order` are what make row-swap animations possible: a tile is
keyed by row id, so swapping two entries in `order` moves both rows' tiles
smoothly while their contents stay attached.

A completed move pushes a history snapshot (`rows`, `order`, `moves`,
`cursorPos`) for undo. A live scale run pushes only its first snapshot, so one
undo restores the row to the state before the whole run.

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
    state.ts          Game class: moves, undo, drawer factors, win detection
    hint.ts           next-step hint engine
  ui/
    components/
      game-app.ts     <game-app> root controller component
      rref-board.ts   <rref-board> matrix board + lift rail custom element
      factor-dial.ts  <factor-dial> numerator + denominator dial pair
      number-dial.ts  <number-dial> kinetic scrolling scale
      dial-tuning.ts  size / momentum / snap constants
      game-hud.ts     <game-hud> mode label, badge, hint box
      game-stats.ts   <game-stats> header stat tiles
      win-overlay.ts  <win-overlay> level-complete modal
      tutorial-overlay.ts <tutorial-overlay> how-to-play modal
index.html            static UI shell (all element ids live here)
e2e/                  Playwright Chromium tests
playwright.config.ts  starts Vite on port 4173 for the e2e suite
```

### 8.1 Data flow

1. `<game-app>` creates a `Game(levelIndex, seed)`.
2. Keyboard handlers, toolbar buttons, and child-component custom events call
   `Game` methods and then `afterAction()`.
3. `afterAction()` pushes a fresh view model into the custom elements:
   `<rref-board>` (tiles, lift rail, row handles), both `<factor-dial>` drawers,
   `<game-hud>`, `<game-stats>`, and the overlays; it also opens the left
   drawer when no row is lifted, opens the right drawer while lifted, clears
   stale hints when moves changed, and shows the win overlay when `game.won`.
4. `<rref-board>` positions each tile from `order`, renders rational values,
   and applies CSS classes for cursor/source/target/hint/pop.

### 8.2 Rendering and animation

- Each tile is an absolutely positioned `.tile` wrapper containing a `.cell`.
  Row drag handles are positioned just outside the right edge of the board and
  follow their row id through swaps; they are hidden while a lift is active.
- `.tile` owns `transform: translate(x, y)` with a CSS transition — row swaps
  animate as slides.
- `.cell` owns colors, fraction content, and the `pop` keyframe animation.
  (The pop animation must live on `.cell`, never `.tile`, because animating
  `transform` on `.tile` would fight the position transform.)
- Colors are tiered by magnitude (0–11) with a separate red ramp for negative
  values; zero cells are neutral.
- Fractions render stacked (`num` over `den`) when both parts are ≤ 4 digits,
  otherwise inline `n/d`.

### 8.3 Dial physics

`<number-dial>` renders an absolutely positioned value track inside a clipped
viewport with a fixed center needle. Pointer drags move the track (with
rubber-band resistance at the ends), release velocity decays exponentially,
and once the speed falls below the snap threshold the track eases to the
nearest value. Tapping a visible value animates it to the needle; keyboard
arrows/PageUp/PageDown/Home/End move by whole steps.

All tunable values — item height, dial width, gap, friction, fling caps, snap
speed/duration, overscroll, tap slop, and velocity sampling — live in
`src/ui/components/dial-tuning.ts`, so feel can be adjusted without touching
the component logic.

### 8.4 Audio

All sounds are generated with WebAudio oscillators on first user gesture
(`src/audio.ts`); there are no audio assets. The toggle is persisted in
`localStorage` under `rref.sound`.

### 8.5 Persistence

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
- `Game`: factor selection/clamping, immediate row scaling, independent
  left/right drawer factors, scale-run and swap-run coalescing, sign toggling,
  lift/swap, invalid-op rejection, undo (including cursor restore), win
  detection and best-score callback.

Playwright runs Chromium e2e tests in `e2e/` against a Vite dev server. They
cover drawer switching, immediate left-drawer scaling, right-drawer lift
factors, exact `2/3` selection, scale-run and swap-run move grouping/undo,
row-handle dragging and hiding, toolbar simplification, negative numerators,
endpoint clamping, slow-drag snapping, flick momentum, and a narrow mobile
viewport (`npm run test:e2e`).

## 10. Known limitations / future ideas

- No redo stack (undo only).
- Best scores are per board size, not per scramble seed.
- The dials expose basic slider ARIA labels/values; broader focus management
  and screen-reader narration across the board are still future work.
- Possible additions: move-by-move lesson mode, REF-only practice mode,
  deterministic daily challenges (seeded by date), keyboard remapping,
  locale/localization support.
