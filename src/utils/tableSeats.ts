import {
  DEAD_HAND_ID,
  deadHandHoldsThreeClubs,
  isDeadHandPlayer,
  livingPlayerIds,
} from "../game/deadHand";
import type { Player } from "../game/ruleset";

/** @deprecated Dead hand uses the same ring slot as any other seat (see ringAngleForSeat). */
export const DEAD_HAND_RING_ANGLE = 90;

export type TableSeatConfig = {
  /** Server turn order (clockwise around the table). */
  turnOrderIds: string[];
  /** Seat ids for layout — local player first, then clockwise. */
  layoutSeatIds: string[];
  localPlayerIds: string[];
  visibleOpponentIds: string[];
  /** Total seats at the table (living + dead hand). */
  layoutSeatCount: number;
  deadHandId: string | null;
};

function rotateIdsToFront(ids: string[], frontId: string | null): string[] {
  if (!frontId) return [...ids];
  const idx = ids.indexOf(frontId);
  if (idx <= 0) return [...ids];
  return [...ids.slice(idx), ...ids.slice(0, idx)];
}

export function buildTableSeatConfig(
  players: Pick<Player, "id" | "isDeadHand">[],
  localPlayerId: string | null | undefined,
): TableSeatConfig {
  const turnOrderIds = players.map((p) => p.id);
  const deadHand = players.find(isDeadHandPlayer);
  const deadHandId = deadHand?.id ?? null;
  const localId =
    localPlayerId && turnOrderIds.includes(localPlayerId)
      ? localPlayerId
      : null;

  const visibleOpponentIds = turnOrderIds.filter((id) => id !== localId);
  const layoutSeatIds = rotateIdsToFront(turnOrderIds, localId);

  return {
    turnOrderIds,
    layoutSeatIds,
    localPlayerIds: localId ? [localId] : [],
    visibleOpponentIds,
    layoutSeatCount: Math.max(turnOrderIds.length, 1),
    deadHandId,
  };
}

export type DealerContext = {
  hostId?: string | null;
  lastRoundOrder?: string[];
  finishedOrder?: string[];
  roles?: Record<string, string>;
};

/** Asshole from last round deals; round 1 is dealt by the lobby host. */
export function resolveDealerId(
  players: Pick<Player, "id">[],
  options: {
    hostId?: string | null;
    lastRoundOrder?: string[];
    finishedOrder?: string[];
    roles?: Record<string, string>;
  },
): string | null {
  const living = livingPlayerIds(players as Player[]);
  if (living.length === 0) return null;

  const order = options.lastRoundOrder?.length
    ? options.lastRoundOrder
    : options.finishedOrder?.length
      ? options.finishedOrder
      : [];

  if (order.length >= 2) {
    const assholeId = order[order.length - 1];
    if (living.includes(assholeId)) return assholeId;

    const roleAsshole = Object.entries(options.roles ?? {}).find(
      ([, role]) => role === "asshole" || role === "Asshole",
    )?.[0];
    if (roleAsshole && living.includes(roleAsshole)) return roleAsshole;
  }

  if (options.hostId && living.includes(options.hostId)) {
    return options.hostId;
  }

  return living[0] ?? null;
}

/** Dealer context for round ceremony — Asshole deals from round 2 onward. */
export function buildDealerContext(options: {
  hostId?: string | null;
  finishOrder?: string[];
  lastRoundOrder?: string[];
  roles?: Record<string, string>;
}): DealerContext {
  const order =
    options.finishOrder && options.finishOrder.length >= 2
      ? options.finishOrder
      : options.lastRoundOrder && options.lastRoundOrder.length >= 2
        ? options.lastRoundOrder
        : [];
  const priorRound = order.length >= 2;
  return {
    hostId: priorRound ? null : (options.hostId ?? null),
    lastRoundOrder: priorRound ? order : options.lastRoundOrder,
    finishedOrder: options.finishOrder,
    roles: options.roles,
  };
}

/**
 * Living recipients anticlockwise from the dealer (same order cards are dealt).
 */
