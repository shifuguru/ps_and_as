import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
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
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
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
  resetPlayerStatsRestore,
  unlockedAchievements,
  winRate,
  type PlayerStats,
} from "../services/playerStats";

export default function Achievements({
  onBack,
  onNavigateToSettings,
}: {
  onBack: () => void;
  onNavigateToSettings?: () => void;
}) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
        resetPlayerStatsRestore();
        const restoredStats = await getPlayerStats();
        setStats(restoredStats);
        Alert.alert("Connected", `Signed in as ${info.displayName}`);
        if (restoredStats.roundsPlayed > 0) {
          void syncStatsToGameCenter(restoredStats);
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
  const gameCenterAvailable =
    Platform.OS === "ios" && isGameCenterPlatformSupported();
  const showBottomGameCenterActions =
    gameCenterAvailable && playerInfo?.isAuthenticated;

  if (isLoading) {
    return (
      <ScreenContainer ignoreHeaderOffset style={styles.loadingRoot}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Loading Profile…</Text>
        </View>
        <BottomBar>
          <BottomBarControls style={styles.bottomControls}>
            <BottomBarLeave onPress={onBack} label="Back" />
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
          <BlurPanel style={ui.panel} intensity={52}>
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
                  {playerInfo?.isAuthenticated && gameCenterAvailable
                    ? "Game Center"
                    : "Local Profile"}
                </Text>
              </View>
            </View>
            {!gameCenterAvailable ? (
              <>
                <Text style={styles.accountText}>
                  Stats sync to the game server while you play online. Sign in
                  with Game Center on iOS to restore them after reinstalling.
                </Text>
                {onNavigateToSettings ? (
                  <TouchableOpacity
                    style={ui.btnSecondary}
                    onPress={onNavigateToSettings}
                    activeOpacity={0.85}
                  >
                    <Text style={ui.btnSecondaryText}>Open Settings</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : playerInfo?.isAuthenticated ? (
              <Text style={styles.accountText}>
                Stats are backed up to the game server and linked to your Game
                Center account — they restore after reinstall when you sign in
                again.
              </Text>
            ) : (
              <Text style={styles.accountText}>
                Sign in with Game Center below to back up stats and restore them
                if you delete and reinstall the app.
              </Text>
            )}
          </BlurPanel>

          {/* Statistics */}
          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Statistics</Text>
            <View style={styles.statsGrid}>
              <StatCard label="XP" value={String(stats?.xp ?? 0)} />
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
              <StatCard label="Tricks" value={String(stats?.tricksWon ?? 0)} />
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

          {/* Game Center (iOS native) */}
          {gameCenterAvailable ? (
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
            {showBottomGameCenterActions ? (
              <View style={ui.actionTrack}>
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
              </View>
            ) : null}
            <BottomBarLeave onPress={onBack} label="Back" />
          </View>
        </BottomBarControls>
      </BottomBar>
    </ScreenContainer>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function RolePill({ label, count }: { label: string; count: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.rolePill}>
      <Text style={styles.rolePillLabel}>{label}</Text>
      <Text style={styles.rolePillValue}>{count}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
  loadingRoot: { flex: 1 },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: colors.textSecondary,
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
    backgroundColor: colors.btnGoldBg,
    borderWidth: 2,
    borderColor: colors.btnGoldBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 16,
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  profileHint: {
    color: colors.textMuted,
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
    backgroundColor: colors.btnSecondaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginBottom: 4,
    textAlign: "center",
  },
  statValue: {
    color: colors.textPrimary,
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
    backgroundColor: colors.btnSecondaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  rolePillLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  rolePillValue: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  streakText: {
    color: colors.textMuted,
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
    backgroundColor: colors.btnSecondaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    opacity: 0.55,
  },
  achievementRowEarned: {
    opacity: 1,
    backgroundColor: colors.btnGoldBg,
    borderColor: colors.btnGoldBorder,
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
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  achievementTitleLocked: {
    color: colors.textSecondary,
  },
  achievementDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  achievementStatus: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "800",
  },
  achievementStatusEarned: {
    color: colors.gold,
  },
  accountText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  gcActions: {
    gap: 8,
  },
  });
}
