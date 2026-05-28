import { rankIndex, type GameState } from "./core";
import {
  Card,
  Player,
  createDeck,
  dealCards,
  shuffleDeck,
  shuffleDeckSeeded,
} from "./ruleset";
import { DEAD_HAND_ID, livingPlayerIds, livingPlayers } from "./deadHand";
import {
  type DealerContext,
  resolveOpeningPlayerIndex,
} from "../utils/tableSeats";

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
    player.role = serverRoleToPlayerRole(roles[player.id]);
  }
}

export function assignPlayerRoles(
  players: Player[],
  finishedOrder: string[],
): void {
  const activePlayers = livingPlayers(players);
  activePlayers.forEach((p) => {
    p.role = "Neutral";
  });
  const livingOrder = finishedOrder.filter((id) =>
    activePlayers.some((p) => p.id === id),
  );
  const order =
    livingOrder.length === activePlayers.length
      ? livingOrder
      : activePlayers.map((p) => p.id);
  const count = activePlayers.length;

  const setRole = (id: string, role: Player["role"]) => {
    const pl = activePlayers.find((x) => x.id === id);
    if (pl) pl.role = role;
  };

  if (order.length >= 1) setRole(order[0], "President");
  if (count >= 5) {
    setRole(order[1], "Vice President");
    setRole(order[count - 2], "Vice Asshole");
    setRole(order[count - 1], "Asshole");
  } else if (count >= 2) {
    setRole(order[count - 1], "Asshole");
  }
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

export function buildFreshRoundState(
  prev: GameState,
  players: Player[],
  dealerOptions?: DealerContext,
): GameState {
  const livingIds = livingPlayerIds(players);
  const lastRoundOrder =
    prev.finishedOrder.filter((id) => livingIds.includes(id)).length >= 2
      ? prev.finishedOrder.filter((id) => livingIds.includes(id))
      : prev.lastRoundOrder?.filter((id) => livingIds.includes(id)) ?? [];

  const dealerContext: DealerContext = {
    ...dealerOptions,
    lastRoundOrder:
      lastRoundOrder.length >= 2
        ? lastRoundOrder
        : dealerOptions?.lastRoundOrder ?? prev.lastRoundOrder,
  };
  const openerIdx = resolveOpeningPlayerIndex(players, dealerContext);

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
