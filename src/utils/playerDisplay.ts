/** Avatar initials: first char of each word, or first two chars for a single word ("Mike" → "MI"). */
export function playerInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((word) => word.charAt(0)).join("").toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

/** Table turn-hint / pill labels — keep ellipsis, allow longer names before truncating. */
export function truncatePillLabel(text: string, maxChars = 24): string {
  const trimmed = (text || "").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}…`;
}

export function formatWaitingForTurnHint(
  playerName: string,
  maxChars = 24,
): string {
  const label = truncatePillLabel(playerName, maxChars);
  return label.endsWith("…")
    ? `Waiting for ${label}`
    : `Waiting for ${label}…`;
}
