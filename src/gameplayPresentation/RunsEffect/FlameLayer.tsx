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
  seeds?: FlameSeed[];
  maxFlameHeight?: number;
  /** Keep wisps mostly inside the pill (rise from the inner bottom edge). */
  contained?: boolean;
};

function FlameWisp({
  seed,
  pillWidth,
  flameIntensity,
  ignition,
  effectOpacity,
  maxFlameHeight,
  contained,
}: {
  seed: FlameSeed;
  pillWidth: number;
  flameIntensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  maxFlameHeight: number;
  contained: boolean;
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
    // Rise upward from the fuel line (negative Y). Contained = subtler lift.
    const lift = contained
      ? -2 - burst * 4 - flicker.value * 3 * intensity
      : -6 - burst * 12 - flicker.value * 6 * intensity;
    const opacity =
      effectOpacity.value *
      intensity *
      (0.35 + flicker.value * 0.55 + burst * 0.25);

    return {
      opacity,
      height: Math.min(
        maxFlameHeight + 4,
        baseH * (maxFlameHeight / RUNS_LAYOUT.maxFlameHeight),
      ),
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
 * Soft energy wisps rising from the bottom edge of the pill (fuel source).
 * Wisp bases sit on the fuel line; tips rise upward. Soft blobs — not comic fire.
 */
export default function FlameLayer({
  width,
  flameIntensity,
  ignition,
  effectOpacity,
  seeds = FLAME_SEEDS,
  maxFlameHeight = RUNS_LAYOUT.maxFlameHeight,
  contained = false,
}: Props) {
  if (width <= 0) return null;

  return (
    <View
      style={[
        styles.row,
        contained
          ? {
              height: maxFlameHeight + 8,
              bottom: 1,
            }
          : {
              height: maxFlameHeight + 18,
              // Slight overhang so the base reads as inside the pill edge.
              bottom: -(maxFlameHeight * 0.12),
            },
      ]}
      pointerEvents="none"
    >
      {seeds.map((seed) => (
        <FlameWisp
          key={seed.id}
          seed={seed}
          pillWidth={width}
          flameIntensity={flameIntensity}
          ignition={ignition}
          effectOpacity={effectOpacity}
          maxFlameHeight={maxFlameHeight}
          contained={contained}
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
    overflow: "visible",
  },
  wisp: {
    position: "absolute",
    // Anchor on the fuel line at the bottom of the flame row.
    bottom: 0,
  },
});
