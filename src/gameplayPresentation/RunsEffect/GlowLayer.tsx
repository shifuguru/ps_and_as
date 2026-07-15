import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { RUNS_COLORS, RUNS_LAYOUT } from "./constants";

type Props = {
  glowOpacity: SharedValue<number>;
  glowScale: SharedValue<number>;
  effectOpacity: SharedValue<number>;
};

/**
 * Soft warm bloom behind the glass pill — illuminates felt, never overpowers UI.
 * Scale/opacity only (no animated blur).
 */
export default function GlowLayer({
  glowOpacity,
  glowScale,
  effectOpacity,
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
      <Animated.View style={[styles.halo, glowStyle]} />
      <Animated.View style={[styles.core, coreStyle]} />
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
    backgroundColor: RUNS_COLORS.glow,
  },
  core: {
    position: "absolute",
    width: "100%",
    height: "108%",
    borderRadius: 999,
    backgroundColor: RUNS_COLORS.glowSoft,
    shadowColor: RUNS_COLORS.core,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: RUNS_LAYOUT.glowPad,
  },
});
