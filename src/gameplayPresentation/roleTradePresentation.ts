import type { ClientPendingTrade } from "../game/roundPrep";
import type { Card } from "../game/ruleset";

export const TRADE_RESULT_DISMISS_MS = 4000;

export function roleTradeKey(trade: ClientPendingTrade): string {
  return `${trade.key}:${trade.winnerId}:${trade.loserId}`;
}

export function localRoleTrade(
  trades: ClientPendingTrade[],
  localPlayerId: string | null,
): ClientPendingTrade | null {
  if (!localPlayerId) return null;
  return trades.find(
    (trade) => trade.winnerId === localPlayerId || trade.loserId === localPlayerId,
  ) ?? null;
}

export function completedLocalRoleTrade(
  trade: ClientPendingTrade,
  localPlayerId: string | null,
  returnedCards: Card[],
): ClientPendingTrade | null {
  if (!localPlayerId || trade.loserId !== localPlayerId || returnedCards.length === 0) {
    return null;
  }
  return {
    ...trade,
    incoming: [...trade.incoming],
    completed: true,
    returnedCards: [...returnedCards],
  };
}

export function displayedLocalRoleTrade(
  trade: ClientPendingTrade | null,
  result: ClientPendingTrade | null,
  shownResultKey: string | null,
): ClientPendingTrade | null {
  if (result) return result;
  if (!trade || trade.completed || roleTradeKey(trade) === shownResultKey) return null;
  return trade;
}

export function roleTradeCardGroups(
  trade: ClientPendingTrade,
  localPlayerId: string,
  selectedCards: Card[],
): { label: string; cards: Card[] }[] {
  const outgoing = trade.returnedCards ?? selectedCards;
  return trade.winnerId === localPlayerId
    ? [
        { label: `From ${trade.loserName}`, cards: trade.incoming },
        { label: "You give", cards: outgoing },
      ]
    : [
        { label: "You give (best)", cards: trade.incoming },
        { label: `From ${trade.winnerName}`, cards: outgoing },
      ];
}
