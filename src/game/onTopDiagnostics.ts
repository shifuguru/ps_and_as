/**
 * Structured diagnostics for 10-rule / on-top validation (rules unchanged).
 */

import type { Card } from "./ruleset";

const RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

function rankIndex(value: number): number {
  const idx = RANK_ORDER.indexOf(value);
  return idx >= 0 ? idx : -1;
}

type TenRuleState = {
  active: boolean;
  direction: "higher" | "lower" | null;
};

type RunOnTopState = {
  active: boolean;
  playerIndex: number;
};

type TrickAction = {
  type: string;
  playerId?: string;
  cards?: Card[];
  tenRuleDirection?: "higher" | "lower";
};

type TrickHistoryLike = {
  actions?: TrickAction[];
};

export type OnTopDiagnosticDetail = Record<string, unknown>;

const ENABLED =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.EXPO_PUBLIC_ON_TOP_DIAG === "1";

function log(event: string, detail: OnTopDiagnosticDetail): void {
  if (!ENABLED) return;
  console.warn(`[ON-TOP-DIAG] ${event}`, detail);
}

export function logGrantRunOnTopBeat(
  state: {
    tenRule?: TenRuleState;
    runOnTop?: RunOnTopState;
    pile?: Card[];
    currentTrick?: TrickHistoryLike;
  },
  leaderIndex: number,
): void {
  log("grantRunOnTopBeat", {
    leaderIndex,
    pile: state.pile?.map((c) => c.value),
    tenRule: state.tenRule,
    runOnTop: state.runOnTop,
    recoveredDirection: resolveDirectionForLog(state.currentTrick),
  });
}

export function logResolveEffectiveTenRule(
  state: {
    tenRule?: TenRuleState;
    runOnTop?: RunOnTopState;
    pile?: Card[];
    currentTrick?: TrickHistoryLike;
  },
  result: TenRuleState,
): void {
  if (!state.runOnTop?.active) return;
  log("resolveEffectiveTenRule", {
    pile: state.pile?.map((c) => c.value),
    tenRule: state.tenRule,
    runOnTop: state.runOnTop,
    recoveredDirection: resolveDirectionForLog(state.currentTrick),
    effective: result,
  });
}

export function logResolveTenRuleDirectionFromTrick(
  currentTrick: TrickHistoryLike | undefined,
  result: "higher" | "lower" | null,
): void {
  log("resolveTenRuleDirectionFromTrick", {
    actionCount: currentTrick?.actions?.length ?? 0,
    result,
    lastPlays: (currentTrick?.actions ?? [])
      .filter((a) => a.type === "play")
      .slice(-3)
      .map((a) => ({
        playerId: a.playerId,
        values: a.cards?.map((c) => c.value),
        tenRuleDirection: a.tenRuleDirection ?? null,
      })),
  });
}

export function logRunOnTopPlayRejected(
  state: {
    tenRule?: TenRuleState;
    runOnTop?: RunOnTopState;
    pile?: Card[];
    currentTrick?: TrickHistoryLike;
  },
  cards: Card[],
  effectiveTenRule: TenRuleState,
  rejectionReason: string,
): void {
  log("isValidPlay rejected on-top turn", {
    pile: state.pile?.map((c) => c.value),
    runOnTop: state.runOnTop,
    tenRule: state.tenRule,
    effectiveTenRule,
    recoveredDirection: resolveDirectionForLog(state.currentTrick),
    playAttempted: cards.map((c) => c.value),
    playCount: cards.length,
    rejectionReason,
  });
}

function resolveDirectionForLog(
  currentTrick?: TrickHistoryLike,
): "higher" | "lower" | null {
  if (!currentTrick?.actions?.length) return null;
  for (let i = currentTrick.actions.length - 1; i >= 0; i--) {
    const action = currentTrick.actions[i];
    if (action.type !== "play" || !action.cards?.length) continue;
    return action.tenRuleDirection ?? null;
  }
  return null;
}

/** Mirror isValidPlay §9 ten-rule comparison for diagnostic messages only. */
export function diagnoseTenRuleOnTopRejection(
  cards: Card[],
  pile: Card[],
  tenRule: TenRuleState | undefined,
  _runOnTop: boolean,
): string | null {
  if (!cards.length) return "empty play";
  const pileIsUniform =
    pile.length > 0 && pile.every((c) => c.value === pile[0].value);
  const pileIsTenSet = pileIsUniform && pile[0].value === 10;
  if (!tenRule?.active || !tenRule.direction) {
    return "ten-rule: inactive or direction null";
  }
  if (!pileIsTenSet) {
    return "ten-rule: pile is not uniform tens";
  }
  const playCount = cards.length;
  const pileCount = pile.length;
  const playRank = rankIndex(cards[0].value);
  const pileRank = rankIndex(pile[0].value);
  const pileLabel = pile[0].value;
  if (playCount !== pileCount) {
    return `10 ${tenRule.direction}: play count ${playCount} must match pile count ${pileCount}`;
  }
  if (tenRule.direction === "higher") {
    if (playRank <= pileRank) {
      return `10 Higher: play rank must be higher than ${pileLabel}`;
    }
    return null;
  }
  if (tenRule.direction === "lower") {
    if (playRank >= pileRank) {
      return `10 Lower: play rank must be lower than ${pileLabel}`;
    }
    return null;
  }
  return "ten-rule direction unset";
}
