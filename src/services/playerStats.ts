import { Platform } from "react-native";
import { roleForPlacement } from "../utils/roundRoles";

/**
 * Canonical local career progression (single source of truth).
 *
 * - Storage key: `@ps_and_as_player_stats`
 * - Cloud: `playerStatsCloud` max-merge on restore / push on save
 * - XP: only `PlayerStats.xp` — never introduce a parallel XP field
 * - Level: not stored; any UI level is display-derived from `xp`
 * - Achievements: derived via counters on `PlayerStats` (not a separate unlock store)
 * - Prestige: repeatable ranks; rank R unlocks at `step * fib(R)`
 *   (Fibonacci 1, 2, 3, 5, 8…) so existing counters apply retroactively
 *
 * Hub / daily challenge / unlock-event helpers must read or append through this
 * schema — never replace or reset it on upgrade.
 */
const STORAGE_KEY = "@ps_and_as_player_stats";

export type PlayerStats = {
  roundsPlayed: number;
  timesPresident: number;
  timesVicePresident: number;
  timesViceAsshole: number;
  timesAsshole: number;
  presidentStreak: number;
  bestPresidentStreak: number;
  /** Career XP — authoritative progression currency. */
  xp: number;
  tricksWon: number;
};

/** Stats fields that can drive achievement / prestige progress. */
export type AchievementCounterField = keyof Pick<
  PlayerStats,
  | "roundsPlayed"
  | "timesPresident"
  | "timesVicePresident"
  | "timesViceAsshole"
  | "timesAsshole"
  | "bestPresidentStreak"
  | "tricksWon"
  | "xp"
>;

export type AchievementDef = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  /** Career counter that advances this achievement. */
  field: AchievementCounterField;
  /**
   * Scale for Fibonacci prestige thresholds.
   * Prestige rank R unlocks when counter >= step * fibonacci(R)
   * (sequence: 1, 2, 3, 5, 8, 13…). Rank I = first unlock at `step`.
   */
  step: number;
  check: (stats: PlayerStats) => boolean;
};

/**
 * Prestige Fibonacci sequence (1-based): 1, 2, 3, 5, 8, 13, 21…
 * Skips the duplicate leading 1 from classic Fib so each rank has a distinct bar.
 */
export function prestigeFibonacci(rank: number): number {
  const n = Math.max(1, Math.floor(rank));
  if (n === 1) return 1;
  if (n === 2) return 2;
  let a = 1;
  let b = 2;
  for (let i = 3; i <= n; i++) {
    const next = a + b;
    a = b;
    b = next;
  }
  return b;
}

/** Absolute counter required to hold prestige rank `rank` (1-based). */
export function prestigeThreshold(step: number, rank: number): number {
  const s = Math.max(1, Math.floor(step));
  return s * prestigeFibonacci(rank);
}

export function achievementPrestigeFromValue(
  value: number,
  step: number,
): number {
  const s = Math.max(1, Math.floor(step));
  const v = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  if (v < s) return 0;
  let rank = 0;
  // Soft cap — fib grows fast; 80 ranks is far beyond any career.
  for (let r = 1; r <= 80; r++) {
    if (v >= prestigeThreshold(s, r)) rank = r;
    else break;
  }
  return rank;
}

function makeCheck(
  field: AchievementCounterField,
  step: number,
): (stats: PlayerStats) => boolean {
  return (stats) =>
    achievementPrestigeFromValue(Number(stats[field]) || 0, step) >= 1;
}

/** Completed prestige ranks for an achievement (0 = still locked). Retroactive. */
export function achievementPrestige(
  stats: PlayerStats,
  def: Pick<AchievementDef, "field" | "step">,
): number {
  return achievementPrestigeFromValue(Number(stats[def.field]) || 0, def.step);
}

/** Career counter for an achievement, e.g. total times President. */
export function achievementCareerTotal(
  stats: PlayerStats,
  def: Pick<AchievementDef, "field">,
): number {
  return Math.max(0, Math.floor(Number(stats[def.field]) || 0));
}

