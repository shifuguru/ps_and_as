import type { Player } from "../game/ruleset";
import { livingPlayers } from "../game/deadHand";

/** Placement role labels — keep in sync with ruleset role assignment. */
export type RoundRoleLabel =
  | "President"
  | "Vice President"
  | "Vice Asshole"
  | "Asshole"
  | "Middle Man";

/** 5+ living players — second & second-last finisher become VP / Vice Asshole. */
export function supportsViceRoles(playerCount: number): boolean {
  return playerCount >= 5;
}

/** Normalize server or client role strings for badge display. */
export function normalizePlayerRole(
  role: string | undefined | null,
): Player["role"] {
  if (!role) return "Neutral";
  switch (role) {
    case "President":
    case "president":
      return "President";
    case "Vice President":
    case "vice_president":
      return "Vice President";
    case "Vice Asshole":
    case "vice_asshole":
      return "Vice Asshole";
    case "Asshole":
    case "asshole":
      return "Asshole";
    default:
      return "Neutral";
  }
}

/**
 * Map finish order index to role for `playerCount` players.
 * Index 0 = first out (President), last index = Asshole.
 * 5+ players: index 1 = VP, index n-2 = Vice Asshole, middle ranks = Middle Man.
 */
export function roleForPlacement(
  index: number,
  playerCount: number,
): RoundRoleLabel {
  if (index === 0) return "President";
  if (index === playerCount - 1) return "Asshole";
  if (supportsViceRoles(playerCount) && index === 1) return "Vice President";
  if (supportsViceRoles(playerCount) && index === playerCount - 2) {
    return "Vice Asshole";
  }
  return "Middle Man";
}

export function roleEmoji(role: RoundRoleLabel | Player["role"]): string | null {
  switch (role) {
    case "President":
      return "👑";
    case "Vice President":
      return "⭐";
    case "Asshole":
    case "Vice Asshole":
      return "💩";
    default:
      return null;
  }
}

/**
 * Apply placement roles as players finish the round.
 * First out → President (crown); last out → Asshole (💩); clears prior roles first.
 */
export function applyFinishOrderRoles(
  players: Player[],
  finishedOrder: string[],
): void {
  for (const p of players) {
    p.role = "Neutral";
  }

  const activePlayers = livingPlayers(players);
  const order = finishedOrder.filter((id) =>
    activePlayers.some((p) => p.id === id),
  );
  const count = activePlayers.length;
  const finished = order.length;
  if (finished === 0) return;

  const setRole = (id: string, role: Player["role"]) => {
    const player = activePlayers.find((p) => p.id === id);
    if (player) player.role = role;
  };

  setRole(order[0], "President");
  if (supportsViceRoles(count) && finished >= 2) {
    setRole(order[1], "Vice President");
  }
  if (finished >= count && count >= 2) {
    if (supportsViceRoles(count)) {
      setRole(order[order.length - 2], "Vice Asshole");
    }
    setRole(order[order.length - 1], "Asshole");
  }
}
