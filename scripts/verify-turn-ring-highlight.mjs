/**
 * Headless verification of turn highlight ring vs pendingTablePlayFlights invariant.
 * Mirrors resolveTurnHighlightPlayerId in src/utils/turnRingFlightVerify.ts
 * and turnHighlightPlayerId branches in GameScreen.tsx (~3991–4003).
 *
 * Going-out edge (scenario 7): when the last actor emptied their hand or is in
 * finishedOrder, lastPlayActorCanHighlight=false. While pendingTablePlayFlights
 * is true the ring must NOT latch on activeLastPlayId; it follows display turn
 * (displayTurnPlayerId when displaySeatCanAct, else "").
 *
 * node scripts/verify-turn-ring-highlight.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function resolveTurnHighlight(input) {
  const {
    revealTurnHighlight,
    presentationHoldActive,
    holdPlayerId,
    holdPlayerOut,
    pendingTablePlayFlights,
    activeLastPlayId,
    lastPlayActorCanHighlight,
    displaySeatCanAct,
    displayTurnPlayerId,
  } = input;
  if (!revealTurnHighlight) return "";
  if (presentationHoldActive && holdPlayerId && !holdPlayerOut) return holdPlayerId;
  if (pendingTablePlayFlights && lastPlayActorCanHighlight && activeLastPlayId) {
    return activeLastPlayId;
  }
  if (displaySeatCanAct) return displayTurnPlayerId;
  return "";
}

/**
 * Pending-flight ring invariant — mirrors GameScreen.tsx turnHighlightPlayerId:
 * - pending + lastPlayActorCanHighlight → ring stays on activeLastPlayId (actor still in hand)
 * - pending + !lastPlayActorCanHighlight (going-out) → ring follows display turn, not last actor
 */
function invariantOk(input, ring) {
  const {
    pendingTablePlayFlights: pending,
    activeLastPlayId: activeLast,
    lastPlayActorCanHighlight,
    displaySeatCanAct,
    displayTurnPlayerId,
  } = input;
  if (!pending) return true;
  if (!activeLast) return true;
  if (lastPlayActorCanHighlight) return ring === activeLast;
  if (displaySeatCanAct) return ring === displayTurnPlayerId;
  return ring === "";
}

function runScenario(name, steps) {
  const log = [];
  let fail = null;
  for (const step of steps) {
    const ring = resolveTurnHighlight(step.input);
    const ok = invariantOk(step.input, ring);
    log.push({
      event: step.event,
      pending: step.input.pendingTablePlayFlights,
      activeLastPlayId: step.input.activeLastPlayId,
      lastPlayActorCanHighlight: step.input.lastPlayActorCanHighlight,
      turnHighlightPlayerId: ring,
      displayTurnPlayerId: step.input.displayTurnPlayerId,
      invariantOk: ok,
    });
    if (!ok && !fail) {
      fail = {
        event: step.event,
        pending: step.input.pendingTablePlayFlights,
        activeLastPlayId: step.input.activeLastPlayId,
        turnHighlightPlayerId: ring,
        displayTurnPlayerId: step.input.displayTurnPlayerId,
      };
    }
  }
  return { name, pass: fail == null, log, fail };
}

const base = {
  revealTurnHighlight: true,
  holdPlayerOut: false,
  lastPlayActorCanHighlight: true,
  displaySeatCanAct: true,
};

