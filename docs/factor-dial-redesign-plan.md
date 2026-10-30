# Factor dial redesign plan

## Goal

Replace the single factor rail with a pair of side-by-side, kinetically
scrollable number dials:

- **Left dial — numerator:** integers `-20 … 20`.
- **Right dial — denominator:** `1 … 20`, shown as unit fractions
  `1/1 … 1/20`.
- The combined factor is `numerator / denominator`, so fractions such as
  `2/3` become directly selectable.
- No separate negative button: negative factors come from the numerator dial.
- The **scale scrolls** under a fixed center needle instead of moving a cursor.
  A flick imparts momentum; below a velocity threshold the dial eases to the
  nearest value.
- All feel-related constants (item size, friction, snap threshold, durations,
  widths, etc.) live in one tuning module so the interaction can be tweaked in
  one place.
- The dial uses an inset shadow and center needle so it looks embedded in the
  UI.
- Playwright + Chromium e2e tests cover the new component.

## Implementation steps

- [x] **1. Plan** — add this document.
- [x] **2. Game state** — replace `kIndex` / `kNegative` / `K_TILES` with
  `kNumerator` / `kDenominator`, keep clamping and lift syncing exact, and
  update/extend Vitest coverage. (Temporary compatibility aliases keep the old
  rail compiling until step 3.)
- [x] **3. Number dial component** — build the reusable scrolling scale with
  drag, momentum, rubber-band edges, snapping, keyboard support, and the
  centralized tuning constants.
- [x] **4. Factor dial pair + styling** — compose two number dials side by side,
  report a combined `factor-change`, add needle/inset-shadow styling, and
  adjust the board width budget for the wider control.
- [x] **5. App wiring, keyboard, and copy** — wire the new event/model into
  `GameApp`, update keyboard controls (`PgUp`/`PgDn` numerator,
  `Shift`+`PgUp`/`PgDn` denominator, `-` sign), hint text, help line, and
  tutorial.
- [x] **6. Playwright** — add `@playwright/test`, Chromium config, and e2e tests
  for rendering, fraction selection, negative numerators, snapping, momentum,
  and a real scale operation.
- [x] **7. Validation + docs** — update README/design docs, run
  `npm test`, `npm run build`, and `npm run test:e2e`.

## Tuning parameters (single source of truth)

Defined in `src/ui/components/dial-tuning.ts`:

| Constant | Purpose | Initial value |
| --- | --- | --- |
| `itemHeight` | Vertical distance between values / scale step | `46px` |
| `dialWidth` | Width of each dial | `56px` |
| `pairGap` | Gap between numerator and denominator dials | `6px` |
| `frictionPerMs` | Momentum decay per millisecond | `0.996` |
| `maxFlingVelocity` | Caps a very fast flick | `3.5 px/ms` |
| `minFlingVelocity` | Releases below this go straight to snapping | `0.08 px/ms` |
| `snapVelocity` | Inertia ends and snapping starts below this | `0.12 px/ms` |
| `snapDuration` | Base easing time to the nearest value | `170ms` |
| `overscrollResistance` | Rubber-band factor past the first/last value | `0.35` |
| `tapSlop` | Movement still treated as a tap | `8px` |

## Acceptance criteria

- Dragging/flicking either scale moves the numbers under a fixed center needle.
- A quick flick keeps moving and then settles exactly on one value.
- A slow drag that stops off-center snaps to the nearest value.
- Numerator reaches `-20` and `20`; denominator reaches `1` and `20`.
- Selecting `2` / `3` makes the game factor exactly `2/3`.
- The old `±` button and old rail DOM are gone.
- `npm test`, `npm run build`, and `npm run test:e2e` pass.

## Result

All steps are implemented. `npm run lint`, `npm test` (43 tests), and
`npm run build` pass; `npm run test:e2e` passes all 6 Chromium cases. The
Playwright suite exercises dial rendering, exact `2/3` selection, negative
numerators, range endpoints, slow-drag snapping, flick momentum, and a narrow
mobile viewport.
