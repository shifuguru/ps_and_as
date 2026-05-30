import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { PS_SHIMMER_TEXT_CLASS } from "../utils/shimmerTextCss";

type Props = {
  children: string;
  style?: TextStyle;
  /** Full repeat period — gradient sweeps once per cycle. */
  cycleMs?: number;
  /** How long the left-to-right sweep takes within each cycle. */
  sweepMs?: number;
};

const DEFAULT_CYCLE_MS = 10_000;
const DEFAULT_SWEEP_MS = 1_200;

function flattenColor(style: TextStyle | undefined, fallback: string): string {
  const flat = StyleSheet.flatten(style);
  return typeof flat?.color === "string" ? flat.color : fallback;
}

export default function ShimmerText({
  children,
  style,
  cycleMs = DEFAULT_CYCLE_MS,
  sweepMs = DEFAULT_SWEEP_MS,
}: Props) {
  const { colors } = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const baseColor = flattenColor(style, colors.onFelt.textPrimary);

  const goldSoft = hexToRgba(colors.gold, 0.55);
  const goldMid = hexToRgba(colors.gold, 0.88);
  const hotCore = hexToRgba("#fffef5", 0.95);

  const idleMs = Math.max(0, cycleMs - sweepMs);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: sweepMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(idleMs),
      ]),
    );

    progress.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [progress, sweepMs, idleMs]);

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

  const webShimmerStyle = useMemo(
    (): ViewStyle =>
      Platform.OS === "web"
        ? ({
            ["--shimmer-base" as string]: baseColor,
            ["--shimmer-soft" as string]: goldSoft,
            ["--shimmer-mid" as string]: goldMid,
            ["--shimmer-hot" as string]: hotCore,
            animationDuration: `${cycleMs}ms`,
          } as ViewStyle)
        : {},
    [baseColor, goldSoft, goldMid, hotCore, cycleMs],
  );

  if (Platform.OS === "web") {
    return (
      <Text
        style={[style, webShimmerStyle]}
        // @ts-expect-error className is supported on RN Web
        className={PS_SHIMMER_TEXT_CLASS}
        numberOfLines={1}
      >
        {children}
      </Text>
    );
  }

  const maskText = (
    <Text style={[style, styles.maskText]} numberOfLines={1}>
      {children}
    </Text>
  );

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
    <View style={styles.root} onLayout={onLayout} collapsable={false}>
      {size.w > 0 ? (
        <MaskedView
          style={{ width: size.w, height: size.h }}
          maskElement={
            <View
              style={[styles.maskWrap, { width: size.w, height: size.h }]}
              collapsable={false}
            >
              {maskText}
            </View>
          }
        >
          <View
            style={[
              styles.fill,
              { width: size.w, height: size.h, backgroundColor: baseColor },
            ]}
            collapsable={false}
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
    justifyContent: "center",
    alignItems: "center",
  },
  maskText: {
    color: "#000000",
  },
  fill: {
    overflow: "hidden",
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
