import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import BlurPanel from "./BlurPanel";
import HubProgressRing from "./HubProgressRing";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import type { NextAchievement } from "../services/nextAchievement";
import {
  RARITY_COLOR,
  RARITY_LABEL,
  rarityForAchievementId,
} from "../services/achievementRarity";

type Props = {
  next: NextAchievement;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function NextAchievementCard({ next, onPress, style }: Props) {
  const { colors } = useAppTheme();
  const rarity = rarityForAchievementId(next.def.id);
  const accent = RARITY_COLOR[rarity];
  const styles = useMemo(
    () => createStyles(colors, accent),
    [colors, accent],
  );

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
      {/* Single visual surface = BlurPanel. No glowWash / nested plates. */}
      <BlurPanel intensity={56} style={[styles.card, style]}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>Next Achievement</Text>
          <View style={styles.rarityPill}>
            <Text style={styles.rarityPillText}>{RARITY_LABEL[rarity]}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <HubProgressRing
            size={84}
            progress={next.fraction}
            strokeWidth={5}
            trackColor={hexToRgba(accent, 0.22)}
            fillColor={accent}
          >
            <Text style={styles.emoji}>{next.def.emoji}</Text>
          </HubProgressRing>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>
              {next.def.title}
            </Text>
            <Text style={styles.description} numberOfLines={3}>
              {next.def.description}
            </Text>
            <Text style={styles.progress}>
              {next.current} / {next.target}
            </Text>
          </View>
        </View>
      </BlurPanel>
    </TouchableOpacity>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  accent: string,
) {
  return StyleSheet.create({
    card: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(accent, 0.45),
      padding: 16,
      overflow: "hidden",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 12,
    },
    eyebrow: {
      color: accent,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    rarityPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: hexToRgba(accent, 0.18),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(accent, 0.4),
    },
    rarityPillText: {
      color: accent,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    emoji: {
      fontSize: 30,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
    },
    description: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 18,
    },
    progress: {
      marginTop: 4,
      color: accent,
      fontSize: 14,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
  });
}
