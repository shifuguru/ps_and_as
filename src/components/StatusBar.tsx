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
      <View style={styles.left}>
        <Text style={styles.turnLabel}>{isHumanTurn ? "Your turn" : currentPlayerName}</Text>
        {mustPlay && <View style={styles.mustPlayDot} />}
      </View>
      <View style={styles.stats}>
        <Text style={styles.stat}>{currentHandCount} cards</Text>
        <Text style={styles.divider}>·</Text>
        <Text style={styles.stat}>{pileCount} pile</Text>
        <Text style={styles.divider}>·</Text>
        <Text style={styles.stat}>{playerCount}p</Text>
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  turnLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  mustPlayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7aacd6",
    marginLeft: 8,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
  },
  stat: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: "500",
  },
  divider: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 13,
    marginHorizontal: 8,
  },
});
