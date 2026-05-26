import type { Card } from "../game/ruleset";
import type { GameState, TrickHistory } from "../game/core";

export type TrickPlayDisplay = {
  cards: Card[];
  playerId: string;
};

/** Chronological play groups for the table (one entry per player action). */
export function buildTrickPlayDisplays(state: GameState): TrickPlayDisplay[] {
  const plays: TrickPlayDisplay[] = [];
  const seen = new Set<string>();

  if (state.pileHistory) {
    for (let i = 0; i < state.pileHistory.length; i++) {
      const entry = state.pileHistory[i];
      if (!Array.isArray(entry) || entry.length === 0) continue;
      const owner = (state.pileOwners && state.pileOwners[i]) || "";
      const sig = `${owner}|${entry.map((c) => `${c.suit}:${c.value}`).join("|")}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      plays.push({ cards: entry.slice(), playerId: owner });
    }
  }

  if (state.currentTrick?.actions) {
    for (const action of state.currentTrick.actions) {
      if (action.type !== "play" || !action.cards || action.cards.length === 0) {
        continue;
      }
      const owner = action.playerId || action.playerName || "";
      const sig = `${owner}|${action.cards.map((c) => `${c.suit}:${c.value}`).join("|")}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      plays.push({ cards: action.cards.slice(), playerId: action.playerId });
    }
  }

  if (plays.length === 0 && state.pile.length > 0) {
    const owner =
      state.lastPlayPlayerIndex != null
        ? state.players[state.lastPlayPlayerIndex]?.id ?? ""
        : "";
    plays.push({ cards: state.pile.slice(), playerId: owner });
  }

  return plays;
}

export function buildPlaysFromTrick(trick: TrickHistory): TrickPlayDisplay[] {
  const plays: TrickPlayDisplay[] = [];
  for (const action of trick.actions) {
    if (action.type === "play" && action.cards && action.cards.length > 0) {
      plays.push({
        cards: action.cards.slice(),
        playerId: action.playerId,
      });
    }
  }
  return plays;
}

export function passedIdsFromTrick(trick: TrickHistory): string[] {
  return trick.actions
    .filter((action) => action.type === "pass")
    .map((action) => action.playerId);
}

export function lastPlayPlayerId(state: GameState): string | null {
  if (state.currentTrick?.actions?.length) {
    for (let i = state.currentTrick.actions.length - 1; i >= 0; i--) {
      const action = state.currentTrick.actions[i];
      if (action.type === "play" && action.playerId) {
        return action.playerId;
      }
    }
  }
  if (
    state.lastPlayPlayerIndex != null &&
    state.players[state.lastPlayPlayerIndex]
  ) {
    return state.players[state.lastPlayPlayerIndex].id;
  }
  return null;
}
