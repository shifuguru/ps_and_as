import { PRESENCE_NUDGE_PULSE_MS } from "./presenceTokens";

/** Seamless 0→1 breathe from a linear phase (wraps at midpoint, not at extrema). */
export function breatheFromPhase(phase: number): number {
  "worklet";
  return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
}

/** Advance normalized phase — frequency changes do not reset accumulated phase. */
export function advancePhase(
  phase: number,
  dtMs: number,
  periodMs: number,
): number {
  "worklet";
  if (periodMs <= 0 || dtMs <= 0) return phase;
  const next = phase + dtMs / periodMs;
  return next - Math.floor(next);
}

/** Advance rotation in degrees — same continuity guarantees as advancePhase. */
export function advanceRotationDeg(
  degrees: number,
  dtMs: number,
  periodMs: number,
): number {
  "worklet";
  if (periodMs <= 0 || dtMs <= 0) return degrees;
  const next = degrees + (dtMs / periodMs) * 360;
  return next % 360;
}

/** Exponential smoothing toward a target (UI-thread friendly). */
export function smoothToward(
  current: number,
  target: number,
  dtMs: number,
  tauMs: number,
): number {
  "worklet";
  if (tauMs <= 0 || dtMs <= 0) return target;
  const alpha = 1 - Math.exp(-dtMs / tauMs);
  return current + (target - current) * alpha;
}

/** Legacy turn ring — calm ~2.4s full breathe cycle. */
export const LEGACY_PULSE_PERIOD_MS = 2400;

/** Matches useSlowTurnBell tick — smooth urgency-driven param changes. */
export const PRESENCE_PARAM_SMOOTH_MS = 400;

/** Max wave amplitude from waveSpecForUrgency(1). */
export const PRESENCE_WAVE_MAX_AMPLITUDE_PX = 5;

export const LEGACY_NUDGE_PERIOD_MS = PRESENCE_NUDGE_PULSE_MS * 2;
