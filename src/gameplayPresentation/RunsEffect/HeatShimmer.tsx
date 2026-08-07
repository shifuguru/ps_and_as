import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

type Props = {
  width: number;
  height: number;
  shimmer: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  active: boolean;
};

/**
 * Subtle heat shimmer above the aura — transform-only distortion suggestion.
 * Never covers the pill face / text.
 */
export default function HeatShimmer({
  width,
  height,
  shimmer,
  effectOpacity,
  active,
}: Props) {
  const bandA = useAnimatedStyle(() => {
    const t = shimmer.value;
    return {
      opacity: effectOpacity.value * (0.08 + t * 0.1),
      transform: [
        { translateX: (t - 0.5) * 6 },
        { scaleX: 1 + t * 0.04 },
        { scaleY: 1 + (1 - t) * 0.08 },
      ],
    } as ViewStyle;
  });

  const bandB = useAnimatedStyle(() => {
    const t = 1 - shimmer.value;
    return {
      opacity: effectOpacity.value * (0.06 + t * 0.09),
      transform: [
        { translateX: (0.5 - t) * 8 },
        { scaleX: 1 + (1 - t) * 0.05 },
        { scaleY: 1 + t * 0.06 },
      ],
    } as ViewStyle;
  });

  if (!active || width <= 0) return null;

  const top = -(Math.max(height, 22) * 0.95);

  return (
    <View
      style={[styles.wrap, { width: width * 1.15, left: -width * 0.075, top }]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.band, styles.bandA, bandA]} />
      <Animated.View style={[styles.band, styles.bandB, bandB]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    height: 28,
    overflow: "visible",
  },
  band: {
    position: "absolute",
    left: "8%",
    right: "8%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,230,160,0.18)",
  },
  bandA: {
    top: 2,
  },
  bandB: {
    top: 12,
    left: "18%",
    right: "12%",
    backgroundColor: "rgba(255,180,80,0.12)",
  },
});
