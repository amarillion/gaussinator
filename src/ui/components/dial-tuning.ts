/**
 * Every feel-related constant for the scrolling number dials lives here.
 * Tweak these values to change the size, momentum, snap, and tap behaviour
 * without touching the component logic.
 */
export const DIAL_TUNING = {
	/** Vertical distance between two values on the scale, in px. */
	itemHeight: 46,
	/** Width of one dial, in px. */
	dialWidth: 56,
	/** Gap between the numerator and denominator dials, in px. */
	pairGap: 6,
	/** Momentum retained per millisecond after a fling (1 = no decay). */
	frictionPerMs: 0.996,
	/** A flick faster than this is capped, in px/ms. */
	maxFlingVelocity: 3.5,
	/** Releases slower than this skip inertia and snap straight away, in px/ms. */
	minFlingVelocity: 0.08,
	/** Inertia ends and snapping begins below this speed, in px/ms. */
	snapVelocity: 0.12,
	/** Duration of the ease-to-nearest-value animation, in ms. */
	snapDuration: 170,
	/** How much the scale can stretch past its first/last value (0 = none). */
	overscrollResistance: 0.35,
	/** How much velocity is kept when the scale hits an edge. */
	edgeBounce: 0.25,
	/** Pointer movement up to this distance still counts as a tap, in px. */
	tapSlop: 8,
	/** Longest press that still counts as a tap, in ms. */
	tapTimeout: 450,
	/** Only samples in this recent window are used for release velocity, in ms. */
	velocityWindowMs: 90,
	/** Maximum number of pointer samples kept for release velocity. */
	velocitySampleLimit: 8,
	/** Below this remaining distance the snap finishes immediately, in px. */
	snapEpsilonPx: 0.35,
} as const;

export const FACTOR_DIAL_WIDTH = DIAL_TUNING.dialWidth * 2 + DIAL_TUNING.pairGap;
