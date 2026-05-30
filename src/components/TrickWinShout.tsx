import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, Platform } from "react-native";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  active: boolean;
  text: string;
  avatarSize: number;
};

export default function TrickWinShout({ active, text, avatarSize }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pop.stopAnimation();
      pop.setValue(0);
      return;
    }

    pop.setValue(0);
    Animated.sequence([
      Animated.spring(pop, {
        toValue: 1,
        friction: 5,
        tension: 160,
        useNativeDriver: true,
      }),
      Animated.delay(420),
      Animated.timing(pop, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, pop, text]);

  if (!active || !text.trim()) return null;

  return (
    <Animated.View
      style={[
        styles.host,
        {
          top: -avatarSize * 0.42,
          opacity: pop,
          transform: [
            {
              scale: pop.interpolate({
                inputRange: [0, 1],
                outputRange: [0.55, 1],
              }),
            },
            {
              translateY: pop.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.bubble}>
        <Text style={styles.text} numberOfLines={1}>
          {text}
        </Text>
      </View>
      <View style={styles.tail} />
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    host: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 40,
    },
    bubble: {
      maxWidth: 140,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.gold,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.btnGoldBorder,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    text: {
      color: colors.textOnGold,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.25,
      textAlign: "center",
    },
    tail: {
      width: 0,
      height: 0,
      marginTop: -1,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 7,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: colors.gold,
    },
  });
}
