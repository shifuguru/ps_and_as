// Game Center integration (iOS) via expo-game-center, with local fallback elsewhere.
import { Platform } from "react-native";
import * as Application from "expo-application";
import {
  GAME_CENTER_ACHIEVEMENTS,
  GAME_CENTER_LEADERBOARDS,
} from "../config/gameCenterIds";

type GameCenterModule = typeof import("expo-game-center");
type GameCenterServiceClass = GameCenterModule["GameCenterService"];

export interface PlayerInfo {
  /** Stable ID used for multiplayer rooms (Game Center ID or install ID). */
  id: string;
  /** Device-scoped install ID — survives Game Center sign-in/out. */
  installId: string;
  /** Game Center player ID when linked; null otherwise. */
  linkedAccountId: string | null;
  displayName: string;
  isAuthenticated: boolean;
  source: "gamecenter" | "fallback";
}

const INSTALL_ID_KEY = "@player_install_id";
const LEGACY_ID_KEY = "@player_id";
const LINKED_GC_KEY = "@player_linked_gc_id";

let gcService: InstanceType<GameCenterServiceClass> | null = null;
let gameCenterModule: GameCenterModule | null | undefined;

function loadGameCenterModule(): GameCenterModule | null {
  if (gameCenterModule !== undefined) return gameCenterModule;
  try {
    gameCenterModule = require("expo-game-center") as GameCenterModule;
  } catch (error) {
    console.warn("[GameCenter] Native module unavailable:", error);
    gameCenterModule = null;
  }
  return gameCenterModule;
}

function getGameCenterService(): InstanceType<GameCenterServiceClass> {
  const mod = loadGameCenterModule();
  if (!mod) {
    throw new Error("expo-game-center is not available on this platform");
  }
  if (!gcService) {
    gcService = new mod.GameCenterService({
      achievements: GAME_CENTER_ACHIEVEMENTS,
      leaderboards: GAME_CENTER_LEADERBOARDS,
      enableLogging: __DEV__,
    });
  }
  return gcService;
}

export function isGameCenterPlatformSupported(): boolean {
  const mod = loadGameCenterModule();
  if (!mod) return false;
  try {
    return mod.GameCenterService.isPlatformSupported();
  } catch {
    return false;
  }
}

async function readHardwareInstallId(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      return Application.getAndroidId();
    }
    if (Platform.OS === "ios") {
      return (await Application.getIosIdForVendorAsync()) ?? null;
    }
  } catch {
    // fall through
  }
  return null;
}

async function ensureInstallId(): Promise<string> {
  const cached = await getCachedInstallId();
  if (cached) return cached;

  const legacy = await getCachedPlayerId();
  const hardware = await readHardwareInstallId();
  const id =
    legacy ||
    (hardware ? `hw-${hardware}` : null) ||
    `install-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  await cacheInstallId(id);
  if (!legacy) {
    await cachePlayerId(id);
  }
  return id;
}

function buildPlayerInfo(
  installId: string,
  displayName: string,
  linkedAccountId: string | null,
  isAuthenticated: boolean,
  source: PlayerInfo["source"],
): PlayerInfo {
  return {
    id: linkedAccountId || installId,
    installId,
    linkedAccountId,
    displayName,
    isAuthenticated,
    source,
  };
}

async function ensureDeviceId(): Promise<string> {
  return ensureInstallId();
}

async function playerInfoFromLocalPlayer(
  player: { playerID: string; displayName: string; alias: string },
  cachedName: string | null,
  installId: string,
): Promise<PlayerInfo> {
  await cacheLinkedGameCenterId(player.playerID);
  await cachePlayerId(player.playerID);
  const displayName =
    cachedName || player.displayName || player.alias || "Player";
  if (!cachedName && displayName) {
    await cachePlayerName(displayName);
  }
  return buildPlayerInfo(
    installId,
    displayName,
    player.playerID,
    true,
    "gamecenter",
  );
}

/**
 * Authenticate with Game Center (shows system UI if needed).
 */
export async function authenticatePlayer(): Promise<PlayerInfo> {
  if (!isGameCenterPlatformSupported()) {
    return getOrCreatePlayerId();
  }

  try {
    const mod = loadGameCenterModule();
    if (!mod) {
      return getOrCreatePlayerId();
    }
    const available = await mod.default.isGameCenterAvailable();
    if (!available) {
      return getOrCreatePlayerId();
    }

    const authenticated = await mod.default.authenticateLocalPlayer();
    if (!authenticated) {
      return getOrCreatePlayerId();
    }

    const player = await mod.default.getLocalPlayer();
    if (player?.playerID) {
      const cachedName = await getCachedPlayerName();
      const installId = await ensureInstallId();
      return playerInfoFromLocalPlayer(player, cachedName, installId);
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
    const mod = loadGameCenterModule();
    if (!mod) return false;
    const player = await mod.default.getLocalPlayer();
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
  const installId = await ensureInstallId();
  const linkedAccountId = await getCachedLinkedGameCenterId();

  if (isGameCenterPlatformSupported()) {
    try {
      const mod = loadGameCenterModule();
      if (mod) {
        const available = await mod.default.isGameCenterAvailable();
        if (available) {
          const player = await mod.default.getLocalPlayer();
          if (player?.playerID) {
            return playerInfoFromLocalPlayer(player, cachedName, installId);
          }
        }
      }
    } catch {
      // fall through to local profile
    }
  }

  if (linkedAccountId) {
    return buildPlayerInfo(
      installId,
      cachedName || "Player",
      linkedAccountId,
      false,
      "gamecenter",
    );
  }

  return buildPlayerInfo(
    installId,
    cachedName || "Player",
    null,
    false,
    "fallback",
  );
}

export async function getCachedInstallId(): Promise<string | null> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return await AsyncStorage.getItem(INSTALL_ID_KEY);
  } catch {
    return null;
  }
}

export async function cacheInstallId(id: string): Promise<void> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(INSTALL_ID_KEY, id);
  } catch {
    // ignore
  }
}

export async function getCachedLinkedGameCenterId(): Promise<string | null> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return await AsyncStorage.getItem(LINKED_GC_KEY);
  } catch {
    return null;
  }
}

export async function cacheLinkedGameCenterId(id: string): Promise<void> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(LINKED_GC_KEY, id);
  } catch {
    // ignore
  }
}

export async function getCachedPlayerId(): Promise<string | null> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return await AsyncStorage.getItem(LEGACY_ID_KEY);
  } catch {
    return null;
  }
}

export async function cachePlayerId(id: string): Promise<void> {
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(LEGACY_ID_KEY, id);
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
  const { validateDisplayText, isValidDisplayText } = require("../utils/profanityFilter") as typeof import("../utils/profanityFilter");
  const check = validateDisplayText(name, "Player name");
  if (!isValidDisplayText(check)) {
    throw new Error(check.reason);
  }
  try {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("@player_name", check.value);
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
