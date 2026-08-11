const STORAGE_KEY = "@ps_and_as_practice_player_count";

export const PRACTICE_MIN_PLAYERS = 3;
export const PRACTICE_MAX_PLAYERS = 8;
export const PRACTICE_DEFAULT_PLAYERS = 4;

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

export function clampPracticePlayerCount(count: number): number {
  if (!Number.isFinite(count)) return PRACTICE_DEFAULT_PLAYERS;
  return Math.min(
    PRACTICE_MAX_PLAYERS,
    Math.max(PRACTICE_MIN_PLAYERS, Math.round(count)),
  );
}

export async function readPracticePlayerCount(): Promise<number> {
  const store = getAsyncStorage();
  if (!store) return PRACTICE_DEFAULT_PLAYERS;
  try {
    const raw = await store.getItem(STORAGE_KEY);
    if (!raw) return PRACTICE_DEFAULT_PLAYERS;
    const parsed = Number.parseInt(raw, 10);
    return clampPracticePlayerCount(parsed);
  } catch {
    return PRACTICE_DEFAULT_PLAYERS;
  }
}

export async function writePracticePlayerCount(count: number): Promise<void> {
  const store = getAsyncStorage();
  if (!store) return;
  try {
    await store.setItem(
      STORAGE_KEY,
      String(clampPracticePlayerCount(count)),
    );
  } catch {
    /* non-critical */
  }
}
