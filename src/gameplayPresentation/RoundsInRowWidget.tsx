import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { clampLuminance } from "../styles/feltPalette";
import {
  RARITY_COLOR,
  roundStreakRarityProgress,
} from "../services/achievementRarity";
import GameplayGlassPanel from "./GameplayGlassPanel";
import {
  HUD_TYPE,
  hudGlassPadding,
  resolveHudCardHeight,
  type HudDensity,
} from "./hudLayout";

type Props = {
  current: number;
  best: number;
  density?: HudDensity;
};

/** Session round streak and rarity progress. */
export default function RoundsInRowWidget({
  current,
  best: _best,
  density = "comfortable",
}: Props) {
  const { colors } = useAppTheme();
  const progress = roundStreakRarityProgress(current);
  const rarityColor = RARITY_COLOR[progress.rarity];
  const accent = colors.mode === "light"
    ? clampLuminance(rarityColor, 0.09)
    : rarityColor;
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
    <GameplayGlassPanel compact accentColor={accent} style={[styles.root, styles.panel]}>
      <View style={styles.header}>
        <Text
          style={styles.count}
          accessibilityLabel={`${current} ${current === 1 ? "round" : "rounds"}`}
        >
          {current}
        </Text>
        <View style={styles.details}>
          <Text style={styles.eyebrow}>Round Streak</Text>
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
        </View>
      </View>
    </GameplayGlassPanel>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  accent: string,
  density: HudDensity,
) {
  const pad = hudGlassPadding(density);
  const cardH = resolveHudCardHeight(density);
  return StyleSheet.create({
    root: {
      alignSelf: "flex-start",
      maxWidth: "100%",
    },
    panel: {
      minWidth: 136,
      maxWidth: 148,
      height: cardH,
      justifyContent: "center",
      padding: pad,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    details: {
      justifyContent: "center",
      gap: 3,
    },
    eyebrow: {
      color: accent,
      fontSize: HUD_TYPE.eyebrow,
      fontWeight: "800",
      letterSpacing: 0.6,
      lineHeight: 13,
      textTransform: "uppercase",
    },
    count: {
      color: colors.textPrimary,
      fontSize: HUD_TYPE.display,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
      letterSpacing: -0.3,
      lineHeight: 26,
    },
    pipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    pip: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });
}
