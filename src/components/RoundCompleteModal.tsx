import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import BlurPanel from "./BlurPanel";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";

import { roleEmoji, roleForPlacement } from "../utils/roundRoles";

type Player = { id: string; name: string };

type Props = {
  visible: boolean;
  finishedOrder: string[];
  players: Player[];
  readyStates: Record<string, boolean>;
  /** Local human on this device — used to highlight row and toggle ready. */
  localPlayerId?: string;
  onQuit: () => void;
  onToggleReady: () => void;
};

export default function RoundCompleteModal({
  visible,
  finishedOrder,
  players,
  readyStates,
  localPlayerId,
  onQuit,
  onToggleReady,
}: Props) {
  const { colors, ui, blur } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 420);
  const readyCount = Object.values(readyStates).filter(Boolean).length;
  const isReady = localPlayerId ? !!readyStates[localPlayerId] : false;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={ui.modalOverlay}>
        <BlurPanel
          style={[ui.modalCard, { width: cardWidth, maxWidth: cardWidth }]}
          preset={blur.modal}
        >
          <Text style={ui.modalTitle}>Round Complete</Text>
          <Text style={[ui.modalBody, { fontSize: 22, marginBottom: 18 }]}>Final Rankings</Text>

          <View style={styles.rankings}>
            {finishedOrder.map((playerId, index) => {
              const player = players.find((p) => p.id === playerId);
              if (!player) return null;

              const role = roleForPlacement(index, finishedOrder.length);
              const emoji = roleEmoji(role);
              const ready = !!readyStates[playerId];
              const isLocal = playerId === localPlayerId;

              return (
                <View
                  key={playerId}
                  style={[styles.rankRow, isLocal && styles.rankRowLocal]}
                >
                  <Text style={styles.rankIndex}>{index + 1}</Text>
                  <View style={styles.rankBody}>
                    <Text style={styles.rankName} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <Text style={styles.rankRole}>
                      {emoji ? `${emoji} ` : ""}
                      {role}
                    </Text>
                  </View>
                  {ready ? (
                    <View style={styles.readyBadge}>
                      <Text style={styles.readyBadgeText}>Ready</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Text style={styles.readyCount}>
            {readyCount} / {players.length} Players Ready
          </Text>

          <View style={ui.actionTrack}>
            <TouchableOpacity
              style={ui.actionSecondary}
              activeOpacity={0.82}
              onPress={() => {
                triggerHaptic("light");
                onQuit();
              }}
              accessibilityRole="button"
              accessibilityLabel="Quit Game"
            >
              <Text style={ui.actionSecondaryText}>Quit Game</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ui.actionPrimary, isReady && { backgroundColor: colors.gold }]}
              activeOpacity={0.82}
              onPress={() => {
                triggerHaptic("medium");
                onToggleReady();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isReady ? "Mark Unready For Next Round" : "Ready For Next Round"
              }
            >
              <Text
                style={[
                  ui.actionPrimaryText,
                  isReady && { color: colors.textOnGold },
                ]}
              >
                {isReady ? "Not Ready" : "Next Round"}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
  rankings: {
    width: "100%",
    marginBottom: 14,
    gap: 6,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.btnSecondaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  rankRowLocal: {
    borderColor: colors.btnGoldBorder,
    backgroundColor: colors.btnGoldBg,
  },
  rankIndex: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "800",
    width: 24,
    textAlign: "center",
  },
  rankBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  rankName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  rankRole: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  readyBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.btnGoldBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.btnGoldBorder,
  },
  readyBadgeText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  readyCount: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
    marginBottom: 14,
  },
  });
}
