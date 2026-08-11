/**
 * Daily login bonus — tap to claim 20 XP once per UTC calendar day.
 *
 * Resets at UTC midnight (same day boundary as daily challenge and rewarded ads).
 * XP grants only via `commitRoundXpEarned` on explicit claim — never on hub load.
 */
import { utcDayKey } from "./dailyChallenge";

const STORAGE_KEY = "@ps_and_as_daily_login_v1";

export const DAILY_LOGIN_XP = 20;

export type DailyLoginState = {
  dayKey: string;
  claimed: boolean;
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

export async function loadDailyLoginState(): Promise<DailyLoginState> {
  const dayKey = utcDayKey();
  const store = getAsyncStorage();
  let stored: DailyLoginState | null = null;
  if (store) {
    try {
      const raw = await store.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) as DailyLoginState;
    } catch {
      stored = null;
    }
  }

  if (stored && stored.dayKey === dayKey) {
    return stored;
  }

  const state: DailyLoginState = { dayKey, claimed: false };
  await persistDailyLoginState(state);
  return state;
}

export async function persistDailyLoginState(
  state: DailyLoginState,
): Promise<void> {
  const store = getAsyncStorage();
  if (!store) return;
  await store.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Pure: resolve claim for the current day. Does not touch storage or PlayerStats.
 */
export function resolveDailyLoginClaim(
  state: DailyLoginState,
  dayKey = utcDayKey(),
): { state: DailyLoginState; grantedXp: number } {
  if (state.dayKey !== dayKey) {
    return { state: { dayKey, claimed: false }, grantedXp: 0 };
  }
  if (state.claimed) {
    return { state, grantedXp: 0 };
  }
  return {
    state: { ...state, claimed: true },
    grantedXp: DAILY_LOGIN_XP,
  };
}

/** User-initiated claim — grants XP once per UTC day. */
export async function claimDailyLoginIfReady(
  state: DailyLoginState,
): Promise<{ state: DailyLoginState; grantedXp: number }> {
  const resolved = resolveDailyLoginClaim(state);
  if (resolved.state.claimed === state.claimed && resolved.grantedXp === 0) {
    return { state, grantedXp: 0 };
  }
  if (resolved.grantedXp > 0) {
    const { commitRoundXpEarned } = await import("./playerStats");
    await commitRoundXpEarned(DAILY_LOGIN_XP, 0);
  }
  await persistDailyLoginState(resolved.state);
  return resolved;
}
