/**
 * Display-only career level derived from the canonical flat XP field.
 *
 * AUTHORITATIVE PROGRESSION (do not diverge):
 * - XP lives only in `PlayerStats.xp` (`@ps_and_as_player_stats` + cloud max-merge).
 * - There is no second XP store and no persisted `level` field.
 * - Achievements / round / role / trick counters stay on `PlayerStats`.
 *
 * Level numbers here are a pure view over `stats.xp`. Changing this curve
 * never rewrites save data; existing XP totals are preserved byte-for-byte.
 */

export type LevelProgress = {
  level: number;
  /** XP earned within the current level (slice of career XP, not a second balance). */
  xpIntoLevel: number;
  /** XP required to finish the current level. */
  xpForLevel: number;
  /** XP still needed to reach the next level. */
  xpToNext: number;
  /** 0–1 progress within the current level. */
  fraction: number;
  /** Canonical career XP — same value as `PlayerStats.xp`. */
  totalXp: number;
};

/** XP cost to go from `level` → `level + 1` (level is 1-based). */
export function xpRequiredForLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  // L1→2: 100, L2→3: 150, L3→4: 200, …
  return 50 + L * 50;
}

/** Cumulative XP required to *reach* a given level (level 1 = 0). */
export function totalXpToReachLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  let total = 0;
  for (let i = 1; i < L; i++) {
    total += xpRequiredForLevel(i);
  }
  return total;
}

export function levelProgressFromXp(xp: number): LevelProgress {
  const totalXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let level = 1;
  let remaining = totalXp;
  // Soft cap so a pathological XP value cannot hang
  for (let guard = 0; guard < 10_000; guard++) {
    const need = xpRequiredForLevel(level);
    if (remaining < need) {
      return {
        level,
        xpIntoLevel: remaining,
        xpForLevel: need,
        xpToNext: need - remaining,
        fraction: need > 0 ? remaining / need : 1,
        totalXp,
      };
    }
    remaining -= need;
    level += 1;
  }
  return {
    level,
    xpIntoLevel: 0,
    xpForLevel: xpRequiredForLevel(level),
    xpToNext: xpRequiredForLevel(level),
    fraction: 0,
    totalXp,
  };
}

export function levelFromXp(xp: number): number {
  return levelProgressFromXp(xp).level;
}

export function xpIntoLevel(xp: number): number {
  return levelProgressFromXp(xp).xpIntoLevel;
}

export function xpToNextLevel(xp: number): number {
  return levelProgressFromXp(xp).xpToNext;
}
