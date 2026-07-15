import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import {
  RARITY_COLOR,
  RARITY_LABEL,
  roundStreakRarityProgress,
} from "../services/achievementRarity";
import GameplayGlassPanel from "./GameplayGlassPanel";
import { HUD_CARD_HEIGHT } from "./hudLayout";

type Props = {
  current: number;
  best: number;
};

/**
 * Session round streak — hierarchy matches concept:
 * icon → title → count → descriptor → rarity pips.
 * Accent follows achievement rarity palette by streak threshold.
 */
export default function RoundsInRowWidget({ current, best }: Props) {
  const { colors } = useAppTheme();
  const progress = roundStreakRarityProgress(current);
  const accent = RARITY_COLOR[progress.rarity];
  const styles = useMemo(
    () => createStyles(colors, accent),
    [colors, accent],
  );

  const pipCount = Math.min(5, Math.max(3, progress.target));
  const filled = Math.min(
    pipCount,
    progress.nextRarity == null
      ? pipCount
      : Math.round(progress.fraction * pipCount),
  );

  const bestLine =
    best > current ? `Best ${best}` : best > 0 ? `Best ${best}` : null;

  return (
    <GameplayGlassPanel compact accentColor={accent} style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.fire}>🔥</Text>
        <Text style={styles.eyebrow}>Round Streak</Text>
      </View>
      <Text style={styles.count}>
        {current}
        <Text style={styles.countUnit}>
          {current === 1 ? " Round" : " Rounds"}
        </Text>
      </Text>
      <Text style={styles.descriptor} numberOfLines={1}>
        {current <= 0 ? "Start a run" : bestLine ?? "Keep it going"}
      </Text>
      <View style={styles.pipRow}>
        {Array.from({ length: pipCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              {
                backgroundColor:
                  i < filled ? accent : hexToRgba(accent, 0.22),
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.rarityLabel}>{RARITY_LABEL[progress.rarity]}</Text>
    </GameplayGlassPanel>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  accent: string,
) {
  return StyleSheet.create({
    panel: {
      minWidth: 118,
      maxWidth: 148,
      height: HUD_CARD_HEIGHT,
      alignSelf: "flex-end",
      justifyContent: "space-between",
      gap: 0,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 0,
    },
    fire: { fontSize: 12 },
    eyebrow: {
      color: accent,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    count: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
      letterSpacing: -0.3,
      lineHeight: 26,
    },
    countUnit: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    descriptor: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: "600",
      marginBottom: 2,
    },
    pipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 2,
    },
    pip: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    rarityLabel: {
      color: accent,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
  });
}
