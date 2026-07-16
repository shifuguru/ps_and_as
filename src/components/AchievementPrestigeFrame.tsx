import React, { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  /** 0–1 progress toward the next prestige rank. */
  progress: number;
  /** Rarity accent — drives fill + border color. */
  rarityColor: string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * Achievement card frame whose rarity-tinted fill grows left → right
 * with prestige progress toward the next rank.
 */
export default function AchievementPrestigeFrame({
  progress,
  rarityColor,
  borderRadius = 14,
  style,
  contentStyle,
  children,
}: Props) {
  const fraction = Math.max(0, Math.min(1, progress));
  const trackColor = useMemo(
    () => hexToRgba(rarityColor, 0.1),
    [rarityColor],
  );
  const fillColor = useMemo(
    () => hexToRgba(rarityColor, 0.38),
    [rarityColor],
  );
  const borderColor = useMemo(
    () => hexToRgba(rarityColor, 0.55),
    [rarityColor],
  );

  return (
    <View
      style={[
        styles.host,
        {
          borderRadius,
          backgroundColor: trackColor,
          borderColor,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.fill,
          {
            width: `${fraction * 100}%`,
            backgroundColor: fillColor,
          },
        ]}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    overflow: "hidden",
    position: "relative",
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },
});
