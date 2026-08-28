import { describe, expect, it } from "vitest";
import { Rational } from "../math/rational";
import { Matrix } from "../math/matrix";
import { Game, computeStars } from "./state";

function M(rows: (number | string)[][]): Matrix {
	return rows.map(row => row.map(x => (typeof x === "number" ? new Rational(x) : Rational.parse(x)!)));
}

describe("computeStars", () => {
	it("rewards moves at or under par", () => {
		expect(computeStars(5, 8)).toBe(3);
		expect(computeStars(10, 8)).toBe(2);
		expect(computeStars(20, 8)).toBe(1);
	});
});

describe("Game", () => {
	it("edits the pending multiplier k", () => {
		const g = new Game(0, 1);
		expect(g.kString).toBe("1");
		g.appendK("3");
		expect(g.kString).toBe("3");
		g.appendK("-");
		expect(g.kString).toBe("-3");
		g.appendK("-");
		expect(g.kString).toBe("3");
		g.appendK("/");
		g.appendK("4");
		expect(g.kString).toBe("3/4");
		g.backspaceK();
		expect(g.kString).toBe("3/");
		g.backspaceK();
		g.backspaceK();
		expect(g.kString).toBe("1");
	});

	it("multiplies the selected row by k", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		g.setK("3");
		expect(g.applyScale()).toBe(true);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "6", "12" ]);
		expect(g.moves).toBe(1);
		expect(g.kString).toBe("1");
	});

	it("rejects scaling by zero", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK("0");
		expect(g.applyScale()).toBe(false);
		expect(g.moves).toBe(0);
	});

	it("lifts a row, multiplies the copy, and applies it to a target", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 0 ], [ 2, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		expect(g.liftRow()).toBe(true);
		expect(g.lift?.sourceId).toBe(0);
		expect(g.lift?.sourcePos).toBe(0);
		g.setK("-2");
		expect(g.multiplyLift()).toBe(true);
		expect(g.lift?.factor.toString()).toBe("-2");
		g.setLiftTarget(1);
		expect(g.applyLift()).toBe(true);
		expect(g.rows[1].map(x => x.toString())).toEqual([ "0", "1" ]);
		expect(g.moves).toBe(1);
		expect(g.lift).toBeNull();
		expect(g.cursorPos).toBe(1);
	});

	it("multiplying the lifted copy accumulates k without changing kString", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		g.liftRow();
		g.setK("2");
		expect(g.multiplyLift()).toBe(true);
		expect(g.kString).toBe("2");
		expect(g.multiplyLift()).toBe(true);
		expect(g.lift?.factor.toString()).toBe("4");
		g.setK("0");
		expect(g.multiplyLift()).toBe(false);
	});

	it("rejects applying a lift to its own source row", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 0 ], [ 2, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		g.liftRow();
		expect(g.applyLift()).toBe(false);
		expect(g.moves).toBe(0);
		expect(g.lift).not.toBeNull();
	});

	it("cancels an active lift", () => {
		const g = new Game(0, 1);
		g.liftRow();
		expect(g.lift).not.toBeNull();
		g.cancelLift();
		expect(g.lift).toBeNull();
	});

	it("undo clears an active lift and restores the previous rows", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK("3");
		g.applyScale();
		g.cursorPos = 0;
		g.liftRow();
		expect(g.lift).not.toBeNull();
		expect(g.undo()).toBe(true);
		expect(g.lift).toBeNull();
		expect(g.rows[0].map(x => x.toString())).toEqual([ "2", "4" ]);
		expect(g.moves).toBe(0);
	});

	it("reorders rows and moves the cursor", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 2 ], [ 3, 4 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		expect(g.swapAt(0, 1)).toBe(true);
		expect(g.order).toEqual([ 1, 0 ]);
		expect(g.cursorPos).toBe(1);
	});

	it("undo restores the previous state exactly", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK("3");
		g.applyScale();
		expect(g.undo()).toBe(true);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "2", "4" ]);
		expect(g.moves).toBe(0);
		expect(g.undo()).toBe(false);
	});

	it("undo restores the cursor position after a row swap", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 2 ], [ 3, 4 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		g.swapCursor(1);
		expect(g.cursorPos).toBe(1);
		expect(g.undo()).toBe(true);
		expect(g.cursorPos).toBe(0);
		expect(g.order).toEqual([ 0, 1 ]);
	});

	it("detects the win when the matrix reaches RREF", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 0 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK("1/2");
		let recorded: number | null = null;
		g.onBest = m => {
			recorded = m;
		};
		expect(g.applyScale()).toBe(true);
		expect(g.won).toBe(true);
		expect(g.isRREF()).toBe(true);
		expect(g.best).toBe(1);
		expect(recorded).toBe(1);
		expect(g.newRecord).toBe(true);
	});
});