/** Small faded label: "12 times President", "24 rounds total", etc. */
export function formatAchievementCareerTotal(
  stats: PlayerStats,
  def: Pick<AchievementDef, "field">,
): string {
  const n = achievementCareerTotal(stats, def);
  const times = `${n} time${n === 1 ? "" : "s"}`;
  switch (def.field) {
    case "roundsPlayed":
      return `${n} round${n === 1 ? "" : "s"} total`;
    case "timesPresident":
      return `${times} President`;
    case "timesVicePresident":
      return `${times} Vice President`;
    case "timesViceAsshole":
      return `${times} Vice Asshole`;
    case "timesAsshole":
      return `${times} Asshole`;
    case "bestPresidentStreak":
      return `Best streak ${n}`;
    case "tricksWon":
      return `${n} trick${n === 1 ? "" : "s"} won`;
    case "xp":
      return `${n.toLocaleString()} XP`;
    default:
      return `${n} total`;
  }
}

/**
 * Progress toward the *next* prestige rank (Fibonacci-spaced thresholds).
 * When value sits exactly on a boundary, current=0 (just ranked up).
 */
export function achievementPrestigeProgress(
  stats: PlayerStats,
  def: Pick<AchievementDef, "field" | "step">,
): {
  prestige: number;
  value: number;
  current: number;
  target: number;
  fraction: number;
  unlocked: boolean;
  nextPrestige: number;
} {
  const step = Math.max(1, Math.floor(def.step));
  const value = Math.max(0, Math.floor(Number(stats[def.field]) || 0));
  const prestige = achievementPrestigeFromValue(value, step);
  const nextPrestige = prestige + 1;
  const prevThreshold = prestige >= 1 ? prestigeThreshold(step, prestige) : 0;
  const nextThreshold = prestigeThreshold(step, nextPrestige);
  const span = Math.max(1, nextThreshold - prevThreshold);
  const into = Math.min(span, Math.max(0, value - prevThreshold));

  return {
    prestige,
    value,
    current: into,
    target: span,
    fraction: into / span,
    unlocked: prestige >= 1,
    nextPrestige,
  };
}

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  roundsPlayed: 0,
  timesPresident: 0,
  timesVicePresident: 0,
  timesViceAsshole: 0,
  timesAsshole: 0,
  presidentStreak: 0,
  bestPresidentStreak: 0,
  xp: 0,
  tricksWon: 0,
};

export const TRICK_WIN_XP = 15;
/** Run bonus: +5 XP per card in the run (doubles/triples count every card). */
export const RUN_CARD_XP = 5;
/** @deprecated Use RUN_CARD_XP — kept for imports that still reference the old name. */
export const RUN_STEP_XP = RUN_CARD_XP;

/** Ordered most exclusive → least (legendary → common). */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "dynasty",
    title: "Dynasty",
    description: "Become President 5 times",
    emoji: "👑",
    field: "timesPresident",
    step: 5,
    check: makeCheck("timesPresident", 5),
  },
  {
    id: "hot_streak",
    title: "Hot Streak",
    description: "Become President twice in a row",
    emoji: "🔥",
    field: "bestPresidentStreak",
    step: 2,
    check: makeCheck("bestPresidentStreak", 2),
  },
  {
    id: "president",
    title: "Mr. President",
    description: "Finish first in a round",
    emoji: "👑",
    field: "timesPresident",
    step: 1,
    check: makeCheck("timesPresident", 1),
  },
  {
    id: "veteran",
    title: "Veteran",
    description: "Complete 10 rounds",
    emoji: "🏆",
    field: "roundsPlayed",
    step: 10,
    check: makeCheck("roundsPlayed", 10),
  },
  {
    id: "vice_president",
    title: "Running Mate",
    description: "Finish as Vice President",
    emoji: "⭐",
    field: "timesVicePresident",
    step: 1,
    check: makeCheck("timesVicePresident", 1),
  },
  {
    id: "vice_asshole",
    title: "Almost Last",
    description: "Finish as Vice Asshole",
    emoji: "😬",
    field: "timesViceAsshole",
    step: 1,
    check: makeCheck("timesViceAsshole", 1),
  },
  {
    id: "debut",
    title: "Another Round",
    description: "Complete rounds — prestiged the more you play",
    emoji: "🎮",
    field: "roundsPlayed",
    step: 1,
    check: makeCheck("roundsPlayed", 1),
  },
  {
    id: "asshole",
    title: "Bottom of the Deck",
    description: "Finish last in a round",
    emoji: "💩",
    field: "timesAsshole",
    step: 1,
    check: makeCheck("timesAsshole", 1),
  },
];

