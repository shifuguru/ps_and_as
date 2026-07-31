/**
 * Shared layout tokens for gameplay HUD glass cards.
 * Presentation-only — does not affect rules or networking.
 *
 * Typography floors follow the P0 UI coherence audit (v1.1.23):
 * drop sub-10px labels; 10px exception-only; accent eyebrows ~11pt bold
 * (matches `ui.panelEyebrow` / colour-audit PASS_ACCENT note).
 * Save space by cutting copy, not by shrinking type or glass padding.
 */

import {
  resolveCompactHeightTier,
  type CompactHeightTier,
} from "../utils/compactGameLayout";

/**
 * Outer height for Upcoming Achievement (matched when prestige is on).
 * Round Streak uses resolveHudCardHeight — shorter from fewer lines.
 */
export const HUD_CARD_HEIGHT = 108;

/** Consistent gap between sibling HUD chrome (cards / util buttons). */
export const HUD_CLUSTER_GAP = 8;

/**
 * HUD type ramp — do not go below these in glass widgets.
 * Density may omit lines; it must not shrink below the floor.
 */
export const HUD_TYPE = {
  /** Accent section label — `ui.panelEyebrow` */
  eyebrow: 11,
  /** Small supporting copy — exception floor */
  caption: 10,
  /** Primary body / names */
  body: 12,
  /** Emphasized mid value (trick count, winner name) */
  emphasis: 12,
  /** Card rank line in Winning Play */
  value: 20,
  /** Round Streak numeral */
  display: 22,
} as const;

/** Glass inset — keep GameplayGlassPanel defaults; never crush below compact. */
export const HUD_GLASS_PAD = {
  comfortable: 12,
  compact: 10,
} as const;

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
 * Round Streak height — title + number + pips (+ rarity on roomy).
 * Sized for HUD_TYPE + HUD_GLASS_PAD, not crushed type.
 */
export function resolveHudCardHeight(density: HudDensity): number {
  switch (density) {
    case "ultra":
    case "dense":
      // eyebrow + display + pips + compact pad
      return 78;
    default:
      // + rarity caption
      return 96;
  }
}

export function hudGlassPadding(density: HudDensity): number {
  return density === "comfortable"
    ? HUD_GLASS_PAD.comfortable
    : HUD_GLASS_PAD.compact;
}
