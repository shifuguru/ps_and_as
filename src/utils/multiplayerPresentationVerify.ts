/**
 * Temporary — QA-006 / QA-008 verification sprint.
 * Log markers ([PLAY] E5_VERIFIED, [FLIGHT] E5_VERIFIED) are for Human QA correlation only.
 * They do NOT constitute E5 evidence without player-visible video/GIF (see QA006_QA008_VERIFICATION.md).
 */
import type { GameState } from "../game/core";
import {
  isRoundCompleteForLiving,
  playerCanActInCurrentTrick,
} from "../game/core";

export const ENABLE_MULTIPLAYER_PRESENTATION_VERIFY = true;

export type FlightVerifySource =
  | "commitHumanPlayWithFlight"
  | "GamePlayArea"
  | "sync"
  | "reconnect";

export type FlightVerifyRemoveReason =
  | "sync"
  | "land"
  | "clear"
  | "complete"
  | "cancel";

let flightSeq = 0;

export function nextFlightVerifyId(playKey: string, source: FlightVerifySource): string {
  flightSeq += 1;
  return `${playKey}|${source}|${flightSeq}`;
}

function ts(): string {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now().toFixed(1);
  }
  return Date.now().toString();
}

function fo(ids: string[] | undefined): string {
  return (ids ?? []).join(",");
}

/** Mirror GameScreen isHumanTurnServer — keep in sync for verify logs only. */
export function verifyIsHumanTurnServer(
  state: GameState,
  myPlayerId: string | null | undefined,
  trickPauseActive = false,
): boolean {
  if (!myPlayerId || trickPauseActive || state.tenRulePending) return false;
  const human = state.players.find((p) => p.id === myPlayerId);
  if (!human) return false;
  const localIsOut =
    state.finishedOrder.includes(human.id) || human.hand.length === 0;
  if (localIsOut) return false;
  const runOnTopActive =
    !!state.runOnTop?.active &&
    state.runOnTop.playerIndex === state.currentPlayerIndex &&
    state.players[state.runOnTop.playerIndex]?.id === myPlayerId;
  const humanIsAuthoritativeCurrent =
    state.players[state.currentPlayerIndex]?.id === myPlayerId;
  return (
    runOnTopActive ||
    (humanIsAuthoritativeCurrent &&
      playerCanActInCurrentTrick(state, state.currentPlayerIndex))
  );
}

export function logRoundSyncReceived(input: {
  roundComplete: boolean;
  roundOver: boolean;
  currentPlayerIndex: number;
  finishedOrder: string[];
  isHumanTurn: boolean;
  stateVersion?: number | null;
}): void {
  if (!ENABLE_MULTIPLAYER_PRESENTATION_VERIFY) return;
  console.log(
    "[ROUND] SYNC_RECEIVED",
    `t=${ts()}`,
    `roundComplete=${input.roundComplete}`,
    `roundOver=${input.roundOver}`,
    `currentPlayerIndex=${input.currentPlayerIndex}`,
    `finishedOrder=[${fo(input.finishedOrder)}]`,
    `isHumanTurn=${input.isHumanTurn}`,
    input.stateVersion != null ? `stateVersion=${input.stateVersion}` : "",
  );
  if (input.roundComplete && !input.roundOver) {
    console.warn(
      "[ROUND] E5_CANDIDATE",
      "roundComplete=true roundOver=false — Play may still be enabled until roundEnded",
    );
  }
}

export function logRoundEnded(input: {
  roundOver: boolean;
  finishedOrder: string[];
}): void {
  if (!ENABLE_MULTIPLAYER_PRESENTATION_VERIFY) return;
  console.log(
    "[ROUND] ROUND_ENDED",
    `t=${ts()}`,
    `roundOver=${input.roundOver}`,
    `finishedOrder=[${fo(input.finishedOrder)}]`,
  );
}

export function logPlayAttempt(input: {
  roundComplete: boolean;
  roundOver: boolean;
  isHumanTurn: boolean;
  actionPending: boolean;
  playKey?: string;
}): void {
  if (!ENABLE_MULTIPLAYER_PRESENTATION_VERIFY) return;
  console.log(
    "[PLAY] PLAY_ATTEMPT",
    `t=${ts()}`,
    `roundComplete=${input.roundComplete}`,
    `roundOver=${input.roundOver}`,
    `isHumanTurn=${input.isHumanTurn}`,
    `actionPending=${input.actionPending}`,
    input.playKey ? `playKey=${input.playKey}` : "",
  );
  if (input.roundComplete && !input.roundOver) {
    console.warn(
      "[PLAY] E5_VERIFIED",
      "PLAY_ATTEMPT while roundComplete=true and roundOver=false",
    );
  }
}

