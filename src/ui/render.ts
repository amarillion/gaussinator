import { Game, K_TILES } from "../game/state";
import { Rational } from "../math/rational";

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

function setText(id: string, text: string): void {
	const el = document.getElementById(id);
	if (el) el.textContent = text;
}

function kLabel(game: Game): string {
	return game.k.toString().replace("-", "−");
}

export class Renderer {
	private board: HTMLElement;
	private rail: HTMLElement | null;
	private factorTiles: HTMLElement[] = [];
	private lastRailIndex = -1;
	private tiles = new Map<string, HTMLElement>();
	private cells = new Map<string, HTMLElement>();
	private liftTiles = new Map<number, HTMLElement>();
	private liftCells = new Map<number, HTMLElement>();
	private last = new Map<string, string>();
	private lastLift = new Map<string, string>();
	private tileW = 60;
	private tileH = 54;
	private gap = 8;

	constructor(board: HTMLElement) {
		this.board = board;
		this.rail = document.getElementById("lift-rail");
		this.buildFactorRail();
	}

	private buildFactorRail(): void {
		const rail = document.getElementById("k-tiles");
		if (!rail) return;
		rail.innerHTML = "";
		this.factorTiles = [];
		for (let i = 0; i < K_TILES.length; i++) {
			const tile = document.createElement("button");
			tile.type = "button";
			tile.className = "k-tile";
			tile.dataset.kIndex = String(i);
			tile.textContent = K_TILES[i].toString();
			rail.appendChild(tile);
			this.factorTiles.push(tile);
		}
	}

	layout(n: number, m: number): void {
		const maxW = Math.min(window.innerWidth * 0.94, 560);
		const maxH = Math.max(240, window.innerHeight - 330);
		const tw = Math.max(44, Math.min(maxW / m, maxH / n, 108));
		const th = Math.round(tw * 0.92);
		this.gap = Math.max(4, Math.round(tw * 0.12));
		this.tileW = Math.floor(tw);
		this.tileH = th;
		this.board.style.width = `${m * this.tileW + (m + 1) * this.gap}px`;
		this.board.style.height = `${n * this.tileH + (n + 1) * this.gap}px`;
		this.board.style.setProperty("--tile-font", `${Math.max(13, Math.floor(this.tileW * 0.38))}px`);
		if (this.rail) {
			this.rail.style.height = this.board.style.height;
			this.rail.style.setProperty("--tile-font", this.board.style.getPropertyValue("--tile-font"));
		}
		const rail = document.getElementById("factor-rail");
		if (rail) {
			const boardH = n * this.tileH + (n + 1) * this.gap;
			const railTileH = Math.max(14, Math.min(28, Math.floor((boardH - 16 * 2) / K_TILES.length)));
			rail.style.setProperty("--rail-tile-h", `${railTileH}px`);
			rail.style.setProperty("--rail-font", `${Math.max(9, Math.floor(railTileH * 0.72))}px`);
		}
	}

	setBoardSize(n: number, m: number): void {
		this.board.innerHTML = "";
		this.tiles.clear();
		this.cells.clear();
		this.last.clear();
		for (let r = 0; r < n; r++) {
			for (let c = 0; c < m; c++) {
				const tile = document.createElement("div");
				tile.className = "tile";
				const cell = document.createElement("div");
				cell.className = "cell";
				tile.appendChild(cell);
				this.board.appendChild(tile);
				const key = `${r}:${c}`;
				this.tiles.set(key, tile);
				this.cells.set(key, cell);
			}
		}
		if (this.rail) {
			this.rail.innerHTML = "";
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
		}
		this.layout(n, m);
	}

