# AGENTS.md — Coding Agent Instructions

This file is the operating manual for coding agents working in this repository.
Read it before making changes.

## Project summary

Single-page **Vite + vanilla TypeScript** game (no framework, no runtime
dependencies) that teaches row reduction to **reduced row echelon form
(RREF)**. All game math uses **exact BigInt rationals** — never floating point.
See `README.md` for the player-facing overview and `docs/design.md` for the
full design.

## Commands

```bash
npm install        # install dev dependencies
npm run dev        # start Vite dev server
npm test           # run Vitest once
npm run build      # tsc type-check + production build (run before finishing)
npm run preview    # serve dist/ locally
```

If `npm run dev`/`build` fails with a missing esbuild binary after install,
run `npm approve-scripts esbuild` and retry.

Always run **`npm test` and `npm run build`** after any change and make sure
both pass before reporting completion.

## Architecture map

```
src/main.ts             bootstrap, wiring, localStorage, resize handling
src/audio.ts            WebAudio sfx (lazy AudioContext, no assets)
src/styles.css          all styling; element ids are referenced from TS
src/math/rational.ts    Rational: BigInt num/den, reduced, den > 0, 0/1 for zero
src/math/matrix.ts      Matrix = Rational[][]; swapRows/scaleRow/addMultiple;
                        isREF/isRREF; computeRREF (returns matrix + ops)
src/math/generator.ts   levelSpec (sizes+depth), mulberry32 PRNG, generateLevel
src/game/state.ts       Game class: rows, order, cursorPos, kString, combine,
                        history/undo, moves, par, best, win detection
src/game/hint.ts        getHint: exact next-step suggestion {kind, rows, col, factor}
src/ui/render.ts        Renderer: tiles keyed by rowId, position from order,
                        fraction HTML, stats, badges, win overlay
src/ui/input.ts         keyboard, toolbar buttons, board pointer/swipe
src/ui/tutorial.ts      first-run overlay show/hide
index.html              static shell — every id used by render/input lives here
```

## Hard invariants (do not break)

1. **Exact math only.** Game logic must use `Rational`/BigInt for all values
   and comparisons. No `number` arithmetic, no `===`/`==` float comparisons,
   no tolerance-based checks anywhere in math/game logic. (`Rational.toNumber`
   exists only for tile color tiering.)
2. **Solvable levels.** `generateLevel` must produce matrices whose
   `computeRREF(start).matrix` equals the generated RREF answer. It does this
   by applying invertible elementary row ops to a valid RREF. If you change
   generation, keep this property and keep entries bounded (magnitude ≤ 60).
3. **Exact win check.** Winning is `isRREF(displayMatrix())` exactly. Do not
   add approximations or heuristic completion.
4. **Row-id + order model.** Rows are stored by stable id; `order` maps
   display position → id. Row swaps exchange `order` entries. Tiles are keyed
   by row id so swaps animate. Do not key tiles by display position.
5. **Undo completeness.** History snapshots must include `rows`, `order`,
   `moves`, **and** `cursorPos`. Any new mutable state that a move changes
   must be snapshotted too (or reset consistently in `undo`/`restart`).
6. **Legal ops only.** Scaling requires non-zero k; add-multiple requires
   distinct rows and non-zero k. Keep these guards in both `Game` and the
   `Matrix` helpers.
7. **Animation split.** `.tile` owns `transform: translate(...)` and the
   position transition. `.cell` owns colors/content and the `pop` keyframe.
   Never put a transform animation on `.tile` for content effects, and never
   position `.cell` with transforms.
8. **Element id contract.** `index.html` ids are referenced by `render.ts`,
   `input.ts`, and `main.ts`. If you rename/remove an id, update all
   references. Unknown ids are tolerated (optional chaining) but render
   failures are not.

## Conventions

- TypeScript strict mode is on (`tsconfig.json`); keep it clean.
- ES modules only (`"type": "module"`); use `.ts` extension imports.
- No new runtime dependencies unless absolutely necessary and justified.
- UI text is English; keep the tutorial/help copy in sync with actual keys.
- Guard all `localStorage` access with `try/catch` (storage can be blocked).
- Audio must be lazy (create `AudioContext` on first gesture) and fail
  silently.
- Touch targets ≥ 44px; keep `touch-action: none` on `#board`.
- Keyboard handlers must `preventDefault()` on `Arrow*`, `Space`, `Backspace`,
  and `/` to stop page scroll/navigation.
- Randomness in generation uses the seeded `mulberry32` PRNG so tests are
  reproducible. Do not call `Math.random()` inside `generateLevel`/`applyRandomOp`.

## Testing

- Tests are colocated as `src/**/*.test.ts` and run with Vitest.
- Add tests for: any new math function, any change to generation, any change
  to `Game` move/undo/win behavior, and hint correctness.
- For randomized tests use fixed seed loops (see `generator.test.ts`).
- Property to preserve when changing ops: every allowed op preserves RREF,
  i.e. `computeRREF(op(matrix)).matrix === computeRREF(matrix).matrix`.
- `hint.test.ts` includes an auto-solver; if you change the hint engine, add
  or extend a convergence test over generated levels.

## Adding a feature (typical path)

For a new row operation or UI action:

1. Math/state first: add the operation to `matrix.ts` (with validation) and a
   `Game` method that snapshots history, mutates, calls `finishMove()`, and
   returns success/failure.
2. Wire input: keyboard key + toolbar button + (if relevant) board touch in
   `input.ts`, using `sfx` and `ctx.afterAction()`.
3. Update `index.html`/`styles.css` if new elements are needed, keeping ids
   consistent.
4. Update tutorial copy and `README.md`/`docs/design.md` if player-visible.
5. Add unit tests; run `npm test` and `npm run build`.

## Common pitfalls

- **Transform conflict**: pop/scale animations on the same element that uses
  `transform` for position will jump. Use `.tile` for position, `.cell` for
  effects.
- **Swipe vs scroll**: the board needs `touch-action: none`; don't remove it
  or vertical swipes will scroll the page instead of swapping rows.
- **BigInt conversion**: `BigInt()` on a non-integer `number` throws. Construct
  `Rational`s from BigInts, integers, or strings (`Rational.parse`).
- **Zero normalization**: rely on the `Rational` constructor/`parse` to keep
  `0/1`, sign, and reduction invariants; don't build raw fractions manually.
- **History size**: snapshots clone the whole matrix; fine at these sizes, but
  don't store references to mutable rows in history.
- **Win overlay focus**: after a win the keyboard handler only responds to
  `Enter`/`Space` (next level). Don't add post-win key handling without
  updating that branch.

## Definition of done

- `npm test` passes (all suites).
- `npm run build` passes (`tsc` + `vite build`).
- Manual check: keyboard playthrough of level 1 works; board responds to
  tap/select and row swipe; undo/hint/restart behave; win overlay advances to
  the next level.
- Docs updated if the change is player-visible or architectural.
