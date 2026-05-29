import type { Card, Player } from "./ruleset";
import type { DealerContext } from "../utils/tableSeats";
import { resolveOpeningPlayerIndex } from "../utils/tableSeats";

export const DEAD_HAND_ID = "__dead_hand__";
export const DEAD_HAND_NAME = "Dead Hand";

export function createDeadHandPlayer(): Player {
  return {
    id: DEAD_HAND_ID,
    name: DEAD_HAND_NAME,
    hand: [],
    role: "Neutral",
    isDeadHand: true,
  };
}

export function isDeadHandPlayer(
  player: Pick<Player, "id" | "isDeadHand"> | null | undefined,
): boolean {
  if (!player) return false;
  return player.isDeadHand === true || player.id === DEAD_HAND_ID;
}

export function livingPlayers<T extends Player>(players: T[]): T[] {
  return players.filter((p) => !isDeadHandPlayer(p));
}

export function livingPlayerIds(players: Player[]): string[] {
  return livingPlayers(players).map((p) => p.id);
}

/** Finish order with sidelined dead-hand entries removed. */
export function livingFinishedOrder(
  players: Pick<Player, "id" | "isDeadHand">[],
  finishedOrder: string[],
): string[] {
  const livingIds = new Set(livingPlayerIds(players as Player[]));
  return finishedOrder.filter((id) => livingIds.has(id));
}

/** True when the sidelined dead hand holds 3♣ (before or after sideline). */
export function deadHandHoldsThreeClubs(
  players: Pick<Player, "id" | "hand" | "isDeadHand" | "sidelinedHand">[],
): boolean {
  const dead = players.find((p) => isDeadHandPlayer(p));
  if (!dead) return false;
  const cards = [...(dead.hand ?? []), ...(dead.sidelinedHand ?? [])];
  return cards.some((c) => c.value === 3 && c.suit === "clubs");
}

export function isRoundCompleteForLiving(state: {
  players: Player[];
  finishedOrder: string[];
}): boolean {
  const ids = livingPlayerIds(state.players);
  if (ids.length === 0) return false;
  return ids.every((id) => state.finishedOrder.includes(id));
}

/** After deal, sideline the dead hand and fix the opening player if needed. */
export function applyDeadHandAfterDeal(
  state: {
    players: Player[];
    finishedOrder: string[];
    currentPlayerIndex: number;
    mustPlay?: boolean;
  },
  dealerOptions?: DealerContext,
): void {
  const dead = state.players.find((p) => isDeadHandPlayer(p));
  if (!dead) return;

  dead.sidelinedHand = [...dead.hand];
  dead.hand = [];
  dead.role = "Neutral";

  state.currentPlayerIndex = resolveOpeningPlayerIndex(
    state.players,
    dealerOptions ?? {},
  );
  state.mustPlay = true;
}

/** All rank-3 cards held by the dead hand (active or sidelined). */
export function deadHandThrees(
  players: Pick<Player, "id" | "hand" | "isDeadHand" | "sidelinedHand">[],
): Card[] {
  const dead = players.find((p) => isDeadHandPlayer(p));
  if (!dead) return [];
  return [...(dead.hand ?? []), ...(dead.sidelinedHand ?? [])].filter(
    (c) => c.value === 3,
  );
}

/** True when the dead hand holds all four 3s in the deck. */
export function deadHandHoldsAllThrees(
  players: Pick<Player, "id" | "hand" | "isDeadHand" | "sidelinedHand">[],
): boolean {
  return deadHandThrees(players).length >= 4;
}

/**
 * Round 1 with a dead hand and no living player can open — dealer must reshuffle.
 */
export function needsRoundOneDealerReshuffle(
  players: Pick<Player, "id" | "hand" | "isDeadHand" | "sidelinedHand">[],
  options: DealerContext = {},
): boolean {
  const priorRound =
    (options.lastRoundOrder?.length ?? 0) >= 2 ||
    (options.finishedOrder?.length ?? 0) >= 2;
  if (priorRound || !players.some(isDeadHandPlayer)) return false;
  return resolveOpeningPlayerIndex(players, options) < 0;
}

/** True when any living player holds the given rank. */
export function livingPlayerHasRank(
  players: Player[],
  value: number,
  suit?: Card["suit"],
): boolean {
  return livingPlayers(players).some((p) =>
    p.hand.some(
      (c) =>
        c.value === value && (suit == null ? true : c.suit === suit),
    ),
  );
}

/** Index in `hand` to highlight for a round-opening lead (3♣ or dead-hand 3♠ rules). */
export function openingLeadCardIndex(
  hand: Card[],
  players: Pick<Player, "id" | "hand" | "isDeadHand" | "sidelinedHand">[],
): number {
  if (hand.length === 0) return -1;
  if (deadHandHoldsThreeClubs(players)) {
    const spades = hand.findIndex((c) => c.value === 3 && c.suit === "spades");
    if (spades >= 0) return spades;
  } else {
    const clubs = hand.findIndex((c) => c.value === 3 && c.suit === "clubs");
    if (clubs >= 0) return clubs;
  }
  return hand.findIndex((c) => c.value === 3);
}
