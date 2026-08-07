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
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
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
 * Irregular pointed fire tongues (0–100). Variants avoid cloned stickers.
 * Tall tip, notched sides, flared white-hot base.
 */
function flamePath(variant: number, skew: number): string {
  const tipX = 50 + skew * 10;
  if (variant === 1) {
    return [
      `M ${32 + skew} 100`,
      `C ${12 + skew * 2} 88, ${8 + skew} 72, ${16 + skew} 54`,
      `C ${22} 40, ${18 + skew} 28, ${30 + skew * 0.5} 16`,
      `C ${38} 8, ${44 + skew} 4, ${tipX} 0`,
      `C ${58 - skew} 5, ${68} 12, ${74 - skew * 0.5} 22`,
      `C ${86 - skew} 36, ${90 - skew} 52, ${84 - skew} 68`,
      `C ${92 - skew * 2} 78, ${86 - skew} 90, ${68 - skew} 100`,
      `C ${56} 102, ${42} 102, ${32 + skew} 100`,
      "Z",
    ].join(" ");
  }
  if (variant === 2) {
    return [
      `M ${36 + skew} 98`,
      `C ${20 + skew} 90, ${10 + skew * 2} 74, ${18 + skew} 56`,
      `C ${26} 42, ${34 + skew} 30, ${28 + skew} 18`,
      `C ${36} 8, ${46 + skew} 2, ${tipX} 1`,
      `C ${60 - skew} 3, ${70} 10, ${76 - skew} 20`,
      `C ${72 - skew} 32, ${82 - skew} 44, ${86 - skew} 58`,
      `C ${94 - skew} 72, ${88 - skew * 2} 88, ${70 - skew} 98`,
      `C ${58} 101, ${44} 101, ${36 + skew} 98`,
      "Z",
    ].join(" ");
  }
  // variant 0 — default aggressive lick
  return [
    `M ${30 + skew} 100`,
    `C ${14 + skew * 2} 86, ${10 + skew} 68, ${18 + skew} 50`,
    `C ${24} 36, ${32 + skew} 24, ${26 + skew * 0.5} 12`,
    `C ${34} 4, ${42 + skew} 0, ${tipX} 0`,
    `C ${62 - skew} 2, ${72} 8, ${78 - skew * 0.5} 18`,
    `C ${86 - skew} 32, ${92 - skew} 48, ${86 - skew} 64`,
    `C ${94 - skew * 2} 76, ${88 - skew} 90, ${70 - skew} 100`,
    `C ${56} 103, ${40} 103, ${30 + skew} 100`,
    "Z",
  ].join(" ");
}

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
  const outerGrad = `runsFlameOuter-${uid}-${seed.id}`;
  const midGrad = `runsFlameMid-${uid}-${seed.id}`;
  const coreGrad = `runsFlameCore-${uid}-${seed.id}`;

  useEffect(() => {
    flicker.value = withDelay(
      seed.delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: seed.periodMs * 0.32,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.12, {
            duration: seed.periodMs * 0.68,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
    sway.value = withDelay(
      seed.delayMs * 0.55,
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

  const lobeW = Math.max(16, auraW * seed.widthFrac);
  const lobeH = Math.max(30, auraH * seed.heightFrac);
  const left = seed.x * auraW - lobeW / 2;
  const skew = (seed.id % 3) - 1;
  const outerD = useMemo(
    () => flamePath(seed.pathVariant, skew),
    [seed.pathVariant, skew],
  );
  const midD = useMemo(
    () => flamePath(seed.pathVariant, skew * 0.5),
    [seed.pathVariant, skew],
  );
  const coreD = useMemo(
    () => flamePath((seed.pathVariant + 1) % 3, skew * 0.25),
    [seed.pathVariant, skew],
  );

  const style = useAnimatedStyle(() => {
    const intensity = flameIntensity.value;
    const burst = ignition.value;
    const scaleY =
      (contained ? 0.58 : 0.8) +
      flicker.value * 0.5 +
      burst * 0.42 +
      intensity * 0.08;
    const scaleX = 0.7 + (1 - flicker.value) * 0.34 + burst * 0.1;
    const dx = sway.value * seed.swayFrac * auraW * (0.75 + intensity * 0.3);
    const lift = contained
      ? -2 - burst * 4 - flicker.value * 3
      : -10 - burst * 16 - flicker.value * 9;
    const opacity =
      effectOpacity.value *
      intensity *
      (0.48 + flicker.value * 0.42 + burst * 0.28);

    return {
      opacity,
      transform: [
        { translateX: dx },
        { translateY: lift },
        { scaleY },
        { scaleX },
        { rotate: `${seed.rotDeg * (0.4 + flicker.value * 0.65)}deg` },
      ],
    } as ViewStyle;
  });

  return (
    <Animated.View
      style={[
        styles.lobe,
        {
          left,
          width: lobeW,
          height: lobeH,
          shadowColor: seed.tipColor,
        },
        style,
      ]}
    >
      <Svg width={lobeW} height={lobeH} viewBox="0 0 100 100" style={styles.svg}>
        <Defs>
          <LinearGradient id={outerGrad} x1="50%" y1="100%" x2="50%" y2="0%">
            <Stop offset="0%" stopColor={seed.coreColor} stopOpacity="1" />
            <Stop offset="18%" stopColor={seed.color} stopOpacity="1" />
            <Stop offset="48%" stopColor={seed.tipColor} stopOpacity="1" />
            <Stop offset="78%" stopColor="#D01800" stopOpacity="0.98" />
            <Stop offset="100%" stopColor="#A00800" stopOpacity="0.65" />
          </LinearGradient>
          <LinearGradient id={midGrad} x1="50%" y1="100%" x2="50%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="28%" stopColor={seed.coreColor} stopOpacity="1" />
            <Stop offset="65%" stopColor={seed.color} stopOpacity="0.98" />
            <Stop offset="100%" stopColor={seed.tipColor} stopOpacity="0.6" />
          </LinearGradient>
          <LinearGradient id={coreGrad} x1="50%" y1="100%" x2="50%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="50%" stopColor="#FFF6C8" stopOpacity="1" />
            <Stop offset="100%" stopColor={seed.coreColor} stopOpacity="0.4" />
          </LinearGradient>
        </Defs>
        <Path d={outerD} fill={`url(#${outerGrad})`} />
        <G transform="translate(15, 14) scale(0.7)">
          <Path d={midD} fill={`url(#${midGrad})`} />
        </G>
        <G transform="translate(30, 38) scale(0.4)">
          <Path d={coreD} fill={`url(#${coreGrad})`} />
        </G>
      </Svg>
    </Animated.View>
  );
}

function FuelRibbon({
  auraW,
  auraH,
  flameIntensity,
  ignition,
  effectOpacity,
  contained,
  whiteHot,
  hot,
  core,
}: {
  auraW: number;
  auraH: number;
  flameIntensity: SharedValue<number>;
  ignition: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  contained: boolean;
  whiteHot: string;
  hot: string;
  core: string;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const style = useAnimatedStyle(() => {
    const intensity = flameIntensity.value;
    const burst = ignition.value;
    return {
      opacity:
        effectOpacity.value * intensity * (0.55 + pulse.value * 0.35 + burst * 0.25),
      transform: [
        { scaleY: 0.85 + pulse.value * 0.35 + burst * 0.4 },
        { scaleX: 0.96 + pulse.value * 0.04 },
      ],
    } as ViewStyle;
  });

  if (contained) return null;
  const ribbonH = Math.max(14, auraH * 0.28);

  return (
    <Animated.View
      style={[
        styles.ribbon,
        {
          width: auraW * 0.96,
          height: ribbonH,
          left: auraW * 0.02,
          bottom: auraH * 0.08,
          shadowColor: core,
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 200 40">
        <Defs>
          <LinearGradient id="fuelRibbon" x1="0%" y1="50%" x2="100%" y2="50%">
            <Stop offset="0%" stopColor={core} stopOpacity="0.15" />
            <Stop offset="18%" stopColor={hot} stopOpacity="0.85" />
            <Stop offset="50%" stopColor={whiteHot} stopOpacity="1" />
            <Stop offset="82%" stopColor={hot} stopOpacity="0.85" />
            <Stop offset="100%" stopColor={core} stopOpacity="0.15" />
          </LinearGradient>
        </Defs>
        <Ellipse cx="100" cy="28" rx="92" ry="14" fill="url(#fuelRibbon)" />
        <Ellipse cx="100" cy="24" rx="70" ry="9" fill={whiteHot} opacity={0.85} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Continuous behind-pill fire aura: shared fuel ribbon + overlapping tongues.
 * Reads as one erupting energy mass — not a row of stickers.
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
        bottom: 0,
        top: undefined as number | undefined,
      };
    }
    const auraH = Math.min(
      maxFlameHeight * 1.6,
      Math.max(pillH * RUNS_LAYOUT.auraHeightFactor, pillH * 1.45),
    );
    const side = width * RUNS_LAYOUT.auraSideSpill;
    return {
      auraW: width + side * 2,
      auraH,
      left: -side,
      top: -(auraH - pillH * 0.52),
      bottom: undefined as number | undefined,
    };
  }, [width, height, maxFlameHeight, contained]);

  const ribbonColors = useMemo(() => {
    const first = seeds[0];
    return {
      whiteHot: first?.coreColor ?? "#FFF8E0",
      hot: first?.color ?? "#FFE566",
      core: first?.tipColor ?? "#FF3B00",
    };
  }, [seeds]);

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
      <FuelRibbon
        auraW={dims.auraW}
        auraH={dims.auraH}
        flameIntensity={flameIntensity}
        ignition={ignition}
        effectOpacity={effectOpacity}
        contained={contained}
        whiteHot={ribbonColors.whiteHot}
        hot={ribbonColors.hot}
        core={ribbonColors.core}
      />
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
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  ribbon: {
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  svg: {
    width: "100%",
    height: "100%",
  },
});
