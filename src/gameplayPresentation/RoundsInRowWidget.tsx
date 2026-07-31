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
 * Session round streak — hierarchy:
 * icon → title → count → rarity pips → rarity label (roomy only).
 * No “Start a run” copy — “run” means consecutive cards in this game.
 * Count is a bare number so “Round” isn’t repeated under the title.
 */
export default function RoundsInRowWidget({
  current,
  best: _best,
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

  return (
    <RunsPill
      active={energyOn}
      style={styles.root}
      showGlow={energyOn && !ultra}
      showFlames={energyOn && !ultra}
      containFlames
      emberSpread="around"
      maxFlameHeight={ultra ? 10 : dense ? 12 : 14}
      palette={palette}
      flameSeeds={flameSeeds}
      pillStyle={styles.effectShell}
    >
      <GameplayGlassPanel compact accentColor={accent} style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.fire}>🔥</Text>
          <Text style={styles.eyebrow}>Round Streak</Text>
        </View>
        <Text
          style={styles.count}
          accessibilityLabel={`${current} ${current === 1 ? "round" : "rounds"}`}
        >
          {current}
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
      minWidth: ultra ? 96 : dense ? 104 : 112,
      maxWidth: ultra ? 120 : dense ? 128 : 140,
      height: cardH,
      justifyContent: "flex-start",
      gap: ultra ? 2 : dense ? 3 : 4,
      padding: ultra ? 7 : dense ? 8 : 9,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginBottom: 0,
    },
    fire: { fontSize: dense ? 10 : 11 },
    eyebrow: {
      color: accent,
      fontSize: ultra ? 8 : 9,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    count: {
      color: colors.textPrimary,
      fontSize: ultra ? 20 : dense ? 22 : 24,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
      letterSpacing: -0.3,
      lineHeight: ultra ? 22 : dense ? 24 : 26,
    },
    pipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    pip: {
      width: dense ? 7 : 8,
      height: dense ? 7 : 8,
      borderRadius: dense ? 3.5 : 4,
    },
    rarityLabel: {
      color: accent,
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginTop: 2,
    },
  });
}
