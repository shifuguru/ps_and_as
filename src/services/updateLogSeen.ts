import {
  countUnreadUpdateNotifications,
  latestUpdateLogTimestamp,
} from "../screens/updateLogContent";

const STORAGE_KEY = "@ps_and_as_update_log_last_seen";

function getAsyncStorage() {
  try {
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

export async function getUpdateLogLastSeenAt(): Promise<string | null> {
  const AsyncStorage = getAsyncStorage();
  if (!AsyncStorage) return null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export async function getUpdateLogUnreadCount(): Promise<number> {
  const lastSeen = await getUpdateLogLastSeenAt();
  return countUnreadUpdateNotifications(lastSeen);
}

export async function markUpdateLogSeen(): Promise<void> {
  const AsyncStorage = getAsyncStorage();
  if (!AsyncStorage) return;
  await AsyncStorage.setItem(STORAGE_KEY, latestUpdateLogTimestamp());
}
