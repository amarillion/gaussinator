import { Rational } from "./rational";
import {
  Matrix,
  cloneMatrix,
  computeRREF,
  isRREF,
  rowsOf,
  swapRows,
  scaleRow,
  addMultiple,
} from "./matrix";

export interface LevelSpec {
  rows: number;
  cols: number;
  depth: number;
}

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [2, 3],
  [3, 3],
  [3, 4],
  [4, 4],
  [4, 5],
  [4, 6],
];

export function levelSpec(levelIndex: number): LevelSpec {
  if (levelIndex < SIZES.length) {
    const [rows, cols] = SIZES[levelIndex];
    return { rows, cols, depth: 6 + levelIndex * 2 };
  }
  return { rows: 4, cols: 6, depth: 6 + levelIndex * 2 };
}

/** Small deterministic PRNG so levels can be reproduced in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

const SCALES: readonly Rational[] = [
  new Rational(2),
  new Rational(3),
  Rational.MINUS_ONE,
  new Rational(1, 2),
  new Rational(1, 3),
];

function randomSmall(rng: () => number): Rational {
  if (rng() < 0.22) return Rational.ZERO;
  const mag = randInt(rng, 1, 3);
  return rng() < 0.5 ? new Rational(mag) : new Rational(-mag);
}

function maxMagnitude(m: Matrix): bigint {
  let max = 0n;
  for (const row of m) {
    for (const x of row) {
      const nn = x.n < 0n ? -x.n : x.n;
      if (nn > max) max = nn;
      if (x.d > max) max = x.d;
    }
  }
  return max;
}

/** Apply one random invertible elementary row operation, reverting if entries get too big. */
function applyRandomOp(m: Matrix, rng: () => number): void {
  const n = rowsOf(m);
  const before = cloneMatrix(m);
  const roll = Math.floor(rng() * 3);

  if (roll === 0) {
    const a = randInt(rng, 0, n - 1);
    let b = randInt(rng, 0, n - 1);
    if (a === b) b = (b + 1) % n;
    swapRows(m, a, b);
  } else if (roll === 1) {
    const row = randInt(rng, 0, n - 1);
    scaleRow(m, row, SCALES[randInt(rng, 0, SCALES.length - 1)]);
  } else {
    const a = randInt(rng, 0, n - 1);
    let b = randInt(rng, 0, n - 1);
    if (a === b) b = (b + 1) % n;
    let k = randInt(rng, -3, 3);
    if (k === 0) k = 1;
    addMultiple(m, a, b, new Rational(k));
  }

  if (maxMagnitude(m) > 60n) {
    for (let r = 0; r < n; r++) m[r] = before[r].slice();
  }
}

export interface GeneratedLevel {
  start: Matrix;
  rref: Matrix;
  par: number;
}

/**
 * Build a random RREF matrix, then scramble it with invertible row
 * operations. Because every operation is invertible, the RREF of the
 * starting matrix is exactly the generated RREF, so the level is always
 * solvable. "par" is the number of elementary ops the reference solver
 * needs on the scrambled matrix.
 */
export function generateLevel(levelIndex: number, seed: number): GeneratedLevel {
  const rng = mulberry32(seed);
  const spec = levelSpec(levelIndex);
  const n = spec.rows;
  const m = spec.cols;

  const maxRank = Math.min(n, m);
  const minRank = Math.max(1, maxRank - 1);
  const rank = randInt(rng, minRank, maxRank);

  // Pick distinct pivot columns, sorted left to right.
  const pivotCols: number[] = [];
  while (pivotCols.length < rank) {
    const c = randInt(rng, 0, m - 1);
    if (!pivotCols.includes(c)) pivotCols.push(c);
  }
  pivotCols.sort((a, b) => a - b);

  // Build the RREF answer: pivot rows have 1 at pivot columns,
  // arbitrary small integers in free columns, zero rows below.
  const A: Matrix = Array.from({ length: n }, () =>
    Array.from({ length: m }, () => Rational.ZERO),
  );
  for (let i = 0; i < rank; i++) {
    A[i][pivotCols[i]] = Rational.ONE;
  }

  // Free columns may hold non-zero values only to the RIGHT of a pivot row's
  // pivot; entries left of a pivot must be zero or the matrix is not in RREF.
  const freeCols: number[] = [];
  for (let c = 0; c < m; c++) {
    if (!pivotCols.includes(c)) freeCols.push(c);
  }
  for (const c of freeCols) {
    const allowedRows: number[] = [];
    for (let i = 0; i < rank; i++) {
      if (pivotCols[i] < c) allowedRows.push(i);
    }
    let tries = 0;
    do {
      for (let i = 0; i < rank; i++) {
        A[i][c] = pivotCols[i] < c ? randomSmall(rng) : Rational.ZERO;
      }
      tries++;
    } while (tries < 60 && allowedRows.length > 0 && allowedRows.every((i) => A[i][c].isZero()));
  }

  // Scramble until the board is no longer already in RREF.
  const start = cloneMatrix(A);
  let guard = 0;
  do {
    for (let t = 0; t < spec.depth; t++) applyRandomOp(start, rng);
    guard++;
  } while (isRREF(start) && guard < 50);

  const { ops } = computeRREF(start);
  return { start, rref: A, par: ops.length };
}
