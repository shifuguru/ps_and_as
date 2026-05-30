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
