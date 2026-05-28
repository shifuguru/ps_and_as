import type { Player } from "../game/ruleset";

/** Placement role labels — keep in sync with ruleset role assignment. */
export type RoundRoleLabel =
  | "President"
  | "Vice President"
  | "Vice Asshole"
  | "Asshole"
  | "Civilian";

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
 */
export function roleForPlacement(
  index: number,
  playerCount: number,
): RoundRoleLabel {
  if (index === 0) return "President";
  if (index === playerCount - 1) return "Asshole";
  if (playerCount >= 5 && index === 1) return "Vice President";
  if (playerCount >= 5 && index === playerCount - 2) return "Vice Asshole";
  return "Civilian";
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
