/**
 * `<win-overlay>` — the level-complete modal. Emits `next` when the
 * player activates the button (the keyboard path is handled by the app).
 */
export class WinOverlay extends HTMLElement {
	private starsEl: HTMLElement | null = null;
	private movesEl: HTMLElement | null = null;
	private bestEl: HTMLElement | null = null;
	private nextBtn: HTMLButtonElement | null = null;

	connectedCallback(): void {
		this.classList.add("overlay", "hidden");
		this.innerHTML = `
			<div class="overlay-card">
				<h2>Level complete!</h2>
				<div class="stars"></div>
				<p class="win-moves"></p>
				<p class="win-best"></p>
				<button class="big-btn next-btn" type="button">Next level (Enter)</button>
			</div>
		`;
		this.starsEl = this.querySelector(".stars");
		this.movesEl = this.querySelector(".win-moves");
		this.bestEl = this.querySelector(".win-best");
		this.nextBtn = this.querySelector(".next-btn");
		this.nextBtn?.addEventListener("click", this.onNext);
	}

	disconnectedCallback(): void {
		this.nextBtn?.removeEventListener("click", this.onNext);
	}

	show(stars: number, moves: number, par: number, best: number | null, isNewBest: boolean): void {
		if (this.starsEl) this.starsEl.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
		if (this.movesEl) this.movesEl.textContent = `${moves} moves (par ${par})`;
		if (this.bestEl) this.bestEl.textContent = best === null ? "" : `Best: ${best}${isNewBest ? " — new record!" : ""}`;
		this.classList.remove("hidden");
	}

	hide(): void {
		this.classList.add("hidden");
	}

	private readonly onNext = (): void => {
		this.dispatchEvent(new CustomEvent("next", { bubbles: true }));
	};
}
