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
  applyDeadHandAfterDeal,
  isDeadHandPlayer,
  livingFinishedOrder,
  livingPlayers,
  needsRoundOneDealerReshuffle,
} from "./deadHand";
import {
  type DealerContext,
  buildDealerContext,
  resolveLeadPlayerIndexAfterTrades,
  resolveFirstRoundLeadPlayerIndex,
  resolveOpeningPlayerIndex,
} from "../utils/tableSeats";
import { applyFinishOrderRoles, supportsViceRoles } from "../utils/roundRoles";
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
  /** Cards the winner returned to the loser (set when trade completes). */
  returnedCards?: Card[];
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
    president: supportsViceRoles(playerCount) ? 2 : 1,
    vice: supportsViceRoles(playerCount) ? 1 : 0,
  };
}

export type AssholeStreakState = {
  consecutiveAssholeId: string | null;
  consecutiveAssholeCount: number;
  freshRound: boolean;
};

/** Asshole is last in living finish order. */
export function assholeIdFromFinishOrder(
  players: Player[],
  finishedOrder: string[],
): string | null {
  const order = livingFinishedOrder(players, finishedOrder);
  if (order.length < 2) return null;
  return order[order.length - 1];
}

/** Update streak after a round completes; resets after a fresh round. */
export function advanceAssholeStreakAfterRound(
  prev: AssholeStreakState,
  finishedOrder: string[],
  players: Player[],
): AssholeStreakState {
  const assholeId = assholeIdFromFinishOrder(players, finishedOrder);
  if (!assholeId) {
    return {
      consecutiveAssholeId: prev.consecutiveAssholeId,
      consecutiveAssholeCount: prev.consecutiveAssholeCount,
      freshRound: false,
    };
  }

  if (prev.freshRound) {
    return {
      consecutiveAssholeId: assholeId,
      consecutiveAssholeCount: 1,
      freshRound: false,
    };
  }

  if (prev.consecutiveAssholeId === assholeId) {
    return {
      consecutiveAssholeId: assholeId,
      consecutiveAssholeCount: prev.consecutiveAssholeCount + 1,
      freshRound: false,
    };
  }

  return {
    consecutiveAssholeId: assholeId,
    consecutiveAssholeCount: 1,
    freshRound: false,
  };
}

/** Same Asshole three rounds running → next round skips President trade. */
export function shouldSkipPresidentAssholeTrade(
  streak: Pick<AssholeStreakState, "consecutiveAssholeCount">,
): boolean {
  return streak.consecutiveAssholeCount >= 3;
}

export type MandatoryTradeOptions = {
  skipPresidentTrade?: boolean;
};

function removeCardsFromHand(hand: Card[], cards: Card[]) {
  for (const rc of cards) {
    const idx = hand.findIndex((h) => h.suit === rc.suit && h.value === rc.value);
    if (idx >= 0) hand.splice(idx, 1);
  }
}

