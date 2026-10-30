import { Rational } from "../../math/rational";
import type { Matrix } from "../../math/matrix";
import { FACTOR_DIAL_WIDTH } from "./dial-tuning";

export interface LiftView {
	sourceId: number,
	sourcePos: number,
	targetPos: number,
	factor: Rational,
}

/** Everything `<rref-board>` needs to draw one frame. */
export interface BoardView {
	rows: Matrix,
	order: number[],
	cursorPos: number,
	lift: LiftView | null,
	hintRows: number[] | null,
}

function tierOf(r: Rational): number {
	let mag = r.toNumber();
	if (!Number.isFinite(mag)) mag = 4096;
	mag = Math.abs(mag);
	if (mag < 2) return 0;
	return Math.min(Math.floor(Math.log2(mag)), 11);
}

function fracHTML(r: Rational): string {
	if (r.d === 1n) return `<span class="int">${r.n.toString()}</span>`;
	const ns = r.n.toString();
	const ds = r.d.toString();
	if (ns.length <= 4 && ds.length <= 4) {
		return `<span class="frac"><span class="num">${ns}</span><span class="den">${ds}</span></span>`;
	}
	return `<span class="inline">${ns}/${ds}</span>`;
}

/**
 * `<rref-board>` — the matrix board plus its right-hand lifted-copy rail.
 *
 * Owns the tile pools, layout math, value painting, and row tap/swipe
 * pointer gestures. It reports user intent as `row-tap` / `row-swipe`
 * events and receives the whole board frame through `render(view)`.
 */
export class RrefBoard extends HTMLElement {
	private tiles = new Map<string, HTMLElement>();
	private cells = new Map<string, HTMLElement>();
	private liftTiles = new Map<number, HTMLElement>();
	private liftCells = new Map<number, HTMLElement>();
	private handles = new Map<number, HTMLElement>();
	private last = new Map<string, string>();
	private lastLift = new Map<string, string>();
	private rail: HTMLElement | null = null;
	private tileW = 60;
	private tileH = 54;
	private gap = 8;
	private order: number[] = [];
	private lift: LiftView | null = null;

	private down: { x: number, y: number, pos: number, id: number, fromRail: boolean } | null = null;
	private swiped = false;
	private handleDrag: {
		pointerId: number,
		rowId: number,
		startY: number,
		startPos: number,
		currentPos: number,
		step: number,
		moved: boolean,
	} | null = null;

	connectedCallback(): void {
		this.addEventListener("pointerdown", this.onPointerDown);
		this.addEventListener("pointermove", this.onPointerMove);
		this.addEventListener("pointerup", this.onPointerUp);
		this.addEventListener("pointercancel", this.onPointerCancel);
	}

	disconnectedCallback(): void {
		this.removeEventListener("pointerdown", this.onPointerDown);
		this.removeEventListener("pointermove", this.onPointerMove);
		this.removeEventListener("pointerup", this.onPointerUp);
		this.removeEventListener("pointercancel", this.onPointerCancel);
	}

	layout(n: number, m: number): void {
		// The board sits in the left half of the container; the right half is
		// reserved for the lifted-copy rail, so the whole board + rail fits on
		// screen without horizontal overflow.
		const wrap = this.parentElement?.parentElement as HTMLElement | null;
		const containerW = wrap ? wrap.clientWidth : window.innerWidth;
		// One factor drawer is always open; the board and its lift rail split
		// the remaining width evenly.
		const dialW = FACTOR_DIAL_WIDTH + 10;
		const widthBudget = Math.max(96, (containerW - dialW - 8) / 2);
		const maxH = Math.max(240, window.innerHeight - 330);
		let tw = Math.max(30, Math.min(widthBudget / m, maxH / n, 108));
		this.gap = Math.max(4, Math.round(tw * 0.12));
		if (m * tw + (m + 1) * this.gap > widthBudget) {
			tw = Math.max(30, (widthBudget - (m + 1) * this.gap) / m);
			this.gap = Math.max(4, Math.round(tw * 0.12));
		}
		this.tileW = Math.floor(tw);
		this.tileH = Math.round(tw * 0.92);
		this.style.width = `${m * this.tileW + (m + 1) * this.gap}px`;
		this.style.height = `${n * this.tileH + (n + 1) * this.gap}px`;
		this.style.setProperty("--tile-font", `${Math.max(13, Math.floor(this.tileW * 0.38))}px`);
		if (this.rail) {
			this.rail.style.height = this.style.height;
			this.rail.style.setProperty("--tile-font", this.style.getPropertyValue("--tile-font"));
		}
	}

