import React from "react";
import { View, Text, StyleSheet } from "react-native";
import BlurPanel from "./BlurPanel";

/** Content row height below the safe-area inset — used for layout padding in GameScreen. */
export const STATUS_BAR_HEIGHT = 58;

type Props = {
  currentPlayerName: string;
  currentHandCount: number;
  playerCount: number;
  /** Cards in the current top play (what must be beaten) */
  pileToBeat: number;
  passCount: number;
  mustPlay: boolean;
  isHumanTurn: boolean;
  isLargeScreen: boolean;
  /** Safe-area top inset passed from parent */
  topInset?: number;
};

export default function StatusBar({
  currentPlayerName,
  currentHandCount,
  playerCount,
  pileToBeat,
  passCount,
  mustPlay,
  isHumanTurn,
  topInset = 0,
}: Props) {
  return (
    <BlurPanel
      style={[styles.panel, { paddingTop: topInset + 6 }]}
      intensity={40}
      scrimOpacity={0.16}
      webOpacity={0.05}
    >
      <View style={styles.container}>
        <View style={styles.sideSection}>
          <Text style={styles.label}>Turn</Text>
          <Text style={styles.value} numberOfLines={1}>
            {currentPlayerName}
          </Text>
        </View>

        <View style={styles.centerSection}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.label}>Players</Text>
              <Text style={styles.value}>{playerCount}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.label}>To beat</Text>
              <Text style={styles.value}>{pileToBeat}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.label}>Hand</Text>
              <Text style={styles.value}>{currentHandCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sideSectionRight}>
          <Text style={styles.label}>{isHumanTurn ? "Your turn" : "Waiting"}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {mustPlay ? "Must play" : `Passes ${passCount}`}
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
    gap: 4,
  },
  statCard: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
    maxWidth: 76,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
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
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});
