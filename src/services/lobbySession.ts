const SESSION_KEY = "@ps_and_as_lobby_session";
const SESSION_TTL_MS = 30 * 60 * 1000;

export type LobbySession = {
  roomId: string;
  profileId: string;
  playerName: string;
  isHost: boolean;
  roomName?: string;
  savedAt: number;
};

function getAsyncStorage() {
  try {
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

export async function saveLobbySession(
  session: Omit<LobbySession, "savedAt">,
): Promise<void> {
  const AsyncStorage = getAsyncStorage();
  if (!AsyncStorage) return;
  const payload: LobbySession = { ...session, savedAt: Date.now() };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export async function getLobbySession(): Promise<LobbySession | null> {
  const AsyncStorage = getAsyncStorage();
  if (!AsyncStorage) return null;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as LobbySession;
    if (!session?.roomId || !session?.profileId) return null;
    if (Date.now() - session.savedAt > SESSION_TTL_MS) {
      await clearLobbySession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearLobbySession(): Promise<void> {
  const AsyncStorage = getAsyncStorage();
  if (!AsyncStorage) return;
  await AsyncStorage.removeItem(SESSION_KEY);
}
