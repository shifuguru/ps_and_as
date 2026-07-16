/**
 * Display-only rarity for hub achievement hero cards.
 * Does not alter PlayerStats, unlock rules, or XP.
 */
export type AchievementRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "secret";

export const RARITY_LABEL: Record<AchievementRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  secret: "Secret",
};

/** Accent colors aligned to rarity tiers (Epic ≈ hub purple). */
export const RARITY_COLOR: Record<AchievementRarity, string> = {
  common: "#9AA3B2",
  uncommon: "#3DDC97",
  rare: "#4BA3FF",
  epic: "#7B6CF0",
  legendary: "#E8C547",
  secret: "#E879A9",
};

/** Higher = more exclusive. Used to sort achievement lists. */
export const RARITY_RANK: Record<AchievementRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  secret: 5,
};

const BY_ID: Record<string, AchievementRarity> = {
  debut: "common",
  asshole: "common",
  vice_asshole: "uncommon",
  vice_president: "uncommon",
  president: "rare",
  veteran: "rare",
  hot_streak: "epic",
  dynasty: "legendary",
};

export function rarityForAchievementId(id: string): AchievementRarity {
  return BY_ID[id] ?? "common";
}

/** Most exclusive first (legendary → common). Stable within a tier. */
export function compareAchievementsByExclusivity(
  a: { id: string },
  b: { id: string },
): number {
  return (
    RARITY_RANK[rarityForAchievementId(b.id)] -
    RARITY_RANK[rarityForAchievementId(a.id)]
  );
}

export function orderAchievementsByExclusivity<T extends { id: string }>(
  list: readonly T[],
): T[] {
  return [...list].sort(compareAchievementsByExclusivity);
}

/** Session round-streak → rarity accent (display only). */
const STREAK_RARITY_THRESHOLDS: ReadonlyArray<{
  at: number;
  rarity: AchievementRarity;
}> = [
  { at: 0, rarity: "common" },
  { at: 2, rarity: "uncommon" },
  { at: 4, rarity: "rare" },
  { at: 6, rarity: "epic" },
  { at: 10, rarity: "legendary" },
];

export function rarityForRoundStreak(streak: number): AchievementRarity {
  const n = Math.max(0, Math.floor(streak));
  let rarity: AchievementRarity = "common";
  for (const step of STREAK_RARITY_THRESHOLDS) {
    if (n >= step.at) rarity = step.rarity;
  }
  return rarity;
}

/** Progress within the current → next rarity band (for streak pips). */
export function roundStreakRarityProgress(streak: number): {
  rarity: AchievementRarity;
  current: number;
  target: number;
  fraction: number;
  nextRarity: AchievementRarity | null;
} {
  const n = Math.max(0, Math.floor(streak));
  const rarity = rarityForRoundStreak(n);
  const idx = STREAK_RARITY_THRESHOLDS.findIndex((s) => s.rarity === rarity);
  const at = STREAK_RARITY_THRESHOLDS[idx]?.at ?? 0;
  const next = STREAK_RARITY_THRESHOLDS[idx + 1];
  if (!next) {
    return {
      rarity,
      current: n,
      target: at,
      fraction: 1,
      nextRarity: null,
    };
  }
  const span = Math.max(1, next.at - at);
  const into = Math.min(span, Math.max(0, n - at));
  return {
    rarity,
    current: into,
    target: span,
    fraction: into / span,
    nextRarity: next.rarity,
  };
}
