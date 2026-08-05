import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
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

/**
 * Lobby header chrome — overlay only.
 * No glass plate / painted band through the status region; stats float on felt.
 */
export default function LobbyStatusBar({
  playerCount,
  roomName,
  statusLabel,
  statusValue,
  topInset = 0,
  countLabel = "Party",
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[styles.host, { paddingTop: topInset + 6 }]}
      pointerEvents="box-none"
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
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  const isDark = colors.mode === "dark";
  return StyleSheet.create({
    host: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 40,
      elevation: 40,
      backgroundColor: "transparent",
    },
    container: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: "transparent",
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
      backgroundColor: hexToRgba(colors.accent, isDark ? 0.28 : 0.2),
    },
    label: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      marginBottom: 2,
      textAlign: "center",
      textShadowColor: "rgba(0,0,0,0.55)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    value: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "center",
      textShadowColor: "rgba(0,0,0,0.55)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  });
}
