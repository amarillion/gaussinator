import { Game, computeStars } from "../../game/state";
import { getHint } from "../../game/hint";
import { setSound, sfx } from "../../audio";
import type { FactorDial } from "./factor-dial";
import type { RrefBoard } from "./rref-board";
import type { GameHud } from "./game-hud";
import type { GameStats } from "./game-stats";
import type { WinOverlay } from "./win-overlay";
import type { TutorialOverlay } from "./tutorial-overlay";

/**
 * `<game-app>` — the root controller component.
 *
 * Owns the Game instance and wires the child view components
 * (`<rref-board>`, `<factor-dial>`, `<game-hud>`, `<game-stats>`, and the
 * overlays) to it. Children report user intent through custom events; the
 * app mutates `Game` and pushes a fresh view model down in `afterAction()`.
 */
export class GameApp extends HTMLElement {
	private readonly seedBase = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;

	private game!: Game;
	private hintRows: number[] | null = null;
	private lastMoves = 0;
	private soundOn = true;

	private board!: RrefBoard;
	private dial: FactorDial | null = null;
	private hud!: GameHud;
	private stats!: GameStats;
	private winOverlay!: WinOverlay;
	private tutorialOverlay!: TutorialOverlay;
	private sizeLabel!: HTMLElement;
	private soundBtn!: HTMLButtonElement;

	connectedCallback(): void {
		this.board = this.querySelector<RrefBoard>("rref-board")!;
		this.dial = this.querySelector<FactorDial>("factor-dial");
		this.hud = this.querySelector<GameHud>("game-hud")!;
		this.stats = this.querySelector<GameStats>("game-stats")!;
		this.winOverlay = this.querySelector<WinOverlay>("win-overlay")!;
		this.tutorialOverlay = this.querySelector<TutorialOverlay>("tutorial-overlay")!;
		this.sizeLabel = this.querySelector<HTMLElement>("#size-label")!;
		this.soundBtn = this.querySelector<HTMLButtonElement>("#btn-sound")!;

		this.setupSound();
		this.setupTutorial();
		this.bindButtons();
		this.wireEvents();
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("resize", this.onResize);
		this.startLevel(0);
	}

	disconnectedCallback(): void {
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("resize", this.onResize);
	}

	// ---------------------------------------------------------------- setup

	private setupSound(): void {
		try {
			this.soundOn = localStorage.getItem("rref.sound") !== "off";
		} catch {
			this.soundOn = true;
		}
		setSound(this.soundOn);
		this.soundBtn.textContent = this.soundOn ? "🔊" : "🔇";
	}

	private setupTutorial(): void {
		this.tutorialOverlay.addEventListener("close", this.onTutorialClose);
		try {
			if (localStorage.getItem("rref.tutorialSeen") !== "1") this.tutorialOverlay.show();
			else this.tutorialOverlay.hide();
		} catch {
			this.tutorialOverlay.hide();
		}
	}

	private bindButtons(): void {
		this.bind("btn-scale", () => {
			const g = this.game;
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
			this.afterAction();
		});
		this.bind("btn-lift", () => {
			if (this.game.liftRow()) sfx.lift();
			else sfx.invalid();
			this.afterAction();
		});
		this.bind("btn-swap-up", () => {
			const g = this.game;
			if (g.lift) {
				g.moveLift(-1);
				sfx.select();
			} else if (g.pendingScale) {
				sfx.invalid();
			} else {
				if (g.swapCursor(-1)) sfx.move();
				else sfx.invalid();
			}
			this.afterAction();
		});
		this.bind("btn-swap-down", () => {
			const g = this.game;
			if (g.lift) {
				g.moveLift(1);
				sfx.select();
			} else if (g.pendingScale) {
				sfx.invalid();
			} else {
				if (g.swapCursor(1)) sfx.move();
				else sfx.invalid();
			}
			this.afterAction();
		});
		this.bind("btn-undo", () => {
			if (this.game.undo()) sfx.move();
			else sfx.invalid();
			this.afterAction();
		});
		this.bind("btn-hint", () => this.showHint());
		this.bind("btn-restart", () => this.restartLevel());
		this.bind("btn-tutorial", () => this.tutorialOverlay.show());
		this.bind("btn-sound", () => this.toggleSound());
	}

	private wireEvents(): void {
		this.dial?.addEventListener("factor-change", e => {
			if (this.game.won) return;
			this.game.setKIndex((e as CustomEvent<{ index: number }>).detail.index);
			this.afterAction();
		});
		this.dial?.addEventListener("factor-sign", () => {
			if (this.game.won) return;
			this.game.toggleKSign();
			this.afterAction();
		});

		this.board.addEventListener("row-tap", e => {
			if (this.game.won) return;
			const pos = (e as CustomEvent<{ pos: number }>).detail.pos;
			if (this.game.lift) {
				if (this.game.lift.sourcePos === pos) {
					this.game.cancelLift();
					sfx.select();
				} else {
					this.game.setLiftTarget(pos);
					if (this.game.applyLift()) sfx.combine();
					else sfx.invalid();
				}
			} else {
				this.game.cursorPos = pos;
				sfx.select();
			}
			this.afterAction();
		});
		this.board.addEventListener("row-swipe", e => {
			if (this.game.won) return;
			const { pos, direction } = (e as CustomEvent<{ pos: number, direction: number }>).detail;
			if (this.game.lift) {
				this.game.moveLift(direction);
				sfx.select();
			} else if (this.game.pendingScale) {
				sfx.invalid();
			} else {
				this.game.cursorPos = pos;
				if (this.game.swapCursor(direction)) sfx.move();
				else sfx.invalid();
			}
			this.afterAction();
		});

		this.winOverlay.addEventListener("next", () => this.startLevel(this.game.levelIndex + 1));
	}

