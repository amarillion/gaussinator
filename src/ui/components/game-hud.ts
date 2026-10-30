import { Game } from "../../game/state";

function kLabel(game: Game): string {
	return game.k.toString().replace("-", "−");
}

/**
 * `<game-hud>` — the status strip under the board: mode label, REF badge,
 * and the hint box.
 */
export class GameHud extends HTMLElement {
	private modeEl: HTMLElement | null = null;
	private badgeEl: HTMLElement | null = null;
	private hintEl: HTMLElement | null = null;

	connectedCallback(): void {
		this.innerHTML = `
			<div class="mode-label"></div>
			<div class="badge"></div>
			<div class="hint-box hidden"></div>
		`;
		this.modeEl = this.querySelector(".mode-label");
		this.badgeEl = this.querySelector(".badge");
		this.hintEl = this.querySelector(".hint-box");
	}

	update(game: Game): void {
		if (this.modeEl) {
			if (game.lift) {
				this.modeEl.textContent = `Lift row ${game.lift.sourcePos + 1} × ${game.lift.factor.toString().replace("-", "−")} → row ${game.lift.targetPos + 1} — right dial, Enter to add, Esc to cancel`;
				this.modeEl.className = "mode-label lift";
			} else {
				this.modeEl.textContent = `Scale row ${game.cursorPos + 1} × ${kLabel(game)} — left dial applies immediately`;
				this.modeEl.className = "mode-label scale";
			}
		}

		if (this.badgeEl) {
			if (game.won) {
				this.badgeEl.textContent = "Reduced row echelon form achieved! 🎉";
				this.badgeEl.className = "badge win";
			} else if (game.isREF()) {
				this.badgeEl.textContent = "Row echelon form ✓ — now make the pivots 1 and clear above them.";
				this.badgeEl.className = "badge ref";
			} else {
				this.badgeEl.textContent = "";
				this.badgeEl.className = "badge";
			}
		}
	}

	setHint(text: string | null): void {
		if (!this.hintEl) return;
		this.hintEl.textContent = text ?? "";
		this.hintEl.classList.toggle("hidden", !text);
	}
}
