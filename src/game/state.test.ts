import { describe, expect, it } from "vitest";
import { Rational } from "../math/rational";
import { Matrix } from "../math/matrix";
import {
	Game,
	K_CENTER_INDEX,
	K_DENOMINATOR_MAX,
	K_DENOMINATOR_MIN,
	K_NUMERATOR_MAX,
	K_NUMERATOR_MIN,
	K_TILES,
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

describe("K rail", () => {
	it("has 1 at the center, integers above, unit fractions below", () => {
		expect(K_TILES[K_CENTER_INDEX].toString()).toBe("1");
		expect(K_TILES[K_CENTER_INDEX - 1].toString()).toBe("2");
		expect(K_TILES[0].toString()).toBe("9");
		expect(K_TILES[K_CENTER_INDEX + 1].toString()).toBe("1/2");
		expect(K_TILES[K_TILES.length - 1].toString()).toBe("1/9");
	});
});

describe("numerator / denominator factor", () => {
	it("builds exact fractions from the two dials", () => {
		const g = new Game(0, 1);
		expect(g.kNumerator).toBe(1);
		expect(g.kDenominator).toBe(1);
		g.setK(2, 3);
		expect(g.k.toString()).toBe("2/3");
		g.setK(-4, 5);
		expect(g.k.toString()).toBe("-4/5");
		g.setK(6, 3);
		expect(g.k.toString()).toBe("2");
	});

	it("clamps the numerator to -20..20 and the denominator to 1..20", () => {
		const g = new Game(0, 1);
		g.setK(-99, 0);
		expect(g.kNumerator).toBe(K_NUMERATOR_MIN);
		expect(g.kDenominator).toBe(K_DENOMINATOR_MIN);
		g.setK(99, 99);
		expect(g.kNumerator).toBe(K_NUMERATOR_MAX);
		expect(g.kDenominator).toBe(K_DENOMINATOR_MAX);
	});

	it("moves the numerator and denominator independently", () => {
		const g = new Game(0, 1);
		g.moveNumerator(2);
		g.moveDenominator(3);
		expect(g.k.toString()).toBe("3/4");
		g.moveNumerator(-5);
		expect(g.k.toString()).toBe("-1/2");
	});

	it("keeps the lifted copy in sync with a fractional factor", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 0 ], [ 2, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		g.setK(2, 3);
		g.liftRow();
		expect(g.lift?.factor.toString()).toBe("2/3");
		g.setK(-5, 7);
		expect(g.lift?.factor.toString()).toBe("-5/7");
	});

	it("scales a row by an exact fraction", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 3, 6 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		g.setK(2, 3);
		g.startScaleMode();
		expect(g.applyScale()).toBe(true);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "2", "4" ]);
	});
});

describe("Game", () => {
	it("moves along the multiplier rail", () => {
		const g = new Game(0, 1);
		expect(g.k.toString()).toBe("1");
		g.moveK(-1);
		expect(g.k.toString()).toBe("2");
		g.moveK(-1);
		expect(g.k.toString()).toBe("3");
		g.moveK(1);
		expect(g.k.toString()).toBe("2");
		g.setKIndex(0);
		expect(g.k.toString()).toBe("9");
	});

	it("toggles negative factors with the minus key", () => {
		const g = new Game(0, 1);
		g.moveK(-1);
		expect(g.k.toString()).toBe("2");
		g.toggleKSign();
		expect(g.k.toString()).toBe("-2");
		g.toggleKSign();
		expect(g.k.toString()).toBe("2");
	});

	it("scales the selected row only after entering scale mode", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		expect(g.applyScale()).toBe(false);
		expect(g.startScaleMode()).toBe(true);
		g.moveK(-1); // factor 2
		expect(g.applyScale()).toBe(true);
		expect(g.rows[0].map(x => x.toString())).toEqual([ "4", "8" ]);
		expect(g.moves).toBe(1);
		expect(g.pendingScale).toBe(false);
		expect(g.k.toString()).toBe("1");
	});

	it("cancels an active scale mode without changing the board", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 2, 4 ], [ 0, 1 ] ]);
		g.order = [ 0, 1 ];
		g.startScaleMode();
		expect(g.cancelScaleMode()).toBe(true);
		expect(g.applyScale()).toBe(false);
		expect(g.moves).toBe(0);
	});

	it("rejects scale mode while a row is lifted", () => {
		const g = new Game(0, 1);
		g.liftRow();
		expect(g.startScaleMode()).toBe(false);
	});

	it("lifts a row and the copy always follows the rail factor from the original row", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 0 ], [ 2, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		expect(g.liftRow()).toBe(true);
		expect(g.lift?.sourceId).toBe(0);
		expect(g.lift?.sourcePos).toBe(0);
		expect(g.lift?.factor.toString()).toBe("1");
		g.moveK(-1);
		expect(g.lift?.factor.toString()).toBe("2");
		g.moveK(-1);
		expect(g.lift?.factor.toString()).toBe("3"); // absolute, not 2*3
		g.toggleKSign();
		expect(g.lift?.factor.toString()).toBe("-3");
	});

	it("applies the lifted copy with the selected factor", () => {
		const g = new Game(0, 1);
		g.rows = M([ [ 1, 0 ], [ 2, 1 ] ]);
		g.order = [ 0, 1 ];
		g.cursorPos = 0;
		g.liftRow();
		g.moveK(-1); // factor 2
		g.toggleKSign(); // -2
		g.setLiftTarget(1);
		expect(g.applyLift()).toBe(true);
		expect(g.rows[1].map(x => x.toString())).toEqual([ "0", "1" ]);
		expect(g.moves).toBe(1);
		expect(g.lift).toBeNull();
		expect(g.cursorPos).toBe(1);
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
		g.startScaleMode();
		g.moveK(-1); // 2
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
		g.startScaleMode();
		g.moveK(-1); // 2
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
		g.startScaleMode();
		g.setKIndex(K_CENTER_INDEX + 1); // 1/2
		expect(g.k.toString()).toBe("1/2");
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
