import React, { useEffect, useMemo } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  View,
} from "react-native";
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
import { RUNS_LAYOUT, type FlameSeed } from "./constants";

const FIRE_BAND = require("../../../assets/effects/runs-fire-band.png");

const AnimatedImage = Animated.createAnimatedComponent(Image);

type Props = {
  width: number;
  height: number;
  flameIntensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  /** Kept for API compatibility with palette variants; unused for sprite fire. */
  seeds?: FlameSeed[];
  maxFlameHeight?: number;
  contained?: boolean;
};

function FireSpriteLayer({
  style,
  intensity,
  ignition,
  effectOpacity,
  delayMs,
  periodMs,
  swayMs,
  baseOpacity,
  baseScale,
}: {
  style: object;
  intensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  delayMs: number;
  periodMs: number;
  swayMs: number;
  baseOpacity: number;
  baseScale: number;
}) {
  const flicker = useSharedValue(0);
  const sway = useSharedValue(0);

  useEffect(() => {
    flicker.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: periodMs * 0.4,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.2, {
            duration: periodMs * 0.6,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
    sway.value = withDelay(
      delayMs * 0.5,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: swayMs * 0.5,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-1, {
            duration: swayMs * 0.5,
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
  }, [flicker, sway, delayMs, periodMs, swayMs]);

  const animStyle = useAnimatedStyle(() => {
    const burst = ignition.value;
    const i = intensity.value;
    const scaleY =
      baseScale * (0.9 + flicker.value * 0.14 + burst * 0.18 + i * 0.04);
    const scaleX = 0.98 + (1 - flicker.value) * 0.04;
    const opacity =
      effectOpacity.value *
      i *
      baseOpacity *
      (0.72 + flicker.value * 0.28 + burst * 0.15);
    return {
      opacity,
      transform: [
        { translateX: sway.value * 1.5 },
        { scaleY },
        { scaleX },
      ],
    };
  });

  return (
    <AnimatedImage
      source={FIRE_BAND}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={[style, animStyle] as any}
      resizeMode="stretch"
      pointerEvents="none"
    />
  );
}

/**
 * Realistic fire sprite centered on the pill.
 * Hot base tucks behind the top rim; tips rise ~half the pill height.
 */
export default function FlameLayer({
  width,
  height,
  flameIntensity,
  ignition,
  effectOpacity,
  maxFlameHeight = RUNS_LAYOUT.maxFlameHeight,
  contained = false,
}: Props) {
  const dims = useMemo(() => {
    if (width <= 0) return null;
    const pillH = Math.max(height, 22);
    const rise = contained
      ? Math.min(maxFlameHeight, pillH * 0.45)
      : Math.min(maxFlameHeight, pillH * RUNS_LAYOUT.auraHeightFactor);
    // Tuck a bit of the hot base behind the pill so fire reads as erupting from it.
    const tuck = pillH * 0.42;
    const side = contained ? 0 : width * RUNS_LAYOUT.auraSideSpill;
    return {
      auraW: width + side * 2,
      auraH: rise + tuck,
      left: -side,
      top: -rise,
    };
  }, [width, height, maxFlameHeight, contained]);

  if (!dims) return null;

  const imgStyle = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: dims.auraW,
    height: dims.auraH,
  };

  return (
    <View
      style={[
        styles.field,
        {
          width: dims.auraW,
          height: dims.auraH,
          left: dims.left,
          top: dims.top,
        },
        Platform.OS === "web"
          ? ({
              // Soften sprite edges slightly without turning it into a glow bar.
              filter: "drop-shadow(0 0 4px rgba(255,120,20,0.35))",
            } as object)
          : null,
      ]}
      pointerEvents="none"
    >
      {/* Soft under-glow copy */}
      <FireSpriteLayer
        style={[imgStyle, styles.glowCopy]}
        intensity={flameIntensity}
        ignition={ignition}
        effectOpacity={effectOpacity}
        delayMs={40}
        periodMs={1200}
        swayMs={1800}
        baseOpacity={0.45}
        baseScale={1.06}
      />
      {/* Main fire */}
      <FireSpriteLayer
        style={imgStyle}
        intensity={flameIntensity}
        ignition={ignition}
        effectOpacity={effectOpacity}
        delayMs={0}
        periodMs={980}
        swayMs={1500}
        baseOpacity={1}
        baseScale={1}
      />
      {/* Secondary flicker layer for living depth */}
      <FireSpriteLayer
        style={imgStyle}
        intensity={flameIntensity}
        ignition={ignition}
        effectOpacity={effectOpacity}
        delayMs={160}
        periodMs={860}
        swayMs={1300}
        baseOpacity={0.55}
        baseScale={0.96}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: "absolute",
    overflow: "visible",
  },
  glowCopy: {
    opacity: 0.5,
  },
});
