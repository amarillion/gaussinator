export function initTutorial(): void {
	document.getElementById("btn-tutorial-close")?.addEventListener("click", () => {
		hideTutorial();
		try {
			localStorage.setItem("rref.tutorialSeen", "1");
		} catch {
			// localStorage may be unavailable; the tutorial still closes.
		}
	});
}

export function showTutorial(): void {
	document.getElementById("tutorial-overlay")?.classList.remove("hidden");
}

export function hideTutorial(): void {
	document.getElementById("tutorial-overlay")?.classList.add("hidden");
}
