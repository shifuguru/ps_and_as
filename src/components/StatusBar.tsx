import React from "react";
import { View, Text, StyleSheet } from "react-native";
import BlurPanel from "./BlurPanel";

/** Approximate content height — used for layout padding in GameScreen. */
export const STATUS_BAR_HEIGHT = 72;

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
    <BlurPanel style={[styles.panel, { paddingTop: topInset + 10 }]}>
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
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sideSection: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideSectionRight: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 240,
    gap: 4,
  },
  statCard: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    maxWidth: 76,
    maxHeight: 70,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  label: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
    textAlign: "center",
  },
  value: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});
