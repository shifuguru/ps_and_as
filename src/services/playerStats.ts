import { Platform } from "react-native";
import { roleForPlacement } from "../utils/roundRoles";

const STORAGE_KEY = "@ps_and_as_player_stats";

export type PlayerStats = {
  roundsPlayed: number;
  timesPresident: number;
  timesVicePresident: number;
  timesViceAsshole: number;
  timesAsshole: number;
  presidentStreak: number;
  bestPresidentStreak: number;
  xp: number;
  tricksWon: number;
};

export type AchievementDef = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  check: (stats: PlayerStats) => boolean;
};

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
export const RUN_STEP_XP = 15;

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "debut",
    title: "First Round",
    description: "Complete your first round",
    emoji: "🎮",
    check: (s) => s.roundsPlayed >= 1,
  },
  {
    id: "president",
    title: "Mr. President",
    description: "Finish first in a round",
    emoji: "👑",
    check: (s) => s.timesPresident >= 1,
  },
  {
    id: "asshole",
    title: "Bottom of the Deck",
    description: "Finish last in a round",
    emoji: "💩",
    check: (s) => s.timesAsshole >= 1,
  },
  {
    id: "vice_president",
    title: "Running Mate",
    description: "Finish as Vice President",
    emoji: "⭐",
    check: (s) => s.timesVicePresident >= 1,
  },
  {
    id: "vice_asshole",
    title: "Almost Last",
    description: "Finish as Vice Asshole",
    emoji: "😬",
    check: (s) => s.timesViceAsshole >= 1,
  },
  {
    id: "hot_streak",
    title: "Hot Streak",
    description: "Become President twice in a row",
    emoji: "🔥",
    check: (s) => s.bestPresidentStreak >= 2,
  },
  {
    id: "veteran",
    title: "Veteran",
    description: "Complete 10 rounds",
    emoji: "🏆",
    check: (s) => s.roundsPlayed >= 10,
  },
  {
    id: "dynasty",
    title: "Dynasty",
    description: "Become President 5 times",
    emoji: "👑",
    check: (s) => s.timesPresident >= 5,
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

/** Pull cloud backup (keyed by Game Center / player id) and merge into local storage. */
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

/** Call after Game Center sign-in so cloud restore uses the linked account id. */
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

/** Award XP when the local human wins a trick. */
export async function recordTrickWin(
  xp = TRICK_WIN_XP,
): Promise<PlayerStats> {
  const stats = await getPlayerStats();
  stats.tricksWon += 1;
  stats.xp += xp;
  await savePlayerStats(stats);
  return stats;
}

/** Award XP when the local human earns run-step XP. */
export async function recordRunStepXp(
  xp = RUN_STEP_XP,
): Promise<PlayerStats> {
  const stats = await getPlayerStats();
  stats.xp += xp;
  await savePlayerStats(stats);
  return stats;
}

export function unlockedAchievements(stats: PlayerStats): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.check(stats));
}

export function winRate(stats: PlayerStats): number {
  if (stats.roundsPlayed === 0) return 0;
  return Math.round((stats.timesPresident / stats.roundsPlayed) * 100);
}
