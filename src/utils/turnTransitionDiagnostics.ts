/**
 * Presentation-only turn transition diagnostics (authoritative state unchanged).
 */

export type TurnTransitionDetail = Record<string, unknown>;

const VERBOSE =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.EXPO_PUBLIC_TURN_TRANSITION_DIAG === "1";

export function logTurnTransition(
  event:
    | "animationStarted"
    | "animationCompleted"
    | "displayTurn"
    | "authoritativeTurn"
    | "actionPending"
    | "turnHighlight",
  detail?: TurnTransitionDetail,
): void {
  if (!VERBOSE) return;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[TURN-TRANSITION] ${event}`, detail);
  } else {
    console.log(`[TURN-TRANSITION] ${event}`);
  }
}

export function logTurnTransitionSnapshot(detail: {
  authoritativeTurnIndex: number;
  authoritativeTurnPlayerId: string | null;
  displayTurnIndex: number;
  displayTurnPlayerId: string | null;
  turnHighlightPlayerId: string;
  actionPending: boolean;
  pendingTablePlayFlights: boolean;
  playFlightHoldPlayerId?: string | null;
  presentationHoldActive?: boolean;
}): void {
  logTurnTransition("turnHighlight", detail);
}
