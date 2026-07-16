import {
  ACHIEVEMENTS,
  achievementPrestigeProgress,
  formatAchievementPrestige,
  type AchievementDef,
  type PlayerStats,
} from "./playerStats";
import { levelProgressFromXp } from "./playerLevel";

export type HubGoal = {
  id: string;
  title: string;
  subtitle: string;
  current: number;
  target: number;
  /** 0–1 */
  fraction: number;
  kind: "level" | "achievement";
  achievementId?: string;
  prestige?: number;
  nextPrestige?: number;
};

/**
 * Progress toward the next prestige rank for an achievement.
 * Fully retroactive from career counters — no separate unlock store.
 */
export function achievementProgress(
  def: AchievementDef,
  stats: PlayerStats,
): {
  current: number;
  target: number;
  fraction: number;
  unlocked: boolean;
  prestige: number;
  nextPrestige: number;
} {
  const p = achievementPrestigeProgress(stats, def);
  return {
    current: p.current,
    target: p.target,
    fraction: p.fraction,
    unlocked: p.unlocked,
    prestige: p.prestige,
    nextPrestige: p.nextPrestige,
  };
}

/**
 * Journey roadmap — nearest next-prestige milestones.
 * Achievements stay on the board forever; each rank-up is a new goal.
 * Level fills only when we somehow have no achievement rows (should not happen).
 */
export function selectHubGoals(
  stats: PlayerStats,
  maxGoals = 3,
  skipAchievementId?: string,
): HubGoal[] {
  const goals: HubGoal[] = [];
  const ranked = ACHIEVEMENTS.map((a) => {
    const p = achievementProgress(a, stats);
    return { def: a, ...p };
  }).sort(
    (a, b) =>
      b.fraction - a.fraction ||
      a.target - b.target ||
      a.nextPrestige - b.nextPrestige,
  );

  for (const row of ranked) {
    if (goals.length >= maxGoals) break;
    if (skipAchievementId && row.def.id === skipAchievementId) continue;
    goals.push({
      id: `ach:${row.def.id}:p${row.nextPrestige}`,
      title: row.def.title,
      subtitle:
        row.prestige >= 1
          ? `Next Prestige ${formatAchievementPrestige(row.nextPrestige)} · ${row.current} / ${row.target}`
          : `${row.current} / ${row.target}`,
      current: row.current,
      target: row.target,
      fraction: row.fraction,
      kind: "achievement",
      achievementId: row.def.id,
      prestige: row.prestige,
      nextPrestige: row.nextPrestige,
    });
  }

  if (goals.length === 0) {
    const level = levelProgressFromXp(stats.xp);
    goals.push({
      id: `level:${level.level + 1}`,
      title: `Level ${level.level + 1}`,
      subtitle: `${level.xpToNext} XP remaining`,
      current: level.xpIntoLevel,
      target: level.xpForLevel,
      fraction: level.fraction,
      kind: "level",
    });
  }

  return goals;
}

/** Alias matching the UX “roadmap” naming. */
export const selectJourneyGoals = selectHubGoals;

/** @deprecated Prefer AchievementDef.field / .step — kept for any external imports. */
export const ACHIEVEMENT_PROGRESS: Record<
  string,
  { field: keyof PlayerStats; target: number }
> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, { field: a.field, target: a.step }]),
);
