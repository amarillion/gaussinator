import { describe, expect, it } from "vitest";
import { Rational } from "./rational";
import {
  Matrix,
  addMultiple,
  computeRREF,
  equalMatrices,
  isREF,
  isRREF,
  scaleRow,
  swapRows,
} from "./matrix";

function M(rows: (number | string)[][]): Matrix {
  return rows.map((row) => row.map((x) => (typeof x === "number" ? new Rational(x) : Rational.parse(x)!)));
}

describe("isREF / isRREF", () => {
  it("accepts proper REF", () => {
    expect(isREF(M([[1, 2], [0, 1]]))).toBe(true);
    expect(isREF(M([[1, 2, 3], [0, 0, 1], [0, 0, 0]]))).toBe(true);
  });

  it("rejects broken staircases", () => {
    expect(isREF(M([[0, 1], [1, 0]]))).toBe(false);
    expect(isREF(M([[0, 0], [1, 0]]))).toBe(false);
    expect(isREF(M([[1, 2], [1, 3]]))).toBe(false);
  });

  it("accepts proper RREF", () => {
    expect(isRREF(M([[1, 0], [0, 1]]))).toBe(true);
    expect(isRREF(M([[1, 2], [0, 0]]))).toBe(true);
    expect(isRREF(M([[1, 0, 2], [0, 1, -1]]))).toBe(true);
    expect(isRREF(M([[1, 0], [0, 1], [0, 0]]))).toBe(true);
  });

  it("rejects non-reduced matrices", () => {
    expect(isRREF(M([[1, 2], [0, 1]]))).toBe(false);
    expect(isRREF(M([[2, 0], [0, 1]]))).toBe(false);
    expect(isRREF(M([[1, 0, 2], [0, 0, 1]]))).toBe(false);
  });
});

describe("row operations", () => {
  it("swap, scale and add-multiple mutate in place", () => {
    const a = M([[1, 2], [3, 4]]);
    swapRows(a, 0, 1);
    expect(a[0][0].toString()).toBe("3");

    scaleRow(a, 1, new Rational(2));
    expect(a[1].map((x) => x.toString())).toEqual(["2", "4"]);

    addMultiple(a, 1, 0, new Rational(-1));
    expect(a[0].map((x) => x.toString())).toEqual(["1", "0"]);
  });

  it("rejects invalid operations", () => {
    const a = M([[1, 2], [3, 4]]);
    expect(() => scaleRow(a, 0, Rational.ZERO)).toThrow();
    expect(() => addMultiple(a, 0, 0, new Rational(1))).toThrow();
    expect(() => addMultiple(a, 0, 1, Rational.ZERO)).toThrow();
  });
});

describe("computeRREF", () => {
  it("reduces a 2x2 integer matrix", () => {
    const { matrix, ops } = computeRREF(M([[2, 1], [3, 1]]));
    expect(equalMatrices(matrix, M([[1, 0], [0, 1]]))).toBe(true);
    expect(ops.length).toBeGreaterThan(0);
  });

  it("reduces a 2x3 matrix", () => {
    const { matrix } = computeRREF(M([[1, 2, 3], [4, 5, 6]]));
    expect(equalMatrices(matrix, M([[1, 0, -1], [0, 1, 2]]))).toBe(true);
  });

  it("leaves an RREF matrix unchanged", () => {
    const input = M([[1, 0, 2], [0, 1, -1]]);
    const { matrix, ops } = computeRREF(input);
    expect(equalMatrices(matrix, input)).toBe(true);
    expect(ops.length).toBe(0);
  });

  it("handles rank-deficient matrices", () => {
    const { matrix } = computeRREF(M([[1, 2], [2, 4]]));
    expect(equalMatrices(matrix, M([[1, 2], [0, 0]]))).toBe(true);
  });
});
