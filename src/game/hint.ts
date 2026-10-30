import { Matrix, computeRREF, leadingIndex } from "../math/matrix";
import { Rational } from "../math/rational";

export type Hint =
	| {
		done: false,
		kind: "swap" | "scale" | "add",
		text: string,
		rows: number[],
		col: number,
		factor: Rational | null,
	}
	| { done: true, text: string };

/**
 * Suggest the next elementary row operation toward RREF.
 * Scans columns left-to-right and rows top-to-bottom for the first
 * mismatch against the matrix's RREF. Row indices refer to display order.
 * `col` is the pivot column being fixed; `factor` is the multiplier for
 * scale (row ×= factor) and add (target += factor × source) operations.
 */
export function getHint(matrix: Matrix): Hint {
	const { matrix: rref } = computeRREF(matrix);
	const n = matrix.length;
	const m = matrix.length === 0 ? 0 : matrix[0].length;

	const pivotRow: number[] = new Array(m).fill(-1);
	for (let r = 0; r < n; r++) {
		const li = leadingIndex(rref[r]);
		if (li >= 0) pivotRow[li] = r;
	}

	for (let c = 0; c < m; c++) {
		const p = pivotRow[c];
		if (p === -1) continue; // free column: any values are acceptable

		const v = matrix[p][c];
		if (v.isZero()) {
			for (let r = p + 1; r < n; r++) {
				if (!matrix[r][c].isZero()) {
					return {
						done: false,
						kind: "swap",
						rows: [ p, r ],
						col: c,
						factor: null,
						text: `Swap row ${p + 1} with row ${r + 1} to bring a non-zero pivot into column ${c + 1}.`,
					};
				}
			}
			continue;
		}

		if (!v.isOne()) {
			const f = v.inv();
			return {
				done: false,
				kind: "scale",
				rows: [ p ],
				col: c,
				factor: f,
				text: `Scale row ${p + 1} by ${f.toString()}: press M, set it on the numerator/denominator dials (PgUp/PgDn, Shift+PgUp/PgDn, − for sign), then Enter to make the pivot in column ${c + 1} equal to 1.`,
			};
		}

		// Pivot is 1: clear the rest of the pivot column, below first then above.
		for (let r = p + 1; r < n; r++) {
			const x = matrix[r][c];
			if (!x.isZero()) {
				const f = x.neg();
				return {
					done: false,
					kind: "add",
					rows: [ p, r ],
					col: c,
					factor: f,
					text: `Lift row ${p + 1} with →, set the factor ${f.toString()} on the numerator/denominator dials (PgUp/PgDn, Shift+PgUp/PgDn, − for sign), align with row ${r + 1}, then press Enter to clear column ${c + 1}.`,
				};
			}
		}
		for (let r = 0; r < p; r++) {
			const x = matrix[r][c];
			if (!x.isZero()) {
				const f = x.neg();
				return {
					done: false,
					kind: "add",
					rows: [ p, r ],
					col: c,
					factor: f,
					text: `Lift row ${p + 1} with →, set the factor ${f.toString()} on the numerator/denominator dials (PgUp/PgDn, Shift+PgUp/PgDn, − for sign), align with row ${r + 1}, then press Enter to clear column ${c + 1}.`,
				};
			}
		}
	}

	return { done: true, text: "The matrix is already in reduced row echelon form." };
}
