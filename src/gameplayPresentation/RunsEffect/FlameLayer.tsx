import React, { useEffect, useId } from "react";
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
import Svg, { Defs, LinearGradient, Stop, Ellipse } from "react-native-svg";
import { FLAME_SEEDS, RUNS_LAYOUT, type FlameSeed } from "./constants";

type Props = {
  width: number;
  flameIntensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  seeds?: FlameSeed[];
  maxFlameHeight?: number;
  /**
   * Contained = subtler wisps rising inside from the bottom (streak widgets).
   * Default = erupt from the top neon rim (Runs! reference look).
   */
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
  const uid = useId().replace(/:/g, "");
  const gradId = `flameGrad-${uid}-${seed.id}`;

  useEffect(() => {
    flicker.value = withDelay(
      seed.delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: seed.periodMs * 0.42,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.18, {
            duration: seed.periodMs * 0.58,
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
    const baseH = seed.height * (0.4 + intensity * 0.7 + burst * 0.4);
    const scaleY = 0.55 + flicker.value * 0.6 + burst * 0.45;
    const scaleX = 0.72 + (1 - flicker.value) * 0.38;
    const lift = contained
      ? -2 - burst * 4 - flicker.value * 3 * intensity
      : -4 - burst * 10 - flicker.value * 8 * intensity;
    const opacity =
      effectOpacity.value *
      intensity *
      (0.42 + flicker.value * 0.5 + burst * 0.28);

    return {
      opacity,
      height: Math.min(
        maxFlameHeight + 6,
        baseH * (maxFlameHeight / RUNS_LAYOUT.maxFlameHeight),
      ),
      transform: [
        { translateY: lift },
        { scaleY },
        { scaleX },
        { rotate: `${seed.rotDeg * (0.65 + flicker.value * 0.55)}deg` },
      ],
    } as ViewStyle;
  });

  const left = Math.max(0, seed.x * pillWidth - seed.width / 2);
  const coreColor = seed.coreColor ?? "#FFF8D6";
  // SVG needs an explicit height; animated style still drives the wrapper.
  const svgH = Math.max(seed.height, 16);
  const svgW = seed.width;

  return (
    <Animated.View
      style={[
        styles.wisp,
        {
          left,
          width: seed.width,
          shadowColor: seed.color,
        },
        style,
      ]}
    >
      <Svg width={svgW} height={svgH} style={styles.svg}>
        <Defs>
          <LinearGradient id={gradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <Stop offset="0%" stopColor={coreColor} stopOpacity="1" />
            <Stop offset="35%" stopColor={seed.color} stopOpacity="0.95" />
            <Stop offset="75%" stopColor="#FF6A00" stopOpacity="0.85" />
            <Stop offset="100%" stopColor="#FF4500" stopOpacity="0.55" />
          </LinearGradient>
        </Defs>
        {/* Teardrop tongue — wide base on the rim, pointed tip upward */}
        <Ellipse
          cx={svgW / 2}
          cy={svgH * 0.55}
          rx={svgW * 0.48}
          ry={svgH * 0.48}
          fill={`url(#${gradId})`}
        />
        <Ellipse
          cx={svgW / 2}
          cy={svgH * 0.28}
          rx={svgW * 0.28}
          ry={svgH * 0.32}
          fill={`url(#${gradId})`}
          opacity={0.9}
        />
        {/* Hot core near the rim */}
        <Ellipse
          cx={svgW / 2}
          cy={svgH * 0.72}
          rx={svgW * 0.22}
          ry={svgH * 0.22}
          fill={coreColor}
          opacity={0.95}
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * Flame tongues on the pill rim.
 * Default: erupt upward from the top neon edge (Runs!).
 * Contained: soft wisps from the inner bottom (streak / prestige pills).
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
              // Mostly above the pill — bases kiss the neon rim (~3px).
              height: maxFlameHeight + 3,
              top: -maxFlameHeight,
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
    bottom: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    overflow: "visible",
  },
  svg: {
    width: "100%",
    height: "100%",
  },
});
