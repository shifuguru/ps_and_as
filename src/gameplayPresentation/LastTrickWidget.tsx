import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { Card } from "../game/ruleset";
import { formatCardRank } from "../game/ruleset";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { playerInitials } from "../utils/playerDisplay";
import GameplayGlassPanel from "./GameplayGlassPanel";
import {
  HUD_TYPE,
  hudGlassPadding,
  type HudDensity,
} from "./hudLayout";

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
          <Text style={styles.winner} numberOfLines={1}>
            {shown.winnerName}
          </Text>
        </View>
      </GameplayGlassPanel>
    </Animated.View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  density: HudDensity,
) {
  const pad = hudGlassPadding(density);
  return StyleSheet.create({
    host: {
      alignSelf: "flex-start",
      maxWidth: 168,
    },
    panel: {
      minWidth: 148,
      padding: pad,
      gap: 0,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: HUD_TYPE.eyebrow,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginBottom: 6,
      textAlign: "center",
    },
    cards: {
      color: colors.textPrimary,
      fontSize: HUD_TYPE.value,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 8,
    },
    winnerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minWidth: 0,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: hexToRgba(colors.accent, 0.22),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.accent, 0.5),
      flexShrink: 0,
    },
    avatarText: {
      color: colors.accent,
      fontSize: HUD_TYPE.caption,
      fontWeight: "800",
    },
    winner: {
      flex: 1,
      minWidth: 0,
      color: hexToRgba(colors.accent, 0.98),
      fontSize: HUD_TYPE.emphasis,
      fontWeight: "800",
    },
  });
}
