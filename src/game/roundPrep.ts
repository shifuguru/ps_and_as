import { rankIndex, type GameState } from "./core";
import {
  Card,
  Player,
  createDeck,
  dealCards,
  shuffleDeck,
  shuffleDeckSeeded,
} from "./ruleset";
import {
  DEAD_HAND_ID,
  isDeadHandPlayer,
  livingFinishedOrder,
  livingPlayers,
} from "./deadHand";
import {
  type DealerContext,
  resolveLeadPlayerIndexAfterTrades,
  resolveOpeningPlayerIndex,
} from "../utils/tableSeats";
import { applyFinishOrderRoles } from "../utils/roundRoles";
import { isCpuPlayer } from "../utils/localPlayer";

export type ClientPendingTrade = {
  key: "president" | "vicePresident";
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  incoming: Card[];
  returnCount: number;
  completed?: boolean;
};

export function serverRoleToPlayerRole(role: string | undefined): Player["role"] {
  switch (role) {
    case "president":
      return "President";
    case "vice_president":
      return "Vice President";
    case "vice_asshole":
      return "Vice Asshole";
    case "asshole":
      return "Asshole";
    default:
      return "Neutral";
  }
}

export function applyServerRolesToPlayers(
  players: Player[],
  roles: Record<string, string> | undefined,
): void {
  if (!roles) return;
  for (const player of players) {
    if (isDeadHandPlayer(player)) {
      player.role = "Neutral";
      continue;
    }
    player.role = serverRoleToPlayerRole(roles[player.id]);
  }
}

export function assignPlayerRoles(
  players: Player[],
  finishedOrder: string[],
): void {
  applyFinishOrderRoles(players, finishedOrder);
}

export function pickHighestCards(hand: Card[], n: number): Card[] {
  if (n <= 0) return [];
  return [...hand]
    .sort((a, b) => rankIndex(b.value) - rankIndex(a.value))
    .slice(0, n);
}

export function pickLowestCards(hand: Card[], n: number): Card[] {
  if (n <= 0) return [];
  return [...hand]
    .sort((a, b) => rankIndex(a.value) - rankIndex(b.value))
    .slice(0, n);
}

export function mandatoryTradeCounts(playerCount: number): {
  president: number;
  vice: number;
} {
  return {
    president: playerCount >= 5 ? 2 : 1,
    vice: playerCount >= 5 ? 1 : 0,
  };
}

function removeCardsFromHand(hand: Card[], cards: Card[]) {
  for (const rc of cards) {
    const idx = hand.findIndex((h) => h.suit === rc.suit && h.value === rc.value);
    if (idx >= 0) hand.splice(idx, 1);
  }
}

/** Asshole / Vice Asshole give best cards — president picks return separately. */
export function applyMandatoryTrades(players: Player[]): ClientPendingTrade[] {
  const pending: ClientPendingTrade[] = [];
  const activePlayers = livingPlayers(players);
  const { president: presCount, vice: viceCount } = mandatoryTradeCounts(
    activePlayers.length,
  );
  const byRole = (role: Player["role"]) =>
    activePlayers.find((p) => p.role === role);

  const president = byRole("President");
  const asshole = byRole("Asshole");
  const vicePres = byRole("Vice President");
  const viceAss = byRole("Vice Asshole");

  if (president && asshole && presCount > 0) {
    const given = pickHighestCards(asshole.hand, presCount);
    removeCardsFromHand(asshole.hand, given);
    pending.push({
      key: "president",
      winnerId: president.id,
      loserId: asshole.id,
      winnerName: president.name,
      loserName: asshole.name,
      incoming: given,
      returnCount: given.length,
    });
  }

  if (vicePres && viceAss && viceCount > 0) {
    const given = pickHighestCards(viceAss.hand, viceCount);
    removeCardsFromHand(viceAss.hand, given);
    pending.push({
      key: "vicePresident",
      winnerId: vicePres.id,
      loserId: viceAss.id,
      winnerName: vicePres.name,
      loserName: viceAss.name,
      incoming: given,
      returnCount: given.length,
    });
  }

  return pending;
}

/** Offline: president/VP CPUs instantly return their lowest cards. */
export function autoCompleteCpuWinnerTrades(
  players: Player[],
  trades: ClientPendingTrade[],
): boolean {
  let changed = false;
  for (const trade of trades) {
    if (trade.completed) continue;
    const winner = players.find((p) => p.id === trade.winnerId);
    if (!winner || !isCpuPlayer(winner)) continue;
    const selected = pickLowestCards(winner.hand, trade.returnCount);
    if (completeWinnerReturn(players, trade, selected)) {
      changed = true;
    }
  }
  return changed;
}