	setBoardSize(n: number, m: number): void {
		this.innerHTML = "";
		this.tiles.clear();
		this.cells.clear();
		this.last.clear();
		this.handles.clear();
		this.handleDrag = null;

		this.rail = document.createElement("div");
		this.rail.className = "lift-rail";
		this.rail.setAttribute("aria-hidden", "true");
		this.appendChild(this.rail);

		for (let r = 0; r < n; r++) {
			for (let c = 0; c < m; c++) {
				const tile = document.createElement("div");
				tile.className = "tile";
				tile.dataset.row = String(r);
				const cell = document.createElement("div");
				cell.className = "cell";
				tile.appendChild(cell);
				this.appendChild(tile);
				const key = `${r}:${c}`;
				this.tiles.set(key, tile);
				this.cells.set(key, cell);
			}
		}

		this.liftTiles.clear();
		this.liftCells.clear();
		this.lastLift.clear();
		for (let c = 0; c < m; c++) {
			const tile = document.createElement("div");
			tile.className = "tile lift";
			const cell = document.createElement("div");
			cell.className = "cell lift";
			tile.appendChild(cell);
			this.rail.appendChild(tile);
			this.liftTiles.set(c, tile);
			this.liftCells.set(c, cell);
		}

		for (let r = 0; r < n; r++) {
			const handle = document.createElement("button");
			handle.type = "button";
			handle.className = "row-handle";
			handle.dataset.row = String(r);
			handle.setAttribute("aria-label", `Drag row ${r + 1} to reorder`);
			handle.title = `Drag row ${r + 1} to reorder`;
			handle.textContent = "⠿";
			this.appendChild(handle);
			this.handles.set(r, handle);
		}

		this.layout(n, m);
	}

	render(view: BoardView): void {
		const n = view.order.length;
		const m = view.rows.length === 0 ? 0 : view.rows[0].length;
		this.order = view.order.slice();
		if (this.tiles.size !== n * m || this.liftTiles.size !== m) this.setBoardSize(n, m);
		this.layout(n, m);

		const lift = view.lift;
		this.lift = lift;
		if (this.rail) {
			this.rail.classList.toggle("active", !!lift);
			const railW = lift ? m * this.tileW + (m + 1) * this.gap : 0;
			this.rail.style.width = `${railW}px`;
		}

		for (const [ key, tile ] of this.tiles) {
			const [ r, c ] = key.split(":").map(Number);
			const pos = view.order.indexOf(r);
			const x = this.gap + c * (this.tileW + this.gap);
			const y = this.gap + pos * (this.tileH + this.gap);
			tile.style.width = `${this.tileW}px`;
			tile.style.height = `${this.tileH}px`;
			tile.style.transform = `translate(${x}px, ${y}px)`;

			const cell = this.cells.get(key)!;
			this.paintValue(cell, view.rows[r][c], key, this.last);

			cell.classList.remove("cursor", "src", "target");
			if (lift) {
				cell.classList.toggle("src", pos === lift.sourcePos);
				cell.classList.toggle("target", pos === lift.targetPos);
			} else {
				cell.classList.toggle("cursor", pos === view.cursorPos);
			}
			cell.classList.toggle("hint", view.hintRows !== null && view.hintRows.includes(pos));
		}

		const boardW = m * this.tileW + (m + 1) * this.gap;
		for (const [ rowId, handle ] of this.handles) {
			const pos = view.order.indexOf(rowId);
			if (pos < 0) continue;
			handle.style.width = "44px";
			handle.style.height = `${this.tileH}px`;
			handle.style.transform = `translate(${boardW + 4}px, ${this.gap + pos * (this.tileH + this.gap)}px)`;
			handle.dataset.pos = String(pos);
			handle.classList.toggle("hidden", !!lift);
		}

		if (this.rail && lift) {
			const src = view.rows[lift.sourceId];
			for (const [ c, tile ] of this.liftTiles) {
				const x = this.gap + c * (this.tileW + this.gap);
				const y = this.gap + lift.targetPos * (this.tileH + this.gap);
				tile.style.width = `${this.tileW}px`;
				tile.style.height = `${this.tileH}px`;
				tile.style.transform = `translate(${x}px, ${y}px)`;
				const cell = this.liftCells.get(c)!;
				this.paintValue(cell, src[c].mul(lift.factor), String(c), this.lastLift);
			}
		}
	}

