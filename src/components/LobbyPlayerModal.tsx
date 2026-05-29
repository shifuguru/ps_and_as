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
  getPlayerStats,
  unlockedAchievements,
  type PlayerStats,
} from "../services/playerStats";
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
    if (player.isLocalPlayer && !player.isCPU) {
      void getPlayerStats().then(setStats);
      return;
    }
    setStats(null);
  }, [visible, player?.id, player?.isLocalPlayer, player?.isCPU]);

  const unlocked = stats ? unlockedAchievements(stats) : [];
  const unlockedIds = new Set(unlocked.map((a) => a.id));
  const canShowStats = !!player?.isLocalPlayer && !player?.isCPU;

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
                  {player.isCPU
                    ? "CPU players don't earn achievements."
                    : "Achievement progress is stored on each player's device and isn't shared yet."}
                </Text>
              ) : null}

              <ScrollView
                style={styles.achievementScroll}
                contentContainerStyle={styles.achievementScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {ACHIEVEMENTS.map((achievement) => {
                  const earned = canShowStats && unlockedIds.has(achievement.id);
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
              </ScrollView>

              {canShowStats && stats ? (
                <Text style={styles.statsSummary}>
                  {unlocked.length} / {ACHIEVEMENTS.length} unlocked ·{" "}
                  {stats.roundsPlayed} rounds played
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
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.btnSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    achievementRowEarned: {
      borderColor: colors.btnGoldBorder,
      backgroundColor: colors.btnGoldBg,
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
    achievementStatus: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "800",
      width: 18,
      textAlign: "center",
    },
    achievementStatusEarned: {
      color: colors.gold,
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
