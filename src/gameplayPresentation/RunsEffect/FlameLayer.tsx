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
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { RUNS_COLORS, RUNS_LAYOUT, type FlameSeed } from "./constants";

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
 * One continuous fire crown wrapping the pill top (viewBox 0 0 240 100).
 * Jagged peaks read as erupting energy — not a row of stickers.
 */
const FIRE_CROWN = [
  "M 4 92",
  "C 10 78, 14 62, 8 48",
  "C 12 34, 22 22, 18 8",
  "C 28 16, 34 28, 40 42",
  "C 44 28, 52 12, 48 2",
  "C 58 10, 64 24, 70 38",
  "C 76 22, 86 8, 82 0",
  "C 94 8, 100 22, 108 36",
  "C 114 20, 126 6, 120 0",
  "C 132 8, 140 22, 148 38",
  "C 156 24, 168 10, 162 2",
  "C 174 12, 180 26, 188 40",
  "C 196 26, 208 12, 202 4",
  "C 214 14, 222 30, 228 46",
  "C 234 60, 232 76, 236 92",
  "C 200 100, 40 100, 4 92",
  "Z",
].join(" ");

const FIRE_CROWN_MID = [
  "M 18 94",
  "C 24 80, 28 66, 22 52",
  "C 28 40, 36 28, 32 14",
  "C 42 22, 48 34, 54 48",
  "C 60 34, 70 18, 64 8",
  "C 76 16, 84 30, 92 44",
  "C 100 28, 112 14, 106 6",
  "C 118 14, 126 28, 134 44",
  "C 142 30, 154 16, 148 8",
  "C 160 18, 168 32, 176 46",
  "C 184 32, 196 18, 190 10",
  "C 202 20, 210 36, 216 52",
  "C 222 66, 220 80, 222 94",
  "C 170 100, 70 100, 18 94",
  "Z",
].join(" ");

const FIRE_CORE = [
  "M 40 96",
  "C 50 84, 58 70, 52 56",
  "C 60 46, 72 36, 68 24",
  "C 78 32, 88 44, 96 56",
  "C 106 42, 120 30, 114 20",
  "C 126 30, 138 44, 146 58",
  "C 156 46, 168 34, 162 24",
  "C 174 36, 184 50, 190 64",
  "C 198 76, 196 88, 200 96",
  "C 150 100, 90 100, 40 96",
  "Z",
].join(" ");

