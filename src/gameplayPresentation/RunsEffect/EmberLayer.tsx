import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  cancelAnimation,
  type SharedValue,
} from "react-native-reanimated";
import { RUNS_COLORS, RUNS_LAYOUT, RUNS_TIMING } from "./constants";

type Ember = {
  id: number;
  x: number;
  size: number;
  driftX: number;
  rise: number;
  duration: number;
  delay: number;
};

type Props = {
  width: number;
  /** Higher during ignition → more spawn; idle uses sparse cadence. */
  ignition: SharedValue<number>;
  flameIntensity: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  active: boolean;
};

function EmberParticle({
  ember,
  effectOpacity,
  onDone,
}: {
  ember: Ember;
  effectOpacity: SharedValue<number>;
  onDone: (id: number) => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(
      1,
      {
        duration: ember.duration,
        easing: Easing.out(Easing.quad),
      },
      (finished) => {
        if (finished) runOnJS(onDone)(ember.id);
      },
    );
    return () => cancelAnimation(progress);
  }, [ember.duration, ember.id, onDone, progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const y = -ember.rise * t;
    const x = ember.driftX * Math.sin(t * Math.PI);
    const opacity =
      effectOpacity.value * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);

    return {
      opacity: Math.max(0, opacity),
      transform: [{ translateX: x }, { translateY: y }, { scale: 1 - t * 0.35 }],
    } as ViewStyle;
  });

  return (
    <Animated.View
      style={[
        styles.ember,
        {
          left: ember.x,
          width: ember.size,
          height: ember.size,
          borderRadius: ember.size / 2,
        },
        style,
      ]}
    />
  );
}

/**
 * Tiny glowing particles drifting up from the pill top.
 * Cap concurrent count; spawn via lightweight interval (motion is Reanimated).
 */
export default function EmberLayer({
  width,
  ignition,
  flameIntensity,
  effectOpacity,
  active,
}: Props) {
  const [embers, setEmbers] = useState<Ember[]>([]);
  const nextId = useRef(0);
  const ignitionRef = useRef(0);
  const intensityRef = useRef(0);

  // Mirror shared values for spawn decisions (spawn is rare; UI-thread motion elsewhere).
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      ignitionRef.current = ignition.value;
      intensityRef.current = flameIntensity.value;
    }, 80);
    return () => clearInterval(id);
  }, [active, ignition, flameIntensity]);

  const removeEmber = useCallback((id: number) => {
    setEmbers((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const spawn = useCallback(() => {
    if (width <= 0) return;
    setEmbers((prev) => {
      if (prev.length >= RUNS_LAYOUT.maxEmbers) return prev;
      const id = nextId.current++;
      const [minLife, maxLife] = RUNS_TIMING.emberLifetimeMs;
      const duration = minLife + Math.random() * (maxLife - minLife);
      const ember: Ember = {
        id,
        x: width * (0.15 + Math.random() * 0.7),
        size: 2 + Math.random() * 2.2,
        driftX: (Math.random() - 0.5) * 14,
        rise: 18 + Math.random() * 16,
        duration,
        delay: 0,
      };
      return [...prev, ember];
    });
  }, [width]);

  useEffect(() => {
    if (!active) {
      setEmbers([]);
      return;
    }

    // Ignition burst: a few quick embers
    const burstTimers = [40, 120, 220, 360].map((ms) =>
      setTimeout(() => spawn(), ms),
    );

    // Idle sparse spawn
    const idle = setInterval(() => {
      const chance = ignitionRef.current > 0.2 ? 0.85 : 0.55;
      if (Math.random() < chance && intensityRef.current > 0.15) spawn();
    }, RUNS_TIMING.emberSpawnIdleMs);

    return () => {
      burstTimers.forEach(clearTimeout);
      clearInterval(idle);
    };
  }, [active, spawn]);

  if (width <= 0) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      {embers.map((ember) => (
        <EmberParticle
          key={ember.id}
          ember={ember}
          effectOpacity={effectOpacity}
          onDone={removeEmber}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -4,
    height: 40,
    overflow: "visible",
  },
  ember: {
    position: "absolute",
    bottom: 0,
    backgroundColor: RUNS_COLORS.ember,
    shadowColor: RUNS_COLORS.core,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 3,
  },
});
