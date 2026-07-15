import React, { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  type SharedValue,
} from "react-native-reanimated";
import { FLAME_SEEDS, RUNS_LAYOUT, type FlameSeed } from "./constants";

type Props = {
  width: number;
  flameIntensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
};

function FlameWisp({
  seed,
  pillWidth,
  flameIntensity,
  ignition,
  effectOpacity,
}: {
  seed: FlameSeed;
  pillWidth: number;
  flameIntensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
}) {
  const flicker = useSharedValue(0);

  useEffect(() => {
    flicker.value = withDelay(
      seed.delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: seed.periodMs * 0.45,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.15, {
            duration: seed.periodMs * 0.55,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(flicker);
  }, [flicker, seed.delayMs, seed.periodMs]);

  const style = useAnimatedStyle(() => {
    const intensity = flameIntensity.value;
    const burst = ignition.value;
    const baseH = seed.height * (0.35 + intensity * 0.65 + burst * 0.35);
    const scaleY = 0.55 + flicker.value * 0.55 + burst * 0.4;
    const scaleX = 0.75 + (1 - flicker.value) * 0.35;
    const lift = -2 - burst * 6 - flicker.value * 3 * intensity;
    const opacity =
      effectOpacity.value *
      intensity *
      (0.35 + flicker.value * 0.55 + burst * 0.25);

    return {
      opacity,
      height: Math.min(RUNS_LAYOUT.maxFlameHeight + 2, baseH),
      transform: [
        { translateY: lift },
        { scaleY },
        { scaleX },
        { rotate: `${seed.rotDeg * (0.6 + flicker.value * 0.5)}deg` },
      ],
    } as ViewStyle;
  });

  const left = Math.max(0, seed.x * pillWidth - seed.width / 2);

  return (
    <Animated.View
      style={[
        styles.wisp,
        {
          left,
          width: seed.width,
          borderRadius: seed.width / 2,
          backgroundColor: seed.color,
        },
        style,
      ]}
    />
  );
}

/**
 * Soft energy wisps rising from the top edge of the pill only.
 * Rounded blobs — not comic fire.
 */
export default function FlameLayer({
  width,
  flameIntensity,
  ignition,
  effectOpacity,
}: Props) {
  if (width <= 0) return null;

  return (
    <View style={styles.row} pointerEvents="none">
      {FLAME_SEEDS.map((seed) => (
        <FlameWisp
          key={seed.id}
          seed={seed}
          pillWidth={width}
          flameIntensity={flameIntensity}
          ignition={ignition}
          effectOpacity={effectOpacity}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -2,
    height: RUNS_LAYOUT.maxFlameHeight + 8,
    overflow: "visible",
  },
  wisp: {
    position: "absolute",
    bottom: 0,
  },
});
