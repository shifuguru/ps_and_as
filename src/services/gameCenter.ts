// Game Center integration (iOS) via expo-game-center, with local fallback elsewhere.
import { Platform } from "react-native";
import ExpoGameCenter, { GameCenterService } from "expo-game-center";
import {
  GAME_CENTER_ACHIEVEMENTS,
  GAME_CENTER_LEADERBOARDS,
} from "../config/gameCenterIds";

export interface PlayerInfo {
  id: string;
  displayName: string;
  isAuthenticated: boolean;
  source: "gamecenter" | "fallback";
}

let gcService: GameCenterService | null = null;

function getGameCenterService(): GameCenterService {
  if (!gcService) {
    gcService = new GameCenterService({
      achievements: GAME_CENTER_ACHIEVEMENTS,
      leaderboards: GAME_CENTER_LEADERBOARDS,
      enableLogging: __DEV__,
    });
  }
  return gcService;
}

export function isGameCenterPlatformSupported(): boolean {
  return GameCenterService.isPlatformSupported();
}

async function ensureDeviceId(): Promise<string> {
  const cached = await getCachedPlayerId();
  if (cached) return cached;
  const id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  await cachePlayerId(id);
  return id;
}

async function playerInfoFromLocalPlayer(
  player: { playerID: string; displayName: string; alias: string },
  cachedName: string | null,
): Promise<PlayerInfo> {
  await cachePlayerId(player.playerID);
  const displayName =
    cachedName || player.displayName || player.alias || "Player";
  if (!cachedName && displayName) {
    await cachePlayerName(displayName);
  }
  return {
    id: player.playerID,
    displayName,
    isAuthenticated: true,
    source: "gamecenter",
  };
}

/**
 * Authenticate with Game Center (shows system UI if needed).
 */
export async function authenticatePlayer(): Promise<PlayerInfo> {
  if (!isGameCenterPlatformSupported()) {
    return getOrCreatePlayerId();
  }

  try {
    const available = await ExpoGameCenter.isGameCenterAvailable();
    if (!available) {
      return getOrCreatePlayerId();
    }

    const authenticated = await ExpoGameCenter.authenticateLocalPlayer();
    if (!authenticated) {
      return getOrCreatePlayerId();
    }

    const player = await ExpoGameCenter.getLocalPlayer();
    if (player?.playerID) {
      const cachedName = await getCachedPlayerName();
      return playerInfoFromLocalPlayer(player, cachedName);
    }
  } catch (error) {
    console.warn("[GameCenter] Authentication failed:", error);
  }

  return getOrCreatePlayerId();
}

/**
 * Check if player is authenticated without prompting.
 */
export async function isPlayerAuthenticated(): Promise<boolean> {
  if (!isGameCenterPlatformSupported()) return false;

  try {
    const player = await ExpoGameCenter.getLocalPlayer();
    return !!(player && player.playerID);
  } catch {
    return false;
  }
}

/**
 * Get or create a persistent player ID without prompting for Game Center sign-in.
 */
export async function getOrCreatePlayerId(): Promise<PlayerInfo> {
  const cachedName = await getCachedPlayerName();

  if (isGameCenterPlatformSupported()) {
    try {
      const available = await ExpoGameCenter.isGameCenterAvailable();
      if (available) {
        const player = await ExpoGameCenter.getLocalPlayer();
        if (player?.playerID) {
          return playerInfoFromLocalPlayer(player, cachedName);
        }
      }
    } catch {
      // fall through to local profile
    }
  }

  const cachedId = await getCachedPlayerId();
  if (cachedId) {
    return {
      id: cachedId,
      displayName: cachedName || "Player",
      isAuthenticated: false,
      source: "fallback",
    };
  }

  const newId = await ensureDeviceId();
  return {
    id: newId,
    displayName: cachedName || "Player",
    isAuthenticated: false,
    source: "fallback",
  };
}

export async function getCachedPlayerId(): Promise<string | null> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return await AsyncStorage.getItem("@player_id");
  } catch {
    return null;
  }
}

export async function cachePlayerId(id: string): Promise<void> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("@player_id", id);
  } catch {
    // ignore
  }
}

export async function getCachedPlayerName(): Promise<string | null> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return await AsyncStorage.getItem("@player_name");
  } catch {
    return null;
  }
}

export async function cachePlayerName(name: string): Promise<void> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("@player_name", name);
  } catch {
    // ignore
  }
}

/** Present native Game Center achievements UI (iOS). */
export async function showGameCenterAchievements(): Promise<void> {
  if (!isGameCenterPlatformSupported()) return;
  const service = getGameCenterService();
  await service.initialize();
  if (!service.isReady()) {
    const ok = await service.authenticate();
    if (!ok) return;
  }
  await service.showAchievements();
}

/** Present native Game Center leaderboards UI (iOS). */
export async function showGameCenterLeaderboards(): Promise<void> {
  if (!isGameCenterPlatformSupported()) return;
  const service = getGameCenterService();
  await service.initialize();
  if (!service.isReady()) {
    const ok = await service.authenticate();
    if (!ok) return;
  }
  await service.showGameCenter();
}

export { getGameCenterService };

export const gameCenterService = {
  authenticatePlayer,
  isPlayerAuthenticated,
  getOrCreatePlayerId,
  getCachedPlayerId,
  cachePlayerId,
  getCachedPlayerName,
  cachePlayerName,
  showGameCenterAchievements,
  showGameCenterLeaderboards,
  isGameCenterPlatformSupported,
};
