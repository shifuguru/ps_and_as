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
import { resolveHudCardHeight, type HudDensity } from "./hudLayout";
import {
  RunsPill,
  flameSeedsFromPalette,
  paletteFromAccent,
} from "./RunsEffect";

type Props = {
  current: number;
  best: number;
  density?: HudDensity;
};

/**
 * Session round streak — hierarchy matches concept:
 * icon → title → count → descriptor → rarity pips.
 * Accent follows achievement rarity palette by streak threshold.
 * Flame / sparkle energy uses that same accent (pill as fuel).
 */
export default function RoundsInRowWidget({
  current,
  best,
  density = "comfortable",
}: Props) {
  const { colors } = useAppTheme();
  const progress = roundStreakRarityProgress(current);
  const accent = RARITY_COLOR[progress.rarity];
  const energyOn = current > 0;
  const dense = density !== "comfortable";
  const ultra = density === "ultra";
  const palette = useMemo(() => paletteFromAccent(accent), [accent]);
  const flameSeeds = useMemo(
    () => flameSeedsFromPalette(palette),
    [palette],
  );
  const styles = useMemo(
    () => createStyles(colors, accent, density),
    [colors, accent, density],
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
    <RunsPill
      active={energyOn}
      style={styles.root}
      showGlow={energyOn && !ultra}
      showFlames={energyOn && !ultra}
      containFlames
      emberSpread="around"
      maxFlameHeight={ultra ? 10 : dense ? 12 : 16}
      palette={palette}
      flameSeeds={flameSeeds}
      pillStyle={styles.effectShell}
    >
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
        {!ultra ? (
          <Text style={styles.descriptor} numberOfLines={1}>
            {current <= 0 ? "Start a run" : bestLine ?? "Keep it going"}
          </Text>
        ) : null}
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
        {!dense ? (
          <Text style={styles.rarityLabel}>{RARITY_LABEL[progress.rarity]}</Text>
        ) : null}
      </GameplayGlassPanel>
    </RunsPill>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  accent: string,
  density: HudDensity,
) {
  const dense = density !== "comfortable";
  const ultra = density === "ultra";
  const cardH = resolveHudCardHeight(density);
  return StyleSheet.create({
    root: {
      alignSelf: "flex-start",
      maxWidth: "100%",
    },
    /** Transparent host so GameplayGlassPanel remains the glass surface. */
    effectShell: {
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      overflow: "visible",
    },
    panel: {
      minWidth: ultra ? 96 : dense ? 108 : 118,
      maxWidth: ultra ? 120 : dense ? 132 : 148,
      height: cardH,
      justifyContent: "space-between",
      gap: 0,
      padding: ultra ? 8 : undefined,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 0,
    },
    fire: { fontSize: ultra ? 10 : 12 },
    eyebrow: {
      color: accent,
      fontSize: ultra ? 8 : 9,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    count: {
      color: colors.textPrimary,
      fontSize: ultra ? 18 : dense ? 20 : 22,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
      letterSpacing: -0.3,
      lineHeight: ultra ? 22 : dense ? 24 : 26,
    },
    countUnit: {
      fontSize: ultra ? 11 : 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    descriptor: {
      color: colors.textSecondary,
      fontSize: dense ? 9 : 10,
      fontWeight: "600",
      marginBottom: 2,
    },
    pipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ultra ? 3 : 4,
      marginBottom: dense ? 0 : 2,
    },
    pip: {
      width: ultra ? 6 : 8,
      height: ultra ? 6 : 8,
      borderRadius: ultra ? 3 : 4,
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
