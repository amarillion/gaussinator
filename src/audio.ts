let ctx: AudioContext | null = null;
let enabled = true;

function ensureCtx(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.12,
  delay = 0,
): void {
  const c = ensureCtx();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // Audio is best-effort; ignore failures.
  }
}

export const sfx = {
  select: () => tone(520, 0.06, "sine", 0.08),
  move: () => tone(330, 0.09, "triangle", 0.1),
  scale: () => tone(760, 0.1, "sine", 0.1),
  combine: () => {
    tone(500, 0.08, "sine", 0.1);
    tone(750, 0.1, "sine", 0.1, 0.07);
  },
  invalid: () => tone(140, 0.12, "sawtooth", 0.06),
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "triangle", 0.12, i * 0.11));
  },
};

export function setSound(on: boolean): void {
  enabled = on;
}
