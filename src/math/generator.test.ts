import { describe, expect, it } from "vitest";
import { Rational } from "./rational";
import { addMultiple, cloneMatrix, computeRREF, equalMatrices, isRREF, scaleRow, swapRows } from "./matrix";
import { generateLevel } from "./generator";

describe("generateLevel", () => {
	it("produces solvable levels whose RREF matches the generated answer", () => {
		for (let seed = 1; seed <= 60; seed++) {
			for (let level = 0; level <= 6; level++) {
				const g = generateLevel(level, seed);
				expect(isRREF(g.rref)).toBe(true);
				expect(isRREF(g.start)).toBe(false);
				expect(g.par).toBeGreaterThan(0);

				const solved = computeRREF(g.start);
				expect(equalMatrices(solved.matrix, g.rref)).toBe(true);

				// Entries stay readable.
				for (const row of g.start) {
					for (const x of row) {
						expect(x.n < 0n ? -x.n : x.n).toBeLessThanOrEqual(60n);
						expect(x.d).toBeLessThanOrEqual(60n);
					}
				}
			}
		}
	});
});

describe("elementary row operations preserve RREF", () => {
	it("swap, scale and add-multiple do not change the RREF", () => {
		const g = generateLevel(0, 7);
		const base = computeRREF(g.start).matrix;

		const a = cloneMatrix(g.start);
		swapRows(a, 0, (0 + 1) % a.length);
		expect(equalMatrices(computeRREF(a).matrix, base)).toBe(true);

		const b = cloneMatrix(g.start);
		scaleRow(b, 0, new Rational(3));
		expect(equalMatrices(computeRREF(b).matrix, base)).toBe(true);

		const c = cloneMatrix(g.start);
		addMultiple(c, 0, 1, new Rational(-2));
		expect(equalMatrices(computeRREF(c).matrix, base)).toBe(true);
	});
});