export function completeWinnerReturn(
  players: Player[],
  trade: ClientPendingTrade,
  selectedReturn: Card[],
): boolean {
  if (selectedReturn.length !== trade.returnCount) return false;

  const winner = players.find((p) => p.id === trade.winnerId);
  const loser = players.find((p) => p.id === trade.loserId);
  if (!winner || !loser) return false;

  for (const c of selectedReturn) {
    const found = winner.hand.some(
      (h) => h.suit === c.suit && h.value === c.value,
    );
    if (!found) return false;
  }

  removeCardsFromHand(winner.hand, selectedReturn);
  winner.hand = winner.hand.concat(trade.incoming);
  loser.hand = loser.hand.concat(selectedReturn);
  trade.completed = true;
  return true;
}

export function dealFreshHands(players: Player[], dealSeed?: number): void {
  const deck =
    dealSeed != null
      ? shuffleDeckSeeded(createDeck(), dealSeed)
      : shuffleDeck(createDeck());
  for (const p of players) p.hand = [];
  dealCards(deck, players);
}

export function clonePlayersForRound(players: Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    hand: [...p.hand],
  }));
}

/** Apply authoritative post-trade hands from server (all seats, not just local). */
export function applyServerPlayerHands(
  players: Player[],
  playerHands: Record<string, Card[]> | null | undefined,
): Player[] {
  if (!playerHands) return players;
  return players.map((p) =>
    playerHands[p.id] ? { ...p, hand: [...playerHands[p.id]] } : p,
  );
}

/** Who leads after mandatory trades: 3♣ holder among living players when prior round. */
export function resolveOpenerAfterRoleTrades(
  players: Player[],
  dealerOptions?: DealerContext,
): number {
  const dealerContext: DealerContext = dealerOptions ?? {};
  const priorRound =
    (dealerContext.lastRoundOrder?.length ?? 0) >= 2 ||
    (dealerContext.finishedOrder?.length ?? 0) >= 2;
  if (!priorRound) {
    return resolveOpeningPlayerIndex(players, dealerContext);
  }
  const afterTrades = resolveLeadPlayerIndexAfterTrades(players, dealerContext);
  if (afterTrades >= 0) return afterTrades;
  return resolveOpeningPlayerIndex(players, dealerContext);
}

export function buildFreshRoundState(
  prev: GameState,
  players: Player[],
  dealerOptions?: DealerContext,
  /** Use when `players` have hidden/empty hands (deal ceremony UI state). */
  openingPlayerIndex?: number,
): GameState {
  const lastRoundOrder =
    livingFinishedOrder(players, prev.finishedOrder).length >= 2
      ? livingFinishedOrder(players, prev.finishedOrder)
      : livingFinishedOrder(players, prev.lastRoundOrder ?? []);

  const dealerContext: DealerContext = {
    ...dealerOptions,
    lastRoundOrder:
      lastRoundOrder.length >= 2
        ? lastRoundOrder
        : dealerOptions?.lastRoundOrder ?? prev.lastRoundOrder,
  };
  let openerIdx = openingPlayerIndex;
  if (openerIdx == null) {
    openerIdx = resolveOpenerAfterRoleTrades(players, dealerContext);
  }
  if (openerIdx < 0 || openerIdx >= players.length) {
    const fallback = players.findIndex((p) => !isDeadHandPlayer(p));
    openerIdx = fallback >= 0 ? fallback : 0;
  }

  return {
    ...prev,
    players,
    pile: [],
    pileHistory: [],
    pileOwners: [],
    tableStacks: [],
    tableStackOwners: [],
    passCount: 0,
    finishedOrder: [],
    lastRoundOrder: lastRoundOrder.length >= 2 ? lastRoundOrder : prev.lastRoundOrder,
    started: true,
    lastPlayPlayerIndex: null,
    mustPlay: true,
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [] },
    tenRule: { active: false, direction: null },
    tenRulePending: false,
    fourOfAKindChallenge: undefined,
    lastClear: undefined,
    currentPlayerIndex: openerIdx,
  } as GameState;
}

export function allTradesCompleted(trades: ClientPendingTrade[]): boolean {
  return trades.length === 0 || trades.every((t) => t.completed);
}

/** Round-robin deal order for animation: [p0,p1,p2,..., p0,p1,...] */
export function dealAnimationSteps(playerIds: string[], cardsEach: number): string[] {
  const activeIds = playerIds.filter((id) => id !== DEAD_HAND_ID);
  const steps: string[] = [];
  for (let round = 0; round < cardsEach; round += 1) {
    for (const id of activeIds) {
      steps.push(id);
    }
  }
  return steps;
}
