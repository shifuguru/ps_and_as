import {
  type AchievementDef,
  type PlayerStats,
  unlockedAchievements,
} from "../services/playerStats";

export type AvatarBorderKind = "wings" | "flames" | "laurel" | "crown";

export type AvatarBorderDesign = {
  id: string;
  kind: AvatarBorderKind;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
};

const BORDER_BY_ACHIEVEMENT: Record<
  string,
  Omit<AvatarBorderDesign, "id">
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

/** Highest-priority unlocked achievement border (best reward shown). */
const BORDER_PRIORITY = [
  "dynasty",
  "hot_streak",
  "president",
  "veteran",
  "vice_president",
] as const;

export function resolveAvatarBorder(
  stats: PlayerStats,
): AvatarBorderDesign | null {
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
