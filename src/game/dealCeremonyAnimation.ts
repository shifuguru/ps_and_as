import type { Card } from "./ruleset";
import type { ClientPendingTrade } from "./roundPrep";

/**
 * User / room preference: skip shuffle + deal *flights* in DealCeremonyOverlay only.
 * Does not skip executeCeremonyDeal, server dealing, role trades, or finalizeCeremonyRound.
 */
export function resolveSkipDealAnimations(options: {
  onlineMultiplayer: boolean;
  roomSkipDealAnimations: boolean;
  localSkipDealAnimations: boolean;
}): boolean {
  if (options.onlineMultiplayer) {
    return options.roomSkipDealAnimations;
  }
  return options.localSkipDealAnimations;
}

export type CeremonyLaunchMode =
  | "animated"
  | "skipDealPhases"
  | "finalizeNow"
  | "tradeNow"
  | "awaitReshuffle";

export function resolveCeremonyLaunchMode(options: {
  needsDealerReshuffle?: boolean;
  trades: ClientPendingTrade[];
  skipDealAnimations: boolean;
  shouldFinalizeEarly: boolean;
}): CeremonyLaunchMode {
  if (options.needsDealerReshuffle) return "awaitReshuffle";
  if (options.shouldFinalizeEarly) return "finalizeNow";
  if (!options.skipDealAnimations) return "animated";
  const tradesPending =
    options.trades.length > 0 &&
    !options.trades.every((t) => t.completed);
  if (tradesPending) return "skipDealPhases";
  return "tradeNow";
}

export type CeremonyPrepHands = Record<string, Card[]> | null;
