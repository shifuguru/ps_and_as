export type OnlinePlayer = {
  displayName: string;
};

export type OnlinePresenceSnapshot = {
  count: number;
  players: OnlinePlayer[];
};

export const EMPTY_ONLINE_PRESENCE: OnlinePresenceSnapshot = {
  count: 0,
  players: [],
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
  return {
    count,
    players: parseOnlinePlayers(data.players),
  };
}