/** Asshole / Vice Asshole give best cards — president picks return separately. */
export function applyMandatoryTrades(
  players: Player[],
  options?: MandatoryTradeOptions,
): ClientPendingTrade[] {
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

  if (president && asshole && presCount > 0 && !options?.skipPresidentTrade) {
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

export type ServerPendingTrade = {
  fromId: string;
  count: number;
  incoming: Card[];
  selected?: Card[] | null;
};

export type ServerPendingTrades = {
  president?: ServerPendingTrade;
  vicePresident?: ServerPendingTrade;
};

/** Authoritative pending trades from the server — one entry per role, never duplicated. */
export function buildTradesFromServerPending(
  players: Player[],
  roles: Record<string, string>,
  pending: ServerPendingTrades,
): ClientPendingTrade[] {
  const trades: ClientPendingTrade[] = [];
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Player";

  if (pending.president) {
    const presId = Object.keys(roles).find((k) => roles[k] === "president");
    const trade = pending.president;
    const loser = players.find((p) => p.id === trade.fromId);
    if (presId && loser && !isDeadHandPlayer(loser)) {
      trades.push({
        key: "president",
        winnerId: presId,
        loserId: trade.fromId,
        winnerName: nameOf(presId),
        loserName: nameOf(trade.fromId),
        incoming: [...(trade.incoming ?? [])],
        returnCount: trade.count ?? trade.incoming?.length ?? 1,
        completed: !!trade.selected,
      });
    }
  }

  if (pending.vicePresident) {
    const vpId = Object.keys(roles).find((k) => roles[k] === "vice_president");
    const trade = pending.vicePresident;
    const loser = players.find((p) => p.id === trade.fromId);
    if (vpId && loser && !isDeadHandPlayer(loser)) {
      trades.push({
        key: "vicePresident",
        winnerId: vpId,
        loserId: trade.fromId,
        winnerName: nameOf(vpId),
        loserName: nameOf(trade.fromId),
        incoming: [...(trade.incoming ?? [])],
        returnCount: trade.count ?? trade.incoming?.length ?? 1,
        completed: !!trade.selected,
      });
    }
  }

  return trades;
}

/**
 * Online: apply server pending-trade snapshot without restarting deal ceremony.
 * Only while this deal's ceremony is already in progress — not between rounds
 * (gameStateSync can arrive before nextRoundStarting).
 */
export function shouldSyncMidTradeFromServer(options: {
  onlineMultiplayer: boolean;
  hasPendingTrades: boolean;
  awaitingDealCeremony: boolean;
  roundOver: boolean;
  roundKey: string;
  ceremonyStartedForRound: string | null;
  ceremonyDoneForRound: string | null;
  hasLocalTradePhase: boolean;
}): boolean {
  if (!options.onlineMultiplayer || !options.hasPendingTrades) return false;
  if (options.awaitingDealCeremony || options.roundOver) return false;
  if (options.ceremonyDoneForRound === options.roundKey) return false;
  return (
    options.ceremonyStartedForRound === options.roundKey ||
    options.hasLocalTradePhase
  );
}

/** True when the server has no outstanding mandatory trade picks. */
export function serverPendingTradesComplete(
  pending: ServerPendingTrades | null | undefined,
): boolean {
  if (!pending) return true;
  const keys = Object.keys(pending);
  if (keys.length === 0) return true;
  return keys.every((k) => !!pending[k as keyof ServerPendingTrades]?.selected);
}

/** Merge server trade completion flags into local ceremony trades (bot auto-picks, etc.). */
export function mergeTradesFromServerPending(
  trades: ClientPendingTrade[],
  serverPending: ServerPendingTrades | null | undefined,
): ClientPendingTrade[] {
  if (!serverPending) return trades;
  return trades.map((t) => {
    const serv = serverPending[t.key];
    if (!serv?.selected || t.completed) return t;
    return {
      ...t,
      completed: true,
      returnedCards: [...(serv.selected ?? [])],
    };
  });
}

export type TradePhaseFromServer = {
  baseState: GameState;
  players: Player[];
  trades: ClientPendingTrade[];
};

/** Rejoin or mid-trade sync — rebuild trade UI from authoritative server state. */
export function buildTradePhaseFromServerState(
  parsed: GameState,
  options?: {
    pendingTrades?: ServerPendingTrades | null;
    roles?: Record<string, string> | null;
    playerHands?: Record<string, Card[]> | null;
  },
): TradePhaseFromServer | null {
  const pending = options?.pendingTrades ?? null;
  const roles = options?.roles ?? null;
  if (!pending || Object.keys(pending).length === 0 || !roles) return null;

  const roleValues = Object.values(roles);
  if (!roleValues.includes("president") || !roleValues.includes("asshole")) {
    return null;
  }

  let players = clonePlayersForRound(parsed.players);
  const playerHands = options?.playerHands;
  if (playerHands) {
    players = applyServerPlayerHands(players, playerHands);
  }
  applyServerRolesToPlayers(players, roles);

  const trades = buildTradesFromServerPending(players, roles, pending);
  if (trades.length === 0) return null;

  return { baseState: parsed, players, trades };
}

/** Prefer server pending trades when roles are assigned — avoids duplicating local mandatory trades. */
export function resolveCeremonyTrades(
  localTrades: ClientPendingTrade[],
  serverPending: ServerPendingTrades | null | undefined,
  serverRoles: Record<string, string> | null | undefined,
  players: Player[],
): ClientPendingTrade[] {
  if (!serverPending || !serverRoles) return localTrades;
  const roleValues = Object.values(serverRoles);
  if (
    !roleValues.includes("president") ||
    !roleValues.includes("asshole")
  ) {
    return localTrades;
  }
  const fromServer = buildTradesFromServerPending(
    players,
    serverRoles,
    serverPending,
  );
  return fromServer.length > 0 ? fromServer : localTrades;
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

  trade.returnedCards = selectedReturn.slice();

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
  const anyThreeLead = resolveFirstRoundLeadPlayerIndex(players, dealerContext);
  if (anyThreeLead >= 0) return anyThreeLead;
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
  if (openerIdx == null || openerIdx < 0 || openerIdx >= players.length) {
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

export type CeremonyDealResult = {
  players: Player[];
  trades: ClientPendingTrade[];
  dealerContext: DealerContext;
  openingPlayerIndex: number;
  needsDealerReshuffle: boolean;
  streakAfterRound: AssholeStreakState;
  skipPresidentTrade: boolean;
};

/** Deal hands for the round ceremony (single attempt — dealer reshuffles if invalid). */
export function executeCeremonyDeal(
  baseState: GameState,
  finishedOrder: string[],
  options: {
    dealSeed?: number;
    hostId?: string | null;
  },
): CeremonyDealResult {
  const streakAfterRound = advanceAssholeStreakAfterRound(
    {
      consecutiveAssholeId: baseState.consecutiveAssholeId ?? null,
      consecutiveAssholeCount: baseState.consecutiveAssholeCount ?? 0,
      freshRound: !!baseState.freshRound,
    },
    finishedOrder,
    baseState.players,
  );
  const skipPresidentTrade = shouldSkipPresidentAssholeTrade(streakAfterRound);

  let players = clonePlayersForRound(
    baseState.players.map((p) => ({ ...p, hand: [] })),
  );
  dealFreshHands(players, options.dealSeed);

  let trades: ClientPendingTrade[] = [];
  const rolesById: Record<string, string> = {};
  if (finishedOrder.length >= 2) {
    assignPlayerRoles(players, finishedOrder);
    trades = applyMandatoryTrades(players, { skipPresidentTrade });
    for (const p of players) {
      if (!isDeadHandPlayer(p) && p.role !== "Neutral") {
        rolesById[p.id] = p.role;
      }
    }
  }

  const dealerContext = buildDealerContext({
    hostId: options.hostId ?? null,
    finishOrder: finishedOrder,
    lastRoundOrder: baseState.lastRoundOrder,
    roles: rolesById,
  });

  if (players.some(isDeadHandPlayer)) {
    applyDeadHandAfterDeal(
      {
        players,
        finishedOrder: [],
        currentPlayerIndex: 0,
        mustPlay: false,
      },
      dealerContext,
    );
  }

  const openingPlayerIndex = resolveOpeningPlayerIndex(players, dealerContext);
  const needsDealerReshuffle = needsRoundOneDealerReshuffle(
    players,
    dealerContext,
  );

  return {
    players,
    trades,
    dealerContext,
    openingPlayerIndex,
    needsDealerReshuffle,
    streakAfterRound,
    skipPresidentTrade,
  };
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
