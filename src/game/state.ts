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

/** The multiplier rail: 9 … 2, 1, 1/2 … 1/9 (index 8 is the center 1). */
export const K_TILES: readonly Rational[] = [
	new Rational(9),
	new Rational(8),
	new Rational(7),
	new Rational(6),
	new Rational(5),
	new Rational(4),
	new Rational(3),
	new Rational(2),
	Rational.ONE,
	new Rational(1, 2),
	new Rational(1, 3),
	new Rational(1, 4),
	new Rational(1, 5),
	new Rational(1, 6),
	new Rational(1, 7),
	new Rational(1, 8),
	new Rational(1, 9),
];

export const K_CENTER_INDEX = 8;

export function computeStars(moves: number, par: number): number {
	if (moves <= par) return 3;
	if (moves <= par + Math.ceil(par / 2)) return 2;
	return 1;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
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
	/** Selected multiplier-rail tile; `k` is always derived from this. */
	kIndex = K_CENTER_INDEX;
	/** True when the minus key toggled the rail factor negative. */
	kNegative = false;
	/** In-place scaling mode, started with M and confirmed with Enter. */
	pendingScale = false;
	lift: Lift | null = null;
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

	/** Current multiplier: the selected rail tile, optionally negated. */
	get k(): Rational {
		const r = K_TILES[this.kIndex];
		return this.kNegative ? r.neg() : r;
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

	/** PgUp = -1, PgDn = +1. The lifted copy follows immediately. */
	moveK(delta: number): void {
		if (this.won) return;
		this.kIndex = clamp(this.kIndex + delta, 0, K_TILES.length - 1);
		this.syncLiftFactor();
	}

	/** Click/tap a rail tile directly. */
	setKIndex(index: number): void {
		if (this.won) return;
		this.kIndex = clamp(Math.round(index), 0, K_TILES.length - 1);
		this.syncLiftFactor();
	}

	/** Minus key: toggle the sign of the current factor. */
	toggleKSign(): void {
		if (this.won) return;
		this.kNegative = !this.kNegative;
		this.syncLiftFactor();
	}

	resetK(): void {
		this.kIndex = K_CENTER_INDEX;
		this.kNegative = false;
		this.syncLiftFactor();
	}

	moveCursor(delta: number): void {
		this.cursorPos = clamp(this.cursorPos + delta, 0, this.n - 1);
	}

	liftRow(): boolean {
		if (this.won || this.lift) return false;
		this.pendingScale = false;
		this.lift = {
			sourceId: this.order[this.cursorPos],
			sourcePos: this.cursorPos,
			targetPos: this.cursorPos,
			factor: this.k,
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
		this.finishMove();
		return true;
	}

	cancelLift(): void {
		this.lift = null;
	}

	/** M key: begin in-place scaling of the cursor row with the rail factor. */
	startScaleMode(): boolean {
		if (this.won || this.lift || this.pendingScale) return false;
		this.pendingScale = true;
		return true;
	}

	cancelScaleMode(): boolean {
		if (!this.pendingScale) return false;
		this.pendingScale = false;
		return true;
	}

	/** Enter key while `pendingScale`: scale the cursor row by the rail factor. */
	applyScale(): boolean {
		if (this.won || !this.pendingScale) return false;
		const k = this.k;
		this.pushHistory();
		scaleRow(this.rows, this.order[this.cursorPos], k);
		this.pendingScale = false;
		this.finishMove();
		return true;
	}

	swapAt(pos: number, delta: number): boolean {
		if (this.won) return false;
		const b = pos + delta;
		if (b < 0 || b >= this.n) return false;
		this.pushHistory();
		const t = this.order[pos];
		this.order[pos] = this.order[b];
		this.order[b] = t;
		this.cursorPos = b;
		this.finishMove();
		return true;
	}

	swapCursor(delta: number): boolean {
		return this.swapAt(this.cursorPos, delta);
	}

	undo(): boolean {
		const s = this.history.pop();
		if (!s) return false;
		this.rows = s.rows;
		this.order = s.order;
		this.moves = s.moves;
		this.cursorPos = s.cursorPos;
		this.lift = null;
		this.pendingScale = false;
		this.won = false;
		this.newRecord = false;
		this.resetK();
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
		this.pendingScale = false;
		this.won = false;
		this.newRecord = false;
		this.resetK();
		this.hintText = null;
	}

	private syncLiftFactor(): void {
		if (this.lift) this.lift.factor = this.k;
	}

	private pushHistory(): void {
		this.history.push({
			rows: cloneMatrix(this.rows),
			order: this.order.slice(),
			moves: this.moves,
			cursorPos: this.cursorPos,
		});
	}

	private finishMove(): void {
		this.moves++;
		this.resetK();
		this.hintText = null;
		if (this.isRREF()) {
			this.won = true;
			const prev = this.best;
			if (prev === null || this.moves < prev) {
				this.best = this.moves;
				this.newRecord = true;
				this.onBest?.(this.moves);
			}
		}
	}
}
