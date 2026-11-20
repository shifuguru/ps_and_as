import type { OnlinePlayer } from "./onlinePresence";

const STORAGE_KEY = "@ps_and_as_friends";

export type FriendProfile = Pick<OnlinePlayer, "id" | "displayName"> & {
  lastSeenAt?: number;
};

/** "Online 5 seconds ago" style label, rounded down to the largest unit. */
export function formatOnlineAgo(lastSeenAt: number | undefined, now = Date.now()): string {
  if (typeof lastSeenAt !== "number" || !Number.isFinite(lastSeenAt)) {
    return "Online a while ago";
  }
  // Clamp negatives (clock skew) so we never show a negative or "0 seconds".
  const seconds = Math.max(0, Math.floor((now - lastSeenAt) / 1000));
  if (seconds < 1) return "Online just now";
  const units: [string, number][] = [
    ["year", 365 * 86400],
    ["month", 30 * 86400],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [name, size] of units) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `Online ${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return `Online ${seconds} ${seconds === 1 ? "second" : "seconds"} ago`;
}

function getAsyncStorage(): {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
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

function parseFriends(raw: string | null): FriendProfile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const friends: FriendProfile[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const { id, displayName, lastSeenAt } = item as Partial<FriendProfile>;
      if (
        typeof id !== "string" ||
        !id.trim() ||
        seen.has(id) ||
        typeof displayName !== "string" ||
        !displayName.trim()
      ) {
        continue;
      }
      seen.add(id);
      friends.push({
        id: id.trim(),
        displayName: displayName.trim().slice(0, 32),
        ...(typeof lastSeenAt === "number" ? { lastSeenAt } : {}),
      });
    }
    return friends;
  } catch {
    return [];
  }
}

export async function readFriends(): Promise<FriendProfile[]> {
  try {
    const storage = getAsyncStorage();
    const raw = storage
      ? await storage.getItem(STORAGE_KEY)
      : getWebStorage()?.getItem(STORAGE_KEY) ?? null;
    return parseFriends(raw);
  } catch {
    return [];
  }
}

export async function addFriend(
  friend: FriendProfile,
  currentPlayerId?: string | null,
): Promise<FriendProfile[]> {
  if (currentPlayerId && friend.id === currentPlayerId) return readFriends();
  const next = (await readFriends()).filter((item) => item.id !== friend.id);
  // Friends are added from the online list, so they were just seen.
  next.push({ id: friend.id, displayName: friend.displayName, lastSeenAt: Date.now() });
  await writeFriends(next);
  return next;
}

async function writeFriends(friends: FriendProfile[]): Promise<void> {
  try {
    const value = JSON.stringify(friends);
    const storage = getAsyncStorage();
    if (storage) await storage.setItem(STORAGE_KEY, value);
    else getWebStorage()?.setItem(STORAGE_KEY, value);
  } catch {
    /* Non-critical: the current session retains the change. */
  }
}

export async function recordFriendsSeen(
  onlineIds: string[],
  now = Date.now(),
): Promise<FriendProfile[]> {
  const friends = await readFriends();
  const online = new Set(onlineIds);
  if (!friends.some((friend) => online.has(friend.id))) return friends;
  const next = friends.map((friend) =>
    online.has(friend.id) ? { ...friend, lastSeenAt: now } : friend,
  );
  await writeFriends(next);
  return next;
}
