import React from "react";
import { View, Animated, StyleSheet } from "react-native";
import {
  TURN_INTRO_FADE,
  TURN_INTRO_PEAK,
  TURN_INTRO_SETTLE,
  useTurnIntroAnimation,
} from "../hooks/useTurnIntroAnimation";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  active?: boolean;
};

const REST_SCALE = 1;
const REST_OPACITY = 0.75;
const PEAK_SCALE = 1.06;

export default function TurnIndicator({ active = false }: Props) {
  const { colors } = useAppTheme();
  const intro = useTurnIntroAnimation(active);

  const ringScale = intro.interpolate({
    inputRange: [0, TURN_INTRO_FADE, TURN_INTRO_PEAK, TURN_INTRO_SETTLE, 1],
    outputRange: [0.96, 1.02, PEAK_SCALE, 1.01, REST_SCALE],
    extrapolate: "clamp",
  });

  const opacity = intro.interpolate({
    inputRange: [0, TURN_INTRO_FADE, TURN_INTRO_PEAK, 1],
    outputRange: [0, REST_OPACITY, 0.88, REST_OPACITY],
    extrapolate: "clamp",
  });

  if (!active) return <View style={{ width: 0, height: 0 }} />;

  return (
    <Animated.View
      style={[styles.ring, { borderColor: colors.accent, transform: [{ scale: ringScale }], opacity }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    top: -16,
    left: -16,
    zIndex: -1,
  },
});
