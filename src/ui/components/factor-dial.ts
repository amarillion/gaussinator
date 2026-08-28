import { K_CENTER_INDEX, K_TILES } from "../../game/state";

const LABELS: readonly string[] = K_TILES.map(r => r.toString());

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

/**
 * `<factor-dial>` — the left multiplier column.
 *
 * A draggable vertical dial over the factor tiles: drag up/down to scrub,
 * tap a tile to jump to it, and the ± button toggles the sign. The component
 * owns its DOM and pointer gesture entirely; it reports user input as
 * `factor-change` / `factor-sign` events and receives the current selection
 * through `setSelection(index, negative)`.
 */
export class FactorDial extends HTMLElement {
	private tiles: HTMLButtonElement[] = [];
	private tilesEl: HTMLElement | null = null;
	private signBtn: HTMLButtonElement | null = null;
	private handle: HTMLElement | null = null;

	private index = K_CENTER_INDEX;
	private negative = false;
	private lastIndex = K_CENTER_INDEX;

	private pointerId = -1;
	private startY = 0;
	private startIndex = K_CENTER_INDEX;
	private moved = false;
	private suppressClick = false;
	private resizeObserver: ResizeObserver | null = null;

	connectedCallback(): void {
		this.innerHTML = `
			<button class="k-sign" type="button" title="Toggle negative factor (minus key)">±</button>
			<div class="k-tiles-wrap">
				<div class="k-tiles"></div>
				<div class="k-dial-handle" aria-hidden="true"></div>
			</div>
		`;

		this.signBtn = this.querySelector<HTMLButtonElement>(".k-sign");
		this.tilesEl = this.querySelector<HTMLElement>(".k-tiles");
		this.handle = this.querySelector<HTMLElement>(".k-dial-handle");
		this.tiles = [];

		if (this.tilesEl) {
			for (let i = 0; i < K_TILES.length; i++) {
				const tile = document.createElement("button");
				tile.type = "button";
				tile.className = "k-tile";
				tile.dataset.kIndex = String(i);
				tile.textContent = LABELS[i];
				this.tilesEl.appendChild(tile);
				this.tiles.push(tile);
			}
		}

		this.signBtn?.addEventListener("click", this.onSignClick);
		this.addEventListener("pointerdown", this.onPointerDown);
		this.addEventListener("pointermove", this.onPointerMove);
		this.addEventListener("pointerup", this.onPointerEnd);
		this.addEventListener("pointercancel", this.onPointerEnd);
		this.addEventListener("click", this.onClick);

		if (this.tilesEl) {
			this.resizeObserver = new ResizeObserver(() => this.updateFont());
			this.resizeObserver.observe(this.tilesEl);
		}

		this.render();
	}

	disconnectedCallback(): void {
		this.signBtn?.removeEventListener("click", this.onSignClick);
		this.removeEventListener("pointerdown", this.onPointerDown);
		this.removeEventListener("pointermove", this.onPointerMove);
		this.removeEventListener("pointerup", this.onPointerEnd);
		this.removeEventListener("pointercancel", this.onPointerEnd);
		this.removeEventListener("click", this.onClick);
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	/** Programmatic data-down: update the highlighted tile and sign. */
	setSelection(index: number, negative: boolean): void {
		this.index = clamp(Math.round(index), 0, K_TILES.length - 1);
		this.negative = negative;
		this.render();
	}

	private render(): void {
		for (let i = 0; i < this.tiles.length; i++) {
			const tile = this.tiles[i];
			const sel = i === this.index;
			tile.classList.toggle("sel", sel);
			tile.classList.toggle("neg", sel && this.negative);
			if (sel || i === this.lastIndex) {
				tile.textContent = (sel && this.negative ? "−" : "") + LABELS[i];
			}
		}
		this.lastIndex = this.index;

		if (this.signBtn) this.signBtn.textContent = this.negative ? "−" : "±";

		const tile = this.tiles[this.index];
		if (this.handle && tile) {
			this.handle.style.top = `${tile.offsetTop}px`;
			this.handle.style.height = `${tile.offsetHeight}px`;
		}
	}

	private updateFont(): void {
		if (!this.tilesEl) return;
		const total = this.tilesEl.clientHeight;
		const gaps = 2 * (K_TILES.length - 1);
		const tileH = Math.max(12, (total - gaps) / K_TILES.length);
		this.style.setProperty("--rail-font", `${Math.max(9, Math.floor(tileH * 0.72))}px`);
	}

	private step(): number {
		const tile = this.tiles[0];
		return tile ? tile.offsetHeight + 2 : 20; // tile height + .k-tiles gap
	}

	private emit(name: string, detail?: unknown): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
	}

	private readonly onSignClick = (): void => {
		this.negative = !this.negative;
		this.render();
		this.emit("factor-sign");
	};

	private readonly onPointerDown = (e: PointerEvent): void => {
		if ((e.target as HTMLElement).closest(".k-sign")) return;
		this.pointerId = e.pointerId;
		this.startY = e.clientY;
		this.startIndex = this.index;
		this.moved = false;
		this.suppressClick = false;
		this.handle?.classList.add("dragging");
		e.preventDefault();
	};

	private readonly onPointerMove = (e: PointerEvent): void => {
		if (this.pointerId === -1 || e.pointerId !== this.pointerId) return;
		const index = clamp(Math.round(this.startIndex + (e.clientY - this.startY) / this.step()), 0, K_TILES.length - 1);
		if (index !== this.index) {
			this.index = index;
			this.moved = true;
			this.render();
			this.emit("factor-change", { index });
		}
		e.preventDefault();
	};

	private readonly onPointerEnd = (e: PointerEvent): void => {
		if (e.pointerId !== this.pointerId) return;
		this.pointerId = -1;
		this.suppressClick = this.moved;
		this.handle?.classList.remove("dragging");
	};

	private readonly onClick = (e: MouseEvent): void => {
		if (this.suppressClick) {
			this.suppressClick = false;
			return;
		}
		const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-k-index]");
		if (!btn) return;
		const index = Number(btn.dataset.kIndex);
		this.index = index;
		this.render();
		this.emit("factor-change", { index });
	};
}
