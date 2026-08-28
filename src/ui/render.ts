import { Game } from "../game/state";

function setText(id: string, text: string): void {
	const el = document.getElementById(id);
	if (el) el.textContent = text;
}

function kLabel(game: Game): string {
	return game.k.toString().replace("-", "−");
}

/**
 * HUD renderer: mode label, stats, badge, hint box, and the win overlay.
 * The board itself is rendered by `<rref-board>`.
 */
export class Renderer {
	renderHud(game: Game): void {
		this.updateModeLabel(game);
		this.updateStats(game);
		this.updateBadge(game);
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
