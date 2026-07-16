import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
import { getOrCreatePlayerId } from "../services/gameCenter";
import {
  ACHIEVEMENTS,
  DEFAULT_PLAYER_STATS,
  achievementPrestige,
  achievementPrestigeProgress,
  formatAchievementPrestige,
  getPlayerStats,
  totalAchievementPrestige,
  unlockedAchievements,
  winRate,
  type PlayerStats,
} from "../services/playerStats";
import {
  RARITY_COLOR,
  rarityForAchievementId,
} from "../services/achievementRarity";
import AchievementPrestigeFrame from "../components/AchievementPrestigeFrame";
import { hexToRgba } from "../utils/colorTheory";
import {
  RunsPill,
  RUNS_COLORS,
  FLAME_SEEDS,
  PLATINUM_STREAK_COLORS,
  PLATINUM_FLAME_SEEDS,
} from "../gameplayPresentation/RunsEffect";

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

  const [savedName, setSavedName] = useState("");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [info, playerStats] = await Promise.all([
        getOrCreatePlayerId(),
        getPlayerStats(),
      ]);
      setSavedName(info.displayName);
      setStats(playerStats);
    } catch (error) {
      console.error("[Achievements] Failed to load:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const unlocked = stats ? unlockedAchievements(stats) : [];
  const prestigeTotal = stats ? totalAchievementPrestige(stats) : 0;
  const bestPresidentStreak = stats?.bestPresidentStreak ?? 0;
  const currentPresidentStreak = stats?.presidentStreak ?? 0;
  const streakLive = currentPresidentStreak > 0;
  const showStreakPills = bestPresidentStreak > 0 || currentPresidentStreak > 0;

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
                <Text style={styles.profileHint}>Local Profile</Text>
              </View>
            </View>
            <Text style={styles.accountText}>
              Stats are saved on this device. Online play also backs them up to
              the game server so they can restore on the same account.
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
          </BlurPanel>

          <BlurPanel style={ui.panel} intensity={48} overflowVisible>
            <Text style={ui.panelEyebrow}>Statistics</Text>
            <View style={styles.statsGrid}>
              <StatCard label="XP" value={String(stats?.xp ?? 0)} />
              <StatCard label="Rounds" value={String(stats?.roundsPlayed ?? 0)} />
              <StatCard
                label="President"
                value={String(stats?.timesPresident ?? 0)}
              />
              <StatCard
                label="Win Rate"
                value={`${winRate(stats ?? DEFAULT_PLAYER_STATS)}%`}
              />
              <StatCard
                label="Achievements"
                value={`${unlocked.length}/${ACHIEVEMENTS.length}`}
              />
              <StatCard label="Prestige" value={String(prestigeTotal)} />
              <StatCard label="Tricks" value={String(stats?.tricksWon ?? 0)} />
            </View>

            <View style={styles.roleRow}>
              <RolePill
                label="President"
                count={stats?.timesPresident ?? 0}
                fill="#E8C547"
              />
              <RolePill
                label="Vice Pres."
                count={stats?.timesVicePresident ?? 0}
                fill="#C0C7D4"
              />
              <RolePill
                label="Vice Asshole"
                count={stats?.timesViceAsshole ?? 0}
                fill="#C47A4A"
              />
              <RolePill
                label="Asshole"
                count={stats?.timesAsshole ?? 0}
                fill="#A85A32"
              />
            </View>
            {showStreakPills ? (
              <View style={styles.streakRow}>
                <StreakEnergyPill
                  label="Current Streak"
                  count={currentPresidentStreak}
                  live={streakLive}
                  liveLabel
                />
                <StreakEnergyPill
                  label="Best Streak"
                  count={bestPresidentStreak}
                  live={streakLive && bestPresidentStreak > 0}
                />
              </View>
            ) : null}
          </BlurPanel>

          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Achievements</Text>
            <View style={styles.achievementList}>
              {ACHIEVEMENTS.map((achievement) => {
                const prestige = stats
                  ? achievementPrestige(stats, achievement)
                  : 0;
                const progress = stats
                  ? achievementPrestigeProgress(stats, achievement)
                  : null;
                const earned = prestige >= 1;
                const rarity = rarityForAchievementId(achievement.id);
                const accent = RARITY_COLOR[rarity];
                return (
                  <AchievementPrestigeFrame
                    key={achievement.id}
                    progress={progress?.fraction ?? 0}
                    rarityColor={accent}
                    borderRadius={14}
                    style={[
                      styles.achievementRow,
                      earned && styles.achievementRowEarned,
                    ]}
                    contentStyle={styles.achievementRowInner}
                  >
                    <Text style={styles.achievementEmoji}>
                      {achievement.emoji}
                    </Text>
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
                      {progress ? (
                        <Text
                          style={[
                            styles.achievementProgress,
                            { color: accent },
                          ]}
                        >
                          {earned
                            ? `Next Prestige ${formatAchievementPrestige(progress.nextPrestige)} · ${progress.current}/${progress.target}`
                            : `${progress.current}/${progress.target}`}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.achievementStatus,
                        { color: earned ? accent : colors.textMuted },
                      ]}
                    >
                      {formatAchievementPrestige(prestige)}
                    </Text>
                  </AchievementPrestigeFrame>
                );
              })}
            </View>
          </BlurPanel>
        </View>
      </ScrollView>

      <BottomBar>
        <BottomBarControls style={styles.bottomControls}>
          <View style={{ width: contentMax, alignSelf: "center" }}>
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

function RolePill({
  label,
  count,
  fill,
}: {
  label: string;
  count: number;
  fill: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      style={[
        styles.rolePill,
        {
          backgroundColor: hexToRgba(fill, 0.34),
          borderColor: hexToRgba(fill, 0.7),
        },
      ]}
    >
      <Text
        style={[styles.rolePillLabel, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[styles.rolePillValue, { color: fill }]}>{count}</Text>
    </View>
  );
}

/** Role-matched streak pill — hot while live, sparkles-only when interrupted. */
function StreakEnergyPill({
  label,
  count,
  live,
  liveLabel = false,
}: {
  label: string;
  count: number;
  live: boolean;
  liveLabel?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fill = live ? "#FFB200" : "#C0C7D4";

  return (
    <RunsPill
      active
      style={styles.streakRoot}
      showGlow={live}
      showFlames={live}
      containFlames={live}
      emberSpread="around"
      maxFlameHeight={16}
      palette={live ? RUNS_COLORS : PLATINUM_STREAK_COLORS}
      flameSeeds={live ? FLAME_SEEDS : PLATINUM_FLAME_SEEDS}
      pillStyle={[
        styles.streakPill,
        {
          backgroundColor: hexToRgba(fill, live ? 0.4 : 0.28),
          borderColor: hexToRgba(fill, live ? 0.85 : 0.55),
        },
      ]}
    >
      <Text
        style={[styles.rolePillLabel, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {label}
        {live && liveLabel ? "  ·  Live" : ""}
      </Text>
      <Text style={[styles.rolePillValue, { color: fill }]}>{count}</Text>
    </RunsPill>
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
      justifyContent: "space-between",
      alignItems: "stretch",
      gap: 8,
      width: "100%",
      marginBottom: 10,
    },
    rolePill: {
      flexGrow: 1,
      flexBasis: 0,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 9,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
    },
    rolePillLabel: {
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center",
    },
    rolePillValue: {
      fontSize: 15,
      fontWeight: "800",
      textAlign: "center",
    },
    streakRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "stretch",
      gap: 8,
      width: "100%",
      marginTop: 2,
      marginBottom: 4,
      paddingVertical: 10,
      overflow: "visible",
    },
    streakRoot: {
      flexGrow: 1,
      flexBasis: 0,
      alignSelf: "stretch",
      minWidth: 0,
    },
    streakPill: {
      width: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 9,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
    },
    achievementList: {
      gap: 8,
    },
    achievementRow: {
      borderRadius: 14,
      opacity: 0.72,
    },
    achievementRowEarned: {
      opacity: 1,
    },
    achievementRowInner: {
      paddingVertical: 10,
      paddingHorizontal: 12,
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
    achievementProgress: {
      fontSize: 10,
      fontWeight: "700",
      marginTop: 4,
    },
    achievementStatus: {
      fontSize: 14,
      fontWeight: "800",
      minWidth: 28,
      textAlign: "right",
    },
    accountText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 12,
    },
  });
}
