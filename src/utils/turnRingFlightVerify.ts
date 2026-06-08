/** Temporary — remove after turn-ring / flight alignment is verified in production. */
export const ENABLE_TURN_RING_FLIGHT_VERIFY = false;

export type TurnRingVerifySnapshot = {
  currentPlayerIndex: number;
  activeLastPlayId: string | null;
  pendingTablePlayFlights: boolean;
  turnHighlightPlayerId: string;
  playFlightKey?: string | null;
  playFlightStartedAt?: number | null;
  playFlightLandedAt?: number | null;
  presentationHoldActive?: boolean;
  holdPlayerId?: string | null;
};

const flightStartedAt = new Map<string, number>();
const flightLandedAt = new Map<string, number>();
let lastLoggedRingId = "";

function ts(): string {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now().toFixed(1);
  }
  return Date.now().toString();
}

/** Mirror GameScreen turnHighlightPlayerId branches — keep in sync with GameScreen.tsx */
export function resolveTurnHighlightPlayerId(input: {
  revealTurnHighlight: boolean;
  presentationHoldActive: boolean;
  holdPlayerId: string | null;
  holdPlayerOut: boolean;
  pendingTablePlayFlights: boolean;
  activeLastPlayId: string | null;
  lastPlayActorCanHighlight: boolean;
  displaySeatCanAct: boolean;
  displayTurnPlayerId: string;
}): string {
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

export function logTurnRingVerifyEvent(
  event:
    | "PLAY_START"
    | "SYNC_RECEIVED"
    | "RING_CHANGED"
    | "FLIGHT_STARTED"
    | "FLIGHT_LANDED"
    | "INVARIANT_VIOLATION",
  snapshot: TurnRingVerifySnapshot,
  extra?: Record<string, unknown>,
): void {
  if (!ENABLE_TURN_RING_FLIGHT_VERIFY) return;

  const playKey = snapshot.playFlightKey ?? null;
  const startedAt =
    playKey != null ? (flightStartedAt.get(playKey) ?? snapshot.playFlightStartedAt) : null;
  const landedAt =
    playKey != null ? (flightLandedAt.get(playKey) ?? snapshot.playFlightLandedAt) : null;

  console.log(
    "[TURN_RING_VERIFY]",
    event,
    JSON.stringify({
      ts: ts(),
      currentPlayerIndex: snapshot.currentPlayerIndex,
      activeLastPlayId: snapshot.activeLastPlayId,
      pendingTablePlayFlights: snapshot.pendingTablePlayFlights,
      turnHighlightPlayerId: snapshot.turnHighlightPlayerId,
      playFlightKey: playKey,
      playFlightStartedAt: startedAt ?? null,
      playFlightLandedAt: landedAt ?? null,
      presentationHoldActive: snapshot.presentationHoldActive ?? null,
      holdPlayerId: snapshot.holdPlayerId ?? null,
      ...extra,
    }),
  );
}

export function notePlayFlightStarted(playKey: string): number {
  const at = typeof performance !== "undefined" ? performance.now() : Date.now();
  flightStartedAt.set(playKey, at);
  return at;
}

export function notePlayFlightLanded(playKey: string): number {
  const at = typeof performance !== "undefined" ? performance.now() : Date.now();
  flightLandedAt.set(playKey, at);
  return at;
}

export function getPlayFlightTimings(playKey: string): {
  startedAt: number | null;
  landedAt: number | null;
} {
  return {
    startedAt: flightStartedAt.get(playKey) ?? null,
    landedAt: flightLandedAt.get(playKey) ?? null,
  };
}

export function checkPendingFlightRingInvariant(snapshot: TurnRingVerifySnapshot): boolean {
  if (!snapshot.pendingTablePlayFlights) return true;
  if (!snapshot.activeLastPlayId) return true;
  return snapshot.turnHighlightPlayerId === snapshot.activeLastPlayId;
}

export function observeTurnHighlightRing(snapshot: TurnRingVerifySnapshot): void {
  if (!ENABLE_TURN_RING_FLIGHT_VERIFY) return;

  if (!checkPendingFlightRingInvariant(snapshot)) {
    logTurnRingVerifyEvent("INVARIANT_VIOLATION", snapshot);
  }

  const ring = snapshot.turnHighlightPlayerId;
  if (ring !== lastLoggedRingId) {
    lastLoggedRingId = ring;
    logTurnRingVerifyEvent("RING_CHANGED", snapshot);
  }
}