export function livingDealRecipientOrder(
  players: Pick<Player, "id" | "hand" | "isDeadHand">[],
  options: DealerContext = {},
): string[] {
  const living = new Set(livingPlayerIds(players as Player[]));
  const turnOrderIds = players.map((p) => p.id);
  const dealerId = resolveDealerId(players, options);
  return dealRecipientOrder(turnOrderIds, dealerId).filter((id) =>
    living.has(id),
  );
}

/**
 * Round 1 lead — walk deal order among living players.
 * Normal: first with 3♣, else first with any 3, else -1 (reshuffle).
 * When the dead hand holds 3♣: first with 3♠, else any 3, else -1.
 */
export function resolveFirstRoundLeadPlayerIndex(
  players: Pick<Player, "id" | "hand" | "isDeadHand" | "sidelinedHand">[],
  options: DealerContext = {},
): number {
  const order = livingDealRecipientOrder(players, options);
  const deadHasThreeClubs = deadHandHoldsThreeClubs(players);

  const findIdxWith = (predicate: (c: { value: number; suit: string }) => boolean) => {
    for (const id of order) {
      const p = players.find((x) => x.id === id);
      if (p?.hand?.some(predicate)) {
        const idx = players.findIndex((x) => x.id === id);
        if (idx >= 0) return idx;
      }
    }
    return -1;
  };

  if (deadHasThreeClubs) {
    const spadesIdx = findIdxWith((c) => c.value === 3 && c.suit === "spades");
    if (spadesIdx >= 0) return spadesIdx;
  } else {
    const clubsIdx = findIdxWith((c) => c.value === 3 && c.suit === "clubs");
    if (clubsIdx >= 0) return clubsIdx;
  }

  return findIdxWith((c) => c.value === 3);
}

/**
 * First to act each round — one seat anticlockwise from the dealer
 * (same seat that receives the first card in deal order).
 * Round 1 uses {@link resolveFirstRoundLeadPlayerIndex} when no prior round order.
 */
export function resolveOpeningPlayerIndex(
  players: Pick<Player, "id" | "hand" | "isDeadHand">[],
  options: DealerContext = {},
): number {
  if (players.length === 0) return 0;

  const priorRound =
    (options.lastRoundOrder?.length ?? 0) >= 2 ||
    (options.finishedOrder?.length ?? 0) >= 2;

  if (!priorRound) {
    const leadIdx = resolveFirstRoundLeadPlayerIndex(players, options);
    return leadIdx >= 0 ? leadIdx : -1;
  }

  const living = livingPlayerIds(players as Player[]);
  const turnOrderIds = players.map((p) => p.id);
  const dealerId = resolveDealerId(players, options);
  const recipientOrder = dealRecipientOrder(turnOrderIds, dealerId);
  const openerId =
    recipientOrder.find((id) => living.includes(id)) ??
    living[0] ??
    turnOrderIds[0];
  const idx = players.findIndex((p) => p.id === openerId);
  return idx >= 0 ? idx : 0;
}

/** Clockwise recipient order starting with the player to the dealer's left. */
export function dealRecipientOrder(
  turnOrderIds: string[],
  dealerId: string | null,
): string[] {
  if (turnOrderIds.length === 0) return [];
  if (!dealerId) return [...turnOrderIds];

  const dealerIdx = turnOrderIds.indexOf(dealerId);
  if (dealerIdx < 0) return [...turnOrderIds];

  return Array.from(
    { length: turnOrderIds.length },
    (_, i) => turnOrderIds[(dealerIdx + 1 + i) % turnOrderIds.length],
  );
}

export function buildClockwiseDealSteps(
  recipientOrder: string[],
  totalCards: number,
): { playerId: string; round: number }[] {
  if (recipientOrder.length === 0 || totalCards <= 0) return [];
  return Array.from({ length: totalCards }, (_, i) => ({
    playerId: recipientOrder[i % recipientOrder.length],
    round: Math.floor(i / recipientOrder.length),
  }));
}

export function isDeadHandSeatId(playerId: string): boolean {
  return playerId === DEAD_HAND_ID;
}
