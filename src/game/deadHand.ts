import type { Player } from "./ruleset";

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

export function isRoundCompleteForLiving(state: {
  players: Player[];
  finishedOrder: string[];
}): boolean {
  const ids = livingPlayerIds(state.players);
  if (ids.length === 0) return false;
  return ids.every((id) => state.finishedOrder.includes(id));
}

/** After deal, sideline the dead hand and fix the opening player if needed. */
export function applyDeadHandAfterDeal(state: {
  players: Player[];
  finishedOrder: string[];
  currentPlayerIndex: number;
  mustPlay?: boolean;
}): void {
  const dead = state.players.find((p) => isDeadHandPlayer(p));
  if (!dead) return;

  dead.hand = [];
  if (!state.finishedOrder.includes(dead.id)) {
    state.finishedOrder.push(dead.id);
  }

  const living = livingPlayers(state.players);
  const openerIdx = living.findIndex((p) =>
    p.hand.some((c) => c.suit === "clubs" && c.value === 3),
  );
  if (openerIdx >= 0) {
    state.currentPlayerIndex = state.players.indexOf(living[openerIdx]);
    state.mustPlay = true;
    return;
  }

  const firstLivingIdx = state.players.findIndex((p) => !isDeadHandPlayer(p));
  state.currentPlayerIndex = firstLivingIdx >= 0 ? firstLivingIdx : 0;
  state.mustPlay = false;
}
