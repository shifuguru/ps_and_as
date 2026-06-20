/**
 * Structured logging for round transition / ceremony / trade convergence.
 * Warnings and errors are always emitted; verbose traces only in dev.
 */

export type RoundTransitionDetail = Record<string, unknown>;

const VERBOSE =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production";

export function handLengthSummary(
  playerHands: Record<string, { length?: number }[] | unknown> | null | undefined,
): Record<string, number> {
  if (!playerHands) return {};
  const out: Record<string, number> = {};
  for (const [id, cards] of Object.entries(playerHands)) {
    out[id] = Array.isArray(cards) ? cards.length : 0;
  }
  return out;
}

export function logRoundTransitionWarn(
  message: string,
  detail?: RoundTransitionDetail,
): void {
  if (detail && Object.keys(detail).length > 0) {
    console.warn(`[ROUND-TRANSITION] ${message}`, detail);
  } else {
    console.warn(`[ROUND-TRANSITION] ${message}`);
  }
}

export function logRoundTransitionError(
  message: string,
  detail?: RoundTransitionDetail,
): void {
  if (detail && Object.keys(detail).length > 0) {
    console.error(`[ROUND-TRANSITION] ${message}`, detail);
  } else {
    console.error(`[ROUND-TRANSITION] ${message}`);
  }
}

export function logRoundTransitionVerbose(
  message: string,
  detail?: RoundTransitionDetail,
): void {
  if (!VERBOSE) return;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[ROUND-TRANSITION] ${message}`, detail);
  } else {
    console.log(`[ROUND-TRANSITION] ${message}`);
  }
}

export function logCeremonyTradeResolved(detail: {
  roundKey?: string;
  freshRound?: boolean;
  serverPendingKeys: string[];
  tradeCount: number;
  onlineMultiplayer: boolean;
}): void {
  logRoundTransitionVerbose("online ceremony trades resolved", detail);
}

export function logCeremonyTradeDivergence(detail: {
  roundKey?: string;
  freshRound?: boolean;
  serverTradeCount: number;
  localTradeCount: number;
  serverPendingKeys: string[];
  localTradeKeys: string[];
}): void {
  logRoundTransitionWarn("trade count mismatch — server authoritative", detail);
}

export function logFreshRoundPresidentTradeWarning(detail: {
  roundKey?: string;
  freshRound: boolean;
  localPresident: boolean;
  serverPresident: boolean;
}): void {
  logRoundTransitionWarn("freshRound but president trade detected", detail);
}

export function logTradesCompleteReceived(detail: {
  roundKey?: string;
  handLengths: Record<string, number>;
  hasPrep: boolean;
  hasTradePhase: boolean;
}): void {
  logRoundTransitionVerbose("tradesComplete received", detail);
}

export function logFinalizeCeremonyRound(detail: {
  roundKey?: string;
  handLengths: Record<string, number>;
  handSource: "serverHands" | "pendingTradesCompleteRef" | "none";
}): void {
  logRoundTransitionVerbose("finalizeCeremonyRound invoked", detail);
}

export function logFinalizeCeremonyAborted(detail: {
  roundKey?: string;
  reason: string;
  handSource: "serverHands" | "pendingTradesCompleteRef" | "none";
}): void {
  logRoundTransitionError("finalizeCeremonyRound aborted", detail);
}

export function logPostTradeOpenerReconciled(detail?: RoundTransitionDetail): void {
  logRoundTransitionWarn("post-trade opener reconciled from playerHands", detail);
}
