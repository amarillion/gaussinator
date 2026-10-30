import { describe, expect, it } from "vitest";
import { Rational } from "../math/rational";
import { Matrix } from "../math/matrix";
import {
	Game,
	K_DENOMINATOR_MAX,
	K_DENOMINATOR_MIN,
	K_NUMERATOR_MAX,
	K_NUMERATOR_MIN,
	computeStars,
} from "./state";

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

describe("factor drawers", () => {
	it("starts both drawers at 1/1", () => {
		const g = new Game(0, 1);
		expect(g.kNumerator).toBe(1);
		expect(g.kDenominator).toBe(1);
		expect(g.liftNumerator).toBe(1);
		expect(g.liftDenominator).toBe(1);
	});

	it("builds exact factors and clamps both ranges", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 1 ], [ 1, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK(2, 3);
		expect(g.k.toString()).toBe("2/3");
		g.setK(-4, 5);
		expect(g.k.toString()).toBe("-4/5");
		g.setK(-99, 0);
		expect(g.kNumerator).toBe(K_NUMERATOR_MIN);
		expect(g.kDenominator).toBe(K_DENOMINATOR_MIN);
		g.setK(99, 99);
		expect(g.kNumerator).toBe(K_NUMERATOR_MAX);
		expect(g.kDenominator).toBe(K_DENOMINATOR_MAX);
	});

	it("never selects a zero numerator", () => {
		const g = new Game(0, 1);
		g.setK(0, 3);
		expect(g.kNumerator).toBe(1);
		g.setK(1, 1);
		g.moveNumerator(-1);
		expect(g.kNumerator).toBe(-1);
		g.moveNumerator(1);
		expect(g.kNumerator).toBe(1);
		g.setK(-2, 1);
		g.moveNumerator(1);
		expect(g.kNumerator).toBe(-1);
		g.moveNumerator(1);
		expect(g.kNumerator).toBe(1);
	});

	it("scales the selected row immediately as the left factor changes", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 3, 6 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		expect(g.setK(2, 3)).toBe(true);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "2", "4" ]);
		expect(g.setK(1, 3)).toBe(true);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "1", "2" ]);
		expect(g.moves).toBe(1);
	});

	it("groups a run of scale changes on the same row into one move and one undo", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK(2, 3);
		g.setK(3, 2);
		g.setK(5, 4);
		expect(g.moves).toBe(1);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "5/2", "5" ]);
		expect(g.undo()).toBe(true);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "2", "4" ]);
		expect(g.moves).toBe(0);
	});

	it("starts a new scored move after the cursor moves to another row", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 2 ], [ 3, 3 ] ]);
		g.order = [ 0, 1 ];
		g.setK(2, 1);
		g.setCursor(1);
		g.setK(2, 1);
		expect(g.moves).toBe(2);
		expect(g.rows.map(row => row.map(x => x.toString()))).toEqual([ [ "4", "4" ], [ "6", "6" ] ]);
		expect(g.undo()).toBe(true);
		expect(g.rows[1].map(x => x.toString())).toEqual([ "3", "3" ]);
	});

	it("moves the numerator and denominator independently", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 1 ], [ 1, 1 ] ]);
		g.order = [ 0, 1 ];
		g.moveNumerator(2);
		g.moveDenominator(3);
		expect(g.k.toString()).toBe("3/4");
		g.moveNumerator(-5);
		expect(g.k.toString()).toBe("-1/2");
	});

	it("keeps the lifted factor independent from the selected-row factor", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 0 ], [ 2, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		g.liftRow();
		expect(g.lift?.factor.toString()).toBe("1");
		expect(g.setLiftK(2, 3)).toBe(true);
		expect(g.lift?.factor.toString()).toBe("2/3");
		const before = g.rows[0].map(x => x.toString());
		expect(g.setK(5, 1)).toBe(false);
		expect(g.rows[0].map(x => x.toString())).toEqual(before);
	});

	it("resets the left factor when the cursor moves to another row", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 2 ], [ 3, 3 ] ]);
		g.order = [ 0, 1 ];
		g.setK(2, 1);
		expect(g.k.toString()).toBe("2");
		g.setCursor(1);
		expect(g.k.toString()).toBe("1");
		expect(g.rows[0].map(x => x.toString())).toEqual([ "4", "4" ]);
	});
});

