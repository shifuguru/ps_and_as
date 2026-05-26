import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import BlurPanel from "./BlurPanel";
import { triggerHaptic } from "../utils/haptics";

const GOLD = "#d4af37";

type Player = { id: string; name: string };

type Props = {
  visible: boolean;
  finishedOrder: string[];
  players: Player[];
  readyStates: Record<string, boolean>;
  /** Local human on this device — used to highlight row and toggle ready. */
  localPlayerId?: string;
  onQuit: () => void;
  onToggleReady: () => void;
};

function roleForPlacement(index: number, total: number): string {
  if (index === 0) return "President";
  if (total >= 5) {
    if (index === 1) return "Vice President";
    if (index === total - 1) return "Asshole";
    if (index === total - 2) return "Vice Asshole";
  } else if (index === total - 1) {
    return "Asshole";
  }
  return "Civilian";
}

function roleEmoji(role: string): string | null {
  switch (role) {
    case "President":
      return "👑";
    case "Vice President":
      return "⭐";
    case "Asshole":
    case "Vice Asshole":
      return "💩";
    default:
      return null;
  }
}

export default function RoundCompleteModal({
  visible,
  finishedOrder,
  players,
  readyStates,
  localPlayerId,
  onQuit,
  onToggleReady,
}: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 420);
  const readyCount = Object.values(readyStates).filter(Boolean).length;
  const isReady = localPlayerId ? !!readyStates[localPlayerId] : false;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <BlurPanel style={[styles.card, { width: cardWidth, maxWidth: cardWidth }]}>
          <Text style={styles.eyebrow}>Round complete</Text>
          <Text style={styles.headline}>Final rankings</Text>

          <View style={styles.rankings}>
            {finishedOrder.map((playerId, index) => {
              const player = players.find((p) => p.id === playerId);
              if (!player) return null;

              const role = roleForPlacement(index, finishedOrder.length);
              const emoji = roleEmoji(role);
              const ready = !!readyStates[playerId];
              const isLocal = playerId === localPlayerId;

              return (
                <View
                  key={playerId}
                  style={[styles.rankRow, isLocal && styles.rankRowLocal]}
                >
                  <Text style={styles.rankIndex}>{index + 1}</Text>
                  <View style={styles.rankBody}>
                    <Text style={styles.rankName} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <Text style={styles.rankRole}>
                      {emoji ? `${emoji} ` : ""}
                      {role}
                    </Text>
                  </View>
                  {ready ? (
                    <View style={styles.readyBadge}>
                      <Text style={styles.readyBadgeText}>Ready</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Text style={styles.readyCount}>
            {readyCount} / {players.length} players ready
          </Text>

          <View style={styles.actionTrack}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.82}
              onPress={() => {
                triggerHaptic("light");
                onQuit();
              }}
              accessibilityRole="button"
              accessibilityLabel="Quit game"
            >
              <Text style={styles.secondaryBtnText}>Quit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, isReady && styles.primaryBtnReady]}
              activeOpacity={0.82}
              onPress={() => {
                triggerHaptic("medium");
                onToggleReady();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isReady ? "Mark unready for next round" : "Ready for next round"
              }
            >
              <Text
                style={[
                  styles.primaryBtnText,
                  isReady && styles.primaryBtnTextReady,
                ]}
              >
                {isReady ? "Unready" : "Next round"}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212, 175, 55, 0.3)",
  },
  eyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    textAlign: "center",
    marginBottom: 4,
  },
  headline: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 18,
  },
  rankings: {
    width: "100%",
    marginBottom: 14,
    gap: 6,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  rankRowLocal: {
    borderColor: "rgba(212, 175, 55, 0.45)",
    backgroundColor: "rgba(212, 175, 55, 0.1)",
  },
  rankIndex: {
    color: GOLD,
    fontSize: 16,
    fontWeight: "800",
    width: 24,
    textAlign: "center",
  },
  rankBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  rankName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  rankRole: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  readyBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(212, 175, 55, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212, 175, 55, 0.35)",
  },
  readyBadgeText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  readyCount: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    textAlign: "center",
    marginBottom: 14,
  },
  actionTrack: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    padding: 5,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  secondaryBtnText: {
    color: "#f0f0f0",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  primaryBtn: {
    flex: 1.45,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: "rgba(212, 175, 55, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  primaryBtnReady: {
    backgroundColor: GOLD,
  },
  primaryBtnText: {
    color: "#f5f0e6",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  primaryBtnTextReady: {
    color: "#111111",
  },
});
