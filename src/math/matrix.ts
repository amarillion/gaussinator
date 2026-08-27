import { Rational } from "./rational";

export type Matrix = Rational[][];

export type RowOp =
  | { kind: "swap"; a: number; b: number }
  | { kind: "scale"; row: number; factor: Rational }
  | { kind: "add"; src: number; dst: number; factor: Rational };

export function cloneMatrix(m: Matrix): Matrix {
  return m.map((row) => row.slice());
}

export function rowsOf(m: Matrix): number {
  return m.length;
}

export function colsOf(m: Matrix): number {
  return m.length === 0 ? 0 : m[0].length;
}

export function leadingIndex(row: Rational[]): number {
  return row.findIndex((x) => !x.isZero());
}

export function swapRows(m: Matrix, a: number, b: number): void {
  if (a < 0 || b < 0 || a >= m.length || b >= m.length) {
    throw new Error(`swapRows out of bounds: ${a}, ${b}`);
  }
  const t = m[a];
  m[a] = m[b];
  m[b] = t;
}

export function scaleRow(m: Matrix, row: number, c: Rational): void {
  if (c.isZero()) throw new Error("Cannot scale a row by zero");
  if (row < 0 || row >= m.length) throw new Error(`scaleRow out of bounds: ${row}`);
  m[row] = m[row].map((x) => x.mul(c));
}

export function addMultiple(m: Matrix, src: number, dst: number, c: Rational): void {
  if (src === dst) throw new Error("addMultiple requires distinct rows");
  if (c.isZero()) throw new Error("addMultiple requires a non-zero factor");
  if (src < 0 || dst < 0 || src >= m.length || dst >= m.length) {
    throw new Error(`addMultiple out of bounds: ${src}, ${dst}`);
  }
  const s = m[src];
  m[dst] = m[dst].map((x, i) => x.add(s[i].mul(c)));
}

/**
 * Row echelon form: leading entries strictly staircase, zero rows at bottom.
 */
export function isREF(m: Matrix): boolean {
  let prev = -1;
  let seenZeroRow = false;
  for (const row of m) {
    const li = leadingIndex(row);
    if (li === -1) {
      seenZeroRow = true;
      continue;
    }
    if (seenZeroRow || li <= prev) return false;
    prev = li;
  }
  return true;
}

/**
 * Reduced row echelon form: REF plus leading entries equal 1 and each
 * pivot column is zero in every other row.
 */
export function isRREF(m: Matrix): boolean {
  if (!isREF(m)) return false;
  const pivotCols: number[] = [];
  for (const row of m) {
    const li = leadingIndex(row);
    if (li >= 0) {
      if (!row[li].isOne()) return false;
      pivotCols.push(li);
    }
  }
  for (const c of pivotCols) {
    for (let r = 0; r < m.length; r++) {
      if (leadingIndex(m[r]) !== c && !m[r][c].isZero()) return false;
    }
  }
  return true;
}

export function equalMatrices(a: Matrix, b: Matrix): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (!a[r][c].equals(b[r][c])) return false;
    }
  }
  return true;
}

export interface RREFResult {
  matrix: Matrix;
  ops: RowOp[];
}

/**
 * Exact Gaussian-Jordan elimination. Returns the RREF and the list of
 * elementary row operations used (swap / scale / add-multiple).
 */
export function computeRREF(m: Matrix): RREFResult {
  const A = cloneMatrix(m);
  const ops: RowOp[] = [];
  const n = rowsOf(A);
  const cols = colsOf(A);
  let pr = 0; // next pivot row

  for (let col = 0; col < cols && pr < n; col++) {
    let pivot = -1;
    for (let r = pr; r < n; r++) {
      if (!A[r][col].isZero()) {
        pivot = r;
        break;
      }
    }
    if (pivot === -1) continue;

    if (pivot !== pr) {
      swapRows(A, pr, pivot);
      ops.push({ kind: "swap", a: pr, b: pivot });
    }

    const piv = A[pr][col];
    if (!piv.isOne()) {
      const f = piv.inv();
      scaleRow(A, pr, f);
      ops.push({ kind: "scale", row: pr, factor: f });
    }

    for (let r = 0; r < n; r++) {
      if (r === pr) continue;
      const v = A[r][col];
      if (!v.isZero()) {
        const f = v.neg();
        addMultiple(A, pr, r, f);
        ops.push({ kind: "add", src: pr, dst: r, factor: f });
      }
    }
    pr++;
  }

  return { matrix: A, ops };
}
