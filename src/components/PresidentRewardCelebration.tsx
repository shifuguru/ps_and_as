import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  active: boolean;
  rowDelay?: number;
};

const OPEN_DELAY_MS = 420;

export default function PresidentRewardCelebration({
  active,
  rowDelay = 0,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const burst = useRef(new Animated.Value(0)).current;
  const crown = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      burst.stopAnimation();
      crown.stopAnimation();
      shimmer.stopAnimation();
      burst.setValue(0);
      crown.setValue(0);
      shimmer.setValue(0);
      return;
    }

    const delay = OPEN_DELAY_MS + rowDelay;
    burst.setValue(0);
    crown.setValue(0);
    shimmer.setValue(0);

    const burstAnim = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(burst, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const crownAnim = Animated.sequence([
      Animated.delay(delay + 80),
      Animated.spring(crown, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]);

    const shimmerAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    burstAnim.start();
    crownAnim.start();
    shimmerAnim.start();

    return () => {
      burstAnim.stop();
      crownAnim.stop();
      shimmerAnim.stop();
    };
  }, [active, rowDelay, burst, crown, shimmer]);

  if (!active) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: burst.interpolate({
              inputRange: [0, 0.25, 1],
              outputRange: [0, 0.85, 0.35],
            }),
            transform: [
              {
                scale: burst.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1.08],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.crownWrap,
          {
            opacity: crown,
            transform: [
              {
                scale: crown.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 1],
                }),
              },
              {
                translateY: crown.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.crownEmoji}>👑</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: shimmer.interpolate({
              inputRange: [0, 1],
              outputRange: [0.75, 1],
            }),
            transform: [
              {
                scale: shimmer.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.98, 1.02],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.bannerText}>PRESIDENT</Text>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    host: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
      zIndex: 0,
    },
    glow: {
      position: "absolute",
      width: "115%",
      height: "130%",
      borderRadius: 18,
      backgroundColor: hexToRgba(colors.gold, 0.22),
      borderWidth: 1.5,
      borderColor: hexToRgba(colors.gold, 0.45),
      ...Platform.select({
        ios: {
          shadowColor: colors.gold,
          shadowOpacity: 0.55,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        },
        default: {},
      }),
    },
    crownWrap: {
      position: "absolute",
      top: -22,
      alignItems: "center",
      justifyContent: "center",
    },
    crownEmoji: {
      fontSize: 28,
      lineHeight: 30,
    },
    banner: {
      position: "absolute",
      bottom: -8,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: hexToRgba(colors.gold, 0.92),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.btnGoldBorder,
    },
    bannerText: {
      color: colors.textOnGold,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.4,
    },
  });
}
