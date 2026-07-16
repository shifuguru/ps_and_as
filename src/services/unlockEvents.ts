import {
  ACHIEVEMENTS,
  achievementPrestige,
  type AchievementDef,
  type PlayerStats,
} from "./playerStats";

const SNAPSHOT_KEY = "@ps_and_as_hub_unlock_snapshot";
const EVENTS_KEY = "@ps_and_as_unlock_events";
const MAX_EVENTS = 40;

export type UnlockEvent = {
  id: string;
  unlockedAt: number;
  /** Prestige rank earned by this event (1 = first unlock). */
  prestige?: number;
};

/** Prestige map snapshot — id → completed ranks last seen. */
type PrestigeSnapshot = {
  version: 2;
  prestige: Record<string, number>;
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

function currentPrestigeMap(stats: PlayerStats): Record<string, number> {
  const map: Record<string, number> = {};
  for (const def of ACHIEVEMENTS) {
    map[def.id] = achievementPrestige(stats, def);
  }
  return map;
}

export async function readUnlockSnapshotIds(): Promise<string[]> {
  const prestige = await readPrestigeSnapshot();
  return Object.keys(prestige).filter((id) => (prestige[id] ?? 0) >= 1);
}

async function readRawSnapshot(): Promise<unknown | null> {
  const store = getAsyncStorage();
  if (!store) return null;
  try {
    const raw = await store.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Reads prestige snapshot. Migrates legacy string[] (unlocked ids) by seeding
 * current counter-derived prestige — retroactive credit, no fabricated events.
 */
export async function readPrestigeSnapshot(): Promise<Record<string, number>> {
  const parsed = await readRawSnapshot();
  if (parsed == null) return {};

  if (Array.isArray(parsed)) {
    // Legacy v1: list of unlocked ids — caller migrates with stats.
    const map: Record<string, number> = {};
    for (const id of parsed) {
      if (typeof id === "string") map[id] = 1;
    }
    return map;
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    (parsed as PrestigeSnapshot).version === 2 &&
    (parsed as PrestigeSnapshot).prestige &&
    typeof (parsed as PrestigeSnapshot).prestige === "object"
  ) {
    const out: Record<string, number> = {};
    for (const [id, value] of Object.entries(
      (parsed as PrestigeSnapshot).prestige,
    )) {
      const n = Math.floor(Number(value) || 0);
      if (n > 0) out[id] = n;
    }
    return out;
  }

  return {};
}

export async function writeUnlockSnapshotIds(ids: string[]): Promise<void> {
  // Compatibility shim: treat as prestige 1 for listed ids.
  const prestige: Record<string, number> = {};
  for (const id of ids) prestige[id] = 1;
  await writePrestigeSnapshot(prestige);
}

export async function writePrestigeSnapshot(
  prestige: Record<string, number>,
): Promise<void> {
  const store = getAsyncStorage();
  if (!store) return;
  const cleaned: Record<string, number> = {};
  for (const [id, value] of Object.entries(prestige)) {
    const n = Math.floor(Number(value) || 0);
    if (n > 0) cleaned[id] = n;
  }
  const payload: PrestigeSnapshot = { version: 2, prestige: cleaned };
  await store.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
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

async function isLegacyIdListSnapshot(): Promise<boolean> {
  const parsed = await readRawSnapshot();
  return Array.isArray(parsed);
}

export type PrestigeGain = {
  def: AchievementDef;
  from: number;
  to: number;
};

/**
 * Diff current prestige vs snapshot; append events for rank-ups; refresh snapshot.
 * Returns achievements that gained at least one prestige rank (newest last).
 *
 * First run / legacy migration: seeds snapshot from existing counter-derived
 * prestige without fabricating "just unlocked" events — applies retroactively.
 */
export async function syncUnlockSnapshot(
  stats: PlayerStats,
): Promise<AchievementDef[]> {
  const gains = await syncPrestigeSnapshot(stats);
  return gains.map((g) => g.def);
}

export async function syncPrestigeSnapshot(
  stats: PlayerStats,
): Promise<PrestigeGain[]> {
  const current = currentPrestigeMap(stats);

  if (!(await hasUnlockSnapshot())) {
    await writePrestigeSnapshot(current);
    return [];
  }

  // One-time migrate legacy unlocked-id lists → full counter-derived prestige.
  if (await isLegacyIdListSnapshot()) {
    await writePrestigeSnapshot(current);
    return [];
  }

  const prev = await readPrestigeSnapshot();
  const gains: PrestigeGain[] = [];
  const now = Date.now();
  const newEvents: UnlockEvent[] = [];

  for (const def of ACHIEVEMENTS) {
    const to = current[def.id] ?? 0;
    const from = prev[def.id] ?? 0;
    if (to <= from) continue;
    gains.push({ def, from, to });
    // One event per new rank so the recent list can show the highest prestige.
    for (let rank = from + 1; rank <= to; rank++) {
      newEvents.push({ id: def.id, unlockedAt: now, prestige: rank });
    }
  }

  if (newEvents.length > 0) {
    const events = await readUnlockEvents();
    await writeUnlockEvents([...newEvents.reverse(), ...events]);
  }

  await writePrestigeSnapshot(current);
  return gains;
}

/** Most recent unlock / prestige event that still matches a known achievement. */
export async function getMostRecentUnlock(): Promise<{
  def: AchievementDef;
  unlockedAt: number;
  prestige: number;
} | null> {
  const events = await readUnlockEvents();
  for (const ev of events) {
    const def = ACHIEVEMENTS.find((a) => a.id === ev.id);
    if (!def) continue;
    return {
      def,
      unlockedAt: ev.unlockedAt,
      prestige: ev.prestige ?? 1,
    };
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
