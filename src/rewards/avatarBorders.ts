import {
  type AchievementDef,
  type PlayerStats,
  unlockedAchievements,
} from "../services/playerStats";
import { TITLE_TRACKS, titleTrackProgress } from "./titleTracks";

export type AvatarBorderKind = "wings" | "flames" | "laurel" | "crown" | "clover" | "lightning";

export type AvatarBorderDesign = {
  id: string;
  kind: AvatarBorderKind;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  tier?: number;
};

const BORDER_BY_ACHIEVEMENT: Record<
  string,
  Omit<AvatarBorderDesign, "id" | "tier">
> = {
  dynasty: {
    kind: "wings",
    label: "Dynasty Wings",
    primaryColor: "#ffd700",
    secondaryColor: "#fff4c2",
    glowColor: "rgba(255, 215, 0, 0.55)",
  },
  hot_streak: {
    kind: "flames",
    label: "Hot Streak",
    primaryColor: "#ff6b35",
    secondaryColor: "#ffb347",
    glowColor: "rgba(255, 107, 53, 0.5)",
  },
  veteran: {
    kind: "laurel",
    label: "Veteran Laurel",
    primaryColor: "#7dcea0",
    secondaryColor: "#a9dfbf",
    glowColor: "rgba(125, 206, 160, 0.45)",
  },
  president: {
    kind: "wings",
    label: "President Wings",
    primaryColor: "#e8c547",
    secondaryColor: "#f5e6a8",
    glowColor: "rgba(232, 197, 71, 0.48)",
  },
  vice_president: {
    kind: "crown",
    label: "Vice Crown",
    primaryColor: "#9eb7ff",
    secondaryColor: "#d4e0ff",
    glowColor: "rgba(158, 183, 255, 0.42)",
  },
  debut: {
    kind: "crown",
    label: "Rookie Crest",
    primaryColor: "#b8b8b8",
    secondaryColor: "#e8e8e8",
    glowColor: "rgba(184, 184, 184, 0.35)",
  },
};

/** Highest-priority unlocked achievement border (best reward shown).
 * Prestige / cosmetics packs can insert ahead of this list later without
 * changing PlayerStats — resolve remains achievement-id driven. */
const BORDER_PRIORITY = [
  "dynasty",
  "hot_streak",
  "president",
  "veteran",
  "vice_president",
] as const;

const TITLE_BORDER_DESIGNS: Record<string, {
  kind: AvatarBorderKind;
  label: string;
  colors: readonly [string, string][];
}> = {
  lucky: {
    kind: "clover",
    label: "Luck",
    colors: [["#568d67", "#b3d5a5"], ["#51a66b", "#c5e8a4"], ["#36b979", "#d4efa6"], ["#34c995", "#e4f6b6"], ["#6adba4", "#fff1a8"], ["#9be5b3", "#ffd970"]],
  },
  unlucky: {
    kind: "lightning",
    label: "Unlucky",
    colors: [["#797f99", "#c0c6d6"], ["#7d80b2", "#c8c8ed"], ["#8b7cc5", "#d8c6f5"], ["#a475d5", "#e9c5ff"], ["#bb79e0", "#f7d0ff"], ["#d49ce9", "#ffe4ff"]],
  },
  president: {
    kind: "wings",
    label: "President",
    colors: [["#a88b4a", "#e1c98a"], ["#b89a48", "#eed48a"], ["#c9a83f", "#f4df98"], ["#dbb83c", "#f8e8a9"], ["#edca45", "#fff0bc"], ["#ffd700", "#fff4c2"]],
  },
  asshole: {
    kind: "flames",
    label: "Asshole",
    colors: [["#a85e42", "#dfaa78"], ["#bb6041", "#ebaa77"], ["#d3673c", "#f3b27a"], ["#e76b36", "#ffc088"], ["#f67939", "#ffd29b"], ["#ff9149", "#ffe0aa"]],
  },
  veteran: {
    kind: "laurel",
    label: "Veteran",
    colors: [["#668e7b", "#a9c5ad"], ["#6b9f82", "#b5d5b9"], ["#72b08c", "#c0e0c3"], ["#7dcea0", "#ccebd0"], ["#92ddb1", "#e0f3d9"], ["#b1ecc4", "#f2f8d7"]],
  },
};

export function resolveTitleAvatarBorder(
  stats: PlayerStats,
  trackId: string | null | undefined,
): AvatarBorderDesign | null {
  const track = TITLE_TRACKS.find((item) => item.id === trackId);
  if (!track) return null;
  const progress = titleTrackProgress(stats, track);
  const design = TITLE_BORDER_DESIGNS[track.id];
  if (!progress.unlocked || !design) return null;
  const [primaryColor, secondaryColor] = design.colors[progress.tier - 1];
  return {
    id: `title:${track.id}:${progress.tier}`,
    kind: design.kind,
    label: `${design.label} - ${progress.displayTitle} - tier ${progress.tier}`,
    primaryColor,
    secondaryColor,
    glowColor: primaryColor,
    tier: progress.tier,
  };
}

export function resolveAvatarBorder(
  stats: PlayerStats,
  trackId?: string | null,
): AvatarBorderDesign | null {
  const titleBorder = resolveTitleAvatarBorder(stats, trackId);
  if (titleBorder) return titleBorder;
  const unlockedIds = new Set(unlockedAchievements(stats).map((a) => a.id));
  for (const id of BORDER_PRIORITY) {
    if (!unlockedIds.has(id)) continue;
    const def = BORDER_BY_ACHIEVEMENT[id];
    if (def) return { id, ...def };
  }
  return null;
}

export function resolveAvatarBorderFromAchievements(
  achievements: AchievementDef[],
): AvatarBorderDesign | null {
  const unlockedIds = new Set(achievements.map((a) => a.id));
  for (const id of BORDER_PRIORITY) {
    if (!unlockedIds.has(id)) continue;
    const def = BORDER_BY_ACHIEVEMENT[id];
    if (def) return { id, ...def };
  }
  return null;
}
