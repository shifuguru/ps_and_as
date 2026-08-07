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
 * Subtle heat suggestion just above the short flame band.
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
      opacity: effectOpacity.value * (0.05 + t * 0.07),
      transform: [
        { translateX: (t - 0.5) * 4 },
        { scaleX: 1 + t * 0.03 },
      ],
    } as ViewStyle;
  });

  if (!active || width <= 0) return null;

  // Sit just above the ~half-height flame band.
  const top = -(Math.max(height, 22) * 0.55);

  return (
    <View
      style={[styles.wrap, { width: width * 1.02, left: -width * 0.01, top }]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.band, bandA]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    height: 14,
    overflow: "visible",
    zIndex: 3,
  },
  band: {
    position: "absolute",
    left: "12%",
    right: "12%",
    top: 2,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,230,160,0.16)",
  },
});