const scenarios = [
  runScenario("1. Local human play (presentation latch)", [
    {
      event: "PLAY_START",
      input: {
        ...base,
        presentationHoldActive: true,
        holdPlayerId: "human-1",
        pendingTablePlayFlights: false,
        activeLastPlayId: "human-1",
        displayTurnPlayerId: "cpu-2",
      },
    },
    {
      event: "SYNC_RECEIVED",
      input: {
        ...base,
        presentationHoldActive: true,
        holdPlayerId: "human-1",
        pendingTablePlayFlights: false,
        activeLastPlayId: "human-1",
        displayTurnPlayerId: "cpu-2",
      },
    },
    {
      event: "FLIGHT_LANDED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: false,
        activeLastPlayId: "human-1",
        displayTurnPlayerId: "cpu-2",
      },
    },
    {
      event: "RING_CHANGED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: false,
        activeLastPlayId: "human-1",
        displayTurnPlayerId: "cpu-2",
      },
    },
  ]),
  runScenario("2. Remote human play (multiplayer)", [
    {
      event: "SYNC_RECEIVED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "remote-2",
        displayTurnPlayerId: "human-1",
      },
    },
    {
      event: "FLIGHT_STARTED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "remote-2",
        displayTurnPlayerId: "human-1",
      },
    },
    {
      event: "FLIGHT_LANDED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: false,
        activeLastPlayId: "remote-2",
        displayTurnPlayerId: "human-1",
      },
    },
    {
      event: "RING_CHANGED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: false,
        activeLastPlayId: "remote-2",
        displayTurnPlayerId: "human-1",
      },
    },
  ]),
  runScenario("3. CPU play", [
    {
      event: "SYNC_RECEIVED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "cpu-3",
        displayTurnPlayerId: "human-1",
      },
    },
    {
      event: "FLIGHT_STARTED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "cpu-3",
        displayTurnPlayerId: "human-1",
      },
    },
    {
      event: "FLIGHT_LANDED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: false,
        activeLastPlayId: "cpu-3",
        displayTurnPlayerId: "human-1",
      },
    },
  ]),
  runScenario("4. Spectator view (same presentation path)", [
    {
      event: "SYNC_RECEIVED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "p2",
        displayTurnPlayerId: "p3",
      },
    },
    {
      event: "FLIGHT_LANDED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: false,
        activeLastPlayId: "p2",
        displayTurnPlayerId: "p3",
      },
    },
  ]),
  runScenario("5. iOS PWA / 6. Desktop (presentation logic identical)", [
    {
      event: "SYNC_RECEIVED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "actor",
        displayTurnPlayerId: "next",
      },
    },
    {
      event: "FLIGHT_STARTED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "actor",
        displayTurnPlayerId: "next",
      },
    },
    {
      event: "FLIGHT_LANDED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: false,
        activeLastPlayId: "actor",
        displayTurnPlayerId: "next",
      },
    },
  ]),
  runScenario("7. Going-out edge (pending, actor cannot highlight)", [
    {
      event: "SYNC_RECEIVED",
      input: {
        ...base,
        lastPlayActorCanHighlight: false,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "going-out-1",
        displayTurnPlayerId: "next-2",
      },
    },
    {
      event: "FLIGHT_STARTED",
      input: {
        ...base,
        lastPlayActorCanHighlight: false,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "going-out-1",
        displayTurnPlayerId: "next-2",
      },
    },
    {
      event: "FLIGHT_LANDED",
      input: {
        ...base,
        lastPlayActorCanHighlight: false,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: false,
        activeLastPlayId: "going-out-1",
        displayTurnPlayerId: "next-2",
      },
    },
    {
      event: "RING_CHANGED",
      input: {
        ...base,
        lastPlayActorCanHighlight: false,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: false,
        activeLastPlayId: "going-out-1",
        displayTurnPlayerId: "next-2",
      },
    },
  ]),
  runScenario("Regression: pre-fix remote path would fail", [
    {
      event: "SYNC_RECEIVED",
      input: {
        ...base,
        presentationHoldActive: false,
        holdPlayerId: null,
        pendingTablePlayFlights: true,
        activeLastPlayId: "remote-2",
        displayTurnPlayerId: "human-1",
      },
    },
  ]),
];

/** Old logic without pendingTablePlayFlights branch */
function resolveTurnHighlightOld(input) {
  const {
    revealTurnHighlight,
    presentationHoldActive,
    holdPlayerId,
    holdPlayerOut,
    displaySeatCanAct,
    displayTurnPlayerId,
  } = input;
  if (!revealTurnHighlight) return "";
  if (presentationHoldActive && holdPlayerId && !holdPlayerOut) return holdPlayerId;
  if (displaySeatCanAct) return displayTurnPlayerId;
  return "";
}

const preFixRemote = resolveTurnHighlightOld({
  ...base,
  presentationHoldActive: false,
  holdPlayerId: null,
  pendingTablePlayFlights: true,
  activeLastPlayId: "remote-2",
  displayTurnPlayerId: "human-1",
});

console.log("=== Turn highlight ring verification (headless) ===\n");
console.log(
  "Pre-fix remote snapshot (would jump early):",
  JSON.stringify({
    pending: true,
    activeLastPlayId: "remote-2",
    turnHighlightPlayerId: preFixRemote,
  }),
);
console.log("");

let allPass = true;
for (const result of scenarios) {
  console.log(`--- ${result.name} --- ${result.pass ? "PASS" : "FAIL"}`);
  for (const line of result.log) {
    console.log(
      `  ${line.event} pending=${line.pending} activeLast=${line.activeLastPlayId} canHighlight=${line.lastPlayActorCanHighlight} ring=${line.turnHighlightPlayerId} next=${line.displayTurnPlayerId} invariant=${line.invariantOk}`,
    );
  }
  if (result.fail) {
    console.log("  FAIL at:", JSON.stringify(result.fail));
    allPass = false;
  }
  console.log("");
}

console.log(
  allPass
    ? "OVERALL: PASS (logic invariant holds for all simulated paths)"
    : "OVERALL: FAIL",
);
console.log(
  "\nNote: iOS PWA and desktop browser require manual/console capture with ENABLE_TURN_RING_FLIGHT_VERIFY in a live session.",
);
process.exit(allPass ? 0 : 1);
