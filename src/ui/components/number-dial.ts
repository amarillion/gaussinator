import { DIAL_TUNING } from "./dial-tuning";

export interface NumberDialOptions {
	values: readonly number[],
	value: number,
	format: (value: number) => string,
	label: string,
}

interface DragState {
	pointerId: number,
	startY: number,
	startOffset: number,
	startTime: number,
	tappedIndex: number | null,
	moved: boolean,
	samples: { y: number, time: number }[],
}

function clamp(value: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, value));
}

/**
 * `<number-dial>` — one vertical scale that scrolls under a fixed needle.
 *
 * Pointer drags move the scale, a fling keeps it moving with friction, and it
 * eases to the nearest value once momentum is low. The component reports the
 * centred value through a bubbling `dial-change` event. `setValue()` moves the
 * scale programmatically without emitting back into the game.
 */
export class NumberDial extends HTMLElement {
	private values: number[] = [];
	private formatValue: (value: number) => string = String;
	private items: HTMLElement[] = [];
	private track: HTMLElement | null = null;
	private viewport: HTMLElement | null = null;
	private selectedIndex = 0;
	private centreIndex = -1;
	private offset = 0;
	private velocity = 0;
	private raf = 0;
	private drag: DragState | null = null;
	private programmatic = false;
	private lastFrameTime = 0;
	private resizeObserver: ResizeObserver | null = null;
	private built = false;

	connectedCallback(): void {
		this.build();
		this.addEventListener("pointerdown", this.onPointerDown);
		this.addEventListener("pointermove", this.onPointerMove);
		this.addEventListener("pointerup", this.onPointerUp);
		this.addEventListener("pointercancel", this.onPointerCancel);
		this.addEventListener("keydown", this.onKeyDown);
		this.resizeObserver = new ResizeObserver(() => this.handleResize());
		this.resizeObserver.observe(this);
	}

