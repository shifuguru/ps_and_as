import React, { useEffect, useId, useMemo } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
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
import Svg, { Defs, Ellipse, LinearGradient, Stop } from "react-native-svg";
import { FLAME_SEEDS, RUNS_LAYOUT, type FlameSeed } from "./constants";

type Props = {
  width: number;
  height: number;
  flameIntensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  seeds?: FlameSeed[];
  maxFlameHeight?: number;
  contained?: boolean;
};

/**
 * Soft realistic wisp — stacked ellipses + gradient, no hard cartoon outline.
 * Bases sit on the pill rim; tips rise a short distance above.
 */
function FlameWisp({
  seed,
  auraW,
  auraH,
  flameIntensity,
  ignition,
  effectOpacity,
}: {
  seed: FlameSeed;
  auraW: number;
  auraH: number;
  flameIntensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
}) {
  const flicker = useSharedValue(0);
  const sway = useSharedValue(0);
  const uid = useId().replace(/:/g, "");
  const gradId = `runsWisp-${uid}-${seed.id}`;

  useEffect(() => {
    flicker.value = withDelay(
      seed.delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: seed.periodMs * 0.38,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.2, {
            duration: seed.periodMs * 0.62,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
    sway.value = withDelay(
      seed.delayMs * 0.6,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: seed.swayMs * 0.5,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-1, {
            duration: seed.swayMs * 0.5,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(flicker);
      cancelAnimation(sway);
    };
  }, [flicker, sway, seed.delayMs, seed.periodMs, seed.swayMs]);

  const wispW = Math.max(14, auraW * seed.widthFrac);
  const wispH = Math.max(12, auraH * seed.heightFrac);
  const left = seed.x * auraW - wispW / 2;

  const style = useAnimatedStyle(() => {
    const intensity = flameIntensity.value;
    const burst = ignition.value;
    const scaleY = 0.72 + flicker.value * 0.4 + burst * 0.28 + intensity * 0.08;
    const scaleX = 0.82 + (1 - flicker.value) * 0.22;
    const dx = sway.value * seed.swayFrac * auraW;
    const lift = -1 - burst * 3 - flicker.value * 2;
    const opacity =
      effectOpacity.value *
      intensity *
      (0.4 + flicker.value * 0.45 + burst * 0.2);

    return {
      opacity,
      transform: [
        { translateX: dx },
        { translateY: lift },
        { scaleY },
        { scaleX },
        { rotate: `${seed.rotDeg * (0.5 + flicker.value * 0.5)}deg` },
      ],
    } as ViewStyle;
  });

  const cx = wispW / 2;

  return (
    <Animated.View
      style={[
        styles.wisp,
        {
          left,
          width: wispW,
          height: wispH,
          shadowColor: seed.color,
        },
        style,
      ]}
    >
      <Svg width={wispW} height={wispH} style={styles.svg}>
        <Defs>
          <LinearGradient id={gradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <Stop offset="0%" stopColor={seed.coreColor} stopOpacity="0.95" />
            <Stop offset="30%" stopColor={seed.color} stopOpacity="0.9" />
            <Stop offset="65%" stopColor={seed.tipColor} stopOpacity="0.75" />
            <Stop offset="100%" stopColor={seed.tipColor} stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        {/* Soft volume — no stroke, fades at tip */}
        <Ellipse
          cx={cx}
          cy={wispH * 0.58}
          rx={wispW * 0.42}
          ry={wispH * 0.42}
          fill={`url(#${gradId})`}
        />
        <Ellipse
          cx={cx}
          cy={wispH * 0.32}
          rx={wispW * 0.24}
          ry={wispH * 0.3}
          fill={`url(#${gradId})`}
          opacity={0.75}
        />
        {/* Hot base near the pill rim */}
        <Ellipse
          cx={cx}
          cy={wispH * 0.78}
          rx={wispW * 0.3}
          ry={wispH * 0.18}
          fill={seed.coreColor}
          opacity={0.85}
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * Soft fire band centered on the pill.
 * Rises from the top rim ~half the pill height; width locked to the pill.
 */
export default function FlameLayer({
  width,
  height,
  flameIntensity,
  ignition,
  effectOpacity,
  seeds = FLAME_SEEDS,
  maxFlameHeight = RUNS_LAYOUT.maxFlameHeight,
  contained = false,
}: Props) {
  const dims = useMemo(() => {
    if (width <= 0) return null;
    const pillH = Math.max(height, 22);
    if (contained) {
      const auraH = Math.min(maxFlameHeight, Math.max(12, pillH * 0.55));
      return {
        auraW: width,
        auraH,
        left: 0,
        // Contained: still rise from top of the widget face.
        top: -(auraH * 0.35),
        bottom: undefined as number | undefined,
      };
    }
    // Open Runs!: half pill height above the top edge, centered on the pill.
    const auraH = Math.min(
      maxFlameHeight,
      Math.max(10, pillH * RUNS_LAYOUT.auraHeightFactor),
    );
    const side = width * RUNS_LAYOUT.auraSideSpill;
    return {
      auraW: width + side * 2,
      auraH,
      left: -side,
      // Sit on the top rim — pill stays dead-center of the effect.
      top: -auraH + 2,
      bottom: undefined as number | undefined,
    };
  }, [width, height, maxFlameHeight, contained]);

  if (!dims) return null;

  return (
    <View
      style={[
        styles.field,
        {
          width: dims.auraW,
          height: dims.auraH,
          left: dims.left,
          top: dims.top,
          bottom: dims.bottom,
        },
        // Soften hard edges once (static) — not animated every frame.
        Platform.OS === "web"
          ? ({ filter: "blur(1.2px)" } as object)
          : null,
      ]}
      pointerEvents="none"
    >
      {seeds.map((seed) => (
        <FlameWisp
          key={seed.id}
          seed={seed}
          auraW={dims.auraW}
          auraH={dims.auraH}
          flameIntensity={flameIntensity}
          ignition={ignition}
          effectOpacity={effectOpacity}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: "absolute",
    overflow: "visible",
  },
  wisp: {
    position: "absolute",
    bottom: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
  },
  svg: {
    width: "100%",
    height: "100%",
  },
});
