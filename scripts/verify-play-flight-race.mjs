/**
 * Proves the local elevated-flight race without running the app.
 *
 * Scenario: GameScreen primes the portal at t=0; GamePlayArea registers
 * activeFlights after async measureViewInWindow (measureDelayMs).
 * handleFlightComplete only clears elevated when completing ∈ activeFlights.
 */

const PLAY_CARD_FLIGHT_MS = 360;

function simulateLegacy({ measureDelayMs }) {
  let activeFlights = [];
  let elevatedCount = 1;
  let landed = false;

  const runAt = (ms, fn) => ({ ms, fn });
  const timeline = [
    runAt(0, () => {
      elevatedCount = 1;
    }),
    runAt(measureDelayMs, () => {
      activeFlights.push({ id: "local-play", fromLocalHand: true });
    }),
    runAt(PLAY_CARD_FLIGHT_MS, () => {
      const completing = activeFlights.find((f) => f.id === "local-play");
      const next = activeFlights.filter((f) => f.id !== "local-play");
      const clearElevated = !!(
        completing?.fromLocalHand && !next.some((f) => f.fromLocalHand)
      );
      if (clearElevated) elevatedCount = 0;
      landed = true;
    }),
  ].sort((a, b) => a.ms - b.ms);

  for (const step of timeline) step.fn();

  return {
    measureDelayMs,
    ghostElevated: elevatedCount > 0 && landed,
    activeRegisteredBeforeComplete: measureDelayMs < PLAY_CARD_FLIGHT_MS,
  };
}

function simulateFixed({ measureDelayMs }) {
  let activeFlights = [];
  let elevatedCount = 0;
  let landed = false;

  const runAt = (ms, fn) => ({ ms, fn });
  const timeline = [
    runAt(measureDelayMs, () => {
      activeFlights.push({ id: "local-play", fromLocalHand: true });
      elevatedCount = activeFlights.filter((f) => f.fromLocalHand).length;
    }),
    runAt(measureDelayMs + PLAY_CARD_FLIGHT_MS, () => {
      activeFlights = activeFlights.filter((f) => f.id !== "local-play");
      elevatedCount = activeFlights.filter((f) => f.fromLocalHand).length;
      landed = true;
    }),
  ].sort((a, b) => a.ms - b.ms);

  for (const step of timeline) step.fn();

  return {
    measureDelayMs,
    ghostElevated: elevatedCount > 0 && landed,
  };
}

let legacyFailures = 0;
console.log("=== Legacy dual-writer race (prime + conditional clear) ===");
for (const delay of [0, 50, 100, 200, 359, 360, 400, 500]) {
  const r = simulateLegacy({ measureDelayMs: delay });
  if (r.ghostElevated) legacyFailures += 1;
  console.log(
    `measureDelay=${String(delay).padStart(3)}ms ` +
      `registeredBeforeComplete=${r.activeRegisteredBeforeComplete} ` +
      `ghostElevated=${r.ghostElevated}`,
  );
}

let fixedFailures = 0;
console.log("\n=== Fixed single-writer + sync elevated from activeFlights ===");
for (const delay of [0, 50, 100, 200, 359, 360, 400, 500]) {
  const r = simulateFixed({ measureDelayMs: delay });
  if (r.ghostElevated) fixedFailures += 1;
  console.log(
    `measureDelay=${String(delay).padStart(3)}ms ghostElevated=${r.ghostElevated}`,
  );
}

if (legacyFailures === 0) {
  console.error("\nFAIL: expected legacy simulation to show ghost when measure > flight ms");
  process.exit(1);
}
if (fixedFailures !== 0) {
  console.error("\nFAIL: fixed simulation should never leave ghost elevated");
  process.exit(1);
}

console.log(
  `\nPASS: legacy race reproduced (${legacyFailures} ghost cases); fixed model has 0 ghosts.`,
);
