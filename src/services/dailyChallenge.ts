/**
 * Local daily challenge — one objective per UTC calendar day.
 * Uses only existing PlayerStats counters (no run/ten telemetry).
 *
 * Rewards grant XP exclusively via `commitRoundXpEarned` into `PlayerStats.xp`
 * when the player taps to claim — never on hub load alone.
 * Challenge progress state is additive UI storage — it does not replace career stats.
 */
import type { PlayerStats } from "./playerStats";

const STORAGE_KEY = "@ps_and_as_daily_challenge_v1";

export type DailyChallengeDef = {
  id: string;
  title: string;
  description: string;
  /** XP granted once when the player claims. */
  rewardXp: number;
  field: keyof PlayerStats;
  /** Absolute target = baseline[field] + delta on the challenge day. */
  delta: number;
};

export const DAILY_CHALLENGE_POOL: DailyChallengeDef[] = [
  {
    id: "rounds_2",
    title: "Settle In",
    description: "Complete 2 rounds",
    rewardXp: 40,
    field: "roundsPlayed",
    delta: 2,
  },
  {
    id: "president_1",
    title: "Take the Chair",
    description: "Finish as President once",
    rewardXp: 80,
    field: "timesPresident",
    delta: 1,
  },
  {
    id: "tricks_5",
    title: "Take Tricks",
    description: "Win 5 tricks",
    rewardXp: 50,
    field: "tricksWon",
    delta: 5,
  },
  {
    id: "rounds_1",
    title: "One More Round",
    description: "Complete 1 round",
    rewardXp: 25,
    field: "roundsPlayed",
    delta: 1,
  },
];

export type DailyChallengeState = {
  dayKey: string;
  challengeId: string;
  /** Counter values when the day started. */
  baseline: Partial<PlayerStats>;
  completed: boolean;
  rewardClaimed: boolean;
};

function getAsyncStorage(): {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function pickChallengeForDay(dayKey: string): DailyChallengeDef {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  return DAILY_CHALLENGE_POOL[hash % DAILY_CHALLENGE_POOL.length];
}

function snapshotBaseline(stats: PlayerStats, def: DailyChallengeDef): Partial<PlayerStats> {
  return { [def.field]: stats[def.field] };
}

export async function loadDailyChallengeState(
  stats: PlayerStats,
): Promise<{ state: DailyChallengeState; def: DailyChallengeDef }> {
  const dayKey = utcDayKey();
  const store = getAsyncStorage();
  let stored: DailyChallengeState | null = null;
  if (store) {
    try {
      const raw = await store.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) as DailyChallengeState;
    } catch {
      stored = null;
    }
  }

  if (stored && stored.dayKey === dayKey) {
    const def =
      DAILY_CHALLENGE_POOL.find((d) => d.id === stored!.challengeId) ??
      pickChallengeForDay(dayKey);
    return { state: stored, def };
  }

  const def = pickChallengeForDay(dayKey);
  const state: DailyChallengeState = {
    dayKey,
    challengeId: def.id,
    baseline: snapshotBaseline(stats, def),
    completed: false,
    rewardClaimed: false,
  };
  await persistDailyChallengeState(state);
  return { state, def };
}

export async function persistDailyChallengeState(
  state: DailyChallengeState,
): Promise<void> {
  const store = getAsyncStorage();
  if (!store) return;
  await store.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function dailyChallengeProgress(
  def: DailyChallengeDef,
  state: DailyChallengeState,
  stats: PlayerStats,
): { current: number; target: number; fraction: number; done: boolean } {
  const base = Number(state.baseline[def.field] ?? 0);
  const now = Number(stats[def.field] ?? 0);
  const gained = Math.max(0, now - base);
  const target = def.delta;
  const current = Math.min(gained, target);
  const done = state.completed || current >= target;
  return {
    current,
    target,
    fraction: target > 0 ? current / target : 0,
    done,
  };
}

/**
 * Pure: mark completed when progress is met. Does not grant XP.
 * Hub reload uses this so "reward ready" can wait for a tap.
 */
export function resolveDailyChallengeCompletion(
  def: DailyChallengeDef,
  state: DailyChallengeState,
  stats: PlayerStats,
): DailyChallengeState {
  const progress = dailyChallengeProgress(def, state, stats);
  if (!progress.done || state.completed) {
    return state;
  }
  return { ...state, completed: true };
}

/** Persist completed when progress is met — does not grant XP. */
export async function markDailyChallengeCompleteIfReady(
  def: DailyChallengeDef,
  state: DailyChallengeState,
  stats: PlayerStats,
): Promise<DailyChallengeState> {
  const next = resolveDailyChallengeCompletion(def, state, stats);
  if (next === state) {
    return state;
  }
  await persistDailyChallengeState(next);
  return next;
}

/**
 * Pure: resolve claim. Marks completed + rewardClaimed and reports XP to grant.
 * Does not touch storage or PlayerStats — caller persists and commits XP.
 */
export function resolveDailyChallengeClaim(
  def: DailyChallengeDef,
  state: DailyChallengeState,
  stats: PlayerStats,
): { state: DailyChallengeState; grantedXp: number } {
  const progress = dailyChallengeProgress(def, state, stats);
  if (!progress.done) {
    return { state, grantedXp: 0 };
  }
  if (state.rewardClaimed) {
    if (state.completed) {
      return { state, grantedXp: 0 };
    }
    return { state: { ...state, completed: true }, grantedXp: 0 };
  }
  return {
    state: { ...state, completed: true, rewardClaimed: true },
    grantedXp: def.rewardXp,
  };
}

/**
 * User-initiated claim: mark complete and grant XP once.
 * Do not call from hub load — use markDailyChallengeCompleteIfReady instead.
 */
export async function claimDailyChallengeIfReady(
  def: DailyChallengeDef,
  state: DailyChallengeState,
  stats: PlayerStats,
): Promise<{ state: DailyChallengeState; grantedXp: number }> {
  const resolved = resolveDailyChallengeClaim(def, state, stats);
  const changed =
    resolved.state.completed !== state.completed ||
    resolved.state.rewardClaimed !== state.rewardClaimed;
  if (!changed) {
    return { state, grantedXp: 0 };
  }
  if (resolved.grantedXp > 0) {
    const { commitRoundXpEarned } = await import("./playerStats");
    await commitRoundXpEarned(def.rewardXp, 0);
  }
  await persistDailyChallengeState(resolved.state);
  return resolved;
}
