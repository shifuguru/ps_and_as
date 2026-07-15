import {
  ACHIEVEMENTS,
  type AchievementDef,
  unlockedAchievements,
  type PlayerStats,
} from "./playerStats";

const SNAPSHOT_KEY = "@ps_and_as_hub_unlock_snapshot";
const EVENTS_KEY = "@ps_and_as_unlock_events";
const MAX_EVENTS = 40;

export type UnlockEvent = {
  id: string;
  unlockedAt: number;
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

export async function readUnlockSnapshotIds(): Promise<string[]> {
  const store = getAsyncStorage();
  if (!store) return [];
  try {
    const raw = await store.getItem(SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export async function writeUnlockSnapshotIds(ids: string[]): Promise<void> {
  const store = getAsyncStorage();
  if (!store) return;
  await store.setItem(SNAPSHOT_KEY, JSON.stringify(ids));
}

export async function readUnlockEvents(): Promise<UnlockEvent[]> {
  const store = getAsyncStorage();
  if (!store) return [];
  try {
    const raw = await store.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.id === "string" && typeof e.unlockedAt === "number",
    );
  } catch {
    return [];
  }
}

async function writeUnlockEvents(events: UnlockEvent[]): Promise<void> {
  const store = getAsyncStorage();
  if (!store) return;
  await store.setItem(EVENTS_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
}

/** True when the snapshot key has never been written (pre–Player Hub installs). */
async function hasUnlockSnapshot(): Promise<boolean> {
  const store = getAsyncStorage();
  if (!store) return false;
  try {
    const raw = await store.getItem(SNAPSHOT_KEY);
    return raw != null;
  } catch {
    return false;
  }
}

/**
 * Diff current unlocks vs snapshot; append new events; refresh snapshot.
 * Returns newly unlocked achievement defs (order: newest last).
 *
 * First run (no snapshot yet): seeds the snapshot from existing unlocks
 * without fabricating "just unlocked" events — preserves veteran progress
 * presentation when upgrading from builds that had no unlock log.
 */
export async function syncUnlockSnapshot(
  stats: PlayerStats,
): Promise<AchievementDef[]> {
  const current = unlockedAchievements(stats);
  const currentIds = current.map((a) => a.id);

  if (!(await hasUnlockSnapshot())) {
    await writeUnlockSnapshotIds(currentIds);
    return [];
  }

  const prev = new Set(await readUnlockSnapshotIds());
  const newly = current.filter((a) => !prev.has(a.id));

  if (newly.length > 0) {
    const now = Date.now();
    const events = await readUnlockEvents();
    const nextEvents = [
      ...newly.map((a) => ({ id: a.id, unlockedAt: now })),
      ...events,
    ].slice(0, MAX_EVENTS);
    await writeUnlockEvents(nextEvents);
  }

  await writeUnlockSnapshotIds(currentIds);
  return newly;
}

/** Most recent unlock event that still matches a known achievement. */
export async function getMostRecentUnlock(): Promise<{
  def: AchievementDef;
  unlockedAt: number;
} | null> {
  const events = await readUnlockEvents();
  for (const ev of events) {
    const def = ACHIEVEMENTS.find((a) => a.id === ev.id);
    if (def) return { def, unlockedAt: ev.unlockedAt };
  }
  return null;
}

export function formatUnlockAge(unlockedAt: number, now = Date.now()): string {
  const ms = Math.max(0, now - unlockedAt);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
