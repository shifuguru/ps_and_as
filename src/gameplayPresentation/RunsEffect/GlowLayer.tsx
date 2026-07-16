import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { RUNS_COLORS, RUNS_LAYOUT, type RunsPalette } from "./constants";

type Props = {
  glowOpacity: SharedValue<number>;
  glowScale: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  palette?: RunsPalette;
};

/**
 * Soft bloom behind the glass pill — illuminates felt, never overpowers UI.
 * Scale/opacity only (no animated blur).
 */
export default function GlowLayer({
  glowOpacity,
  glowScale,
  effectOpacity,
  palette = RUNS_COLORS,
}: Props) {
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.55 * effectOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.4 * effectOpacity.value,
    transform: [{ scale: 0.88 + glowScale.value * 0.08 }],
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[styles.halo, { backgroundColor: palette.glow }, glowStyle]}
      />
      <Animated.View
        style={[
          styles.core,
          {
            backgroundColor: palette.glowSoft,
            shadowColor: palette.core,
          },
          coreStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  halo: {
    position: "absolute",
    width: "112%",
    height: "130%",
    borderRadius: 999,
  },
  core: {
    position: "absolute",
    width: "100%",
    height: "108%",
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: RUNS_LAYOUT.glowPad,
  },
});
