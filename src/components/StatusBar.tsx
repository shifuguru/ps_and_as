import React from "react";
import { View, Text, StyleSheet } from "react-native";
<<<<<<< Updated upstream
import BlurPanel from "./BlurPanel";

/** Approximate content height — used for layout padding in GameScreen. */
export const STATUS_BAR_HEIGHT = 72;
=======
import { responsive } from "../utils/responsive";
>>>>>>> Stashed changes

type Props = {
  currentPlayerName: string;
  currentHandCount: number;
  playerCount: number;
  /** Cards in the current top play (what must be beaten) */
  pileToBeat: number;
  passCount: number;
  mustPlay: boolean;
  isHumanTurn: boolean;
<<<<<<< Updated upstream
  isLargeScreen: boolean;
  /** Safe-area top inset passed from parent */
  topInset?: number;
=======
  isLargeScreen?: boolean;
>>>>>>> Stashed changes
};

export default function StatusBar({
  currentPlayerName,
  currentHandCount,
  playerCount,
  pileToBeat,
  passCount,
  mustPlay,
  isHumanTurn,
<<<<<<< Updated upstream
  topInset = 0,
=======
  isLargeScreen,
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    </BlurPanel>
=======
      <View style={styles.sideSectionRight}>
        <Text style={styles.label}>{isHumanTurn ? "Your turn" : "Waiting"}</Text>
        <Text style={styles.value}>{mustPlay ? "Must play" : `Pass ${passCount}`}</Text>
      </View>
    </View>
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sideSection: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
=======
    paddingVertical: responsive.spacing.md,
    paddingHorizontal: responsive.spacing.lg,
    backgroundColor: "rgba(20, 34, 24, 0.95)",
    borderRadius: responsive.borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: responsive.shadowRadius,
    gap: responsive.spacing.md,
  },
  sideSection: {
    flex: 1,
    minWidth: 100,
>>>>>>> Stashed changes
  },
  sideSectionRight: {
    flex: 1,
    alignItems: "flex-end",
<<<<<<< Updated upstream
    justifyContent: "center",
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
=======
    minWidth: 100,
>>>>>>> Stashed changes
  },
  statsRow: {
    flexDirection: "row",
<<<<<<< Updated upstream
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
=======
    justifyContent: "space-around",
    gap: responsive.spacing.sm,
  },
  statCard: {
    alignItems: "center",
    paddingVertical: responsive.spacing.md,
    paddingHorizontal: responsive.spacing.md,
    borderRadius: responsive.borderRadius.md,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  label: {
    color: "#a7c9a7",
    fontSize: responsive.fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: responsive.spacing.xs,
>>>>>>> Stashed changes
  },
  value: {
    color: "#fff",
    fontSize: responsive.fontSize.lg,
    fontWeight: "700",
    textAlign: "center",
  },
});
