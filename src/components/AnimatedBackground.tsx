import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

const COLORS = [
  "rgba(8, 12, 10, 1)",
  "rgba(12, 20, 16, 1)",
  "rgba(6, 14, 10, 1)",
];

export default function AnimatedBackground() {
  const pan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pan, {
          toValue: 1,
          duration: 18000,
          useNativeDriver: false,
        }),
        Animated.timing(pan, {
          toValue: 0,
          duration: 18000,
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [pan]);

  const bg1 = pan.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [COLORS[0], COLORS[1], COLORS[2]],
  });

  const translateY = pan.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base dark layer */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#060e0a" }]} />

      {/* Slow-moving gradient overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: bg1, transform: [{ translateY }] },
        ]}
      />

      {/* Radial-ish accent glow (top-center) */}
      <View style={styles.glowTop} />

      {/* Bottom vignette */}
      <View style={styles.vignetteBottom} />

      {/* Overall darkening scrim */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(0,0,0,0.30)" },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glowTop: {
    position: "absolute",
    top: -120,
    left: "20%",
    width: "60%",
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(212,175,55,0.04)",
  },
  vignetteBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
});
