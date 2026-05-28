import { Platform } from "react-native";
import { ACHIEVEMENTS, type PlayerStats } from "./playerStats";
import {
  getGameCenterService,
  isGameCenterPlatformSupported,
  isPlayerAuthenticated,
} from "./gameCenter";
import {
  GAME_CENTER_ACHIEVEMENTS,
  GAME_CENTER_LEADERBOARDS,
} from "../config/gameCenterIds";

/** Push local stats/achievements to Game Center (no-op off iOS or when unsigned in). */
export async function syncStatsToGameCenter(stats: PlayerStats): Promise<void> {
  if (Platform.OS !== "ios" || !isGameCenterPlatformSupported()) return;

  try {
    if (!(await isPlayerAuthenticated())) return;

    const service = getGameCenterService();
    await service.initialize();
    if (!service.isReady()) return;

    for (const achievement of ACHIEVEMENTS) {
      if (!GAME_CENTER_ACHIEVEMENTS[achievement.id]) continue;
      if (!achievement.check(stats)) continue;
      try {
        await service.reportAchievement(achievement.id, 100);
      } catch (error) {
        if (__DEV__) {
          console.warn(
            `[GameCenter] reportAchievement(${achievement.id}) failed:`,
            error,
          );
        }
      }
    }

    if (stats.timesPresident > 0 && GAME_CENTER_LEADERBOARDS.president_wins) {
      try {
        await service.submitScore(stats.timesPresident, "president_wins");
      } catch (error) {
        if (__DEV__) {
          console.warn("[GameCenter] submitScore(president_wins) failed:", error);
        }
      }
    }
    if (stats.roundsPlayed > 0 && GAME_CENTER_LEADERBOARDS.rounds_played) {
      try {
        await service.submitScore(stats.roundsPlayed, "rounds_played");
      } catch (error) {
        if (__DEV__) {
          console.warn("[GameCenter] submitScore(rounds_played) failed:", error);
        }
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[GameCenter] syncStatsToGameCenter failed:", error);
    }
  }
}
