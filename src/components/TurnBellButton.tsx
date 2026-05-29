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

export default function TurnBellButton({ visible, onPress }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        bellWrap: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hexToRgba(colors.gold, colors.mode === "light" ? 0.12 : 0.18),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: hexToRgba(colors.gold, colors.mode === "light" ? 0.28 : 0.38),
        },
        bellGlow: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: 17,
          backgroundColor: hexToRgba(colors.gold, 0.12),
        },
        bellIcon: {
          fontSize: 17,
          lineHeight: 20,
        },
      }),
    [colors],
  );
  const swing = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      swing.setValue(0);
      pulse.setValue(1);
      return;
    }

    const swingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(swing, {
          toValue: -1,
          duration: 220,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(swing, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    swingLoop.start();
    pulseLoop.start();
    return () => {
      swingLoop.stop();
      pulseLoop.stop();
    };
  }, [visible, pulse, swing]);

  if (!visible) return null;

  const rotate = swing.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-18deg", "0deg", "18deg"],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        triggerHaptic("light");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Ring turn bell"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View
        style={[
          styles.bellWrap,
          { transform: [{ scale: pulse }, { rotate }] },
        ]}
      >
        <View style={styles.bellGlow} pointerEvents="none" />
        <Text style={styles.bellIcon}>🔔</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
