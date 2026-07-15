/**
 * Presentation helpers for hub “Next Achievement”.
 * Reads only existing ACHIEVEMENTS + PlayerStats — no parallel progression.
 */
import {
  ACHIEVEMENTS,
  type AchievementDef,
  type PlayerStats,
  unlockedAchievements,
} from "./playerStats";
import { achievementProgress } from "./hubGoals";

export type NextAchievement = {
  def: AchievementDef;
  current: number;
  target: number;
  fraction: number;
};

/** Nearest locked achievement by completion fraction (same ranking as Journey). */
export function selectNextAchievement(
  stats: PlayerStats,
): NextAchievement | null {
  const unlockedIds = new Set(unlockedAchievements(stats).map((a) => a.id));
  const locked = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id))
    .map((a) => {
      const p = achievementProgress(a, stats);
      return { def: a, ...p };
    })
    .sort((a, b) => b.fraction - a.fraction || a.target - b.target);

  const top = locked[0];
  if (!top) return null;
  return {
    def: top.def,
    current: top.current,
    target: top.target,
    fraction: top.fraction,
  };
}
