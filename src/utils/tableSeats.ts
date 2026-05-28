import {
  DEAD_HAND_ID,
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
    : options.finishedOrder ?? [];

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
  cardsPerPlayer: number,
): { playerId: string; round: number }[] {
  if (recipientOrder.length === 0 || cardsPerPlayer <= 0) return [];
  return Array.from({ length: cardsPerPlayer }, (_, round) =>
    recipientOrder.map((playerId) => ({ playerId, round })),
  ).flat();
}

export function isDeadHandSeatId(playerId: string): boolean {
  return playerId === DEAD_HAND_ID;
}
