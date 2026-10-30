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
	private scaleDial: FactorDial | null = null;
	private liftDial: FactorDial | null = null;
	private hud!: GameHud;
	private stats!: GameStats;
	private winOverlay!: WinOverlay;
	private tutorialOverlay!: TutorialOverlay;
	private sizeLabel!: HTMLElement;
	private soundBtn!: HTMLButtonElement;

	connectedCallback(): void {
		this.board = this.querySelector<RrefBoard>("rref-board")!;
		this.scaleDial = this.querySelector<FactorDial>("#scale-dial");
		this.liftDial = this.querySelector<FactorDial>("#lift-dial");
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
		this.scaleDial?.addEventListener("factor-change", e => {
			if (this.game.won) return;
			const { numerator, denominator } = (e as CustomEvent<{ numerator: number, denominator: number }>).detail;
			if (this.game.setK(numerator, denominator)) {
				this.hintRows = null;
				sfx.scale();
			}
			this.afterAction();
		});
		this.liftDial?.addEventListener("factor-change", e => {
			if (this.game.won) return;
			const { numerator, denominator } = (e as CustomEvent<{ numerator: number, denominator: number }>).detail;
			if (this.game.setLiftK(numerator, denominator)) {
				this.hintRows = null;
				sfx.select();
			}
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
				this.game.setCursor(pos);
				sfx.select();
			}
			this.afterAction();
		});
		this.board.addEventListener("row-swipe", e => {
			if (this.game.won) return;
			const { pos, direction, fromRail } = (e as CustomEvent<{
				pos: number,
				direction: "up" | "down" | "left" | "right",
				fromRail?: boolean,
			}>).detail;

			if (fromRail) {
				if (!this.game.lift) {
					this.afterAction();
					return;
				}
				if (direction === "up" || direction === "down") {
					this.game.moveLift(direction === "up" ? -1 : 1);
					sfx.select();
				} else if (direction === "left") {
					if (this.game.lift.sourcePos === this.game.lift.targetPos) {
						this.game.cancelLift();
						sfx.select();
					} else if (this.game.applyLift()) {
						sfx.combine();
					} else {
						sfx.invalid();
					}
				} else {
					this.game.cancelLift();
					sfx.select();
				}
				this.afterAction();
				return;
			}

			if (direction === "right") {
				// Swipe right shifts (lifts) the swiped row.
				if (this.game.lift) {
					sfx.invalid();
				} else {
					this.game.setCursor(pos);
					if (this.game.liftRow()) sfx.lift();
					else sfx.invalid();
				}
				this.afterAction();
				return;
			}

			if (direction === "left") {
				// Swipe left on the source row cancels; on any other row it applies.
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
					sfx.invalid();
				}
				this.afterAction();
				return;
			}

			// Vertical swipes move the lifted copy or swap rows.
			const delta = direction === "up" ? -1 : 1;
			if (this.game.lift) {
				this.game.moveLift(delta);
				sfx.select();
			} else {
				this.game.setCursor(pos);
				if (this.game.swapCursor(delta)) sfx.move();
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
			hintRows: this.hintRows,
		});
		this.board.toggleAttribute("disabled", this.game.won);
		this.scaleDial?.setSelection(this.game.kNumerator, this.game.kDenominator);
		this.scaleDial?.toggleAttribute("disabled", this.game.won);
		this.scaleDial?.toggleAttribute("open", !this.game.lift);
		this.liftDial?.setSelection(this.game.liftNumerator, this.game.liftDenominator);
		this.liftDial?.toggleAttribute("disabled", this.game.won);
		this.liftDial?.toggleAttribute("open", !!this.game.lift);
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

		// Active factor drawer: PgUp/PgDn = numerator, Shift = denominator.
		if (key === "PageUp") {
			if (game.lift) {
				if (e.shiftKey) game.moveLiftDenominator(-1);
				else game.moveLiftNumerator(-1);
			} else if (e.shiftKey) {
				game.moveDenominator(-1);
			} else {
				game.moveNumerator(-1);
			}
			sfx.select();
			e.preventDefault();
			this.afterAction();
			return;
		}
		if (key === "PageDown") {
			if (game.lift) {
				if (e.shiftKey) game.moveLiftDenominator(1);
				else game.moveLiftNumerator(1);
			} else if (e.shiftKey) {
				game.moveDenominator(1);
			} else {
				game.moveNumerator(1);
			}
			sfx.select();
			e.preventDefault();
			this.afterAction();
			return;
		}
		if (key === "-") {
			if (game.lift) game.toggleLiftSign();
			else game.toggleKSign();
			sfx.select();
			e.preventDefault();
			this.afterAction();
			return;
		}

		if (key === "Escape") {
			if (game.lift) {
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
			if (game.lift) game.cancelLift();
			else game.resetK();
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
				if (game.swapCursor(-1)) sfx.move();
				else sfx.invalid();
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
				if (game.swapCursor(1)) sfx.move();
				else sfx.invalid();
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

		if (key === "Enter" || key === " ") {
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
