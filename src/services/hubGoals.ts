import {
  ACHIEVEMENTS,
  type PlayerStats,
  unlockedAchievements,
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
};

/** Counter-backed targets for existing binary achievements. */
export const ACHIEVEMENT_PROGRESS: Record<
  string,
  { field: keyof PlayerStats; target: number }
> = {
  debut: { field: "roundsPlayed", target: 1 },
  president: { field: "timesPresident", target: 1 },
  asshole: { field: "timesAsshole", target: 1 },
  vice_president: { field: "timesVicePresident", target: 1 },
  vice_asshole: { field: "timesViceAsshole", target: 1 },
  hot_streak: { field: "bestPresidentStreak", target: 2 },
  veteran: { field: "roundsPlayed", target: 10 },
  dynasty: { field: "timesPresident", target: 5 },
};

export function achievementProgress(
  def: { id: string; check: (stats: PlayerStats) => boolean },
  stats: PlayerStats,
): { current: number; target: number; fraction: number; unlocked: boolean } {
  const meta = ACHIEVEMENT_PROGRESS[def.id];
  const unlocked = def.check(stats);
  if (!meta) {
    return { current: unlocked ? 1 : 0, target: 1, fraction: unlocked ? 1 : 0, unlocked };
  }
  const current = Math.min(Number(stats[meta.field]) || 0, meta.target);
  return {
    current,
    target: meta.target,
    fraction: meta.target > 0 ? current / meta.target : 0,
    unlocked,
  };
}

/**
 * Journey roadmap — achievement milestones first (unique vs Profile XP).
 * Level is Profile-owned; only fill Journey with Level when no locked achievements remain
 * (or none remain after skipping the Next Achievement hero id).
 */
export function selectHubGoals(
  stats: PlayerStats,
  maxGoals = 3,
  skipAchievementId?: string,
): HubGoal[] {
  const goals: HubGoal[] = [];
  const unlockedIds = new Set(unlockedAchievements(stats).map((a) => a.id));
  const locked = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id))
    .map((a) => {
      const p = achievementProgress(a, stats);
      return { def: a, ...p };
    })
    .sort((a, b) => b.fraction - a.fraction || a.target - b.target);

  for (const row of locked) {
    if (goals.length >= maxGoals) break;
    if (skipAchievementId && row.def.id === skipAchievementId) continue;
    goals.push({
      id: `ach:${row.def.id}`,
      title: row.def.title,
      subtitle: `${row.current} / ${row.target}`,
      current: row.current,
      target: row.target,
      fraction: row.fraction,
      kind: "achievement",
      achievementId: row.def.id,
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
