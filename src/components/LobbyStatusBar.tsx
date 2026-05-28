import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import BlurPanel from "./BlurPanel";
import { useAppTheme } from "../context/ThemeContext";

export const LOBBY_STATUS_BAR_HEIGHT = 58;

type Props = {
  playerCount: number;
  roomName: string;
  statusLabel: string;
  statusValue: string;
  topInset?: number;
  /** Label for the left stat pill — defaults to "Party" in lobbies. */
  countLabel?: string;
};

export default function LobbyStatusBar({
  playerCount,
  roomName,
  statusLabel,
  statusValue,
  topInset = 0,
  countLabel = "Party",
}: Props) {
  const { colors, blur } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BlurPanel
      style={[styles.panel, { paddingTop: topInset + 6 }]}
      preset={blur.chrome}
    >
      <View style={styles.container}>
        <View style={styles.centerSection}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.label}>{countLabel}</Text>
              <Text style={styles.value}>{playerCount}</Text>
            </View>
            <View style={[styles.statCard, styles.roomCard]}>
              <Text style={styles.label}>Room</Text>
              <Text style={styles.value} numberOfLines={1}>
                {roomName || "—"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statusSection}>
          <Text style={styles.label}>{statusLabel}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {statusValue}
          </Text>
        </View>
      </View>
    </BlurPanel>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    panel: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 40,
      elevation: 40,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.panelBorder,
    },
    container: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    centerSection: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 0,
    },
    statusSection: {
      flexShrink: 0,
      alignItems: "flex-end",
      justifyContent: "center",
      minWidth: 72,
      paddingLeft: 8,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    statCard: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 56,
      maxWidth: 88,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 14,
      backgroundColor: colors.btnSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    roomCard: {
      maxWidth: 120,
    },
    label: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.2,
      marginBottom: 2,
      textAlign: "center",
    },
    value: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "center",
    },
  });
}
