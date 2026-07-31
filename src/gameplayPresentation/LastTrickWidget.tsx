import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { Card } from "../game/ruleset";
import { formatCardRank } from "../game/ruleset";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { playerInitials } from "../utils/playerDisplay";
import GameplayGlassPanel from "./GameplayGlassPanel";
import type { HudDensity } from "./hudLayout";

const SUIT_GLYPH: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
  joker: "★",
};

export type LastTrickInfo = {
  trickKey: string;
  winnerName: string;
  winnerId?: string;
  cards: Card[];
};

type Props = {
  info: LastTrickInfo | null;
  /** Hide when next pile activity starts */
  suppress?: boolean;
  visibleMs?: number;
  density?: HudDensity;
};

export function formatTrickCards(cards: Card[]): string {
  if (!cards.length) return "—";
  return cards
    .map((c) => `${formatCardRank(c)}${SUIT_GLYPH[c.suit] ?? ""}`)
    .join(" ");
}

/** Celebratory “Winning Play” glass card — fades when next trick begins. */
export default function LastTrickWidget({
  info,
  suppress = false,
  visibleMs = 3200,
  density = "comfortable",
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, density),
    [colors, density],
  );
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const [shown, setShown] = useState<LastTrickInfo | null>(null);
  /** Ignores stale fade-out callbacks from a previous trick / suppress cycle. */
  const genRef = useRef(0);

  useEffect(() => {
    const gen = ++genRef.current;

    if (suppress) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && genRef.current === gen) setShown(null);
      });
      return () => {
        genRef.current += 1;
      };
    }

    if (!info) {
      setShown(null);
      opacity.setValue(0);
      return () => {
        genRef.current += 1;
      };
    }

    setShown(info);
    opacity.setValue(0);
    scale.setValue(0.9);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const t = setTimeout(() => {
      if (genRef.current !== gen) return;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.96,
          duration: 480,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && genRef.current === gen) setShown(null);
      });
    }, visibleMs);

    return () => {
      clearTimeout(t);
      genRef.current += 1;
    };
  }, [info?.trickKey, suppress, visibleMs, opacity, scale, info]);

  if (!shown) return null;

  return (
    <Animated.View
      style={[styles.host, { opacity, transform: [{ scale }] }]}
      pointerEvents="none"
    >
      <GameplayGlassPanel compact accentColor={colors.accent} style={styles.panel}>
        <Text style={styles.eyebrow}>Winning Play</Text>
        <Text style={styles.cards}>{formatTrickCards(shown.cards)}</Text>
        <View style={styles.winnerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {playerInitials(shown.winnerName)}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.wonBy}>Won by</Text>
            <Text style={styles.winner} numberOfLines={1}>
              {shown.winnerName}
            </Text>
          </View>
        </View>
      </GameplayGlassPanel>
    </Animated.View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  density: HudDensity,
) {
  const dense = density !== "comfortable";
  const ultra = density === "ultra";
  return StyleSheet.create({
    host: {
      alignSelf: "flex-start",
      maxWidth: ultra ? 120 : dense ? 140 : 168,
    },
    panel: {
      minWidth: ultra ? 108 : dense ? 124 : 148,
      padding: ultra ? 8 : undefined,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: ultra ? 8 : 9,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginBottom: ultra ? 3 : dense ? 4 : 6,
      textAlign: "center",
    },
    cards: {
      color: colors.textPrimary,
      fontSize: ultra ? 15 : dense ? 17 : 20,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: ultra ? 4 : dense ? 6 : 8,
    },
    winnerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ultra ? 5 : 8,
    },
    avatar: {
      width: ultra ? 22 : dense ? 24 : 28,
      height: ultra ? 22 : dense ? 24 : 28,
      borderRadius: ultra ? 11 : dense ? 12 : 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: hexToRgba(colors.accent, 0.22),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.accent, 0.5),
    },
    avatarText: {
      color: colors.accent,
      fontSize: ultra ? 8 : 10,
      fontWeight: "800",
    },
    wonBy: {
      color: colors.textTertiary,
      fontSize: ultra ? 8 : 9,
      fontWeight: "600",
    },
    winner: {
      color: hexToRgba(colors.accent, 0.98),
      fontSize: ultra ? 11 : 12,
      fontWeight: "800",
    },
  });
}
