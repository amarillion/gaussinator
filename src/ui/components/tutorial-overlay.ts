/**
 * `<tutorial-overlay>` — the how-to-play modal. Its card content lives as
 * light-DOM children in index.html; the component owns show/hide behavior
 * and emits `close` when the player dismisses it.
 */
export class TutorialOverlay extends HTMLElement {
	private closeBtn: HTMLButtonElement | null = null;

	connectedCallback(): void {
		this.classList.add("overlay", "hidden");
		this.closeBtn = this.querySelector(".tutorial-close");
		this.closeBtn?.addEventListener("click", this.onClose);
	}

	disconnectedCallback(): void {
		this.closeBtn?.removeEventListener("click", this.onClose);
	}

	show(): void {
		this.classList.remove("hidden");
	}

	hide(): void {
		this.classList.add("hidden");
	}

	private readonly onClose = (): void => {
		this.dispatchEvent(new CustomEvent("close", { bubbles: true }));
	};
}