	// ------------------------------------------------------------ game flow

	private readonly bestKey = (n: number, m: number): string => `rref.best.${n}x${m}`;

	private loadBest(n: number, m: number): number | null {
		try {
			const raw = localStorage.getItem(this.bestKey(n, m));
			const v = raw === null ? NaN : Number(raw);
			return Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
		} catch {
			return null;
		}
	}

	private startLevel(index: number): void {
		const seed = (this.seedBase + index * 7919) >>> 0;
		this.game = new Game(index, seed);
		this.game.best = this.loadBest(this.game.n, this.game.m);
		this.game.onBest = moves => {
			try {
				localStorage.setItem(this.bestKey(this.game.n, this.game.m), String(moves));
			} catch {
				// ignore storage failures
			}
		};
		this.hintRows = null;
		this.lastMoves = this.game.moves;
		this.board.setBoardSize(this.game.n, this.game.m);
		this.afterAction();
	}

	private afterAction(): void {
		if (this.game.moves !== this.lastMoves) {
			this.hintRows = null;
			this.game.hintText = null;
			this.lastMoves = this.game.moves;
		}
		this.board.render({
			rows: this.game.rows,
			order: this.game.order,
			cursorPos: this.game.cursorPos,
			lift: this.game.lift,
			pendingScale: this.game.pendingScale,
			hintRows: this.hintRows,
		});
		this.board.toggleAttribute("disabled", this.game.won);
		this.dial?.setSelection(this.game.kIndex, this.game.kNegative);
		this.dial?.toggleAttribute("disabled", this.game.won);
		this.stats.update(this.game);
		this.hud.update(this.game);
		this.hud.setHint(this.game.hintText);
		this.sizeLabel.textContent = `${this.game.n}×${this.game.m}`;
		if (this.game.won) {
			this.winOverlay.show(computeStars(this.game.moves, this.game.par), this.game.moves, this.game.par, this.game.best, this.game.newRecord);
		} else {
			this.winOverlay.hide();
		}
	}

	private showHint(): void {
		const h = getHint(this.game.displayMatrix());
		this.game.hintText = h.text;
		this.hintRows = h.done ? null : h.rows;
		this.afterAction();
	}

	private restartLevel(): void {
		this.game.restart();
		this.hintRows = null;
		this.lastMoves = this.game.moves;
		this.afterAction();
	}

	private toggleSound(): void {
		this.soundOn = !this.soundOn;
		setSound(this.soundOn);
		this.soundBtn.textContent = this.soundOn ? "🔊" : "🔇";
		try {
			localStorage.setItem("rref.sound", this.soundOn ? "on" : "off");
		} catch {
			// ignore
		}
	}

	// ------------------------------------------------------------- handlers

	private bind(id: string, fn: () => void): void {
		this.querySelector<HTMLElement>(`#${id}`)?.addEventListener("click", fn);
	}

	private readonly onTutorialClose = (): void => {
		this.tutorialOverlay.hide();
		try {
			localStorage.setItem("rref.tutorialSeen", "1");
		} catch {
			// localStorage may be unavailable; the tutorial still closes.
		}
	};

	private readonly onResize = (): void => {
		this.board.layout(this.game.n, this.game.m);
		this.afterAction();
	};

	private readonly onKeyDown = (e: KeyboardEvent): void => {
		const game = this.game;
		const key = e.key;

		if (game.won) {
			if (key === "Enter" || key === " ") {
				e.preventDefault();
				this.startLevel(game.levelIndex + 1);
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
			this.afterAction();
			return;
		}
		if (key === "PageDown") {
			game.moveK(1);
			sfx.select();
			e.preventDefault();
			this.afterAction();
			return;
		}
		if (key === "-") {
			game.toggleKSign();
			sfx.select();
			e.preventDefault();
			this.afterAction();
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
			this.afterAction();
			return;
		}
		if (key === "c" || key === "C") {
			game.cancelLift();
			game.cancelScaleMode();
			game.resetK();
			e.preventDefault();
			this.afterAction();
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
			this.afterAction();
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
			this.afterAction();
			return;
		}

		// Lift a copy of the selected row out to the right
		if (key === "ArrowRight") {
			e.preventDefault();
			if (game.liftRow()) sfx.lift();
			else sfx.invalid();
			this.afterAction();
			return;
		}
		// Left arrow returns the lifted row (cancels the lift)
		if (key === "ArrowLeft") {
			e.preventDefault();
			if (game.lift) {
				game.cancelLift();
				sfx.select();
				this.afterAction();
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
			this.afterAction();
			return;
		}
		if (key === "Enter" || key === " ") {
			if (game.pendingScale) {
				if (game.applyScale()) sfx.scale();
				else sfx.invalid();
				this.afterAction();
				return;
			}
			if (game.lift) {
				e.preventDefault();
				if (game.applyLift()) sfx.combine();
				else sfx.invalid();
				this.afterAction();
				return;
			}
		}

		// Utility
		if (key === "u" || key === "U") {
			if (game.undo()) sfx.move();
			else sfx.invalid();
			this.afterAction();
			return;
		}
		if (key === "h" || key === "H") {
			this.showHint();
			return;
		}
		if (key === "r" || key === "R") {
			this.restartLevel();
			return;
		}
		if (key === "?") {
			this.tutorialOverlay.show();
			return;
		}
	};
}
