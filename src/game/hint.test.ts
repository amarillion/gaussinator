import { describe, expect, it } from "vitest";
import { Rational } from "../math/rational";
import {
	Matrix,
	addMultiple,
	cloneMatrix,
	computeRREF,
	equalMatrices,
	scaleRow,
	swapRows,
} from "../math/matrix";
import { generateLevel } from "../math/generator";
import { getHint } from "./hint";

function M(rows: (number | string)[][]): Matrix {
	return rows.map(row => row.map(x => (typeof x === "number" ? new Rational(x) : Rational.parse(x)!)));
}

describe("getHint", () => {
	it("suggests scaling a non-1 pivot to 1", () => {
		const h = getHint(M([ [ 2, 1 ], [ 1, 1 ] ]));
		expect(h.done).toBe(false);
		if (!h.done) {
			expect(h.kind).toBe("scale");
			expect(h.rows).toEqual([ 0 ]);
			expect(h.factor?.toString()).toBe("1/2");
		}
	});

	it("suggests clearing below a pivot of 1", () => {
		const h = getHint(M([ [ 1, 1 ], [ 2, 1 ] ]));
		expect(h.done).toBe(false);
		if (!h.done) {
			expect(h.kind).toBe("add");
			expect(h.rows).toEqual([ 0, 1 ]);
			expect(h.factor?.toString()).toBe("-2");
		}
	});

	it("suggests swapping a zero pivot with a lower nonzero row", () => {
		const h = getHint(M([ [ 0, 1 ], [ 1, 0 ] ]));
		expect(h.done).toBe(false);
		if (!h.done) {
			expect(h.kind).toBe("swap");
			expect(h.rows).toEqual([ 0, 1 ]);
		}
	});

	it("returns done for an RREF matrix", () => {
		const h = getHint(M([ [ 1, 0, 2 ], [ 0, 1, -1 ] ]));
		expect(h.done).toBe(true);
	});

	it("converges to RREF when each suggested operation is applied", () => {
		const start = M([ [ 2, 1 ], [ 1, 1 ] ]);
		const matrix = start.map(row => row.slice());
		const target = computeRREF(start).matrix;

		for (let i = 0; i < 12; i++) {
			const h = getHint(matrix);
			if (h.done) break;
			applyHint(matrix, h);
		}

		expect(equalMatrices(matrix, target)).toBe(true);
	});

	it("auto-solves every generated level by following hints", () => {
		for (let level = 0; level <= 6; level++) {
			for (let seed = 1; seed <= 5; seed++) {
				const g = generateLevel(level, seed);
				const matrix = cloneMatrix(g.start);

				for (let i = 0; i < 300; i++) {
					const h = getHint(matrix);
					if (h.done) break;
					applyHint(matrix, h);
				}

				expect(equalMatrices(matrix, g.rref)).toBe(true);
			}
		}
	});
});

function applyHint(
	matrix: Matrix,
	h: Extract<ReturnType<typeof getHint>, { done: false }>,
): void {
	if (h.kind === "swap") {
		swapRows(matrix, h.rows[0], h.rows[1]);
	} else if (h.kind === "scale") {
		scaleRow(matrix, h.rows[0], h.factor!);
	} else {
		addMultiple(matrix, h.rows[0], h.rows[1], h.factor!);
	}
}
