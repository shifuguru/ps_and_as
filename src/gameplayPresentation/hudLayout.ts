/**
 * Shared layout tokens for gameplay HUD glass cards.
 * Presentation-only — does not affect rules or networking.
 */

import {
  resolveCompactHeightTier,
  type CompactHeightTier,
} from "../utils/compactGameLayout";

/**
 * Outer height for Upcoming Achievement (matched when prestige is on).
 * Round Streak is shorter now — fewer in-panel lines, normal padding.
 */
export const HUD_CARD_HEIGHT = 108;

/** Consistent gap between sibling HUD chrome (cards / util buttons). */
export const HUD_CLUSTER_GAP = 8;

/** How aggressively HUD glass should shrink on short shells. */
export type HudDensity = "comfortable" | "dense" | "ultra";

export function resolveHudDensity(
  shellHeight: number,
  tier: CompactHeightTier = resolveCompactHeightTier(shellHeight),
): HudDensity {
  if (tier === "veryTight") return "ultra";
  if (tier === "tight") return "dense";
  if (tier === "compact" && shellHeight < 780) return "dense";
  return "comfortable";
}

/**
 * Round Streak height — sized for title + number + pips (+ rarity on roomy).
 * Shorter from dropping descriptor copy, not from crushing type/padding.
 */
export function resolveHudCardHeight(density: HudDensity): number {
  switch (density) {
    case "ultra":
      return 86;
    case "dense":
      return 92;
    default:
      return 100;
  }
}