describe("Game", () => {
	it("toggles the left-drawer sign immediately", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK(2, 1);
		expect(g.k.toString()).toBe("2");
		g.toggleKSign();
		expect(g.k.toString()).toBe("-2");
		expect(g.rows[0].map(x => x.toString())).toEqual([ "-4", "-8" ]);
		g.toggleKSign();
		expect(g.k.toString()).toBe("2");
		expect(g.rows[0].map(x => x.toString())).toEqual([ "4", "8" ]);
	});

	it("lifts a row and applies the right-drawer factor to the copy", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 0 ], [ 2, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		expect(g.liftRow()).toBe(true);
		expect(g.lift?.sourceId).toBe(0);
		expect(g.lift?.sourcePos).toBe(0);
		g.setLiftK(2, 1);
		expect(g.lift?.factor.toString()).toBe("2");
		g.setLiftK(3, 1);
		expect(g.lift?.factor.toString()).toBe("3"); // absolute, not 2*3
		g.toggleLiftSign();
		expect(g.lift?.factor.toString()).toBe("-3");
	});

	it("applies the lifted copy with the right-drawer factor", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 0 ], [ 2, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		g.liftRow();
		g.setLiftK(2, 1);
		g.toggleLiftSign(); // -2
		g.setLiftTarget(1);
		expect(g.applyLift()).toBe(true);
		expect(g.rows[1].map(x => x.toString())).toEqual([ "0", "1" ]);
		expect(g.moves).toBe(1);
		expect(g.lift).toBeNull();
		expect(g.cursorPos).toBe(1);
		expect(g.liftK.toString()).toBe("1");
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

	it("cancels an active lift and restores both drawers to 1/1", () => {
		const g = new Game(0, 1);
		g.liftRow();
		g.setLiftK(3, 2);
		expect(g.lift).not.toBeNull();
		g.cancelLift();
		expect(g.lift).toBeNull();
		expect(g.liftK.toString()).toBe("1");
		expect(g.k.toString()).toBe("1");
	});

	it("undo restores the row before a live scale", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK(2, 1);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "4", "8" ]);
		expect(g.undo()).toBe(true);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "2", "4" ]);
		expect(g.moves).toBe(0);
	});

	it("undo clears an active lift and restores the previous rows", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK(2, 1);
		g.setCursor(0);
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

	it("groups repeated swaps of the same row into one move and one undo", () => {
		const g = new Game(1, 1);
		g.rows = M([ [ 1 ], [ 2 ], [ 3 ] ]);
		g.order = [ 0, 1, 2 ];
		g.cursorPos = 0;
		expect(g.swapCursor(1)).toBe(true);
		expect(g.swapCursor(1)).toBe(true);
		expect(g.order).toEqual([ 1, 2, 0 ]);
		expect(g.moves).toBe(1);
		expect(g.undo()).toBe(true);
		expect(g.order).toEqual([ 0, 1, 2 ]);
		expect(g.moves).toBe(0);
	});

	it("starts a new swap run when a different row moves", () => {
		const g = new Game(1, 1);
		g.rows = M([ [ 1 ], [ 2 ], [ 3 ] ]);
		g.order = [ 0, 1, 2 ];
		expect(g.swapAt(0, 1)).toBe(true); // row 0 moves
		expect(g.swapAt(0, 1)).toBe(true); // row 1 now moves
		expect(g.moves).toBe(2);
	});

	it("undo restores the previous state exactly", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.setK(2, 1);
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

	it("detects the win immediately after a live scale reaches RREF", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 0 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		let recorded: number | null = null;
		g.onBest = m => {
			recorded = m;
		};
		expect(g.setK(1, 2)).toBe(true);
		expect(g.k.toString()).toBe("1/2");
		expect(g.won).toBe(true);
		expect(g.isRREF()).toBe(true);
		expect(g.best).toBe(1);
		expect(recorded).toBe(1);
		expect(g.newRecord).toBe(true);
	});
});
