import { Rational } from "../math/rational";
import {
	Matrix,
	cloneMatrix,
	isREF,
	isRREF,
	addMultiple,
	scaleRow,
} from "../math/matrix";
import { GeneratedLevel, generateLevel, levelSpec } from "../math/generator";

export interface Snapshot {
	rows: Matrix,
	order: number[],
	moves: number,
	cursorPos: number,
}

/** A row lifted out to the right side of the board, ready to be applied. */
export interface Lift {
	sourceId: number,
	sourcePos: number,
	targetPos: number,
	factor: Rational,
}

/** Numerator dial range, inclusive. Zero is excluded: factors are never zero. */
export const K_NUMERATOR_MIN = -20;
export const K_NUMERATOR_MAX = 20;
/** Denominator dial range, inclusive (shown as 1/1 … 1/20). */
export const K_DENOMINATOR_MIN = 1;
export const K_DENOMINATOR_MAX = 20;
export const K_DEFAULT_NUMERATOR = 1;
export const K_DEFAULT_DENOMINATOR = 1;

export function computeStars(moves: number, par: number): number {
	if (moves <= par) return 3;
	if (moves <= par + Math.ceil(par / 2)) return 2;
	return 1;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

/** Clamp a numerator while skipping the excluded zero value. */
function clampNumerator(v: number, direction = 1): number {
	const clamped = clamp(Math.round(v), K_NUMERATOR_MIN, K_NUMERATOR_MAX);
	if (clamped !== 0) return clamped;
	return direction < 0 ? -1 : 1;
}

/**
 * Game state. Rows are stored by a stable row id; `order` maps display
 * position -> row id so row swaps can be animated as sliding tiles.
 */
export class Game {
	readonly levelIndex: number;
	readonly spec: ReturnType<typeof levelSpec>;
	readonly generated: GeneratedLevel;

	rows: Matrix;
	order: number[];
	cursorPos = 0;
	/** Left-drawer factor for scaling the selected row: `kNumerator / kDenominator`. */
	kNumerator = K_DEFAULT_NUMERATOR;
	/** Left-drawer denominator, always in [K_DENOMINATOR_MIN, K_DENOMINATOR_MAX]. */
	kDenominator = K_DEFAULT_DENOMINATOR;
	/** Right-drawer factor applied to the lifted row preview. */
	liftNumerator = K_DEFAULT_NUMERATOR;
	liftDenominator = K_DEFAULT_DENOMINATOR;
	lift: Lift | null = null;
	/** Row whose current run of live scale changes shares one history entry/move. */
	private scaleStreakRowId: number | null = null;
	/** Row whose current run of swaps shares one history entry/move. */
	private swapStreakRowId: number | null = null;
	history: Snapshot[] = [];
	moves = 0;
	par: number;
	best: number | null = null;
	newRecord = false;
	won = false;
	hintText: string | null = null;
	onBest: ((moves: number) => void) | null = null;

	constructor(levelIndex: number, seed: number) {
		this.levelIndex = levelIndex;
		this.spec = levelSpec(levelIndex);
		this.generated = generateLevel(levelIndex, seed);
		this.rows = cloneMatrix(this.generated.start);
		this.order = this.rows.map((_, i) => i);
		this.par = this.generated.par;
	}

	get n(): number {
		return this.spec.rows;
	}

	get m(): number {
		return this.spec.cols;
	}

	get startMatrix(): Matrix {
		return this.generated.start;
	}

	/** Exact factor shown in the left drawer. */
	get k(): Rational {
		return new Rational(BigInt(this.kNumerator), BigInt(this.kDenominator));
	}

	/** Exact factor shown in the right drawer. */
	get liftK(): Rational {
		return new Rational(BigInt(this.liftNumerator), BigInt(this.liftDenominator));
	}

	displayMatrix(): Matrix {
		return this.order.map(id => this.rows[id].map(x => x));
	}

	isREF(): boolean {
		return isREF(this.displayMatrix());
	}

	isRREF(): boolean {
		return isRREF(this.displayMatrix());
	}

	/**
	 * Left drawer: choose a factor and immediately scale the selected row by
	 * the ratio from the previous factor, so scrubbing feels direct.
	 */
	setK(numerator: number, denominator: number): boolean {
		if (this.won || this.lift) return false;
		const nextNumerator = clampNumerator(numerator);
		const nextDenominator = clamp(Math.round(denominator), K_DENOMINATOR_MIN, K_DENOMINATOR_MAX);
		const next = new Rational(BigInt(nextNumerator), BigInt(nextDenominator));
		const previous = this.k;
		if (next.equals(previous)) return false;

		this.swapStreakRowId = null;
		const rowId = this.order[this.cursorPos];
		if (this.scaleStreakRowId !== rowId) {
			this.pushHistory();
			this.scaleStreakRowId = rowId;
			this.moves++;
		}
		scaleRow(this.rows, rowId, next.div(previous));
		this.kNumerator = nextNumerator;
		this.kDenominator = nextDenominator;
		this.hintText = null;
		this.checkWin();
		return true;
	}

	/** PgUp/PgDn: move the left-drawer numerator by delta, skipping zero. */
	moveNumerator(delta: number): boolean {
		if (this.won || this.lift) return false;
		return this.setK(clampNumerator(this.kNumerator + delta, delta), this.kDenominator);
	}

	/** Shift+PgUp/Shift+PgDn: move the left-drawer denominator by delta. */
	moveDenominator(delta: number): boolean {
		if (this.won || this.lift) return false;
		return this.setK(this.kNumerator, this.kDenominator + delta);
	}

	/** Minus key: flip the left-drawer numerator. */
	toggleKSign(): boolean {
		if (this.won || this.lift) return false;
		return this.setK(-this.kNumerator, this.kDenominator);
	}

	/** End the current scale run and reset the left drawer to 1/1. */
	resetK(): void {
		this.kNumerator = K_DEFAULT_NUMERATOR;
		this.kDenominator = K_DEFAULT_DENOMINATOR;
		this.scaleStreakRowId = null;
	}

	/** Right drawer: change the lifted row's live multiplier. */
	setLiftK(numerator: number, denominator: number): boolean {
		if (this.won || !this.lift) return false;
		const nextNumerator = clampNumerator(numerator);
		const nextDenominator = clamp(Math.round(denominator), K_DENOMINATOR_MIN, K_DENOMINATOR_MAX);
		const next = new Rational(BigInt(nextNumerator), BigInt(nextDenominator));
		if (next.equals(this.liftK)) return false;
		this.liftNumerator = nextNumerator;
		this.liftDenominator = nextDenominator;
		this.syncLiftFactor();
		this.hintText = null;
		return true;
	}

	/** PgUp/PgDn while lifted: move the right-drawer numerator. */
	moveLiftNumerator(delta: number): boolean {
		if (this.won || !this.lift) return false;
		return this.setLiftK(clampNumerator(this.liftNumerator + delta, delta), this.liftDenominator);
	}

	/** Shift+PgUp/Shift+PgDn while lifted: move the right-drawer denominator. */
	moveLiftDenominator(delta: number): boolean {
		if (this.won || !this.lift) return false;
		return this.setLiftK(this.liftNumerator, this.liftDenominator + delta);
	}

	/** Minus key while lifted: flip the right-drawer numerator. */
	toggleLiftSign(): boolean {
		if (this.won || !this.lift) return false;
		return this.setLiftK(-this.liftNumerator, this.liftDenominator);
	}

	/** Reset the right drawer to 1/1. */
	resetLiftK(): void {
		this.liftNumerator = K_DEFAULT_NUMERATOR;
		this.liftDenominator = K_DEFAULT_DENOMINATOR;
	}

	setCursor(pos: number): void {
		const next = clamp(pos, 0, this.n - 1);
		if (next === this.cursorPos) return;
		this.resetK();
		this.swapStreakRowId = null;
		this.cursorPos = next;
	}

	moveCursor(delta: number): void {
		this.setCursor(this.cursorPos + delta);
	}

	liftRow(): boolean {
		if (this.won || this.lift) return false;
		this.resetK();
		this.resetLiftK();
		this.swapStreakRowId = null;
		this.lift = {
			sourceId: this.order[this.cursorPos],
			sourcePos: this.cursorPos,
			targetPos: this.cursorPos,
			factor: this.liftK,
		};
		return true;
	}

	moveLift(delta: number): void {
		if (!this.lift) return;
		this.lift.targetPos = clamp(this.lift.targetPos + delta, 0, this.n - 1);
	}

	setLiftTarget(pos: number): void {
		if (!this.lift) return;
		this.lift.targetPos = clamp(pos, 0, this.n - 1);
	}

	/** Add the lifted copy to the row it is aligned with. */
	applyLift(): boolean {
		const l = this.lift;
		if (!l || this.won) return false;
		const targetId = this.order[l.targetPos];
		if (targetId === l.sourceId || l.factor.isZero()) return false;
		this.pushHistory();
		addMultiple(this.rows, l.sourceId, targetId, l.factor);
		this.cursorPos = l.targetPos;
		this.lift = null;
		this.resetLiftK();
		this.finishMove();
		return true;
	}

	cancelLift(): void {
		this.lift = null;
		this.resetLiftK();
		this.resetK();
		this.swapStreakRowId = null;
	}

	swapAt(pos: number, delta: number): boolean {
		if (this.won) return false;
		const b = pos + delta;
		if (b < 0 || b >= this.n) return false;
		const rowId = this.order[pos];
		if (this.swapStreakRowId !== rowId) {
			this.pushHistory();
			this.swapStreakRowId = rowId;
			this.moves++;
		}
		this.resetK();
		const t = this.order[pos];
		this.order[pos] = this.order[b];
		this.order[b] = t;
		this.cursorPos = b;
		this.hintText = null;
		this.checkWin();
		return true;
	}

	swapCursor(delta: number): boolean {
		return this.swapAt(this.cursorPos, delta);
	}

	/** Move a specific row by one display step (used by the drag handles). */
	swapRow(rowId: number, delta: number): boolean {
		const pos = this.order.indexOf(rowId);
		if (pos < 0) return false;
		return this.swapAt(pos, delta);
	}

	undo(): boolean {
		const s = this.history.pop();
		if (!s) return false;
		this.rows = s.rows;
		this.order = s.order;
		this.moves = s.moves;
		this.cursorPos = s.cursorPos;
		this.lift = null;
		this.won = false;
		this.newRecord = false;
		this.resetK();
		this.resetLiftK();
		this.swapStreakRowId = null;
		this.hintText = null;
		return true;
	}

	restart(): void {
		this.rows = cloneMatrix(this.startMatrix);
		this.order = this.rows.map((_, i) => i);
		this.cursorPos = 0;
		this.history = [];
		this.moves = 0;
		this.lift = null;
		this.won = false;
		this.newRecord = false;
		this.resetK();
		this.resetLiftK();
		this.swapStreakRowId = null;
		this.hintText = null;
	}

	private syncLiftFactor(): void {
		if (this.lift) this.lift.factor = this.liftK;
	}

	private pushHistory(): void {
		this.history.push({
			rows: cloneMatrix(this.rows),
			order: this.order.slice(),
			moves: this.moves,
			cursorPos: this.cursorPos,
		});
	}

	private checkWin(): void {
		if (!this.isRREF()) return;
		this.won = true;
		const prev = this.best;
		if (prev === null || this.moves < prev) {
			this.best = this.moves;
			this.newRecord = true;
			this.onBest?.(this.moves);
		}
	}

	private finishMove(): void {
		this.moves++;
		this.resetK();
		this.resetLiftK();
		this.swapStreakRowId = null;
		this.hintText = null;
		this.checkWin();
	}
}
