/** Placement role labels — keep in sync with ruleset role assignment. */
export type RoundRoleLabel =
  | "President"
  | "Vice President"
  | "Vice Asshole"
  | "Asshole"
  | "Civilian";

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
  if (playerCount >= 4 && index === 1) return "Vice President";
  if (playerCount >= 4 && index === playerCount - 2) return "Vice Asshole";
  return "Civilian";
}

export function roleEmoji(role: RoundRoleLabel): string | null {
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
