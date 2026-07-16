/**
 * Presentation helpers for hub “Next Achievement”.
 * Reads only existing ACHIEVEMENTS + PlayerStats — no parallel progression.
 * With prestige, every achievement stays eligible forever (next rank).
 */
import {
  ACHIEVEMENTS,
  type AchievementDef,
  type PlayerStats,
} from "./playerStats";
import { achievementProgress } from "./hubGoals";

export type NextAchievement = {
  def: AchievementDef;
  current: number;
  target: number;
  fraction: number;
  /** Completed prestige ranks (0 = not yet unlocked). */
  prestige: number;
  /** Rank the player is working toward. */
  nextPrestige: number;
};

/** Nearest achievement by progress toward its next prestige rank. */
export function selectNextAchievement(
  stats: PlayerStats,
): NextAchievement | null {
  const ranked = ACHIEVEMENTS.map((a) => {
    const p = achievementProgress(a, stats);
    return { def: a, ...p };
  }).sort(
    (a, b) =>
      b.fraction - a.fraction ||
      a.target - b.target ||
      a.nextPrestige - b.nextPrestige,
  );

  const top = ranked[0];
  if (!top) return null;
  return {
    def: top.def,
    current: top.current,
    target: top.target,
    fraction: top.fraction,
    prestige: top.prestige,
    nextPrestige: top.nextPrestige,
  };
}
