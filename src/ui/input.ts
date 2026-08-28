import { Game } from "../game/state";
import { sfx } from "../audio";

export interface InputContext {
	getGame(): Game,
	afterAction(): void,
	nextLevel(): void,
	restartLevel(): void,
	showHint(): void,
	showTutorial(): void,
	toggleSound(): void,
}

export function setupInput(ctx: InputContext): void {
	setupKeyboard(ctx);
	setupButtons(ctx);
	setupBoardTouch(ctx);
}

function setupKeyboard(ctx: InputContext): void {
	window.addEventListener("keydown", e => {
		const game = ctx.getGame();
		const key = e.key;

		if (game.won) {
			if (key === "Enter" || key === " ") {
				e.preventDefault();
				ctx.nextLevel();
			}
			return;
		}

		if (key === " ") e.preventDefault();
		if (key === "Backspace" || key === "/") e.preventDefault();

		// Multiplier rail selection
		if (key === "PageUp") {
			game.moveK(-1);
			sfx.select();
			e.preventDefault();
			ctx.afterAction();
			return;
		}
		if (key === "PageDown") {
			game.moveK(1);
			sfx.select();
			e.preventDefault();
			ctx.afterAction();
			return;
		}
		if (key === "-") {
			game.toggleKSign();
			sfx.select();
			e.preventDefault();
			ctx.afterAction();
			return;
		}

		if (key === "Escape") {
			if (game.pendingScale) {
				game.cancelScaleMode();
				sfx.select();
			} else if (game.lift) {
				game.cancelLift();
				sfx.select();
			} else {
				game.resetK();
			}
			e.preventDefault();
			ctx.afterAction();
			return;
		}
		if (key === "c" || key === "C") {
			game.cancelLift();
			game.cancelScaleMode();
			game.resetK();
			e.preventDefault();
			ctx.afterAction();
			return;
		}

		// Cursor movement / row swap / lift alignment
		if (key === "ArrowUp" || key === "k" || key === "K") {
			e.preventDefault();
			if (game.lift) {
				game.moveLift(-1);
				sfx.select();
			} else if (e.shiftKey) {
				if (game.pendingScale) {
					sfx.invalid();
				} else if (game.swapCursor(-1)) {
					sfx.move();
				} else {
					sfx.invalid();
				}
			} else {
				game.moveCursor(-1);
				sfx.select();
			}
			ctx.afterAction();
			return;
		}
		if (key === "ArrowDown" || key === "j" || key === "J") {
			e.preventDefault();
			if (game.lift) {
				game.moveLift(1);
				sfx.select();
			} else if (e.shiftKey) {
				if (game.pendingScale) {
					sfx.invalid();
				} else if (game.swapCursor(1)) {
					sfx.move();
				} else {
					sfx.invalid();
				}
			} else {
				game.moveCursor(1);
				sfx.select();
			}
			ctx.afterAction();
			return;
		}

		// Lift a copy of the selected row out to the right
		if (key === "ArrowRight") {
			e.preventDefault();
			if (game.liftRow()) sfx.lift();
			else sfx.invalid();
			ctx.afterAction();
			return;
		}
		// Left arrow returns the lifted row (cancels the lift)
		if (key === "ArrowLeft") {
			e.preventDefault();
			if (game.lift) {
				game.cancelLift();
				sfx.select();
				ctx.afterAction();
			}
			return;
		}

		// In-place scaling mode: M starts it, Enter applies, Esc cancels.
		if (key === "m" || key === "M" || key === "*") {
			if (game.lift) {
				sfx.invalid();
			} else if (game.startScaleMode()) {
				sfx.select();
			} else {
				sfx.invalid();
			}
			ctx.afterAction();
			return;
		}
		if (key === "Enter" || key === " ") {
			if (game.pendingScale) {
				if (game.applyScale()) sfx.scale();
				else sfx.invalid();
				ctx.afterAction();
				return;
			}
			if (game.lift) {
				e.preventDefault();
				if (game.applyLift()) sfx.combine();
				else sfx.invalid();
				ctx.afterAction();
				return;
			}
		}

		// Utility
		if (key === "u" || key === "U") {
			if (game.undo()) sfx.move();
			else sfx.invalid();
			ctx.afterAction();
			return;
		}
		if (key === "h" || key === "H") {
			ctx.showHint();
			return;
		}
		if (key === "r" || key === "R") {
			ctx.restartLevel();
			return;
		}
		if (key === "?") {
			ctx.showTutorial();
			return;
		}
	});
}