	render(game: Game, hintRows: number[] | null): void {
		const n = game.n;
		const m = game.m;
		if (this.tiles.size !== n * m) this.setBoardSize(n, m);
		this.layout(n, m);

		const lift = game.lift;
		if (this.rail) {
			const railW = lift ? m * this.tileW + (m + 1) * this.gap : 0;
			this.rail.style.width = `${railW}px`;
		}

		for (const [ key, tile ] of this.tiles) {
			const [ r, c ] = key.split(":").map(Number);
			const pos = game.order.indexOf(r);
			const x = this.gap + c * (this.tileW + this.gap);
			const y = this.gap + pos * (this.tileH + this.gap);
			tile.style.width = `${this.tileW}px`;
			tile.style.height = `${this.tileH}px`;
			tile.style.transform = `translate(${x}px, ${y}px)`;

			const cell = this.cells.get(key)!;
			this.paintValue(cell, game.rows[r][c], key, this.last);

			cell.classList.remove("cursor", "src", "target", "scale");
			if (lift) {
				cell.classList.toggle("src", pos === lift.sourcePos);
				cell.classList.toggle("target", pos === lift.targetPos);
			} else {
				cell.classList.toggle("cursor", pos === game.cursorPos);
				cell.classList.toggle("scale", game.pendingScale && pos === game.cursorPos);
			}
			cell.classList.toggle("hint", hintRows !== null && hintRows.includes(pos));
		}

		if (this.rail && lift) {
			const src = game.rows[lift.sourceId];
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

		this.updateFactorRail(game);
		this.updateModeLabel(game);
		this.updateStats(game);
		this.updateBadge(game);
	}

	private updateFactorRail(game: Game): void {
		for (let i = 0; i < this.factorTiles.length; i++) {
			const tile = this.factorTiles[i];
			const sel = i === game.kIndex;
			tile.classList.toggle("sel", sel);
			tile.classList.toggle("neg", sel && game.kNegative);
			if (sel || i === this.lastRailIndex) {
				const label = (sel && game.kNegative ? "−" : "") + K_TILES[i].toString();
				tile.textContent = label;
			}
		}
		this.lastRailIndex = game.kIndex;
		const sign = document.getElementById("k-sign");
		if (sign) sign.textContent = game.kNegative ? "−" : "±";
	}

	private updateModeLabel(game: Game): void {
		const el = document.getElementById("mode-label");
		if (!el) return;
		if (game.pendingScale) {
			el.textContent = `Scale row ${game.cursorPos + 1} by ${kLabel(game)} — Enter to apply, Esc to cancel`;
			el.className = "mode-label scale";
		} else if (game.lift) {
			el.textContent = `Lift row ${game.lift.sourcePos + 1} × ${kLabel(game)} → row ${game.lift.targetPos + 1} — Enter to add, Esc to cancel`;
			el.className = "mode-label lift";
		} else {
			el.textContent = `k = ${kLabel(game)}`;
			el.className = "mode-label";
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

	private updateStats(game: Game): void {
		setText("level-label", String(game.levelIndex + 1));
		setText("size-label", `${game.n}×${game.m}`);
		setText("moves-label", String(game.moves));
		setText("par-label", String(game.par));
		setText("best-label", game.best === null ? "—" : String(game.best));
	}

	private updateBadge(game: Game): void {
		const el = document.getElementById("badge");
		if (!el) return;
		if (game.won) {
			el.textContent = "Reduced row echelon form achieved! 🎉";
			el.className = "badge win";
		} else if (game.isREF()) {
			el.textContent = "Row echelon form ✓ — now make the pivots 1 and clear above them.";
			el.className = "badge ref";
		} else {
			el.textContent = "";
			el.className = "badge";
		}
	}

	setHint(text: string | null): void {
		const el = document.getElementById("hint-box");
		if (!el) return;
		el.textContent = text ?? "";
		el.classList.toggle("hidden", !text);
	}

	showWin(stars: number, moves: number, par: number, best: number | null, isNewBest: boolean): void {
		const ov = document.getElementById("win-overlay");
		if (!ov) return;
		setText("win-stars", "★".repeat(stars) + "☆".repeat(3 - stars));
		setText("win-moves", `${moves} moves (par ${par})`);
		setText("win-best", best === null ? "" : `Best: ${best}${isNewBest ? " — new record!" : ""}`);
		ov.classList.remove("hidden");
	}

	hideWin(): void {
		document.getElementById("win-overlay")?.classList.add("hidden");
	}
}
