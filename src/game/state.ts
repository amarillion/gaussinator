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
  rows: Matrix;
  order: number[];
  moves: number;
  cursorPos: number;
}

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
  kString = "1";
  combine: { mode: "add" | "sub"; sourcePos: number } | null = null;
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

  displayMatrix(): Matrix {
    return this.order.map((id) => this.rows[id].map((x) => x));
  }

  isREF(): boolean {
    return isREF(this.displayMatrix());
  }

  isRREF(): boolean {
    return isRREF(this.displayMatrix());
  }

  parseK(): Rational | null {
    const r = Rational.parse(this.kString);
    if (!r || r.isZero()) return null;
    return r;
  }

  setK(s: string): void {
    this.kString = s;
  }

  appendK(ch: string): void {
    let s = this.kString;
    if (ch === "-") {
      s = s.startsWith("-") ? s.slice(1) : "-" + s;
    } else if (ch === "/") {
      if (!s.includes("/") && !s.endsWith("/")) s += "/";
    } else {
      // digit
      if (s === "1") s = ch;
      else if (s === "-1") s = "-" + ch;
      else if (s === "-") s = "-" + ch;
      else s += ch;
    }
    if (s.length > 10) s = s.slice(0, 10);
    if (s === "") s = "1";
    this.kString = s;
  }

  backspaceK(): void {
    let s = this.kString.slice(0, -1);
    if (s === "" || s === "-") s = "1";
    this.kString = s;
  }

  moveCursor(delta: number): void {
    this.cursorPos = clamp(this.cursorPos + delta, 0, this.n - 1);
  }

  enterCombine(mode: "add" | "sub"): void {
    if (this.won) return;
    this.combine = { mode, sourcePos: this.cursorPos };
  }

  cancelCombine(): void {
    this.combine = null;
  }

  applyScale(): boolean {
    if (this.won) return false;
    const k = this.parseK();
    if (!k) return false;
    this.pushHistory();
    scaleRow(this.rows, this.order[this.cursorPos], k);
    this.finishMove();
    return true;
  }

  confirmCombine(targetPos: number): boolean {
    const c = this.combine;
    if (!c || this.won) return false;
    if (c.sourcePos === targetPos) return false;
    const k = this.parseK();
    if (!k) return false;
    this.pushHistory();
    const factor = c.mode === "sub" ? k.neg() : k;
    addMultiple(this.rows, this.order[c.sourcePos], this.order[targetPos], factor);
    this.combine = null;
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
    this.combine = null;
    this.won = false;
    this.newRecord = false;
    this.kString = "1";
    this.hintText = null;
    return true;
  }

  restart(): void {
    this.rows = cloneMatrix(this.startMatrix);
    this.order = this.rows.map((_, i) => i);
    this.cursorPos = 0;
    this.history = [];
    this.moves = 0;
    this.combine = null;
    this.won = false;
    this.newRecord = false;
    this.kString = "1";
    this.hintText = null;
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
    this.kString = "1";
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
