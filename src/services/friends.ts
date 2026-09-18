import type { OnlinePlayer } from "./onlinePresence";

const STORAGE_KEY = "@ps_and_as_friends";

export type FriendProfile = Pick<OnlinePlayer, "id" | "displayName">;

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
      const { id, displayName } = item as Partial<FriendProfile>;
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
      friends.push({ id: id.trim(), displayName: displayName.trim().slice(0, 32) });
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
  next.push({ id: friend.id, displayName: friend.displayName });
  try {
    const value = JSON.stringify(next);
    const storage = getAsyncStorage();
    if (storage) await storage.setItem(STORAGE_KEY, value);
    else getWebStorage()?.setItem(STORAGE_KEY, value);
  } catch {
    /* Non-critical: the current session retains the addition. */
  }
  return next;
}
