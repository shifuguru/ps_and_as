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
import {
  RUNS_COLORS,
  RUNS_LAYOUT,
  RUNS_TIMING,
  type RunsPalette,
} from "./constants";

export type EmberSpread = "top" | "around";

type Ember = {
  id: number;
  x: number;
  y: number;
  size: number;
  dx: number;
  dy: number;
  duration: number;
};

type Props = {
  width: number;
  height?: number;
  ignition: SharedValue<number>;
  flameIntensity: SharedValue<number>;
  effectOpacity: SharedValue<number>;
  active: boolean;
  palette?: RunsPalette;
  /**
   * `top` — rise from the flame aura (Runs!).
   * `around` — tiny sparkles inside + outside all sides.
   */
  spread?: EmberSpread;
};

function EmberParticle({
  ember,
  effectOpacity,
  emberColor,
  onDone,
}: {
  ember: Ember;
  effectOpacity: SharedValue<number>;
  emberColor: string;
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
    // Fade in quickly, hold, then fade out — avoids a stiff linear loop feel.
    const opacity =
      effectOpacity.value *
      (t < 0.1 ? t / 0.1 : t > 0.65 ? (1 - t) / 0.35 : 1);

    return {
      opacity: Math.max(0, opacity),
      transform: [
        { translateX: ember.dx * t },
        { translateY: ember.dy * t },
        { scale: 1.05 - t * 0.55 },
      ],
    } as ViewStyle;
  });

  return (
    <Animated.View
      style={[
        styles.ember,
        {
          left: ember.x,
          top: ember.y,
          width: ember.size,
          height: ember.size,
          borderRadius: ember.size / 2,
          backgroundColor: emberColor,
          shadowColor: emberColor,
        },
        style,
      ]}
    />
  );
}

function spawnAroundEmber(width: number, height: number, id: number): Ember {
  const [minLife, maxLife] = RUNS_TIMING.emberLifetimeMs;
  const duration = minLife * 0.7 + Math.random() * (maxLife - minLife * 0.5);
  const size = 1.4 + Math.random() * 2.6;
  const pad = 10;
  const roll = Math.random();

  if (roll < 0.35) {
    const x = width * (0.12 + Math.random() * 0.76);
    const y = height * (0.2 + Math.random() * 0.6);
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 18;
    return {
      id,
      x,
      y,
      size,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      duration,
    };
  }

  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  let dx = 0;
  let dy = 0;
  const outward = 12 + Math.random() * 16;
  const tangential = (Math.random() - 0.5) * 14;

  if (edge === 0) {
    x = width * Math.random();
    y = -pad * Math.random();
    dx = tangential;
    dy = -outward * (0.55 + Math.random() * 0.45);
  } else if (edge === 1) {
    x = width + pad * Math.random();
    y = height * Math.random();
    dx = outward * (0.55 + Math.random() * 0.45);
    dy = tangential;
  } else if (edge === 2) {
    x = width * Math.random();
    y = height + pad * Math.random();
    dx = tangential;
    dy = outward * (0.55 + Math.random() * 0.45);
  } else {
    x = -pad * Math.random();
    y = height * Math.random();
    dx = -outward * (0.55 + Math.random() * 0.45);
    dy = tangential;
  }

  return { id, x, y, size, dx, dy, duration };
}

function spawnTopEmber(width: number, height: number, id: number): Ember {
  const [minLife, maxLife] = RUNS_TIMING.emberLifetimeMs;
  const duration = minLife + Math.random() * (maxLife - minLife);
  const size = 1.4 + Math.random() * 2.6;
  // Spawn along the short flame band above the pill (not far afield).
  return {
    id,
    x: width * (0.08 + Math.random() * 0.84),
    y: -Math.max(4, height * 0.25) - Math.random() * Math.max(6, height * 0.2),
    size,
    dx: (Math.random() - 0.5) * 12,
    dy: -(14 + Math.random() * 16),
    duration,
  };
}

/**
 * Floating embers rising from the fire aura.
 */
export default function EmberLayer({
  width,
  height = 28,
  ignition,
  flameIntensity,
  effectOpacity,
  active,
  palette = RUNS_COLORS,
  spread = "top",
}: Props) {
  const [embers, setEmbers] = useState<Ember[]>([]);
  const nextId = useRef(0);
  const ignitionRef = useRef(0);
  const intensityRef = useRef(0);
  const maxEmbers =
    spread === "around" ? RUNS_LAYOUT.maxEmbers + 2 : RUNS_LAYOUT.maxEmbers;

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
      if (prev.length >= maxEmbers) return prev;
      const id = nextId.current++;
      const ember =
        spread === "around"
          ? spawnAroundEmber(width, Math.max(18, height), id)
          : spawnTopEmber(width, Math.max(18, height), id);
      return [...prev, ember];
    });
  }, [width, height, spread, maxEmbers]);

  useEffect(() => {
    if (!active) {
      setEmbers([]);
      return;
    }

    const burstMs =
      spread === "around"
        ? [30, 90, 160, 240, 340, 480]
        : [20, 55, 100, 160, 240, 340, 460, 600];
    const burstTimers = burstMs.map((ms) => setTimeout(() => spawn(), ms));

    const idleMs =
      spread === "around"
        ? RUNS_TIMING.emberSpawnIdleMs * 0.85
        : RUNS_TIMING.emberSpawnIdleMs;
    const idle = setInterval(() => {
      const chance =
        spread === "around"
          ? ignitionRef.current > 0.2
            ? 0.9
            : 0.7
          : ignitionRef.current > 0.2
            ? 0.98
            : 0.85;
      if (Math.random() < chance && intensityRef.current > 0.12) spawn();
      // Occasional double-spawn so cadence never feels metronomic.
      if (Math.random() < 0.28 && intensityRef.current > 0.4) spawn();
    }, idleMs);

    return () => {
      burstTimers.forEach(clearTimeout);
      clearInterval(idle);
    };
  }, [active, spawn, spread]);

  if (width <= 0) return null;

  const layerStyle =
    spread === "around"
      ? [
          styles.aroundLayer,
          {
            left: -18,
            right: -18,
            top: -18,
            bottom: -18,
          },
        ]
      : styles.topLayer;

  return (
    <View style={layerStyle} pointerEvents="none">
      {embers.map((ember) => (
        <EmberParticle
          key={ember.id}
          ember={
            spread === "around"
              ? { ...ember, x: ember.x + 18, y: ember.y + 18 }
              : ember
          }
          effectOpacity={effectOpacity}
          emberColor={palette.ember}
          onDone={removeEmber}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  topLayer: {
    position: "absolute",
    left: -4,
    right: -4,
    top: -22,
    height: 40,
    overflow: "visible",
  },
  aroundLayer: {
    position: "absolute",
    overflow: "visible",
  },
  ember: {
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 3,
  },
});
