import type { Player } from "../game/ruleset";
import type { GameState } from "../game/core";
import { isMockAdapter, type NetworkAdapter } from "../game/network";

const PLACEHOLDER_NAMES = new Set(["You", "You (Host)", "Player"]);

/** Resolve the human controlled by this device in the current game state. */
export function resolveLocalHumanPlayer(
  players: Player[],
  localPlayerName?: string,
  localPlayerId?: string,
  adapter?: NetworkAdapter | null,
): Player | null {
  if (players.length === 0) return null;

  const usingMock = isMockAdapter(adapter);

  if (localPlayerName) {
    const byName = players.find((p) => p.name === localPlayerName);
    if (byName) return byName;
  }

  if (localPlayerId) {
    const byId = players.find((p) => p.id === localPlayerId);
    if (byId) return byId;
  }

  if (usingMock) {
    const humans = players.filter(
      (p) =>
        !(p.name && typeof p.name === "string" && p.name.startsWith("CPU")),
    );
    if (humans.length === 1) return humans[0];
    return (
      humans.find((p) => !PLACEHOLDER_NAMES.has(p.name)) ??
      humans[0] ??
      null
    );
  }

  return (
    players.find((p) => p.name === "You" || p.name === "You (Host)") ?? null
  );
}

/** Game ids for offline play are "1","2",… — map saved profile onto lobby names. */
export function normalizeLobbyNames(
  initialPlayers: string[] | undefined,
  localPlayerName?: string,
): string[] {
  const names =
    initialPlayers && initialPlayers.length >= 2
      ? [...initialPlayers]
      : ["Alice", "Bob", "Charlie", "Dana"];

  if (!localPlayerName) return names;

  let replaced = false;
  const normalized = names.map((name) => {
    if (PLACEHOLDER_NAMES.has(name)) {
      replaced = true;
      return localPlayerName;
    }
    return name;
  });

  if (!replaced) {
    const humanIdx = normalized.findIndex(
      (name) => !/^CPU\s/i.test(name.trim()),
    );
    if (humanIdx >= 0) normalized[humanIdx] = localPlayerName;
  }

  // Drop duplicate human seats if placeholder replacement collided.
  const seen = new Set<string>();
  return normalized.filter((name, index) => {
    const isCpu = /^CPU\s/i.test(name.trim());
    if (isCpu) return true;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** True when an adapter event carries a full game snapshot (not lobby metadata). */
export function isFullGameState(state: unknown): state is GameState {
  if (!state || typeof state !== "object") return false;
  const s = state as { type?: string; players?: unknown; currentPlayerIndex?: unknown };
  if (s.type && typeof s.type === "string") return false;
  if (!Array.isArray(s.players) || s.players.length === 0) return false;
  if (typeof s.currentPlayerIndex !== "number") return false;
  return s.players.every(
    (p) => p && typeof p === "object" && Array.isArray((p as { hand?: unknown }).hand),
  );
}

/** Accept authoritative server snapshots (including hidden opponent hands). */
export function parseServerGameState(state: unknown): GameState | null {
  if (isFullGameState(state)) return state;
  return null;
}
