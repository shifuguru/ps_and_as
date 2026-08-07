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
 * Atmospheric orange bloom behind the pill — heat radiating onto the felt.
 * Soft transform/opacity only (no animated blur).
 */
export default function GlowLayer({
  glowOpacity,
  glowScale,
  effectOpacity,
  palette = RUNS_COLORS,
}: Props) {
  const outerStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.72 * effectOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const midStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.55 * effectOpacity.value,
    transform: [{ scale: 0.9 + glowScale.value * 0.1 }],
  }));

  const edgeStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.65 * effectOpacity.value,
    transform: [{ scale: 0.96 + glowScale.value * 0.05 }],
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[styles.outer, { backgroundColor: palette.glow }, outerStyle]}
      />
      <Animated.View
        style={[
          styles.mid,
          { backgroundColor: palette.glowSoft },
          midStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.edge,
          {
            backgroundColor: palette.glowCore,
            shadowColor: palette.core,
          },
          edgeStyle,
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
    width: "145%",
    height: "190%",
    borderRadius: 999,
  },
  mid: {
    position: "absolute",
    width: "118%",
    height: "140%",
    borderRadius: 999,
  },
  edge: {
    position: "absolute",
    width: "104%",
    height: "112%",
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: RUNS_LAYOUT.glowPad,
  },
});
