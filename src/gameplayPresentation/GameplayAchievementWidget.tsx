import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, Animated } from "react-native";
import ProgressMeter from "../components/ProgressMeter";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import {
  getPlayerStats,
  formatAchievementPrestige,
  type PlayerStats,
} from "../services/playerStats";
import { selectNextAchievement } from "../services/nextAchievement";
import {
  RARITY_COLOR,
  RARITY_LABEL,
  rarityForAchievementId,
} from "../services/achievementRarity";
import GameplayGlassPanel from "./GameplayGlassPanel";
import { HUD_CARD_HEIGHT } from "./hudLayout";

type Props = {
  onOpenAchievements?: () => void;
  /** Soft reload when round / trick events fire */
  refreshKey?: number;
};

/** Single nearest achievement — mini Hub Next Achievement card. */
export default function GameplayAchievementWidget({
  onOpenAchievements,
  refreshKey = 0,
}: Props) {
  const { colors } = useAppTheme();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const pulse = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    void getPlayerStats().then(setStats);
  }, [refreshKey]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.015,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const next = stats ? selectNextAchievement(stats) : null;
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!next) return null;

  const accent = RARITY_COLOR[rarityForAchievementId(next.def.id)];
  const rarity = rarityForAchievementId(next.def.id);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <GameplayGlassPanel
        compact
        accentColor={accent}
        onPress={onOpenAchievements}
        disabled={!onOpenAchievements}
        style={styles.panel}
      >
        <Text style={[styles.eyebrow, { color: accent }]}>
          {next.prestige >= 1
            ? `Next Prestige ${formatAchievementPrestige(next.nextPrestige)}`
            : "Upcoming"}
        </Text>
        <View style={styles.row}>
          <Text style={styles.emoji}>{next.def.emoji}</Text>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {next.def.title}
              {next.prestige >= 1
                ? ` · ${formatAchievementPrestige(next.prestige)}`
                : ""}
            </Text>
            <Text style={styles.desc} numberOfLines={2}>
              {next.def.description}
            </Text>
            <View
              style={[
                styles.rarityChip,
                {
                  backgroundColor: hexToRgba(accent, 0.2),
                  borderColor: hexToRgba(accent, 0.45),
                },
              ]}
            >
              <Text style={[styles.rarityText, { color: accent }]}>
                {RARITY_LABEL[rarity]}
              </Text>
            </View>
          </View>
        </View>
        <ProgressMeter
          progress={next.fraction}
          height={5}
          fillColor={accent}
          valueLabel={`${next.current} / ${next.target}`}
          style={styles.meter}
        />
      </GameplayGlassPanel>
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    panel: {
      width: 196,
      maxWidth: "100%",
      height: HUD_CARD_HEIGHT,
      justifyContent: "space-between",
    },
    eyebrow: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginBottom: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      flexShrink: 1,
      minHeight: 0,
    },
    emoji: { fontSize: 18, lineHeight: 22 },
    body: { flex: 1, minWidth: 0, gap: 2 },
    title: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "800",
    },
    desc: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: "600",
      lineHeight: 12,
    },
    rarityChip: {
      alignSelf: "flex-start",
      marginTop: 1,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },
    rarityText: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    meter: {
      marginTop: 4,
      gap: 3,
    },
  });
}
