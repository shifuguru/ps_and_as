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
import { tableChatBubbleColors } from "../chat/tableChatAppearance";

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
          left: (avatarSize - maxWidth) / 2,
          width: maxWidth,
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
  const bubbleColors = tableChatBubbleColors(colors);
  return StyleSheet.create({
    host: {
      position: "absolute",
      bottom: "100%",
      marginBottom: 4,
      alignItems: "center",
      zIndex: 42,
    },
    bubble: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: bubbleColors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: bubbleColors.border,
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
      color: bubbleColors.text,
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
      borderTopColor: bubbleColors.background,
    },
  });
}
