import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

export const LOBBY_STATUS_BAR_HEIGHT = 58;
/** Taller header when room name + party stack (in-room lobby). */
export const LOBBY_STACK_BAR_HEIGHT = 68;

type Props = {
  playerCount: number;
  roomName: string;
  statusLabel: string;
  statusValue: string;
  topInset?: number;
  /** Label for the left stat pill — defaults to "Party" in lobbies. */
  countLabel?: string;
  /** Hide the right-side status column (e.g. lobby uses util icons there). */
  hideStatus?: boolean;
  /** Stack room name + party count — used on the in-room lobby. */
  variant?: "default" | "lobby";
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
  hideStatus = false,
  variant = "default",
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const displayRoom = roomName.trim() || "—";
  const partyCount =
    variant === "lobby" ? Math.max(1, playerCount) : playerCount;

  return (
    <View
      style={[styles.host, { paddingTop: topInset + 6 }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.container,
          hideStatus && styles.containerWithUtilPad,
        ]}
      >
        <View
          style={[
            variant === "lobby" ? styles.lobbySection : styles.centerSection,
          ]}
        >
          {variant === "lobby" ? (
            <View style={styles.lobbyStack}>
              <Text style={styles.lobbyRoomName} numberOfLines={1}>
                {displayRoom}
              </Text>
              <View style={styles.lobbyPartyRow}>
                <Text style={styles.lobbyPartyLabel}>{countLabel}</Text>
                <Text style={styles.lobbyPartyValue}>{partyCount}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.label}>{countLabel}</Text>
                <Text style={styles.value}>{partyCount}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={[styles.statCol, styles.roomCol]}>
                <Text style={styles.label}>Room</Text>
                <Text style={styles.value} numberOfLines={1}>
                  {displayRoom}
                </Text>
              </View>
            </View>
          )}
        </View>

        {!hideStatus ? (
          <View style={styles.statusSection}>
            <Text style={styles.label}>{statusLabel}</Text>
            <Text style={styles.value} numberOfLines={1}>
              {statusValue}
            </Text>
          </View>
        ) : null}
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
    containerWithUtilPad: {
      paddingRight: 88,
    },
    centerSection: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 0,
    },
    lobbySection: {
      flex: 1,
      alignItems: "flex-start",
      justifyContent: "center",
      minWidth: 0,
    },
    lobbyStack: {
      alignItems: "flex-start",
      justifyContent: "center",
      gap: 2,
      maxWidth: "100%",
      width: "100%",
    },
    lobbyRoomName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "left",
      textShadowColor: "rgba(0,0,0,0.55)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    lobbyPartyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 6,
    },
    lobbyPartyLabel: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      textAlign: "left",
      textShadowColor: "rgba(0,0,0,0.55)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    lobbyPartyValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      textShadowColor: "rgba(0,0,0,0.55)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
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