function on(id: string, fn: () => void): void {
	document.getElementById(id)?.addEventListener("click", fn);
}

function setupButtons(ctx: InputContext): void {
	on("btn-scale", () => {
		const g = ctx.getGame();
		if (g.pendingScale) {
			if (g.applyScale()) sfx.scale();
			else sfx.invalid();
		} else if (g.lift) {
			sfx.invalid();
		} else if (g.startScaleMode()) {
			sfx.select();
		} else {
			sfx.invalid();
		}
		ctx.afterAction();
	});
	on("btn-lift", () => {
		const g = ctx.getGame();
		if (g.liftRow()) sfx.lift();
		else sfx.invalid();
		ctx.afterAction();
	});
	on("btn-swap-up", () => {
		const g = ctx.getGame();
		if (g.lift) {
			g.moveLift(-1);
			sfx.select();
		} else if (g.pendingScale) {
			sfx.invalid();
		} else {
			if (g.swapCursor(-1)) sfx.move();
			else sfx.invalid();
		}
		ctx.afterAction();
	});
	on("btn-swap-down", () => {
		const g = ctx.getGame();
		if (g.lift) {
			g.moveLift(1);
			sfx.select();
		} else if (g.pendingScale) {
			sfx.invalid();
		} else {
			if (g.swapCursor(1)) sfx.move();
			else sfx.invalid();
		}
		ctx.afterAction();
	});
	on("btn-undo", () => {
		const g = ctx.getGame();
		if (g.undo()) sfx.move();
		else sfx.invalid();
		ctx.afterAction();
	});
	on("btn-hint", () => ctx.showHint());
	on("btn-restart", () => ctx.restartLevel());
	on("btn-next", () => ctx.nextLevel());
	on("btn-tutorial", () => ctx.showTutorial());
	on("btn-sound", () => ctx.toggleSound());
	on("k-sign", () => {
		ctx.getGame().toggleKSign();
		sfx.select();
		ctx.afterAction();
	});

	const rail = document.getElementById("k-tiles");
	if (rail) {
		rail.addEventListener("click", e => {
			const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-k-index]");
			if (!btn) return;
			ctx.getGame().setKIndex(Number(btn.dataset.kIndex));
			sfx.select();
			ctx.afterAction();
		});
	}
}

function setupBoardTouch(ctx: InputContext): void {
	const board = document.getElementById("board");
	if (!board) return;

	let down: { x: number, y: number, pos: number, id: number } | null = null;
	let swiped = false;

	board.addEventListener("pointerdown", e => {
		const g = ctx.getGame();
		if (g.won) return;
		const tile = (e.target as HTMLElement).closest<HTMLElement>(".tile");
		if (!tile) return;
		const rowId = Number(tile.dataset.row);
		const pos = g.order.indexOf(rowId);
		down = { x: e.clientX, y: e.clientY, pos, id: e.pointerId };
		swiped = false;
	});

	board.addEventListener("pointermove", e => {
		if (!down || e.pointerId !== down.id) return;
		const dy = e.clientY - down.y;
		const dx = e.clientX - down.x;
		if (!swiped && Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 1.5) {
			swiped = true;
			const g = ctx.getGame();
			if (!g.won) {
				if (g.lift) {
					g.moveLift(dy < 0 ? -1 : 1);
					sfx.select();
				} else if (!g.pendingScale) {
					g.cursorPos = down.pos;
					if (g.swapCursor(dy < 0 ? -1 : 1)) sfx.move();
					else sfx.invalid();
				} else {
					sfx.invalid();
				}
				ctx.afterAction();
			}
		}
	});

	const finish = (e: PointerEvent): void => {
		if (!down || e.pointerId !== down.id) return;
		const g = ctx.getGame();
		if (!swiped && !g.won) {
			if (g.lift) {
				if (g.lift.sourcePos === down.pos) {
					g.cancelLift();
					sfx.select();
				} else {
					g.setLiftTarget(down.pos);
					if (g.applyLift()) sfx.combine();
					else sfx.invalid();
				}
			} else {
				g.cursorPos = down.pos;
				sfx.select();
			}
			ctx.afterAction();
		}
		down = null;
	};

	board.addEventListener("pointerup", finish);
	board.addEventListener("pointercancel", () => {
		down = null;
	});
}
