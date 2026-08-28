import "./styles.css";
import { Game, computeStars } from "./game/state";
import { getHint } from "./game/hint";
import { Renderer } from "./ui/render";
import { setupInput } from "./ui/input";
import { FactorDial } from "./ui/components/factor-dial";
import { RrefBoard } from "./ui/components/rref-board";
import { initTutorial, showTutorial, hideTutorial } from "./ui/tutorial";
import { setSound, sfx } from "./audio";

customElements.define("factor-dial", FactorDial);
customElements.define("rref-board", RrefBoard);

const seedBase = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;

let game: Game;
let hintRows: number[] | null = null;
let lastMoves = 0;

const renderer = new Renderer();
const board = document.getElementById("board") as RrefBoard;
const factorDial = document.getElementById("factor-dial") as FactorDial | null;

const bestKey = (n: number, m: number) => `rref.best.${n}x${m}`;

function loadBest(n: number, m: number): number | null {
	try {
		const raw = localStorage.getItem(bestKey(n, m));
		const v = raw === null ? NaN : Number(raw);
		return Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
	} catch {
		return null;
	}
}

function startLevel(index: number): void {
	const seed = (seedBase + index * 7919) >>> 0;
	game = new Game(index, seed);
	game.best = loadBest(game.n, game.m);
	game.onBest = moves => {
		try {
			localStorage.setItem(bestKey(game.n, game.m), String(moves));
		} catch {
			// ignore storage failures
		}
	};
	hintRows = null;
	lastMoves = game.moves;
	board.setBoardSize(game.n, game.m);
	afterAction();
}

function afterAction(): void {
	if (game.moves !== lastMoves) {
		hintRows = null;
		game.hintText = null;
		lastMoves = game.moves;
	}
	board.render({
		rows: game.rows,
		order: game.order,
		cursorPos: game.cursorPos,
		lift: game.lift,
		pendingScale: game.pendingScale,
		hintRows,
	});
	board.toggleAttribute("disabled", game.won);
	factorDial?.setSelection(game.kIndex, game.kNegative);
	factorDial?.toggleAttribute("disabled", game.won);
	renderer.renderHud(game);
	renderer.setHint(game.hintText);
	if (game.won) {
		renderer.showWin(computeStars(game.moves, game.par), game.moves, game.par, game.best, game.newRecord);
	} else {
		renderer.hideWin();
	}
}

function showHint(): void {
	const h = getHint(game.displayMatrix());
	game.hintText = h.text;
	hintRows = h.done ? null : h.rows;
	afterAction();
}

let soundOn = true;
try {
	soundOn = localStorage.getItem("rref.sound") !== "off";
} catch {
	// default on
}
setSound(soundOn);
const soundBtn = document.getElementById("btn-sound")!;
soundBtn.textContent = soundOn ? "🔊" : "🔇";

function toggleSound(): void {
	soundOn = !soundOn;
	setSound(soundOn);
	soundBtn.textContent = soundOn ? "🔊" : "🔇";
	try {
		localStorage.setItem("rref.sound", soundOn ? "on" : "off");
	} catch {
		// ignore
	}
}

initTutorial();
try {
	if (localStorage.getItem("rref.tutorialSeen") !== "1") showTutorial();
	else hideTutorial();
} catch {
	hideTutorial();
}

setupInput({
	getGame: () => game,
	afterAction,
	nextLevel: () => startLevel(game.levelIndex + 1),
	restartLevel: () => {
		game.restart();
		hintRows = null;
		lastMoves = game.moves;
		afterAction();
	},
	showHint,
	showTutorial,
	toggleSound,
});

factorDial?.addEventListener("factor-change", e => {
	if (game.won) return;
	game.setKIndex((e as CustomEvent<{ index: number }>).detail.index);
	afterAction();
});
factorDial?.addEventListener("factor-sign", () => {
	if (game.won) return;
	game.toggleKSign();
	afterAction();
});

board.addEventListener("row-tap", e => {
	if (game.won) return;
	const pos = (e as CustomEvent<{ pos: number }>).detail.pos;
	if (game.lift) {
		if (game.lift.sourcePos === pos) {
			game.cancelLift();
			sfx.select();
		} else {
			game.setLiftTarget(pos);
			if (game.applyLift()) sfx.combine();
			else sfx.invalid();
		}
	} else {
		game.cursorPos = pos;
		sfx.select();
	}
	afterAction();
});
board.addEventListener("row-swipe", e => {
	if (game.won) return;
	const { pos, direction } = (e as CustomEvent<{ pos: number, direction: number }>).detail;
	if (game.lift) {
		game.moveLift(direction);
		sfx.select();
	} else if (game.pendingScale) {
		sfx.invalid();
	} else {
		game.cursorPos = pos;
		if (game.swapCursor(direction)) sfx.move();
		else sfx.invalid();
	}
	afterAction();
});

window.addEventListener("resize", () => {
	board.layout(game.n, game.m);
	afterAction();
});

startLevel(0);
