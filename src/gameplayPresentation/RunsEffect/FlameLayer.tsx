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
import Svg, { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";
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
 * Aggressive stylised fire tongue (0–100 viewBox).
 * Tall tip, narrow mid, flared hot base — reads as game fire, not a blob.
 */
function flamePath(skew: number): string {
  const tipX = 50 + skew * 8;
  return [
    `M ${34 + skew} 98`,
    `C ${18 + skew * 2} 86, ${14 + skew} 70, ${20 + skew} 52`,
    `C ${26 + skew * 0.5} 36, ${34 + skew} 22, ${tipX} 2`,
    `C ${66 - skew} 22, ${74 - skew * 0.5} 36, ${80 - skew} 52`,
    `C ${86 - skew} 70, ${82 - skew * 2} 86, ${66 - skew} 98`,
    `C ${58} 100, ${42} 100, ${34 + skew} 98`,
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
            duration: seed.periodMs * 0.34,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.15, {
            duration: seed.periodMs * 0.66,
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

  const lobeW = Math.max(18, auraW * seed.widthFrac * 0.92);
  const lobeH = Math.max(28, auraH * seed.heightFrac * 1.08);
  const left = seed.x * auraW - lobeW / 2;
  const skew = (seed.id % 3) - 1;
  const outerD = useMemo(() => flamePath(skew), [skew]);
  const midD = useMemo(() => flamePath(skew * 0.6), [skew]);
  const coreD = useMemo(() => flamePath(skew * 0.35), [skew]);

  const style = useAnimatedStyle(() => {
    const intensity = flameIntensity.value;
    const burst = ignition.value;
    const scaleY =
      (contained ? 0.6 : 0.82) +
      flicker.value * 0.45 +
      burst * 0.4 +
      intensity * 0.08;
    const scaleX = 0.74 + (1 - flicker.value) * 0.3 + burst * 0.08;
    const dx = sway.value * seed.swayFrac * auraW * (0.7 + intensity * 0.35);
    const lift = contained
      ? -2 - burst * 4 - flicker.value * 3
      : -8 - burst * 14 - flicker.value * 8;
    const opacity =
      effectOpacity.value *
      intensity *
      (0.5 + flicker.value * 0.4 + burst * 0.25);

    return {
      opacity,
      transform: [
        { translateX: dx },
        { translateY: lift },
        { scaleY },
        { scaleX },
        { rotate: `${seed.rotDeg * (0.45 + flicker.value * 0.6)}deg` },
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
            <Stop offset="0%" stopColor={seed.coreColor} stopOpacity="0.85" />
            <Stop offset="22%" stopColor={seed.color} stopOpacity="1" />
            <Stop offset="55%" stopColor={seed.tipColor} stopOpacity="1" />
            <Stop offset="82%" stopColor="#E02000" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#C01000" stopOpacity="0.55" />
          </LinearGradient>
          <LinearGradient id={midGrad} x1="50%" y1="100%" x2="50%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="30%" stopColor={seed.coreColor} stopOpacity="1" />
            <Stop offset="70%" stopColor={seed.color} stopOpacity="0.95" />
            <Stop offset="100%" stopColor={seed.tipColor} stopOpacity="0.55" />
          </LinearGradient>
          <LinearGradient id={coreGrad} x1="50%" y1="100%" x2="50%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="55%" stopColor="#FFF4B0" stopOpacity="1" />
            <Stop offset="100%" stopColor={seed.coreColor} stopOpacity="0.35" />
          </LinearGradient>
        </Defs>
        {/* Crisp outer tongue with subtle edge stroke */}
        <Path
          d={outerD}
          fill={`url(#${outerGrad})`}
          stroke={seed.tipColor}
          strokeWidth={1.2}
          strokeOpacity={0.45}
        />
        <G transform="translate(14, 12) scale(0.72)">
          <Path d={midD} fill={`url(#${midGrad})`} />
        </G>
        <G transform="translate(28, 34) scale(0.44)">
          <Path d={coreD} fill={`url(#${coreGrad})`} />
        </G>
      </Svg>
    </Animated.View>
  );
}

/**
 * Large stylised fire aura BEHIND the white Runs! pill.
 * Pointed tongues wrap top + sides — crisp game-fire volumes.
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
      maxFlameHeight * 1.55,
      Math.max(pillH * RUNS_LAYOUT.auraHeightFactor, pillH * 1.4),
    );
    const side = width * RUNS_LAYOUT.auraSideSpill;
    return {
      auraW: width + side * 2,
      auraH,
      left: -side,
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
    // Soft bloom only — keep silhouette crisp (no heavy blur).
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  svg: {
    width: "100%",
    height: "100%",
  },
});
