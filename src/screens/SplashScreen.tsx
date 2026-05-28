import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { gameTitleFaceStyle } from "../utils/gameTitleFont";

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;

  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(900),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 720,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.center}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Svg width={110} height={110} viewBox="0 0 100 100" fill="none">
            <Path
              d="M20 20h40a20 20 0 1 1 0 60H20V20z"
              stroke="white"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>

        <Animated.View
          style={{
            marginTop: 18,
            alignItems: "center",
            opacity: textOpacity,
            transform: [{ translateY: textTranslate }],
          }}
        >
          <Text style={[styles.title, gameTitleFaceStyle()]}>
            P&apos;s & A&apos;s
          </Text>
          <Text style={styles.subtitle}>Presidents & Assholes</Text>
          <Text style={styles.credit}>App designed by Michael Drury</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 6,
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  credit: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    marginTop: 10,
  },
});
