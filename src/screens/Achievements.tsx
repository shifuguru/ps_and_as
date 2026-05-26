import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import BlurPanel from "../components/BlurPanel";
import ScreenTopBar from "../components/ScreenTopBar";
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  menuBottomReserve,
} from "../components/BottomBar";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { playerInitials } from "../utils/playerDisplay";
import { GOLD, BLUR_PANEL, contentMaxWidth, ui } from "../styles/uiStandards";
import {
  authenticatePlayer,
  getOrCreatePlayerId,
  cachePlayerName,
  showGameCenterAchievements,
  showGameCenterLeaderboards,
  isGameCenterPlatformSupported,
  type PlayerInfo,
} from "../services/gameCenter";
import { syncStatsToGameCenter } from "../services/gameCenterSync";
import {
  ACHIEVEMENTS,
  DEFAULT_PLAYER_STATS,
  getPlayerStats,
  unlockedAchievements,
  winRate,
  type PlayerStats,
} from "../services/playerStats";

export default function Achievements({ onBack }: { onBack: () => void }) {
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);

  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [savedName, setSavedName] = useState("");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [info, playerStats] = await Promise.all([
        getOrCreatePlayerId(),
        getPlayerStats(),
      ]);
      setPlayerInfo(info);
      setSavedName(info.displayName);
      setStats(playerStats);

      if (info.isAuthenticated && playerStats.roundsPlayed > 0) {
        void syncStatsToGameCenter(playerStats);
      }
    } catch (error) {
      console.error("[Achievements] Failed to load:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleLogin = async () => {
    setIsAuthenticating(true);
    try {
      const info = await authenticatePlayer();
      if (info.source === "gamecenter") {
        setPlayerInfo(info);
        if (!savedName || savedName === "Player") {
          await cachePlayerName(info.displayName);
          setSavedName(info.displayName);
        }
        Alert.alert("Connected", `Signed in as ${info.displayName}`);
        if (stats) {
          void syncStatsToGameCenter(stats);
        }
      } else {
        Alert.alert(
          "Unavailable",
          "Game Center is not available on this device. You can still set a local name in Settings.",
        );
      }
    } catch {
      Alert.alert("Error", "Could not connect to Game Center.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const unlocked = stats ? unlockedAchievements(stats) : [];
  const unlockedIds = new Set(unlocked.map((a) => a.id));

  if (isLoading) {
    return (
      <ScreenContainer ignoreHeaderOffset style={styles.loadingRoot}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.loadingText}>Loading Profile…</Text>
        </View>
        <BottomBar>
          <BottomBarControls style={styles.bottomControls}>
            <BottomBarLeave onPress={onBack} />
          </BottomBarControls>
        </BottomBar>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          ui.scrollContent,
          {
            paddingTop: insets.top + 12,
            paddingBottom: bottomBarHeight,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { maxWidth: contentMax }]}>
          <ScreenTopBar title="Achievements" />

          {/* Profile */}
          <BlurPanel style={ui.panel} {...BLUR_PANEL} intensity={52}>
            <Text style={ui.panelEyebrow}>Player Profile</Text>

            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {playerInitials(savedName || "?")}
                </Text>
              </View>
              <View style={styles.profileMeta}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {savedName || "Player"}
                </Text>
                <Text style={styles.profileHint}>
                  {playerInfo?.isAuthenticated ? "Game Center" : "Local Profile"}
                </Text>
              </View>
            </View>
          </BlurPanel>

          {/* Statistics */}
          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Statistics</Text>
            <View style={styles.statsGrid}>
              <StatCard label="Rounds" value={String(stats?.roundsPlayed ?? 0)} />
              <StatCard
                label="President"
                value={String(stats?.timesPresident ?? 0)}
              />
              <StatCard label="Win Rate" value={`${winRate(stats ?? DEFAULT_PLAYER_STATS)}%`} />
              <StatCard
                label="Achievements"
                value={`${unlocked.length}/${ACHIEVEMENTS.length}`}
              />
            </View>

            <View style={styles.roleRow}>
              <RolePill label="Vice Pres." count={stats?.timesVicePresident ?? 0} />
              <RolePill label="Vice Asshole" count={stats?.timesViceAsshole ?? 0} />
              <RolePill label="Asshole" count={stats?.timesAsshole ?? 0} />
            </View>
            {(stats?.bestPresidentStreak ?? 0) > 0 ? (
              <Text style={styles.streakText}>
                Best President Streak: {stats?.bestPresidentStreak}
              </Text>
            ) : null}
          </BlurPanel>

          {/* Achievements */}
          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Achievements</Text>
            <View style={styles.achievementList}>
              {ACHIEVEMENTS.map((achievement) => {
                const earned = unlockedIds.has(achievement.id);
                return (
                  <View
                    key={achievement.id}
                    style={[
                      styles.achievementRow,
                      earned && styles.achievementRowEarned,
                    ]}
                  >
                    <Text style={styles.achievementEmoji}>{achievement.emoji}</Text>
                    <View style={styles.achievementBody}>
                      <Text
                        style={[
                          styles.achievementTitle,
                          !earned && styles.achievementTitleLocked,
                        ]}
                      >
                        {achievement.title}
                      </Text>
                      <Text style={styles.achievementDesc}>
                        {achievement.description}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.achievementStatus,
                        earned && styles.achievementStatusEarned,
                      ]}
                    >
                      {earned ? "✓" : "—"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </BlurPanel>

          {/* Game Center (iOS) */}
          {isGameCenterPlatformSupported() ? (
            <BlurPanel style={ui.panel} intensity={44}>
              <Text style={ui.panelEyebrow}>Game Center</Text>
              {playerInfo?.isAuthenticated ? (
                <>
                  <Text style={styles.accountText}>
                    Signed in with Game Center. Achievements and leaderboards
                    sync when you finish a round.
                  </Text>
                  <View style={styles.gcActions}>
                    <TouchableOpacity
                      style={ui.btnSecondary}
                      onPress={() => void showGameCenterAchievements()}
                      activeOpacity={0.85}
                    >
                      <Text style={ui.btnSecondaryText}>View Achievements</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={ui.btnSecondary}
                      onPress={() => void showGameCenterLeaderboards()}
                      activeOpacity={0.85}
                    >
                      <Text style={ui.btnSecondaryText}>View Leaderboards</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.accountText}>
                    Sign in to sync achievements and leaderboards with Apple
                    Game Center. Requires a physical iOS device with Game Center
                    enabled in Settings.
                  </Text>
                  <TouchableOpacity
                    style={ui.btnGoldFill}
                    onPress={handleLogin}
                    disabled={isAuthenticating}
                    activeOpacity={0.85}
                  >
                    {isAuthenticating ? (
                      <ActivityIndicator size="small" color="#111" />
                    ) : (
                      <Text style={ui.btnGoldFillText}>Sign In With Game Center</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </BlurPanel>
          ) : null}
        </View>
      </ScrollView>

      <BottomBar>
        <BottomBarControls style={styles.bottomControls}>
          <View style={{ width: contentMax, alignSelf: "center" }}>
            <View style={ui.actionTrack}>
              {isGameCenterPlatformSupported() &&
              playerInfo?.isAuthenticated ? (
                <>
                  <TouchableOpacity
                    style={ui.actionSecondary}
                    onPress={() => void showGameCenterAchievements()}
                  >
                    <Text style={ui.actionSecondaryText}>Achievements</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={ui.actionPrimary}
                    onPress={() => void showGameCenterLeaderboards()}
                  >
                    <Text style={ui.actionPrimaryText}>Leaderboards</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {isGameCenterPlatformSupported() ? (
                    <TouchableOpacity
                      style={[ui.actionPrimary, { flex: 1 }]}
                      onPress={handleLogin}
                      disabled={isAuthenticating}
                    >
                      {isAuthenticating ? (
                        <ActivityIndicator size="small" color={GOLD} />
                      ) : (
                        <Text style={ui.actionPrimaryText}>Sign In</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
            <BottomBarLeave onPress={onBack} />
          </View>
        </BottomBarControls>
      </BottomBar>
    </ScreenContainer>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function RolePill({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.rolePill}>
      <Text style={styles.rolePillLabel}>{label}</Text>
      <Text style={styles.rolePillValue}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRoot: { flex: 1 },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 14,
    fontSize: 15,
  },
  scroll: { flex: 1 },
  content: {
    width: "100%",
  },
  bottomControls: {
    paddingTop: 18,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(212, 175, 55, 0.18)",
    borderWidth: 2,
    borderColor: "rgba(212, 175, 55, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  profileHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  statLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginBottom: 4,
    textAlign: "center",
  },
  statValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  rolePillLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "600",
  },
  rolePillValue: {
    color: GOLD,
    fontSize: 12,
    fontWeight: "800",
  },
  streakText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  achievementList: {
    gap: 8,
  },
  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    opacity: 0.55,
  },
  achievementRowEarned: {
    opacity: 1,
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    borderColor: "rgba(212, 175, 55, 0.35)",
  },
  achievementEmoji: {
    fontSize: 22,
    width: 32,
    textAlign: "center",
  },
  achievementBody: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 8,
  },
  achievementTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  achievementTitleLocked: {
    color: "rgba(255,255,255,0.65)",
  },
  achievementDesc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 2,
  },
  achievementStatus: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 16,
    fontWeight: "800",
  },
  achievementStatusEarned: {
    color: GOLD,
  },
  accountText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  gcActions: {
    gap: 8,
  },
});
