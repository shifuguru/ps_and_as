import { Platform } from "react-native";
import { ACHIEVEMENTS, type PlayerStats } from "./playerStats";
import { getGameCenterService, isGameCenterPlatformSupported } from "./gameCenter";

/** Push local stats/achievements to Game Center (no-op off iOS or when unsigned in). */
export async function syncStatsToGameCenter(stats: PlayerStats): Promise<void> {
  if (!isGameCenterPlatformSupported()) return;

  try {
    const service = getGameCenterService();
    await service.initialize();
    if (!service.isReady()) return;

    for (const achievement of ACHIEVEMENTS) {
      if (achievement.check(stats)) {
        await service.reportAchievement(achievement.id, 100);
      }
    }

    if (stats.timesPresident > 0) {
      await service.submitScore(stats.timesPresident, "president_wins");
    }
    if (stats.roundsPlayed > 0) {
      await service.submitScore(stats.roundsPlayed, "rounds_played");
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[GameCenter] syncStatsToGameCenter failed:", error);
    }
  }
}
