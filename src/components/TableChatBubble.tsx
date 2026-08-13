import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  active: boolean;
  text: string;
  avatarSize: number;
};

export default function TableChatBubble({ active, text, avatarSize }: Props) {
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
      Animated.delay(2600),
      Animated.timing(pop, {
        toValue: 0,
        duration: 320,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, pop, text]);

  if (!active || !text.trim()) return null;

  const maxWidth = Math.max(88, Math.round(avatarSize * 1.55));

  return (
    <Animated.View
      style={[
        styles.host,
        {
          top: -avatarSize * 0.52,
          opacity: pop,
          transform: [
            {
              scale: pop.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
            {
              translateY: pop.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.bubble, { maxWidth }]}>
        <Text style={styles.text}>{text}</Text>
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
      zIndex: 42,
    },
    bubble: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: colors.mode === "dark" ? "#f4f7f5" : "#ffffff",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.accent, 0.45),
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
        },
        android: { elevation: 5 },
        default: {},
      }),
    },
    text: {
      color: colors.mode === "dark" ? "#102018" : "#173126",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.15,
      textAlign: "center",
      flexShrink: 1,
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
      borderTopColor: colors.mode === "dark" ? "#f4f7f5" : "#ffffff",
    },
  });
}
