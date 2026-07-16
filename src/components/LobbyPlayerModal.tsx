import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import BlurPanel from "./BlurPanel";
import { playerInitials } from "../utils/playerDisplay";
import {
  ACHIEVEMENTS,
  achievementPrestige,
  achievementPrestigeProgress,
  formatAchievementCareerTotal,
  formatAchievementPrestige,
  getPlayerStats,
  totalAchievementPrestige,
  unlockedAchievements,
  type PlayerStats,
} from "../services/playerStats";
import {
  RARITY_COLOR,
  orderAchievementsByExclusivity,
  rarityForAchievementId,
} from "../services/achievementRarity";
import AchievementPrestigeFrame from "./AchievementPrestigeFrame";
import { getCpuPlayerStats } from "../rewards/cpuProfiles";
import type { AppThemeColors } from "../styles/themeColors";
import type { UiStyles } from "../styles/createUiStyles";
import type { BlurPreset } from "../styles/themeColors";

export type LobbyProfilePlayer = {
  id: string;
  name: string;
  isCPU?: boolean;
  isLocalPlayer?: boolean;
  isHostSeat?: boolean;
};

type Props = {
  visible: boolean;
  player: LobbyProfilePlayer | null;
  colors: AppThemeColors;
  ui: UiStyles;
  blur: { modal: BlurPreset };
  onClose: () => void;
};

export default function LobbyPlayerModal({
  visible,
  player,
  colors,
  ui,
  blur,
  onClose,
}: Props) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!visible || !player) {
      setStats(null);
      return;
    }
    if (player.isCPU) {
      setStats(getCpuPlayerStats({ id: player.id, name: player.name }));
      return;
    }
    if (player.isLocalPlayer) {
      void getPlayerStats().then(setStats);
      return;
    }
    setStats(null);
  }, [visible, player?.id, player?.isLocalPlayer, player?.isCPU, player?.name]);

  const unlocked = stats ? unlockedAchievements(stats) : [];
  const achievementsByExclusivity = useMemo(
    () => orderAchievementsByExclusivity(ACHIEVEMENTS),
    [],
  );
  const canShowStats =
    !!stats && (!!player?.isCPU || (!!player?.isLocalPlayer && !player?.isCPU));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={ui.modalOverlay}>
        <BlurPanel style={[ui.modalCard, styles.card]} preset={blur.modal}>
          {player ? (
            <>
              <View style={styles.headerRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {playerInitials(player.name)}
                  </Text>
                </View>
                <View style={styles.headerMeta}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {player.name}
                  </Text>
                  <Text style={styles.playerMeta}>
                    {player.isHostSeat
                      ? "Host"
                      : player.isLocalPlayer
                        ? "You"
                        : player.isCPU
                          ? "CPU"
                          : "Guest"}
                  </Text>
                </View>
              </View>

              <Text style={ui.panelEyebrow}>Achievements</Text>
              {!canShowStats ? (
                <Text style={styles.statsHint}>
                  Achievement progress is stored on each player's device and isn't shared yet.
                </Text>
              ) : player.isCPU ? (
                <Text style={styles.statsHint}>
                  CPU skill tier — higher numbers have more career XP and rewards.
                </Text>
              ) : null}

              <ScrollView
                style={styles.achievementScroll}
                contentContainerStyle={styles.achievementScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {achievementsByExclusivity.map((achievement) => {
                  const prestige =
                    canShowStats && stats
                      ? achievementPrestige(stats, achievement)
                      : 0;
                  const progress =
                    canShowStats && stats
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
                      borderRadius={12}
                      style={[
                        styles.achievementRow,
                        {
                          opacity: earned || !canShowStats ? 1 : 0.72,
                        },
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
                        {canShowStats && stats ? (
                          <Text style={styles.achievementTotal}>
                            {formatAchievementCareerTotal(stats, achievement)}
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
              </ScrollView>

              {canShowStats && stats ? (
                <Text style={styles.statsSummary}>
                  {unlocked.length} / {ACHIEVEMENTS.length} unlocked ·{" "}
                  {totalAchievementPrestige(stats)} prestige ·{" "}
                  {stats.roundsPlayed} rounds · {stats.xp.toLocaleString()} XP
                </Text>
              ) : null}
            </>
          ) : null}

          <View style={[ui.actionTrack, styles.footerTrack]}>
            <TouchableOpacity
              style={[ui.actionSecondary, { flex: 1 }]}
              onPress={onClose}
            >
              <Text style={ui.actionSecondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      maxHeight: "82%",
      width: "100%",
      maxWidth: 360,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
      gap: 12,
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
    },
    avatarText: {
      color: colors.textPrimary,
      fontWeight: "800",
      fontSize: 16,
    },
    headerMeta: {
      flex: 1,
      minWidth: 0,
    },
    playerName: {
      color: colors.modalBody,
      fontSize: 20,
      fontWeight: "800",
    },
    playerMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    statsHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 10,
    },
    achievementScroll: {
      maxHeight: 280,
      marginBottom: 8,
    },
    achievementScrollContent: {
      gap: 8,
      paddingBottom: 4,
    },
    achievementRow: {
      borderRadius: 12,
    },
    achievementRowInner: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      gap: 10,
    },
    achievementEmoji: {
      fontSize: 22,
      width: 28,
      textAlign: "center",
    },
    achievementBody: {
      flex: 1,
      minWidth: 0,
    },
    achievementTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "800",
    },
    achievementTitleLocked: {
      color: colors.textMuted,
    },
    achievementDesc: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
    },
    achievementTotal: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "500",
      marginTop: 2,
      opacity: 0.72,
    },
    achievementStatus: {
      fontSize: 14,
      fontWeight: "800",
      minWidth: 22,
      textAlign: "center",
    },
    statsSummary: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
      textAlign: "center",
      marginBottom: 8,
    },
    footerTrack: {
      marginTop: 4,
    },
  });
}