export function logFlightCreated(input: {
  playKey: string;
  source: FlightVerifySource;
  flightId: string;
  fromLocalHand?: boolean;
}): void {
  if (!ENABLE_MULTIPLAYER_PRESENTATION_VERIFY) return;
  console.log(
    "[FLIGHT] CREATED",
    `t=${ts()}`,
    `playKey=${input.playKey}`,
    `source=${input.source}`,
    `flightId=${input.flightId}`,
    input.fromLocalHand != null ? `fromLocalHand=${input.fromLocalHand}` : "",
  );
}

export function logFlightStarted(input: {
  playKey: string;
  flightId: string;
}): void {
  if (!ENABLE_MULTIPLAYER_PRESENTATION_VERIFY) return;
  console.log(
    "[FLIGHT] STARTED",
    `t=${ts()}`,
    `playKey=${input.playKey}`,
    `flightId=${input.flightId}`,
  );
}

export function logFlightLanded(input: {
  playKey: string;
  flightId: string;
}): void {
  if (!ENABLE_MULTIPLAYER_PRESENTATION_VERIFY) return;
  console.log(
    "[FLIGHT] LANDED",
    `t=${ts()}`,
    `playKey=${input.playKey}`,
    `flightId=${input.flightId}`,
  );
}

export function logFlightRemoved(input: {
  playKey: string;
  flightId: string;
  reason: FlightVerifyRemoveReason;
}): void {
  if (!ENABLE_MULTIPLAYER_PRESENTATION_VERIFY) return;
  console.log(
    "[FLIGHT] REMOVED",
    `t=${ts()}`,
    `playKey=${input.playKey}`,
    `flightId=${input.flightId}`,
    `reason=${input.reason}`,
  );
}

/** Track CREATED events per playKey to detect duplicate sources (QA-008). */
const createdByPlayKey = new Map<
  string,
  Array<{ source: FlightVerifySource; flightId: string }>
>();

const latestFlightIdByPlayKey = new Map<string, string>();

export function flightVerifyIdForPlayKey(playKey: string): string {
  return latestFlightIdByPlayKey.get(playKey) ?? playKey;
}

export function noteFlightCreatedForDedup(input: {
  playKey: string;
  source: FlightVerifySource;
  flightId: string;
  fromLocalHand?: boolean;
}): void {
  latestFlightIdByPlayKey.set(input.playKey, input.flightId);
  const list = createdByPlayKey.get(input.playKey) ?? [];
  list.push({ source: input.source, flightId: input.flightId });
  createdByPlayKey.set(input.playKey, list);
  logFlightCreated(input);
  if (list.length >= 2) {
    const sources = list.map((e) => e.source).join("+");
    console.warn(
      "[FLIGHT] E5_CANDIDATE",
      `playKey=${input.playKey} CREATED×${list.length} sources=${sources}`,
      list.map((e) => e.flightId).join(" "),
    );
    const uniqueSources = new Set(list.map((e) => e.source));
    if (uniqueSources.size >= 2) {
      console.warn(
        "[FLIGHT] E5_VERIFIED",
        `Duplicate flight generation playKey=${input.playKey} sources=${sources}`,
      );
    }
  }
}

const startedByPlayKey = new Map<string, string[]>();

export function noteFlightStartedForDedup(playKey: string, flightId: string): void {
  const list = startedByPlayKey.get(playKey) ?? [];
  list.push(flightId);
  startedByPlayKey.set(playKey, list);
  logFlightStarted({ playKey, flightId });
  if (list.length >= 2) {
    console.warn(
      "[FLIGHT] E5_CANDIDATE",
      `playKey=${playKey} STARTED×${list.length}`,
      list.join(" "),
    );
  }
}

export function roundCompleteForLiving(state: GameState | null | undefined): boolean {
  if (!state) return false;
  return isRoundCompleteForLiving(state) && !state.tenRulePending;
}
