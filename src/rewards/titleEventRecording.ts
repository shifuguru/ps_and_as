import type { Card } from "../game/ruleset";
import { isJoker } from "../game/core";
import type { ClientPendingTrade } from "../game/roundPrep";
import {
  recordJokersGivenInTrade,
  recordJokersInDeal,
  recordJokersReceivedInTrade,
} from "../services/playerStats";

export function countJokersInCards(cards: readonly Card[]): number {
  let n = 0;
  for (const c of cards) {
    if (isJoker(c)) n += 1;
  }
  return n;
}

export function recordDealJokersForHand(hand: readonly Card[]): void {
  const count = countJokersInCards(hand);
  if (count > 0) void recordJokersInDeal(count);
}

export function recordCompletedTradeJokers(
  trade: ClientPendingTrade,
  localPlayerId: string,
): void {
  if (!trade.completed || !localPlayerId) return;
  const jokersIncoming = countJokersInCards(trade.incoming);
  if (trade.winnerId === localPlayerId && jokersIncoming > 0) {
    void recordJokersReceivedInTrade(jokersIncoming);
  }
  if (trade.loserId === localPlayerId && jokersIncoming > 0) {
    void recordJokersGivenInTrade(jokersIncoming);
  }
}

export function recordCompletedTradesForLocalPlayer(
  trades: readonly ClientPendingTrade[],
  localPlayerId: string,
): void {
  for (const trade of trades) {
    recordCompletedTradeJokers(trade, localPlayerId);
  }
}
