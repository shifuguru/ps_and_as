import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

type Player = {
  id: string;
  name: string;
  hand: any[];
};

type Props = {
  players: Player[];
  localPlayerIndex: number;
  activePlayerIndex: number;
  finishedOrder: string[];
  passedPlayerIds: string[];
};

function Pill({
  player,
  isActive,
  hasPassed,
  placement,
}: {
  player: Player;
  isActive: boolean;
  hasPassed: boolean;
  placement: number | null;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(0);
    }
  }, [isActive]);

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const initials = (player.name || "?").substring(0, 2).toUpperCase();
  const cardCount = player.hand ? player.hand.length : 0;
  const dimmed = hasPassed || placement !== null;

  return (
    <View style={[styles.pill, dimmed && styles.pillDimmed]}>
      {isActive && (
        <Animated.View
          style={[
            styles.activeRing,
            { opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
          pointerEvents="none"
        />
      )}
      <View style={[styles.avatar, isActive && styles.avatarActive]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{cardCount}</Text>
      </View>
      {placement !== null && (
        <View style={styles.placementBadge}>
          <Text style={styles.placementText}>{placement}</Text>
        </View>
      )}
    </View>
  );
}

export default function OpponentPills({
  players,
  localPlayerIndex,
  activePlayerIndex,
  finishedOrder,
  passedPlayerIds,
}: Props) {
  const opponents = players
    .map((p, i) => ({ player: p, index: i }))
    .filter((_, i) => i !== localPlayerIndex);

  return (
    <View style={styles.container}>
      {opponents.map(({ player, index }) => {
        const finishedIdx = finishedOrder.indexOf(player.id);
        const placement = finishedIdx >= 0 ? finishedIdx + 1 : null;
        const hasPassed = passedPlayerIds.includes(player.id);

        return (
          <Pill
            key={player.id}
            player={player}
            isActive={index === activePlayerIndex}
            hasPassed={hasPassed}
            placement={placement}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 16,
  },
  pill: {
    alignItems: "center",
    position: "relative",
  },
  pillDimmed: {
    opacity: 0.35,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  avatarActive: {
    borderColor: "rgba(122,172,214,0.5)",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: -0.3,
  },
  activeRing: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#7aacd6",
    top: -4,
    left: -4,
    zIndex: -1,
  },
  countBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    minWidth: 20,
    alignItems: "center",
  },
  countText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 10,
  },
  placementBadge: {
    marginTop: 4,
    backgroundColor: "rgba(122,172,214,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  placementText: {
    color: "#7aacd6",
    fontWeight: "700",
    fontSize: 10,
  },
});
