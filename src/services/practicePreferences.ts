const STORAGE_KEY = "@ps_and_as_practice_player_count";

export const PRACTICE_MIN_PLAYERS = 3;
export const PRACTICE_MAX_PLAYERS = 8;
export const PRACTICE_DEFAULT_PLAYERS = 4;

let cachedPracticePlayerCount: number | null = null;

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

function getWebStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function clampPracticePlayerCount(count: number): number {
  if (!Number.isFinite(count)) return PRACTICE_DEFAULT_PLAYERS;
  return Math.min(
    PRACTICE_MAX_PLAYERS,
    Math.max(PRACTICE_MIN_PLAYERS, Math.round(count)),
  );
}

export async function readPracticePlayerCount(): Promise<number> {
  if (cachedPracticePlayerCount != null) return cachedPracticePlayerCount;
  const store = getAsyncStorage();
  try {
    const raw = store
      ? await store.getItem(STORAGE_KEY)
      : getWebStorage()?.getItem(STORAGE_KEY) ?? null;
    if (!raw) return PRACTICE_DEFAULT_PLAYERS;
    const parsed = Number.parseInt(raw, 10);
    const count = clampPracticePlayerCount(parsed);
    cachedPracticePlayerCount = count;
    return count;
  } catch {
    return PRACTICE_DEFAULT_PLAYERS;
  }
}

export async function writePracticePlayerCount(count: number): Promise<void> {
  const store = getAsyncStorage();
  const clampedCount = clampPracticePlayerCount(count);
  cachedPracticePlayerCount = clampedCount;
  try {
    const value = String(clampedCount);
    if (store) {
      await store.setItem(STORAGE_KEY, value);
    } else {
      getWebStorage()?.setItem(STORAGE_KEY, value);
    }
  } catch {
    /* non-critical */
  }
}
