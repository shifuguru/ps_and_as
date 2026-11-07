import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";

const COLORS = ["#ff5d8f", "#ffc44d", "#4dd6a4", "#4db8ff", "#a37bff", "#ff8a4d"];
const BUBBLE_COUNT = 22;
const SWAY_STEPS = 16;

type Bubble = {
  x: number;
  size: number;
  color: string;
  phase: number;
  duration: number;
  sway: number;
  swayCycles: number;
};

/** iOS 7–style translucent bubbles rising endlessly; sits under the backdrop blur. */
export default function RoundEndCelebration({ active }: { active: boolean }) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(
    Array.from({ length: BUBBLE_COUNT }, () => new Animated.Value(0)),
  ).current;

  const bubbles = useMemo<Bubble[]>(
    () =>
      Array.from({ length: BUBBLE_COUNT }, (_, i) => ({
        x: Math.random() * width,
        size: 36 + Math.random() * 90,
        color: COLORS[i % COLORS.length],
        phase: Math.random(),
        duration: 9000 + Math.random() * 9000,
        sway: 14 + Math.random() * 30,
        swayCycles: 1 + Math.floor(Math.random() * 3),
      })),
    [active, width],
  );

  useEffect(() => {
    if (!active) return;
    const running: Animated.CompositeAnimation[] = [];
    let stopped = false;
    bubbles.forEach((b, i) => {
      const v = progress[i];
      v.setValue(b.phase);
      // Finish the partial first pass, then loop forever so the bubbles never run out.
      const first = Animated.timing(v, {
        toValue: 1,
        duration: b.duration * (1 - b.phase),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      running.push(first);
      first.start(({ finished }) => {
        if (!finished || stopped) return;
        v.setValue(0);
        const loop = Animated.loop(
          Animated.timing(v, {
            toValue: 1,
            duration: b.duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        );
        running.push(loop);
        loop.start();
      });
    });
    return () => {
      stopped = true;
      running.forEach((a) => a.stop());
    };
  }, [active, bubbles, progress]);

  if (!active) return null;

  const swayInput = Array.from({ length: SWAY_STEPS + 1 }, (_, k) => k / SWAY_STEPS);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bubbles.map((b, i) => {
        const v = progress[i];
        const swayOut = swayInput.map(
          (t) => Math.sin(t * Math.PI * 2 * b.swayCycles) * b.sway,
        );
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: b.x - b.size / 2,
              top: height,
              width: b.size,
              height: b.size,
              borderRadius: b.size / 2,
              backgroundColor: `${b.color}33`,
              borderWidth: 1.5,
              borderColor: `${b.color}99`,
              opacity: v.interpolate({
                inputRange: [0, 0.08, 0.9, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [b.size, -(height + b.size * 2)],
                  }),
                },
                { translateX: v.interpolate({ inputRange: swayInput, outputRange: swayOut }) },
              ],
            }}
          >
            <View
              style={{
                position: "absolute",
                top: b.size * 0.14,
                left: b.size * 0.2,
                width: b.size * 0.3,
                height: b.size * 0.16,
                borderRadius: b.size,
                backgroundColor: "rgba(255,255,255,0.55)",
                transform: [{ rotate: "-30deg" }],
              }}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}
