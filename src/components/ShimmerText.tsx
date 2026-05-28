import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  children: string;
  style?: TextStyle;
  /** Full sweep cycle in ms. */
  durationMs?: number;
};

export default function ShimmerText({
  children,
  style,
  durationMs = 2400,
}: Props) {
  const { colors } = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, durationMs]);

  const translateX =
    size.w > 0
      ? progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-size.w * 0.9, size.w * 1.25],
        })
      : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height },
    );
  };

  const goldSoft = hexToRgba(colors.gold, 0.45);
  const goldMid = hexToRgba(colors.gold, 0.75);
  const hotCore = hexToRgba("#ffffff", 0.92);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Text style={style}>{children}</Text>
      {size.w > 0 ? (
        <View
          style={[styles.overlay, { width: size.w, height: size.h }]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.band,
              {
                height: size.h + 6,
                transform: [{ translateX }, { skewX: "-20deg" }],
              },
            ]}
          >
            <View style={[styles.streak, { backgroundColor: goldSoft }]} />
            <View style={[styles.streakMid, { backgroundColor: goldMid }]} />
            <View style={[styles.streakHot, { backgroundColor: hotCore }]} />
            <View style={[styles.streakMid, { backgroundColor: goldMid }]} />
            <View style={[styles.streak, { backgroundColor: goldSoft }]} />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    alignSelf: "center",
  },
  overlay: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
  band: {
    position: "absolute",
    top: -3,
    left: 0,
    flexDirection: "row",
    alignItems: "stretch",
  },
  streak: {
    width: 14,
    opacity: 0.55,
  },
  streakMid: {
    width: 10,
    opacity: 0.85,
  },
  streakHot: {
    width: 6,
    opacity: 1,
  },
});
