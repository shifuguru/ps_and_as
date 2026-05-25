import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = {
  currentPlayerName: string;
  currentHandCount: number;
  playerCount: number;
  pileCount: number;
  passCount: number;
  mustPlay: boolean;
  isHumanTurn: boolean;
  isLargeScreen: boolean;
};

export default function StatusBar({
  currentPlayerName,
  currentHandCount,
  playerCount,
  pileCount,
  passCount,
  mustPlay,
  isHumanTurn,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.sideSection}>
        <Text style={styles.label}>Turn</Text>
        <Text style={styles.value}>{currentPlayerName}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.label}>Players</Text>
          <Text style={styles.value}>{playerCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.label}>Pile</Text>
          <Text style={styles.value}>{pileCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.label}>Hand</Text>
          <Text style={styles.value}>{currentHandCount}</Text>
        </View>
      </View>
      <View style={styles.sideSectionRight}>
        <Text style={styles.label}>{isHumanTurn ? "Your turn" : "Waiting"}</Text>
        <Text style={styles.value}>{mustPlay ? "Must play" : `Passes ${passCount}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(20, 34, 24, 0.95)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
  },
  sideSection: {
    flex: 1,
    minWidth: 130,
  },
  sideSectionRight: {
    flex: 1,
    alignItems: "flex-end",
    minWidth: 130,
  },
  statsRow: {
    flex: 2,
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 12,
  },
  statCard: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  label: {
    color: "#a7c9a7",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  value: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});