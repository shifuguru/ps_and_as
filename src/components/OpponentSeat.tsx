import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { Player } from "../game/ruleset";
import { playerInitials } from "../utils/playerDisplay";

const SEAT_COLORS = [
  "#5a8a6a",
  "#4a7a9a",
  "#8a6a4a",
  "#7a5a8a",
  "#6a8a8a",
  "#9a6a5a",
  "#5a6a9a",
  "#8a5a6a",
];

function seatColor(playerId: string): string {
  let n = 0;
  for (let i = 0; i < playerId.length; i++) n += playerId.charCodeAt(i);
  return SEAT_COLORS[n % SEAT_COLORS.length];
}

function roleEmoji(role: Player["role"]): string | null {
  switch (role) {
    case "President":
      return "👑";
    case "Vice President":
      return "⭐";
    case "Vice Asshole":
      return "💩";
    case "Asshole":
      return "💩";
    default:
      return null;
  }
}

export type OpponentSeatPlayer = {
  id: string;
  name: string;
  handCount: number;
  role: Player["role"];
};

type Props = {
  player: OpponentSeatPlayer;
  isActive: boolean;
  isOut: boolean;
  hasPassed: boolean;
  isThinking?: boolean;
  compact?: boolean;
  /** Local human — highlighted seat at bottom of table */
  isLocal?: boolean;
};

export default function OpponentSeat({
  player,
  isActive,
  isOut,
  hasPassed,
  isThinking = false,
  compact = false,
  isLocal = false,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const initials = playerInitials(player.name);
  const role = roleEmoji(player.role);

  useEffect(() => {
    if (!isActive || isOut) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, isOut, pulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.95],
  });

  const avatarSize = compact ? 34 : isLocal ? 44 : 40;

  return (
    <View
      style={[
        styles.seat,
        compact && styles.seatCompact,
        isLocal && styles.seatLocal,
        isOut && styles.seatOut,
      ]}
    >
      <View style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}>
        {isActive && !isOut && (
          <Animated.View
            style={[
              styles.turnRing,
              {
                width: avatarSize + 10,
                height: avatarSize + 10,
                borderRadius: (avatarSize + 10) / 2,
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
            pointerEvents="none"
          />
        )}
        <View
          style={[
            styles.avatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: seatColor(player.id),
            },
            isOut && styles.avatarOut,
            isLocal && styles.avatarLocal,
          ]}
        >
          <Text style={[styles.initials, compact && styles.initialsCompact]}>
            {initials}
          </Text>
        </View>
        {role ? (
          <Text style={styles.roleBadge} pointerEvents="none">
            {role}
          </Text>
        ) : null}
        {!isOut && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{player.handCount}</Text>
          </View>
        )}
      </View>

      <Text
        style={[styles.name, compact && styles.nameCompact, isOut && styles.nameOut]}
        numberOfLines={1}
      >
        {player.name}
      </Text>

      {isOut ? (
        <Text style={styles.statusPill}>Out</Text>
      ) : hasPassed ? (
        <Text style={[styles.statusPill, styles.passPill]}>Pass</Text>
      ) : isThinking ? (
        <Text style={[styles.statusPill, styles.thinkPill]}>…</Text>
      ) : isLocal ? (
        <Text style={[styles.statusPill, styles.youPill]}>You</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seat: {
    alignItems: "center",
    minWidth: 64,
    maxWidth: 88,
    paddingHorizontal: 4,
  },
  seatCompact: {
    minWidth: 56,
    maxWidth: 72,
  },
  seatLocal: {
    minWidth: 72,
    maxWidth: 96,
  },
  seatOut: {
    opacity: 0.45,
  },
  avatarWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  turnRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(212,175,55,0.95)",
    ...Platform.select({
      ios: {
        shadowColor: "#d4af37",
        shadowOpacity: 0.45,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  avatarOut: {
    backgroundColor: "rgba(80,80,80,0.5)",
  },
  avatarLocal: {
    borderWidth: 2,
    borderColor: "rgba(212,175,55,0.75)",
  },
  initials: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  initialsCompact: {
    fontSize: 11,
  },
  roleBadge: {
    position: "absolute",
    top: -6,
    left: -4,
    fontSize: 11,
  },
  countBadge: {
    position: "absolute",
    right: -8,
    bottom: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },
  countText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  name: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
    maxWidth: 84,
  },
  nameCompact: {
    fontSize: 10,
    maxWidth: 68,
  },
  nameOut: {
    color: "rgba(255,255,255,0.45)",
  },
  statusPill: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.55)",
  },
  passPill: {
    color: "#c9a86c",
  },
  thinkPill: {
    color: "#d4af37",
    fontSize: 12,
  },
  youPill: {
    color: "#d4af37",
  },
});
