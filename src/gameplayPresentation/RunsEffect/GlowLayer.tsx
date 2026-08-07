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
 * Tight warm bloom centered on the pill — heat around the badge, not a huge halo.
 */
export default function GlowLayer({
  glowOpacity,
  glowScale,
  effectOpacity,
  palette = RUNS_COLORS,
}: Props) {
  const outerStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.65 * effectOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const midStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.5 * effectOpacity.value,
    transform: [{ scale: 0.92 + glowScale.value * 0.08 }],
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[styles.outer, { backgroundColor: palette.glow }, outerStyle]}
      />
      <Animated.View
        style={[
          styles.mid,
          {
            backgroundColor: palette.glowSoft,
            shadowColor: palette.core,
          },
          midStyle,
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
  outer: {
    position: "absolute",
    width: "118%",
    height: "150%",
    borderRadius: 999,
  },
  mid: {
    position: "absolute",
    width: "104%",
    height: "118%",
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: RUNS_LAYOUT.glowPad,
  },
});
