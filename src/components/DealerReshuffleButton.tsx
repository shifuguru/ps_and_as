import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { triggerHaptic } from "../utils/haptics";

type Props = {
  visible: boolean;
  onPress: () => void;
};

export default function DealerReshuffleButton({ visible, onPress }: Props) {
  const { colors } = useAppTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hexToRgba(
            colors.gold,
            colors.mode === "light" ? 0.16 : 0.22,
          ),
          borderWidth: 2,
          borderColor: hexToRgba(
            colors.gold,
            colors.mode === "light" ? 0.42 : 0.55,
          ),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 8,
        },
        glow: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: 36,
          backgroundColor: hexToRgba(colors.gold, 0.14),
        },
        icon: {
          fontSize: 28,
          lineHeight: 32,
        },
        label: {
          marginTop: 2,
          fontSize: 9,
          fontWeight: "800",
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: colors.gold,
        },
      }),
    [colors],
  );

  useEffect(() => {
    if (!visible) {
      pulse.setValue(1);
      spin.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    pulseLoop.start();
    spinLoop.start();
    return () => {
      pulseLoop.stop();
      spinLoop.stop();
    };
  }, [visible, pulse, spin]);

  if (!visible) return null;

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        triggerHaptic("medium");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Reshuffle cards"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Animated.View
        style={[styles.wrap, { transform: [{ scale: pulse }] }]}
      >
        <View style={styles.glow} pointerEvents="none" />
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Text style={styles.icon}>🔀</Text>
        </Animated.View>
        <Text style={styles.label}>Reshuffle</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
