import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  children: string;
  style?: TextStyle;
  /** Shimmer sweep duration in ms. */
  sweepMs?: number;
  /** Minimum idle time between sweeps. */
  intervalMinMs?: number;
  /** Maximum idle time between sweeps. */
  intervalMaxMs?: number;
};

const DEFAULT_SWEEP_MS = 1400;
const DEFAULT_INTERVAL_MIN_MS = 20_000;
const DEFAULT_INTERVAL_MAX_MS = 30_000;

function flattenColor(style: TextStyle | undefined, fallback: string): string {
  const flat = StyleSheet.flatten(style);
  return typeof flat?.color === "string" ? flat.color : fallback;
}

export default function ShimmerText({
  children,
  style,
  sweepMs = DEFAULT_SWEEP_MS,
  intervalMinMs = DEFAULT_INTERVAL_MIN_MS,
  intervalMaxMs = DEFAULT_INTERVAL_MAX_MS,
}: Props) {
  const { colors } = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [webBgPos, setWebBgPos] = useState("100% 0");
  const baseColor = flattenColor(style, colors.onFelt.textPrimary);

  useEffect(() => {
    let cancelled = false;
    let waitTimer: ReturnType<typeof setTimeout> | null = null;
    let anim: Animated.CompositeAnimation | null = null;

    const scheduleSweep = () => {
      if (cancelled) return;
      const span = Math.max(0, intervalMaxMs - intervalMinMs);
      const wait = intervalMinMs + Math.random() * span;
      waitTimer = setTimeout(runSweep, wait);
    };

    const runSweep = () => {
      if (cancelled) return;
      progress.setValue(0);
      anim = Animated.timing(progress, {
        toValue: 1,
        duration: sweepMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: Platform.OS !== "web",
      });
      anim.start(({ finished }) => {
        anim = null;
        if (finished && !cancelled) scheduleSweep();
      });
    };

    scheduleSweep();

    return () => {
      cancelled = true;
      if (waitTimer) clearTimeout(waitTimer);
      anim?.stop();
    };
  }, [progress, sweepMs, intervalMinMs, intervalMaxMs]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = progress.addListener(({ value }) => {
      const x = 110 - value * 130;
      setWebBgPos(`${x}% 0`);
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const translateX =
    size.w > 0
      ? progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-size.w * 1.1, size.w * 1.35],
        })
      : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height },
    );
  };

  const goldSoft = hexToRgba(colors.gold, 0.55);
  const goldMid = hexToRgba(colors.gold, 0.88);
  const hotCore = hexToRgba("#fffef5", 0.95);

  const maskText = (
    <Text style={[style, styles.maskText]} numberOfLines={1}>
      {children}
    </Text>
  );

  if (Platform.OS === "web") {
    const gradient = `linear-gradient(90deg, ${baseColor} 0%, ${baseColor} 38%, ${goldSoft} 44%, ${goldMid} 48%, ${hotCore} 50%, ${goldMid} 52%, ${goldSoft} 56%, ${baseColor} 62%, ${baseColor} 100%)`;
    return (
      <Text
        style={[
          style,
          styles.webText,
          {
            backgroundImage: gradient,
            backgroundSize: "220% 100%",
            backgroundPosition: webBgPos,
          },
        ]}
        numberOfLines={1}
        onLayout={onLayout}
      >
        {children}
      </Text>
    );
  }

  const shimmerBand = (
    <Animated.View
      style={[
        styles.band,
        {
          height: size.h + 8,
          transform: [{ translateX }, { skewX: "-18deg" }],
        },
      ]}
    >
      <View style={[styles.streak, { backgroundColor: goldSoft }]} />
      <View style={[styles.streakMid, { backgroundColor: goldMid }]} />
      <View style={[styles.streakHot, { backgroundColor: hotCore }]} />
      <View style={[styles.streakMid, { backgroundColor: goldMid }]} />
      <View style={[styles.streak, { backgroundColor: goldSoft }]} />
    </Animated.View>
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      {size.w > 0 ? (
        <MaskedView
          style={{ width: size.w, height: size.h }}
          maskElement={<View style={styles.maskWrap}>{maskText}</View>}
        >
          <View
            style={[
              styles.fill,
              { width: size.w, height: size.h, backgroundColor: baseColor },
            ]}
          >
            {shimmerBand}
          </View>
        </MaskedView>
      ) : (
        <Text style={style} numberOfLines={1}>
          {children}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: "center",
  },
  maskWrap: {
    backgroundColor: "transparent",
  },
  maskText: {
    color: "#000000",
  },
  fill: {
    overflow: "hidden",
  },
  webText: {
    backgroundClip: "text",
    // @ts-expect-error web-only
    WebkitBackgroundClip: "text",
    // @ts-expect-error web-only
    WebkitTextFillColor: "transparent",
    color: "transparent",
  },
  band: {
    position: "absolute",
    top: -4,
    left: 0,
    flexDirection: "row",
    alignItems: "stretch",
  },
  streak: {
    width: 12,
    opacity: 0.6,
  },
  streakMid: {
    width: 9,
    opacity: 0.9,
  },
  streakHot: {
    width: 5,
    opacity: 1,
  },
});
