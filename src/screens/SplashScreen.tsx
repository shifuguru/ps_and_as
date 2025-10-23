import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { styles as theme } from "../styles/theme";


interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    ]).start(onFinish);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity,
          backgroundColor: "black",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Svg width={110} height={110} viewBox="0 0 100 100" fill="none">
            {/* simple white monogram / emblem */}
            <Path
              d="M20 20h40a20 20 0 1 1 0 60H20V20z"
              stroke="white"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <View style={{ width: 120, height: 120, backgroundColor: "white", borderRadius: 60 }} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={{ marginTop: 18, alignItems: "center", opacity: textOpacity, transform: [{ translateY: textTranslate }] }}>
        <Text style={styles.title}>P's & A's</Text>
        <Text style={styles.subtitle}>by rabbithole games</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
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
  },
});