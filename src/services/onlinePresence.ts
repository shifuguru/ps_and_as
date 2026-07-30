export type OnlinePlayer = {
  displayName: string;
};

export type OnlinePresenceSnapshot = {
  count: number;
  players: OnlinePlayer[];
  /** True when the server included a `players` array (even if empty). */
  playersProvided: boolean;
};

export const EMPTY_ONLINE_PRESENCE: OnlinePresenceSnapshot = {
  count: 0,
  players: [],
  playersProvided: false,
};

export function parseOnlinePlayerCount(data: {
  activePlayers?: unknown;
}): number | null {
  const raw = data?.activePlayers;
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(0, Math.floor(raw))
    : null;
}

export function parseOnlinePlayers(raw: unknown): OnlinePlayer[] {
  if (!Array.isArray(raw)) return [];

  const names: OnlinePlayer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const displayName = (item as { displayName?: unknown }).displayName;
    if (typeof displayName !== "string") continue;
    const trimmed = displayName.trim();
    if (!trimmed) continue;
    names.push({ displayName: trimmed });
  }

  return names.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    }),
  );
}

export function parseOnlinePresencePayload(data: {
  activePlayers?: unknown;
  players?: unknown;
}): OnlinePresenceSnapshot | null {
  const count = parseOnlinePlayerCount(data);
  if (count == null) return null;
  const playersProvided = Array.isArray(data.players);
  return {
    count,
    players: playersProvided ? parseOnlinePlayers(data.players) : [],
    playersProvided,
  };
}

/**
 * Merge a newly parsed presence payload into the latest snapshot.
 * Count-only payloads (no `players` field) must not wipe known names when the
 * count is stable/rising — production may still emit `{ activePlayers }` alone.
 * When the count drops (or hits zero), prior names are stale and must clear.
 */
export function mergeOnlinePresence(
  previous: OnlinePresenceSnapshot,
  incoming: OnlinePresenceSnapshot,
): OnlinePresenceSnapshot {
  if (incoming.playersProvided) {
    return incoming;
  }
  if (incoming.count <= 0) {
    return {
      count: 0,
      players: [],
      playersProvided: previous.playersProvided,
    };
  }
  if (incoming.count < previous.players.length) {
    return {
      count: incoming.count,
      players: [],
      playersProvided: false,
    };
  }
  return {
    count: incoming.count,
    players: previous.players,
    playersProvided: previous.playersProvided,
  };
}

/** Ensure the local player appears when the server count is non-zero but nameless. */
export function withLocalPresenceFallback(
  snapshot: OnlinePresenceSnapshot,
  localDisplayName: string | null | undefined,
): OnlinePresenceSnapshot {
  const trimmed = localDisplayName?.trim();
  if (!trimmed || snapshot.count <= 0) return snapshot;
  if (snapshot.players.length > 0) return snapshot;
  return {
    ...snapshot,
    players: [{ displayName: trimmed }],
  };
}
