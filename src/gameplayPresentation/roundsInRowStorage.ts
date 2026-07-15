/**
 * Session-scoped consecutive rounds counter (presentation).
 * Not Asshole streak / President streak — rounds completed at this table.
 */
const BEST_KEY = "@ps_and_as_rounds_in_row_best";

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

export async function loadRoundsInRowBest(): Promise<number> {
  const store = getAsyncStorage();
  if (!store) return 0;
  try {
    const raw = await store.getItem(BEST_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export async function persistRoundsInRowBest(best: number): Promise<void> {
  const store = getAsyncStorage();
  if (!store) return;
  await store.setItem(BEST_KEY, String(Math.max(0, Math.floor(best))));
}
