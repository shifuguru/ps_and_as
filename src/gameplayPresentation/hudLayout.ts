/**
 * Shared layout tokens for gameplay HUD glass cards.
 * Presentation-only — does not affect rules or networking.
 */

import {
  resolveCompactHeightTier,
  type CompactHeightTier,
} from "../utils/compactGameLayout";

/** Outer height for Upcoming Achievement + Round Streak (matched pair). */
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

/** Round Streak / prestige card height — shorter on SE-class shells. */
export function resolveHudCardHeight(density: HudDensity): number {
  switch (density) {
    case "ultra":
      return 72;
    case "dense":
      return 84;
    default:
      return HUD_CARD_HEIGHT;
  }
}
