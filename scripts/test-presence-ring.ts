/**
 * Presence Ring resolver + urgency tests.
 * Run: npx tsx ./scripts/test-presence-ring.ts
 */
import assert from "node:assert/strict";
import { resolveTurnHighlightPlayerId } from "../src/utils/turnRingFlightVerify";
import { resolvePresenceRing } from "../src/presence/resolvePresenceRing";
import {
  advancePhase,
  advanceRotationDeg,
  breatheFromPhase,
  smoothToward,
} from "../src/presence/presenceOscillator";
import {
  computePresenceUrgency,
  PRESENCE_URGENCY_MAX_MS,
  pulsePeriodMsForUrgency,
  waveSpecForUrgency,
} from "../src/presence/presenceTokens";
import type { PresenceContext } from "../src/presence/types";

// Oscillator continuity
assert.ok(Math.abs(breatheFromPhase(0) - 0.5) < 1e-10);
assert.ok(Math.abs(breatheFromPhase(0.25) - 1) < 1e-10);
assert.ok(Math.abs(breatheFromPhase(0.5) - 0.5) < 1e-10);
assert.ok(Math.abs(breatheFromPhase(0.75)) < 1e-10);
assert.ok(Math.abs(breatheFromPhase(1) - breatheFromPhase(0)) < 1e-10);

const phaseAfterCycle = advancePhase(0, 1400, 1400);
assert.ok(Math.abs(phaseAfterCycle) < 1e-10);

const phaseMidCycle = advancePhase(0, 700, 1400);
assert.ok(Math.abs(phaseMidCycle - 0.5) < 1e-10);

const phaseAfterPeriodChange = advancePhase(0.5, 16, 1400);
assert.ok(Math.abs(phaseAfterPeriodChange - (0.5 + 16 / 1400)) < 1e-10);

const rotAfterCycle = advanceRotationDeg(0, 5000, 5000);
assert.ok(Math.abs(rotAfterCycle) < 1e-10);

const smoothed = smoothToward(0, 1, 400, 400);
assert.ok(smoothed > 0.6 && smoothed < 0.7);

function ctx(overrides: Partial<PresenceContext> = {}): PresenceContext {
  return {
    turnHighlightPlayerId: "p1",
    turnPlayerId: "p1",
    turnElapsedMs: 0,
    turnPresencePaused: false,
    turnPlayerIsCpu: false,
    nudgeHighlightPlayerId: null,
    disconnectedPlayerIds: new Set<string>(),
    readOnlySpectator: false,
    ...overrides,
  };
}

// Continuous urgency
assert.equal(computePresenceUrgency(0), 0);
assert.equal(computePresenceUrgency(PRESENCE_URGENCY_MAX_MS / 2), 0.5);
assert.equal(computePresenceUrgency(PRESENCE_URGENCY_MAX_MS), 1);
assert.equal(computePresenceUrgency(PRESENCE_URGENCY_MAX_MS + 5000), 1);

// Parameters interpolate smoothly (no tier jumps)
assert.equal(pulsePeriodMsForUrgency(0), 2400);
assert.equal(pulsePeriodMsForUrgency(1), 1600);
assert.ok(waveSpecForUrgency(0.5).amplitudePx > 2);
assert.ok(waveSpecForUrgency(0.5).amplitudePx < 3);

// External amplitude hook
assert.equal(waveSpecForUrgency(0, 7).amplitudePx, 7);

// Ring only on turnHighlightPlayerId
assert.ok(resolvePresenceRing("p1", ctx()));
assert.equal(resolvePresenceRing("p2", ctx()), null);

// Flight hold: highlight on actor, urgency stays 0 on actor
const flightHold = resolvePresenceRing(
  "actor",
  ctx({
    turnHighlightPlayerId: "actor",
    turnPlayerId: "next",
    turnElapsedMs: 20_000,
  }),
);
assert.ok(flightHold);
assert.equal(flightHold!.urgency, 0);
assert.equal(flightHold!.kind, "activeTurn");
assert.equal(flightHold!.accent, "turnWhite");

// Waiting escalation on authoritative turn seat — continuous urgency
const waiting = resolvePresenceRing(
  "p1",
  ctx({ turnElapsedMs: 10_000 }),
);
assert.ok(waiting);
assert.equal(waiting!.urgency, 10_000 / PRESENCE_URGENCY_MAX_MS);
assert.equal(waiting!.kind, "waitingReminder");
assert.ok(waiting!.wave.amplitudePx > 0);

// Nudge forces max urgency visuals
const nudged = resolvePresenceRing(
  "p1",
  ctx({ nudgeHighlightPlayerId: "p1", turnElapsedMs: 1000 }),
);
assert.ok(nudged);
assert.equal(nudged!.urgency, 1);
assert.equal(nudged!.nudge, true);
assert.equal(nudged!.intensity, 0.88);

// CPU / paused — no escalation
assert.equal(
  resolvePresenceRing("p1", ctx({ turnPlayerIsCpu: true, turnElapsedMs: 20_000 }))!
    .urgency,
  0,
);
assert.equal(
  resolvePresenceRing("p1", ctx({ turnPresencePaused: true, turnElapsedMs: 20_000 }))!
    .urgency,
  0,
);

// turnHighlightPlayerId resolver untouched — spot check
assert.equal(
  resolveTurnHighlightPlayerId({
    revealTurnHighlight: true,
    presentationHoldActive: false,
    holdPlayerId: null,
    holdPlayerOut: false,
    playFlightHoldPlayerId: "actor",
    playFlightHoldActorCanHighlight: true,
    pendingTablePlayFlights: false,
    activeLastPlayId: null,
    lastPlayActorCanHighlight: false,
    displaySeatCanAct: true,
    displayTurnPlayerId: "next",
  }),
  "actor",
);

console.log("test-presence-ring: all assertions passed");
