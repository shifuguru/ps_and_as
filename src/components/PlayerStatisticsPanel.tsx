import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import BlurPanel from "./BlurPanel";
import {
  RunsPill,
  PLATINUM_STREAK_COLORS,
  PLATINUM_FLAME_SEEDS,
} from "../gameplayPresentation/RunsEffect";
import { useAppTheme } from "../context/ThemeContext";
import { useGameTerminology } from "../hooks/useGameTerminology";
import {
  ACHIEVEMENTS,
  DEFAULT_PLAYER_STATS,
  totalAchievementPrestige,
  unlockedAchievements,
  winRate,
  type PlayerStats,
} from "../services/playerStats";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  stats: PlayerStats | null;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  overflowVisible?: boolean;
};

const ROLE_COLORS = ["#E8C547", "#C0C7D4", "#C47A4A", "#A85A32"] as const;

export default function PlayerStatisticsPanel({
  stats,
  style,
  intensity = 48,
  overflowVisible = false,
}: Props) {
  const { colors, ui } = useAppTheme();
  const wording = useGameTerminology();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const playerStats = stats ?? DEFAULT_PLAYER_STATS;
  const prestigeTotal = totalAchievementPrestige(playerStats);
  const bestPresidentStreak = playerStats.bestPresidentStreak ?? 0;
  const currentPresidentStreak = playerStats.presidentStreak ?? 0;
  const showStreakPills = bestPresidentStreak > 0 || currentPresidentStreak > 0;
  const metrics = [
    { label: "XP", value: String(playerStats.xp ?? 0) },
    { label: "Rounds", value: String(playerStats.roundsPlayed ?? 0) },
    {
      label: wording("President"),
      value: String(playerStats.timesPresident ?? 0),
    },
    { label: "Win Rate", value: `${winRate(playerStats)}%` },
    {
      label: "Achievements",
      value: `${unlockedAchievements(playerStats).length}/${ACHIEVEMENTS.length}`,
    },
    { label: "Prestige", value: String(prestigeTotal) },
    { label: "Tricks", value: String(playerStats.tricksWon ?? 0) },
  ];
  const roles = [
    { label: wording("President"), count: playerStats.timesPresident ?? 0 },
    {
      label: wording("Vice Pres."),
      count: playerStats.timesVicePresident ?? 0,
    },
    { label: "Vice Asshole", count: playerStats.timesViceAsshole ?? 0 },
    { label: "Asshole", count: playerStats.timesAsshole ?? 0 },
  ];

  return (
    <BlurPanel
      style={[ui.panel, style]}
      intensity={intensity}
      overflowVisible={overflowVisible}
    >
      <Text style={ui.panelEyebrow}>Statistics</Text>
      <View style={styles.statsGrid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.statCard}>
            <Text style={styles.statLabel}>{metric.label}</Text>
            <Text style={styles.statValue}>{metric.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.roleRow}>
        {roles.map((role, index) => (
          <View
            key={role.label}
            style={[
              styles.rolePill,
              {
                backgroundColor: hexToRgba(ROLE_COLORS[index], 0.34),
                borderColor: hexToRgba(ROLE_COLORS[index], 0.7),
              },
            ]}
          >
            <Text style={styles.rolePillLabel} numberOfLines={1}>
              {role.label}
            </Text>
            <Text
              style={[styles.rolePillValue, { color: ROLE_COLORS[index] }]}
            >
              {role.count}
            </Text>
          </View>
        ))}
      </View>
      {showStreakPills ? (
        <View style={styles.streakRow}>
          <StreakEnergyPill
            label="Current Streak"
            count={currentPresidentStreak}
            live={currentPresidentStreak > 0}
            liveLabel
          />
          <StreakEnergyPill
            label="Best Streak"
            count={bestPresidentStreak}
            live={false}
          />
        </View>
      ) : null}
    </BlurPanel>
  );
}

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
  const fill = live ? "#E8EEF8" : "#A8B4C8";

  return (
    <RunsPill
      active
      style={styles.streakRoot}
      showGlow={live}
      showFlames={live}
      containFlames={live}
      emberSpread="around"
      maxFlameHeight={16}
      palette={PLATINUM_STREAK_COLORS}
      flameSeeds={PLATINUM_FLAME_SEEDS}
      pillStyle={[
        styles.streakPill,
        {
          backgroundColor: hexToRgba(fill, live ? 0.38 : 0.26),
          borderColor: hexToRgba(fill, live ? 0.9 : 0.5),
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
      <Text style={[styles.rolePillValue, { color: live ? "#F2F5FA" : fill }]}>
        {count}
      </Text>
    </RunsPill>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
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
      color: colors.textSecondary,
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
      color: colors.textPrimary,
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
  });
}
