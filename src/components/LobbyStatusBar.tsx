import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import BlurPanel from "./BlurPanel";

export const LOBBY_STATUS_BAR_HEIGHT = 58;

type Props = {
  playerCount: number;
  roomName: string;
  statusLabel: string;
  statusValue: string;
  topInset?: number;
  onLeave?: () => void;
};

export default function LobbyStatusBar({
  playerCount,
  roomName,
  statusLabel,
  statusValue,
  topInset = 0,
  onLeave,
}: Props) {
  return (
    <BlurPanel style={[styles.panel, { paddingTop: topInset + 6 }]}>
      <View style={styles.container}>
        <View style={styles.sideSection}>
          {onLeave ? (
            <TouchableOpacity
              onPress={onLeave}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.leaveText}>Leave</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.centerSection}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.label}>Players</Text>
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

        <View style={styles.sideSectionRight}>
          <Text style={styles.label}>{statusLabel}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {statusValue}
          </Text>
        </View>
      </View>
    </BlurPanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    elevation: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sideSection: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: 0,
  },
  sideSectionRight: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 0,
  },
  centerSection: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  roomCard: {
    maxWidth: 120,
  },
  leaveText: {
    color: "#d4af37",
    fontSize: 15,
    fontWeight: "700",
  },
  label: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
    textAlign: "center",
  },
  value: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
});
