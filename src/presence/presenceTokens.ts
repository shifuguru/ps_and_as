import type { PresenceWaveSpec } from "./types";

/** Continuous urgency ramp duration (human turn, not paused). */
export const PRESENCE_URGENCY_MAX_MS = 16_000;

export function computePresenceUrgency(elapsedMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs / PRESENCE_URGENCY_MAX_MS));
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/** Full breathe cycle length — decreases slightly as urgency rises. */
export function pulsePeriodMsForUrgency(urgency: number): number {
  return lerp(2400, 1600, urgency);
}

/** Ring scale amplitude driven by the sine breathe (0 = none, ~0.08 = calm). */
export function pulseStrengthForUrgency(urgency: number): number {
  return lerp(0.04, 0.08, urgency);
}

/** Outer halo breathes slightly wider than the core ring. */
export function haloStrengthForUrgency(urgency: number): number {
  return lerp(0.06, 0.11, urgency);
}

/** 0–1 glow intensity multiplier. */
export function intensityForUrgency(urgency: number, nudge: boolean): number {
  if (nudge) return 0.88;
  return lerp(0.38, 0.68, urgency);
}

export function waveSpecForUrgency(
  urgency: number,
  externalAmplitudePx?: number | null,
): PresenceWaveSpec {
  const amplitudePx =
    externalAmplitudePx != null
      ? externalAmplitudePx
      : lerp(0, 5, urgency);
  const rotationPeriodMs = lerp(12_000, 5_000, urgency);
  return { amplitudePx, lobeCount: 4, rotationPeriodMs };
}

/** Bell / turn-nudge overlay — brighter, faster pulse. */
export const PRESENCE_NUDGE_PULSE_MS = 450;

/** Ring padding around avatar (matches OpponentSeat). */
export const PRESENCE_RING_PAD = {
  halo: 30,
  glow: 16,
  ring: 10,
  core: 6,
} as const;
