import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { gameTitleFaceStyle } from "../utils/gameTitleFont";
import { USE_NATIVE_DRIVER } from "../utils/useNativeDriver";

type Props = {
  onFinish: () => void;
  /** Fired when the black veil begins lifting so the menu can fade in over felt. */
  onRevealBegin?: () => void;
};

/**
 * Boot transition: black veil + brand mark, then dissolve to the felt canvas.
 * Timing is short — splash is a load bridge, not a cinematic.
 */
export default function SplashScreen({ onFinish, onRevealBegin }: Props) {
  const veilOpacity = useRef(new Animated.Value(1)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandScale = useRef(new Animated.Value(0.92)).current;
  const brandTranslate = useRef(new Animated.Value(8)).current;
  const revealStarted = useRef(false);

  useEffect(() => {
    const markReveal = () => {
      if (revealStarted.current) return;
      revealStarted.current = true;
      onRevealBegin?.();
    };

    const intro = Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(brandScale, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(brandTranslate, {
        toValue: 0,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    const hold = Animated.delay(280);

    const reveal = Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 0,
        duration: 360,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(veilOpacity, {
        toValue: 0,
        duration: 560,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    const sequence = Animated.sequence([intro, hold, reveal]);

    // Start menu fade as soon as the veil begins lifting (~660ms in).
    const revealTimer = setTimeout(markReveal, 660);

    sequence.start(({ finished }) => {
      clearTimeout(revealTimer);
      if (!finished) return;
      markReveal();
      onFinish();
    });

    return () => {
      clearTimeout(revealTimer);
      sequence.stop();
    };
  }, [
    brandOpacity,
    brandScale,
    brandTranslate,
    onFinish,
    onRevealBegin,
    veilOpacity,
  ]);

  return (
    <View style={styles.root} pointerEvents="auto">
      <Animated.View
        style={[styles.veil, { opacity: veilOpacity }]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.brand,
          {
            opacity: brandOpacity,
            transform: [
              { scale: brandScale },
              { translateY: brandTranslate },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={96} height={96} viewBox="0 0 100 100" fill="none">
          <Path
            d="M20 20h40a20 20 0 1 1 0 60H20V20z"
            stroke="white"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={[styles.title, gameTitleFaceStyle()]}>P&apos;s & A&apos;s</Text>
        <Text style={styles.subtitle}>Presidents & Assholes</Text>
        <Text style={styles.credit}>App designed by Shifuguru</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  brand: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: 18,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    marginTop: 6,
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  credit: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    marginTop: 12,
  },
});