	disconnectedCallback(): void {
		this.stopAnimation();
		this.removeEventListener("pointerdown", this.onPointerDown);
		this.removeEventListener("pointermove", this.onPointerMove);
		this.removeEventListener("pointerup", this.onPointerUp);
		this.removeEventListener("pointercancel", this.onPointerCancel);
		this.removeEventListener("keydown", this.onKeyDown);
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	configure(options: NumberDialOptions): void {
		this.build();
		this.values = options.values.slice();
		this.formatValue = options.format;
		this.setAttribute("aria-label", options.label);
		this.title = options.label;
		this.setAttribute("aria-valuemin", String(this.values[0] ?? 0));
		this.setAttribute("aria-valuemax", String(this.values[this.values.length - 1] ?? 0));

		if (this.track) {
			this.track.innerHTML = "";
			this.items = this.values.map((value, index) => {
				const item = document.createElement("div");
				item.className = "dial-item";
				item.dataset.value = String(value);
				item.style.top = `${index * DIAL_TUNING.itemHeight}px`;
				item.textContent = this.formatValue(value);
				this.track!.appendChild(item);
				return item;
			});
		}

		const index = Math.max(0, this.values.indexOf(options.value));
		this.selectedIndex = index;
		this.centreIndex = -1;
		this.offset = this.offsetForIndex(index);
		this.updateAria(index);
		this.renderTrack();
	}

	/** Value currently under the needle. */
	get value(): number {
		return this.values[this.selectedIndex] ?? 0;
	}

	/**
	 * Programmatically move to a value (e.g. after a move resets k to 1/1).
	 * This animates the scale but does not emit `dial-change`.
	 */
	setValue(value: number): void {
		const index = this.values.indexOf(value);
		if (index < 0 || this.drag) return;
		if (index === this.selectedIndex) return;
		this.selectedIndex = index;
		this.programmatic = true;
		this.snapToIndex(index, false);
	}

	private build(): void {
		if (this.built) return;
		this.built = true;
		this.tabIndex = 0;
		this.setAttribute("role", "slider");
		this.setAttribute("aria-orientation", "vertical");
		this.style.setProperty("--dial-item-height", `${DIAL_TUNING.itemHeight}px`);
		this.innerHTML = `
			<div class="dial-viewport"><div class="dial-track"></div></div>
			<div class="dial-needle" aria-hidden="true"></div>
		`;
		this.viewport = this.querySelector<HTMLElement>(".dial-viewport");
		this.track = this.querySelector<HTMLElement>(".dial-track");
	}

	private offsetForIndex(index: number): number {
		const centre = (this.viewport?.clientHeight ?? DIAL_TUNING.itemHeight * 5) / 2;
		return centre - DIAL_TUNING.itemHeight / 2 - index * DIAL_TUNING.itemHeight;
	}

	private nearestIndex(offset: number): number {
		const centre = (this.viewport?.clientHeight ?? DIAL_TUNING.itemHeight * 5) / 2;
		const raw = Math.round((centre - DIAL_TUNING.itemHeight / 2 - offset) / DIAL_TUNING.itemHeight);
		return clamp(raw, 0, Math.max(0, this.values.length - 1));
	}

	private minOffset(): number {
		return this.offsetForIndex(Math.max(0, this.values.length - 1));
	}

	private maxOffset(): number {
		return this.offsetForIndex(0);
	}

	private withOverscroll(raw: number): number {
		const min = this.minOffset();
		const max = this.maxOffset();
		if (raw < min) return min + (raw - min) * DIAL_TUNING.overscrollResistance;
		if (raw > max) return max + (raw - max) * DIAL_TUNING.overscrollResistance;
		return raw;
	}

	private renderTrack(): void {
		if (!this.track) return;
		this.track.style.transform = `translate3d(0, ${this.offset}px, 0)`;
		const index = this.nearestIndex(this.offset);
		if (index === this.centreIndex) return;
		this.items[this.centreIndex]?.classList.remove("centre");
		this.items[index]?.classList.add("centre");
		this.centreIndex = index;
		this.dataset.value = String(this.values[index] ?? 0);
		this.updateAria(index);
	}

	private updateAria(index: number): void {
		const value = this.values[index];
		if (value === undefined) return;
		this.setAttribute("aria-valuenow", String(value));
		this.setAttribute("aria-valuetext", this.formatValue(value));
	}

	private syncSelection(): void {
		const index = this.nearestIndex(this.offset);
		if (index === this.selectedIndex) return;
		this.selectedIndex = index;
		this.updateAria(index);
		this.dispatchEvent(new CustomEvent("dial-change", {
			bubbles: true,
			detail: { value: this.values[index], index },
		}));
	}

	private stopAnimation(): void {
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	private snapToIndex(index: number, userDriven: boolean): void {
		this.stopAnimation();
		const targetOffset = this.offsetForIndex(index);
		const from = this.offset;
		const distance = targetOffset - from;
		if (Math.abs(distance) < DIAL_TUNING.snapEpsilonPx) {
			this.offset = targetOffset;
			this.renderTrack();
			this.programmatic = false;
			if (userDriven) this.syncSelection();
			return;
		}

		const start = performance.now();
		const step = (now: number): void => {
			const t = Math.min(1, (now - start) / DIAL_TUNING.snapDuration);
			const eased = 1 - Math.pow(1 - t, 3);
			this.offset = from + distance * eased;
			this.renderTrack();
			if (userDriven) this.syncSelection();
			if (t < 1) {
				this.raf = requestAnimationFrame(step);
				return;
			}
			this.offset = targetOffset;
			this.renderTrack();
			this.raf = 0;
			if (userDriven) this.syncSelection();
			else this.programmatic = false;
		};
		this.raf = requestAnimationFrame(step);
	}

	private startInertia(initialVelocity: number): void {
		this.stopAnimation();
		this.velocity = clamp(initialVelocity, -DIAL_TUNING.maxFlingVelocity, DIAL_TUNING.maxFlingVelocity);
		this.lastFrameTime = performance.now();

		const step = (now: number): void => {
			const dt = Math.min(50, Math.max(1, now - this.lastFrameTime));
			this.lastFrameTime = now;

			const min = this.minOffset();
			const max = this.maxOffset();
			let next = this.offset + this.velocity * dt;
			if (next < min || next > max) {
				next = clamp(next, min, max);
				this.velocity = -this.velocity * DIAL_TUNING.edgeBounce;
			} else {
				this.velocity *= Math.pow(DIAL_TUNING.frictionPerMs, dt);
			}

			this.offset = next;
			this.renderTrack();
			this.syncSelection();

			if (Math.abs(this.velocity) < DIAL_TUNING.snapVelocity) {
				this.snapToIndex(this.nearestIndex(this.offset), false);
				return;
			}
			this.raf = requestAnimationFrame(step);
		};
		this.raf = requestAnimationFrame(step);
	}

	private recordSample(y: number, time: number): void {
		if (!this.drag) return;
		const samples = this.drag.samples;
		samples.push({ y, time });
		while (samples.length > DIAL_TUNING.velocitySampleLimit) samples.shift();
		while (samples.length > 1 && time - samples[0].time > DIAL_TUNING.velocityWindowMs) {
			samples.shift();
		}
	}

	private releaseVelocity(drag: DragState): number {
		const samples = drag.samples;
		if (samples.length < 2) return 0;
		const first = samples[0];
		const last = samples[samples.length - 1];
		if (performance.now() - last.time > DIAL_TUNING.velocityWindowMs) return 0;
		const dt = last.time - first.time;
		if (dt <= 0) return 0;
		return clamp((last.y - first.y) / dt, -DIAL_TUNING.maxFlingVelocity, DIAL_TUNING.maxFlingVelocity);
	}

	private handleResize(): void {
		if (this.values.length === 0 || this.drag) return;
		this.stopAnimation();
		this.programmatic = false;
		this.offset = this.offsetForIndex(this.selectedIndex);
		this.renderTrack();
	}

	private readonly onPointerDown = (e: PointerEvent): void => {
		if (this.hasAttribute("disabled") || this.values.length === 0) return;
		if (e.button !== 0) return;
		this.stopAnimation();
		this.programmatic = false;
		this.focus({ preventScroll: true });
		this.setPointerCapture(e.pointerId);
		const target = (e.target as HTMLElement).closest<HTMLElement>(".dial-item");
		const targetValue = target ? Number(target.dataset.value) : NaN;
		const tappedIndex = Number.isFinite(targetValue) ? this.values.indexOf(targetValue) : -1;
		this.drag = {
			pointerId: e.pointerId,
			startY: e.clientY,
			startOffset: this.offset,
			startTime: performance.now(),
			tappedIndex: tappedIndex >= 0 ? tappedIndex : null,
			moved: false,
			samples: [ { y: e.clientY, time: performance.now() } ],
		};
		e.preventDefault();
	};

	private readonly onPointerMove = (e: PointerEvent): void => {
		if (!this.drag || e.pointerId !== this.drag.pointerId) return;
		const dy = e.clientY - this.drag.startY;
		if (Math.abs(dy) > DIAL_TUNING.tapSlop) this.drag.moved = true;
		this.offset = this.withOverscroll(this.drag.startOffset + dy);
		this.recordSample(e.clientY, performance.now());
		this.renderTrack();
		this.syncSelection();
		e.preventDefault();
	};

	private readonly onPointerUp = (e: PointerEvent): void => {
		if (!this.drag || e.pointerId !== this.drag.pointerId) return;
		const drag = this.drag;
		const velocity = this.releaseVelocity(drag);
		this.drag = null;
		if (this.hasPointerCapture?.(e.pointerId)) this.releasePointerCapture(e.pointerId);

		const isTap = !drag.moved && performance.now() - drag.startTime <= DIAL_TUNING.tapTimeout;
		if (isTap && drag.tappedIndex !== null) {
			this.snapToIndex(drag.tappedIndex, true);
			return;
		}

		if (Math.abs(velocity) < DIAL_TUNING.minFlingVelocity) {
			this.snapToIndex(this.nearestIndex(this.offset), true);
			return;
		}
		this.startInertia(velocity);
	};

	private readonly onPointerCancel = (e: PointerEvent): void => {
		if (!this.drag || e.pointerId !== this.drag.pointerId) return;
		this.drag = null;
		this.snapToIndex(this.nearestIndex(this.offset), true);
	};

	private readonly onKeyDown = (e: KeyboardEvent): void => {
		if (this.hasAttribute("disabled")) return;
		const step = e.key === "PageUp" || e.key === "PageDown" ? 5 : 1;
		let next = this.selectedIndex;
		if (e.key === "ArrowUp" || e.key === "PageUp") next += step;
		else if (e.key === "ArrowDown" || e.key === "PageDown") next -= step;
		else if (e.key === "Home") next = 0;
		else if (e.key === "End") next = this.values.length - 1;
		else return;

		e.preventDefault();
		e.stopPropagation();
		this.snapToIndex(clamp(next, 0, this.values.length - 1), true);
	};
}
