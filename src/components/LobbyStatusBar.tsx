import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import BlurPanel from "./BlurPanel";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

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
            <View style={styles.statCol}>
              <Text style={styles.label}>{countLabel}</Text>
              <Text style={styles.value}>{playerCount}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={[styles.statCol, styles.roomCol]}>
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
  const isDark = colors.mode === "dark";
  return StyleSheet.create({
    panel: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 40,
      elevation: 40,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: hexToRgba(colors.gold, isDark ? 0.22 : 0.16),
    },
    container: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 14,
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
      gap: 10,
    },
    statCol: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 48,
      maxWidth: 88,
    },
    roomCol: {
      maxWidth: 140,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 28,
      backgroundColor: hexToRgba(colors.gold, isDark ? 0.28 : 0.2),
    },
    label: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase",
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
