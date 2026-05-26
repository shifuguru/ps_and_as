import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

const COLORS = [
  "rgba(6, 8, 12, 1)",
  "rgba(10, 14, 20, 1)",
  "rgba(4, 6, 10, 1)",
];

export default function AnimatedBackground() {
  const pan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pan, { toValue: 1, duration: 20000, useNativeDriver: false }),
        Animated.timing(pan, { toValue: 0, duration: 20000, useNativeDriver: false }),
      ]),
    ).start();
  }, [pan]);

  const bg = pan.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: COLORS,
  });

  const translateY = pan.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: bg, transform: [{ translateY }] },
        ]}
      />
      {/* Subtle top ambient light */}
      <View style={styles.topGlow} />
      {/* Bottom vignette */}
      <View style={styles.bottomScrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  topGlow: {
    position: "absolute",
    top: -80,
    left: "15%",
    width: "70%",
    height: 260,
    borderRadius: 200,
    backgroundColor: "rgba(122, 172, 214, 0.04)",
  },
  bottomScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
});
