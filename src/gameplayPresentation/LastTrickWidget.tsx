import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { Card } from "../game/ruleset";
import { formatCardRank } from "../game/ruleset";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { playerInitials } from "../utils/playerDisplay";
import GameplayGlassPanel from "./GameplayGlassPanel";

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
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      <GameplayGlassPanel compact accentColor={colors.gold} style={styles.panel}>
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

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    host: {
      alignSelf: "flex-start",
      maxWidth: 168,
    },
    panel: {
      minWidth: 148,
    },
    eyebrow: {
      color: colors.gold,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginBottom: 6,
      textAlign: "center",
    },
    cards: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 8,
    },
    winnerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: hexToRgba(colors.gold, 0.22),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.gold, 0.5),
    },
    avatarText: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: "800",
    },
    wonBy: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "600",
    },
    winner: {
      color: hexToRgba(colors.gold, 0.98),
      fontSize: 12,
      fontWeight: "800",
    },
  });
}
