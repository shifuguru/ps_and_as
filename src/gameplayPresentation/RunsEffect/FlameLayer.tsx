import React, { useEffect, useId, useMemo } from "react";
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
  /**
   * Contained = compact inner energy (streak widgets).
   * Default = large behind-pill aura wrapping top + sides.
   */
  contained?: boolean;
};

function FlameLobe({
  seed,
  auraW,
  auraH,
  flameIntensity,
  ignition,
  effectOpacity,
  contained,
}: {
  seed: FlameSeed;
  auraW: number;
  auraH: number;
  flameIntensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  contained: boolean;
}) {
  const flicker = useSharedValue(0);
  const sway = useSharedValue(0);
  const uid = useId().replace(/:/g, "");
  const gradId = `runsAura-${uid}-${seed.id}`;

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
      seed.delayMs * 0.7,
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

  const lobeW = Math.max(18, auraW * seed.widthFrac);
  const lobeH = Math.max(22, auraH * seed.heightFrac);
  const left = seed.x * auraW - lobeW / 2;

  const style = useAnimatedStyle(() => {
    const intensity = flameIntensity.value;
    const burst = ignition.value;
    const scaleY =
      (contained ? 0.55 : 0.72) +
      flicker.value * 0.38 +
      burst * 0.35 +
      intensity * 0.12;
    const scaleX = 0.82 + (1 - flicker.value) * 0.28 + burst * 0.08;
    const dx = sway.value * seed.swayFrac * auraW * (0.6 + intensity * 0.4);
    const lift = contained
      ? -2 - burst * 4 - flicker.value * 3
      : -4 - burst * 10 - flicker.value * 6;
    const opacity =
      effectOpacity.value *
      intensity *
      (0.4 + flicker.value * 0.45 + burst * 0.25);

    return {
      opacity,
      transform: [
        { translateX: dx },
        { translateY: lift },
        { scaleY },
        { scaleX },
        { rotate: `${seed.rotDeg * (0.55 + flicker.value * 0.5)}deg` },
      ],
    } as ViewStyle;
  });

  // Soft stacked ellipses — reads as a flame volume, not a candle sticker.
  const cx = lobeW / 2;
  const cy = lobeH * 0.58;

  return (
    <Animated.View
      style={[
        styles.lobe,
        {
          left,
          width: lobeW,
          height: lobeH,
          shadowColor: seed.color,
        },
        style,
      ]}
    >
      <Svg width={lobeW} height={lobeH} style={styles.svg}>
        <Defs>
          <LinearGradient id={gradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <Stop offset="0%" stopColor={seed.coreColor} stopOpacity="0.95" />
            <Stop offset="22%" stopColor={seed.coreColor} stopOpacity="0.85" />
            <Stop offset="48%" stopColor={seed.color} stopOpacity="0.9" />
            <Stop offset="78%" stopColor={seed.tipColor} stopOpacity="0.75" />
            <Stop offset="100%" stopColor={seed.tipColor} stopOpacity="0.15" />
          </LinearGradient>
        </Defs>
        {/* Outer volume */}
        <Ellipse
          cx={cx}
          cy={cy}
          rx={lobeW * 0.46}
          ry={lobeH * 0.48}
          fill={`url(#${gradId})`}
        />
        {/* Rising tip */}
        <Ellipse
          cx={cx}
          cy={lobeH * 0.28}
          rx={lobeW * 0.26}
          ry={lobeH * 0.34}
          fill={`url(#${gradId})`}
          opacity={0.85}
        />
        {/* White-hot base near the pill rim */}
        <Ellipse
          cx={cx}
          cy={lobeH * 0.78}
          rx={lobeW * 0.28}
          ry={lobeH * 0.2}
          fill={seed.coreColor}
          opacity={0.9}
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * Large stylised fire aura that sits BEHIND the white Runs! pill.
 * Lobes wrap the top + sides and feel like erupting energy, not stickers.
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
      const auraH = Math.min(maxFlameHeight + 8, Math.max(16, pillH * 0.85));
      return {
        auraW: width,
        auraH,
        left: 0,
        // Sit inside / along the bottom for contained widgets.
        bottom: 0,
        top: undefined as number | undefined,
      };
    }
    const auraH = Math.min(
      maxFlameHeight * 1.35,
      Math.max(pillH * RUNS_LAYOUT.auraHeightFactor, pillH * 1.3),
    );
    const side = width * RUNS_LAYOUT.auraSideSpill;
    return {
      auraW: width + side * 2,
      auraH,
      left: -side,
      // Anchor so bases tuck behind the top half of the pill.
      top: -(auraH - pillH * 0.55),
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
      ]}
      pointerEvents="none"
    >
      {seeds.map((seed) => (
        <FlameLobe
          key={seed.id}
          seed={seed}
          auraW={dims.auraW}
          auraH={dims.auraH}
          flameIntensity={flameIntensity}
          ignition={ignition}
          effectOpacity={effectOpacity}
          contained={contained}
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
  lobe: {
    position: "absolute",
    bottom: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  svg: {
    width: "100%",
    height: "100%",
  },
});