function getAsyncStorage() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

function normalizeStats(raw: Partial<PlayerStats> | null): PlayerStats {
  return {
    roundsPlayed: raw?.roundsPlayed ?? 0,
    timesPresident: raw?.timesPresident ?? 0,
    timesVicePresident: raw?.timesVicePresident ?? 0,
    timesViceAsshole: raw?.timesViceAsshole ?? 0,
    timesAsshole: raw?.timesAsshole ?? 0,
    presidentStreak: raw?.presidentStreak ?? 0,
    bestPresidentStreak: raw?.bestPresidentStreak ?? 0,
    xp: raw?.xp ?? 0,
    tricksWon: raw?.tricksWon ?? 0,
  };
}

function statsEqual(a: PlayerStats, b: PlayerStats): boolean {
  return (
    a.roundsPlayed === b.roundsPlayed &&
    a.timesPresident === b.timesPresident &&
    a.timesVicePresident === b.timesVicePresident &&
    a.timesViceAsshole === b.timesViceAsshole &&
    a.timesAsshole === b.timesAsshole &&
    a.presidentStreak === b.presidentStreak &&
    a.bestPresidentStreak === b.bestPresidentStreak &&
    a.xp === b.xp &&
    a.tricksWon === b.tricksWon
  );
}

async function readLocalPlayerStats(): Promise<PlayerStats> {
  const AsyncStorage = getAsyncStorage();
  if (!AsyncStorage) return { ...DEFAULT_PLAYER_STATS };

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAYER_STATS };
    return normalizeStats(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PLAYER_STATS };
  }
}

async function resolveStatsPlayerId(): Promise<string | null> {
  try {
    const { getOrCreatePlayerId } = await import("./gameCenter");
    const info = await getOrCreatePlayerId();
    return info.linkedAccountId || info.id || info.installId || null;
  } catch {
    return null;
  }
}

let restorePromise: Promise<PlayerStats> | null = null;

/** Pull cloud backup (keyed by player id) and merge into local storage. */
export async function restorePlayerStatsFromCloud(): Promise<PlayerStats> {
  const local = await readLocalPlayerStats();
  const playerId = await resolveStatsPlayerId();
  if (!playerId) return local;

  const { fetchCloudPlayerStats, mergePlayerStats, pushCloudPlayerStats } =
    await import("./playerStatsCloud");
  const remote = await fetchCloudPlayerStats(playerId);
  const merged = mergePlayerStats(local, remote);

  if (!statsEqual(local, merged)) {
    await writeLocalPlayerStats(merged);
  } else if (local.roundsPlayed > 0) {
    void pushCloudPlayerStats(playerId, local);
  }

  if (merged.roundsPlayed > 0 && Platform.OS === "ios") {
    const { syncStatsToGameCenter } = await import("./gameCenterSync");
    void syncStatsToGameCenter(merged);
  }

  return merged;
}

export function ensurePlayerStatsRestored(): Promise<PlayerStats> {
  if (!restorePromise) {
    restorePromise = restorePlayerStatsFromCloud();
  }
  return restorePromise;
}

/** Call after account link so cloud restore uses the linked account id. */
export function resetPlayerStatsRestore(): void {
  restorePromise = null;
}

export async function getPlayerStats(): Promise<PlayerStats> {
  await ensurePlayerStatsRestored();
  return readLocalPlayerStats();
}

