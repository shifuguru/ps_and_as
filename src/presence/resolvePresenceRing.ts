import {
  computePresenceUrgency,
  haloStrengthForUrgency,
  intensityForUrgency,
  pulsePeriodMsForUrgency,
  pulseStrengthForUrgency,
  waveSpecForUrgency,
} from "./presenceTokens";
import type { PresenceContext, PresenceKind, PresenceRingSpec } from "./types";

/**
 * Resolve avatar presence ring for one seat.
 * Ring visibility follows turnHighlightPlayerId only — never authoritative turn alone.
 */
export function resolvePresenceRing(
  playerId: string,
  ctx: PresenceContext,
): PresenceRingSpec | null {
  if (!playerId) return null;

  if (ctx.disconnectedPlayerIds.has(playerId)) {
    return null;
  }

  if (playerId !== ctx.turnHighlightPlayerId) {
    return null;
  }

  const nudge = ctx.nudgeHighlightPlayerId === playerId;
  const waitingOnThisSeat =
    playerId === ctx.turnPlayerId &&
    !ctx.turnPresencePaused &&
    !ctx.turnPlayerIsCpu;

  let urgency = 0;
  if (nudge) {
    urgency = 1;
  } else if (waitingOnThisSeat) {
    urgency = computePresenceUrgency(ctx.turnElapsedMs);
  }

  const kind: PresenceKind =
    waitingOnThisSeat && urgency > 0 ? "waitingReminder" : "activeTurn";

  const externalWaveAmplitude = null;
  const wave = waveSpecForUrgency(urgency, externalWaveAmplitude);
  const playerLabel = ctx.readOnlySpectator ? "active player" : "turn";

  return {
    kind,
    urgency,
    accent: "turnWhite",
    intensity: intensityForUrgency(urgency, nudge),
    pulsePeriodMs: pulsePeriodMsForUrgency(urgency),
    pulseStrength: pulseStrengthForUrgency(urgency),
    haloStrength: haloStrengthForUrgency(urgency),
    wave,
    externalWaveAmplitude,
    nudge,
    a11yLabel: nudge
      ? "Turn nudge highlight"
      : urgency >= 0.55
        ? `Waiting for ${playerLabel}`
        : "Active turn",
  };
}
