import {
	K_DENOMINATOR_MAX,
	K_DENOMINATOR_MIN,
	K_DEFAULT_DENOMINATOR,
	K_DEFAULT_NUMERATOR,
	K_NUMERATOR_MAX,
	K_NUMERATOR_MIN,
} from "../../game/state";
import { DIAL_TUNING } from "./dial-tuning";
import type { NumberDial } from "./number-dial";

function range(min: number, max: number): number[] {
	return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

const NUMERATOR_VALUES = range(K_NUMERATOR_MIN, K_NUMERATOR_MAX);
const DENOMINATOR_VALUES = range(K_DENOMINATOR_MIN, K_DENOMINATOR_MAX);

/**
 * `<factor-dial>` — the exact multiplier picker.
 *
 * Two side-by-side scrolling scales make `numerator / denominator`; the left
 * dial is the numerator (-20…20) and the right dial is the denominator
 * (1…20, shown as 1/1…1/20). Each child `<number-dial>` owns its own gesture
 * physics; this element combines their selections into `factor-change`.
 */
export class FactorDial extends HTMLElement {
	private numeratorDial: NumberDial | null = null;
	private denominatorDial: NumberDial | null = null;

	connectedCallback(): void {
		this.style.setProperty("--dial-width", `${DIAL_TUNING.dialWidth}px`);
		this.style.setProperty("--dial-gap", `${DIAL_TUNING.pairGap}px`);
		this.innerHTML = `
			<div class="dial-pair">
				<number-dial class="dial numerator" data-dial="numerator"></number-dial>
				<number-dial class="dial denominator" data-dial="denominator"></number-dial>
			</div>
		`;

		this.numeratorDial = this.querySelector<NumberDial>('[data-dial="numerator"]');
		this.denominatorDial = this.querySelector<NumberDial>('[data-dial="denominator"]');

		this.numeratorDial?.configure({
			values: NUMERATOR_VALUES,
			value: K_DEFAULT_NUMERATOR,
			format: value => String(value).replace("-", "−"),
			label: "Numerator",
		});
		this.denominatorDial?.configure({
			values: DENOMINATOR_VALUES,
			value: K_DEFAULT_DENOMINATOR,
			format: value => `1/${value}`,
			label: "Denominator",
		});

		this.numeratorDial?.addEventListener("dial-change", this.onDialChange);
		this.denominatorDial?.addEventListener("dial-change", this.onDialChange);
	}

	disconnectedCallback(): void {
		this.numeratorDial?.removeEventListener("dial-change", this.onDialChange);
		this.denominatorDial?.removeEventListener("dial-change", this.onDialChange);
	}

	/** Receive the game's current exact factor and move both scales to it. */
	setSelection(numerator: number, denominator: number): void {
		this.numeratorDial?.setValue(numerator);
		this.denominatorDial?.setValue(denominator);
	}

	private readonly onDialChange = (): void => {
		const numerator = this.numeratorDial?.value ?? K_DEFAULT_NUMERATOR;
		const denominator = this.denominatorDial?.value ?? K_DEFAULT_DENOMINATOR;
		this.dispatchEvent(new CustomEvent("factor-change", {
			bubbles: true,
			detail: { numerator, denominator },
		}));
	};
}