async function writeLocalPlayerStats(stats: PlayerStats): Promise<void> {
  const AsyncStorage = getAsyncStorage();
  if (!AsyncStorage) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

async function savePlayerStats(stats: PlayerStats): Promise<void> {
  await writeLocalPlayerStats(stats);
  try {
    const { syncPrestigeSnapshot } = await import("./unlockEvents");
    const gains = await syncPrestigeSnapshot(stats);
    if (gains.length > 0) {
      const { pushGameplayToast } = await import(
        "../gameplayPresentation/progressionToastBus"
      );
      for (const g of gains) {
        const prestiged = g.from >= 1;
        pushGameplayToast({
          kind: "achievement",
          title: prestiged ? "Prestiged!" : "Unlocked!",
          body: `${g.def.emoji} ${g.def.title}${
            g.to > 1 ? ` · ${formatAchievementPrestige(g.to)}` : ""
          }`,
        });
      }
    }
  } catch {
    /* unlock toast / log is non-critical */
  }
  const playerId = await resolveStatsPlayerId();
  if (playerId) {
    const { pushCloudPlayerStats } = await import("./playerStatsCloud");
    void pushCloudPlayerStats(playerId, stats);
  }
}

/** Record the local human's placement after a round (0 = first out / President). */
export async function recordRoundResult(
  placementIndex: number,
  playerCount: number,
): Promise<PlayerStats> {
  const stats = await getPlayerStats();
  stats.roundsPlayed += 1;

  const role = roleForPlacement(placementIndex, playerCount);

  if (role === "President") {
    stats.timesPresident += 1;
    stats.presidentStreak += 1;
    stats.bestPresidentStreak = Math.max(
      stats.bestPresidentStreak,
      stats.presidentStreak,
    );
  } else {
    stats.presidentStreak = 0;
  }

  if (role === "Vice President") stats.timesVicePresident += 1;
  if (role === "Vice Asshole") stats.timesViceAsshole += 1;
  if (role === "Asshole") stats.timesAsshole += 1;

  await savePlayerStats(stats);
  if (Platform.OS === "ios") {
    const { syncStatsToGameCenter } = await import("./gameCenterSync");
    void syncStatsToGameCenter(stats);
  }
  return stats;
}

/** Award XP when the local human wins a trick (legacy — prefer commitRoundXpEarned). */
export async function recordTrickWin(
  xp = TRICK_WIN_XP,
): Promise<PlayerStats> {
  const stats = await getPlayerStats();
  stats.tricksWon += 1;
  stats.xp += xp;
  await savePlayerStats(stats);
  return stats;
}

/** Award XP when the local human wins a run bonus pool at trick end (legacy). */
export async function recordRunStepXp(
  xp = RUN_STEP_XP,
): Promise<PlayerStats> {
  const stats = await getPlayerStats();
  stats.xp += xp;
  await savePlayerStats(stats);
  return stats;
}

/** Persist round XP tallied in-game — call only after a completed round scoreboard. */
export async function commitRoundXpEarned(
  xpEarned: number,
  tricksWon = 0,
): Promise<PlayerStats> {
  if (xpEarned <= 0 && tricksWon <= 0) {
    return getPlayerStats();
  }
  const stats = await getPlayerStats();
  if (xpEarned > 0) stats.xp += xpEarned;
  if (tricksWon > 0) stats.tricksWon += tricksWon;
  await savePlayerStats(stats);
  if (Platform.OS === "ios") {
    const { syncStatsToGameCenter } = await import("./gameCenterSync");
    void syncStatsToGameCenter(stats);
  }
  return stats;
}

export function unlockedAchievements(stats: PlayerStats): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.check(stats));
}

/** Sum of prestige ranks across all achievements (retroactive from counters). */
export function totalAchievementPrestige(stats: PlayerStats): number {
  return ACHIEVEMENTS.reduce(
    (sum, def) => sum + achievementPrestige(stats, def),
    0,
  );
}

/** Convert a positive integer to Roman numerals (I…MMMCMXCIX). */
export function toRomanNumeral(value: number): string {
  const n = Math.floor(value);
  if (n <= 0) return "";
  if (n >= 4000) return String(n);

  const table: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let remaining = n;
  let out = "";
  for (const [amount, glyph] of table) {
    while (remaining >= amount) {
      out += glyph;
      remaining -= amount;
    }
  }
  return out;
}

/** Prestige badge label — Roman numerals (e.g. III). Locked → em dash. */
export function formatAchievementPrestige(prestige: number): string {
  const p = Math.max(0, Math.floor(prestige));
  if (p <= 0) return "—";
  return toRomanNumeral(p);
}

export function winRate(stats: PlayerStats): number {
  if (stats.roundsPlayed === 0) return 0;
  return Math.round((stats.timesPresident / stats.roundsPlayed) * 100);
}
