import { Game } from "../../game/state";

/**
 * `<game-stats>` — the header stat tiles (level, moves, par, best).
 */
export class GameStats extends HTMLElement {
	private values = new Map<string, HTMLElement>();

	connectedCallback(): void {
		this.innerHTML = `
			<div class="stat"><span>Level</span><strong data-stat="level">1</strong></div>
			<div class="stat"><span>Moves</span><strong data-stat="moves">0</strong></div>
			<div class="stat"><span>Par</span><strong data-stat="par">—</strong></div>
			<div class="stat"><span>Best</span><strong data-stat="best">—</strong></div>
		`;
		this.values.clear();
		this.querySelectorAll<HTMLElement>("[data-stat]").forEach(el => {
			this.values.set(el.dataset.stat ?? "", el);
		});
	}

	update(game: Game): void {
		this.set("level", String(game.levelIndex + 1));
		this.set("moves", String(game.moves));
		this.set("par", String(game.par));
		this.set("best", game.best === null ? "—" : String(game.best));
	}

	private set(key: string, text: string): void {
		const el = this.values.get(key);
		if (el) el.textContent = text;
	}
}
