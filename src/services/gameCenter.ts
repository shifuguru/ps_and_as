// GameCenter integration for player identification
// Uses react-native-cross-platform-game-services for iOS GameCenter and Google Play Games

let GameServices: any = null;
let isAvailable = false;

// Try to load GameServices dynamically
try {
  GameServices = require("react-native-cross-platform-game-services").default;
  isAvailable = true;
  console.log("[GameCenter] GameServices module loaded successfully");
} catch (e) {
  console.warn("[GameCenter] Not available (react-native-cross-platform-game-services not installed)");
}

export interface PlayerInfo {
  id: string;
  displayName: string;
  isAuthenticated: boolean;
  source: "gamecenter" | "fallback";
}

/**
 * Authenticate with GameCenter and get player info
 */
export async function authenticatePlayer(): Promise<PlayerInfo> {
  if (!isAvailable || !GameServices) {
    console.log("[GameCenter] Using fallback authentication");
    return getFallbackPlayerInfo();
  }

  try {
    console.log("[GameCenter] Attempting authentication...");
    
    // Sign in to GameCenter/Play Games
    const signInResult = await GameServices.signIn();
    console.log("[GameCenter] Sign in result:", signInResult);
    
    if (!signInResult || !signInResult.success) {
      console.log("[GameCenter] Sign in not successful, using fallback");
      return getFallbackPlayerInfo();
    }

    // Get current player info
    const player = await GameServices.getCurrentPlayer();
    console.log("[GameCenter] Current player:", player);

    if (player && player.playerId) {
      return {
        id: player.playerId,
        displayName: player.displayName || player.alias || "Player",
        isAuthenticated: true,
        source: "gamecenter"
      };
    }

    console.log("[GameCenter] No player info available, using fallback");
    return getFallbackPlayerInfo();
  } catch (error) {
    console.warn("[GameCenter] Authentication failed:", error);
    return getFallbackPlayerInfo();
  }
}

/**
 * Check if player is authenticated without prompting
 */
export async function isPlayerAuthenticated(): Promise<boolean> {
  if (!isAvailable || !GameServices) {
    return false;
  }

  try {
    const player = await GameServices.getCurrentPlayer();
    return !!(player && player.playerId);
  } catch (error) {
    console.warn("[GameCenter] Failed to check authentication:", error);
    return false;
  }
}

/**
 * Get fallback player info when GameCenter is not available
 */
function getFallbackPlayerInfo(): PlayerInfo {
  const deviceId = generateDeviceId();
  console.log("[GameCenter] Using fallback ID:", deviceId);
  
  return {
    id: deviceId,
    displayName: "Player",
    isAuthenticated: false,
    source: "fallback"
  };
}

/**
 * Generate a semi-persistent device ID
 * Uses AsyncStorage to maintain same ID across app sessions
 */
function generateDeviceId(): string {
  // For now, generate a random ID
  // In production, this should be stored in AsyncStorage
  const id = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return id;
}

/**
 * Get cached player ID from AsyncStorage
 */
export async function getCachedPlayerId(): Promise<string | null> {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const cachedId = await AsyncStorage.getItem("@player_id");
    console.log("[GameCenter] Cached player ID:", cachedId);
    return cachedId;
  } catch (e) {
    console.warn("[GameCenter] Failed to get cached ID:", e);
    return null;
  }
}

/**
 * Save player ID to AsyncStorage
 */
export async function cachePlayerId(id: string): Promise<void> {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("@player_id", id);
    console.log("[GameCenter] Cached player ID:", id);
  } catch (e) {
    console.warn("[GameCenter] Failed to cache ID:", e);
  }
}

/**
 * Get cached player name from AsyncStorage
 */
export async function getCachedPlayerName(): Promise<string | null> {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const cachedName = await AsyncStorage.getItem("@player_name");
    console.log("[GameCenter] Cached player name:", cachedName);
    return cachedName;
  } catch (e) {
    console.warn("[GameCenter] Failed to get cached name:", e);
    return null;
  }
}

/**
 * Save player name to AsyncStorage
 */
export async function cachePlayerName(name: string): Promise<void> {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("@player_name", name);
    console.log("[GameCenter] Cached player name:", name);
  } catch (e) {
    console.warn("[GameCenter] Failed to cache name:", e);
  }
}

/**
 * Get or create a persistent player ID
 * Priority: Cached Name (user preference) > GameCenter ID + Name > Generated ID
 */
export async function getOrCreatePlayerId(): Promise<PlayerInfo> {
  // Check for cached name first (user's explicit preference)
  const cachedName = await getCachedPlayerName();
  
  // Try GameCenter for ID (but respect cached name if set)
  const playerInfo = await authenticatePlayer();
  
  if (playerInfo.source === "gamecenter") {
    await cachePlayerId(playerInfo.id);
    // Only cache GameCenter name if user hasn't manually set one
    if (!cachedName) {
      await cachePlayerName(playerInfo.displayName);
    }
    return {
      id: playerInfo.id,
      displayName: cachedName || playerInfo.displayName, // User's manual name takes priority
      isAuthenticated: true,
      source: "gamecenter"
    };
  }

  // Try cached ID and name
  const cachedId = await getCachedPlayerId();
  
  if (cachedId) {
    return {
      id: cachedId,
      displayName: cachedName || "Player",
      isAuthenticated: false,
      source: "fallback"
    };
  }

  // Generate new ID and cache it
  const newId = generateDeviceId();
  await cachePlayerId(newId);
  
  return {
    id: newId,
    displayName: cachedName || "Player",
    isAuthenticated: false,
    source: "fallback"
  };
}

export const gameCenterService = {
  authenticatePlayer,
  isPlayerAuthenticated,
  getOrCreatePlayerId,
  getCachedPlayerId,
  cachePlayerId,
  getCachedPlayerName,
  cachePlayerName
};