	private paintValue(cell: HTMLElement, val: Rational, key: string, last: Map<string, string>): void {
		const html = fracHTML(val);
		if (last.get(key) !== html) {
			cell.innerHTML = html;
			last.set(key, html);
			cell.classList.remove("pop");
			void cell.offsetWidth; // restart the pop animation
			cell.classList.add("pop");
		}

		cell.classList.toggle("zero", val.isZero());
		for (let t = 0; t <= 11; t++) {
			cell.classList.remove(`pos-${t}`, `neg-${t}`);
		}
		if (!val.isZero()) {
			const sign = val.n < 0n ? "neg" : "pos";
			cell.classList.add(`${sign}-${tierOf(val)}`);
		}
	}

	private emit(name: string, detail: unknown): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
	}

	private readonly onPointerDown = (e: PointerEvent): void => {
		if (this.hasAttribute("disabled")) return;
		const target = e.target as HTMLElement;
		const handle = target.closest<HTMLElement>(".row-handle");
		if (handle) {
			if (this.lift) return;
			const rowId = Number(handle.dataset.row);
			const pos = this.order.indexOf(rowId);
			if (!Number.isFinite(rowId) || pos < 0) return;
			this.down = null;
			this.setPointerCapture(e.pointerId);
			this.handleDrag = {
				pointerId: e.pointerId,
				rowId,
				startY: e.clientY,
				startPos: pos,
				currentPos: pos,
				step: this.tileH + this.gap,
				moved: false,
			};
			handle.classList.add("dragging");
			e.preventDefault();
			return;
		}
		// The rail is a child of the board, so it shares this gesture surface;
		// only its pointer-events need toggling when a row is lifted.
		if (target.closest(".lift-rail")) {
			if (!this.lift) return;
			this.down = {
				x: e.clientX,
				y: e.clientY,
				pos: this.lift.targetPos,
				id: e.pointerId,
				fromRail: true,
			};
			this.swiped = false;
			return;
		}
		const tile = target.closest<HTMLElement>(".tile");
		if (!tile) return;
		const rowId = Number(tile.dataset.row);
		if (!Number.isFinite(rowId)) return;
		this.down = {
			x: e.clientX,
			y: e.clientY,
			pos: this.order.indexOf(rowId),
			id: e.pointerId,
			fromRail: false,
		};
		this.swiped = false;
	};

	private readonly onPointerMove = (e: PointerEvent): void => {
		if (this.handleDrag && e.pointerId === this.handleDrag.pointerId) {
			const drag = this.handleDrag;
			const targetPos = Math.max(0, Math.min(
				this.order.length - 1,
				drag.startPos + Math.round((e.clientY - drag.startY) / drag.step),
			));
			if (targetPos !== drag.currentPos) {
				drag.moved = true;
				while (drag.currentPos !== targetPos) {
					const direction = targetPos > drag.currentPos ? 1 : -1;
					drag.currentPos += direction;
					this.emit("row-reorder", { rowId: drag.rowId, direction });
				}
			}
			e.preventDefault();
			return;
		}
		if (!this.down || e.pointerId !== this.down.id) return;
		const dy = e.clientY - this.down.y;
		const dx = e.clientX - this.down.x;
		const ay = Math.abs(dy);
		const ax = Math.abs(dx);
		if (!this.swiped && ay > 18 && ay > ax * 1.5) {
			this.swiped = true;
			this.emit("row-swipe", { pos: this.down.pos, direction: dy < 0 ? "up" : "down", fromRail: this.down.fromRail });
		} else if (!this.swiped && ax > 18 && ax > ay * 1.5) {
			this.swiped = true;
			this.emit("row-swipe", { pos: this.down.pos, direction: dx < 0 ? "left" : "right", fromRail: this.down.fromRail });
		}
	};

	private readonly onPointerUp = (e: PointerEvent): void => {
		if (this.handleDrag && e.pointerId === this.handleDrag.pointerId) {
			const drag = this.handleDrag;
			this.handleDrag = null;
			this.handles.get(drag.rowId)?.classList.remove("dragging");
			if (this.hasPointerCapture(e.pointerId)) this.releasePointerCapture(e.pointerId);
			if (!drag.moved) this.emit("row-tap", { pos: this.order.indexOf(drag.rowId) });
			return;
		}
		if (!this.down || e.pointerId !== this.down.id) return;
		if (!this.swiped && !this.down.fromRail) this.emit("row-tap", { pos: this.down.pos });
		this.down = null;
	};

	private readonly onPointerCancel = (e: PointerEvent): void => {
		if (this.handleDrag && e.pointerId === this.handleDrag.pointerId) {
			this.handles.get(this.handleDrag.rowId)?.classList.remove("dragging");
			this.handleDrag = null;
			return;
		}
		if (this.down && e.pointerId === this.down.id) this.down = null;
	};
}