function CrownLayer({
  path,
  gradId,
  stops,
  intensity,
  ignition,
  effectOpacity,
  delayMs,
  periodMs,
  swayMs,
  baseScale,
  rotDeg,
  contained,
}: {
  path: string;
  gradId: string;
  stops: { offset: string; color: string; opacity: string }[];
  intensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  delayMs: number;
  periodMs: number;
  swayMs: number;
  baseScale: number;
  rotDeg: number;
  contained: boolean;
}) {
  const flicker = useSharedValue(0);
  const sway = useSharedValue(0);

  useEffect(() => {
    flicker.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: periodMs * 0.35,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.2, {
            duration: periodMs * 0.65,
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

  const style = useAnimatedStyle(() => {
    const burst = ignition.value;
    const i = intensity.value;
    const scaleY =
      baseScale * (0.82 + flicker.value * 0.28 + burst * 0.35 + i * 0.08);
    const scaleX = 0.94 + (1 - flicker.value) * 0.08 + burst * 0.04;
    const dx = sway.value * (contained ? 2 : 5);
    const lift = contained
      ? -1 - burst * 3
      : -4 - burst * 10 - flicker.value * 5;
    const opacity =
      effectOpacity.value * i * (0.45 + flicker.value * 0.4 + burst * 0.25);

    return {
      opacity,
      transform: [
        { translateX: dx },
        { translateY: lift },
        { scaleY },
        { scaleX },
        { rotate: `${rotDeg * (0.4 + flicker.value * 0.6)}deg` },
      ],
    } as ViewStyle;
  });

  return (
    <Animated.View style={[styles.crown, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 240 100" style={styles.svg}>
        <Defs>
          <LinearGradient id={gradId} x1="50%" y1="100%" x2="50%" y2="0%">
            {stops.map((s) => (
              <Stop
                key={s.offset}
                offset={s.offset}
                stopColor={s.color}
                stopOpacity={s.opacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Path d={path} fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Continuous behind-pill fire crown — one erupting energy mass.
 * Layered crown paths flicker independently so it never reads as stickers.
 */
export default function FlameLayer({
  width,
  height,
  flameIntensity,
  ignition,
  effectOpacity,
  seeds: _seeds,
  maxFlameHeight = RUNS_LAYOUT.maxFlameHeight,
  contained = false,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const dims = useMemo(() => {
    if (width <= 0) return null;
    const pillH = Math.max(height, 22);
    if (contained) {
      const auraH = Math.min(maxFlameHeight + 8, Math.max(18, pillH * 0.9));
      return {
        auraW: width * 1.06,
        auraH,
        left: -width * 0.03,
        bottom: 0,
        top: undefined as number | undefined,
      };
    }
    const auraH = Math.min(
      maxFlameHeight * 1.65,
      Math.max(pillH * RUNS_LAYOUT.auraHeightFactor, pillH * 1.5),
    );
    const side = width * RUNS_LAYOUT.auraSideSpill;
    return {
      auraW: width + side * 2,
      auraH,
      left: -side,
      // Crown bases tuck behind the upper half of the white pill.
      top: -(auraH - pillH * 0.5),
      bottom: undefined as number | undefined,
    };
  }, [width, height, maxFlameHeight, contained]);

  if (!dims) return null;

  const palette = RUNS_COLORS;

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
      {/* Deep orange outer crown */}
      <CrownLayer
        path={FIRE_CROWN}
        gradId={`crownOuter-${uid}`}
        stops={[
          { offset: "0%", color: palette.whiteHot, opacity: "0.9" },
          { offset: "22%", color: palette.flameA, opacity: "1" },
          { offset: "55%", color: palette.edge, opacity: "1" },
          { offset: "82%", color: "#C01000", opacity: "0.95" },
          { offset: "100%", color: "#8A0000", opacity: "0.5" },
        ]}
        intensity={flameIntensity}
        ignition={ignition}
        effectOpacity={effectOpacity}
        delayMs={0}
        periodMs={980}
        swayMs={1500}
        baseScale={1}
        rotDeg={0}
        contained={contained}
      />
      {/* Mid yellow crown — independent flicker */}
      <CrownLayer
        path={FIRE_CROWN_MID}
        gradId={`crownMid-${uid}`}
        stops={[
          { offset: "0%", color: "#FFFFFF", opacity: "1" },
          { offset: "30%", color: palette.hot, opacity: "1" },
          { offset: "70%", color: palette.core, opacity: "0.95" },
          { offset: "100%", color: palette.edge, opacity: "0.55" },
        ]}
        intensity={flameIntensity}
        ignition={ignition}
        effectOpacity={effectOpacity}
        delayMs={80}
        periodMs={1120}
        swayMs={1680}
        baseScale={0.92}
        rotDeg={-1.5}
        contained={contained}
      />
      {/* White-hot core near the pill rim */}
      <CrownLayer
        path={FIRE_CORE}
        gradId={`crownCore-${uid}`}
        stops={[
          { offset: "0%", color: "#FFFFFF", opacity: "1" },
          { offset: "40%", color: palette.whiteHot, opacity: "1" },
          { offset: "100%", color: palette.hot, opacity: "0.45" },
        ]}
        intensity={flameIntensity}
        ignition={ignition}
        effectOpacity={effectOpacity}
        delayMs={140}
        periodMs={860}
        swayMs={1320}
        baseScale={0.78}
        rotDeg={1.2}
        contained={contained}
      />
      {/* Slightly offset outer copy for living depth */}
      {!contained ? (
        <CrownLayer
          path={FIRE_CROWN}
          gradId={`crownEcho-${uid}`}
          stops={[
            { offset: "0%", color: palette.hot, opacity: "0.35" },
            { offset: "40%", color: palette.edge, opacity: "0.55" },
            { offset: "100%", color: "#8A0000", opacity: "0.2" },
          ]}
          intensity={flameIntensity}
          ignition={ignition}
          effectOpacity={effectOpacity}
          delayMs={200}
          periodMs={1280}
          swayMs={1900}
          baseScale={1.08}
          rotDeg={2}
          contained={contained}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: "absolute",
    overflow: "visible",
  },
  crown: {
    ...StyleSheet.absoluteFillObject,
    shadowColor: "#FF6A00",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  svg: {
    width: "100%",
    height: "100%",
  },
});
