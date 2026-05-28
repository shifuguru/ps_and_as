import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import { hexToRgba } from "../utils/colorTheory";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function roundedRectPerimeter(
  width: number,
  height: number,
  radius: number,
): number {
  const r = Math.min(radius, width / 2, height / 2);
  const straight = 2 * (width - 2 * r) + 2 * (height - 2 * r);
  return straight + 2 * Math.PI * r;
}

type Props = {
  accentColor: string;
  borderRadius?: number;
  /** When false, only the static accent border is shown. */
  animate?: boolean;
  onPress: () => void;
  activeOpacity?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: "button";
  accessibilityLabel?: string;
  children: React.ReactNode;
};

export default function AccentBorderButton({
  accentColor,
  borderRadius = 14,
  animate = true,
  onPress,
  activeOpacity = 0.82,
  style,
  contentStyle,
  accessibilityRole = "button",
  accessibilityLabel,
  children,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dashOffset = useRef(new Animated.Value(0)).current;
  const strokeWidth = 2;
  const inset = strokeWidth / 2;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const perimeter =
    size.width > 0 && size.height > 0
      ? roundedRectPerimeter(size.width, size.height, borderRadius)
      : 0;
  const highlightLen = perimeter > 0 ? Math.max(28, perimeter * 0.24) : 0;
  const gapLen = Math.max(1, perimeter - highlightLen);

  useEffect(() => {
    if (!animate || perimeter <= 0) {
      dashOffset.stopAnimation();
      dashOffset.setValue(0);
      return;
    }

    dashOffset.setValue(0);
    const loop = Animated.loop(
      Animated.timing(dashOffset, {
        toValue: -perimeter,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, perimeter, dashOffset]);

  const trackColor = hexToRgba(accentColor, 0.28);
  const glowColor = hexToRgba(accentColor, 0.55);

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {size.width > 0 && size.height > 0 ? (
        <Svg
          width={size.width}
          height={size.height}
          style={styles.borderLayer}
          pointerEvents="none"
        >
          <Rect
            x={inset}
            y={inset}
            width={size.width - strokeWidth}
            height={size.height - strokeWidth}
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke={trackColor}
            strokeWidth={1}
          />
          {animate ? (
            <>
              <AnimatedRect
                x={inset}
                y={inset}
                width={size.width - strokeWidth}
                height={size.height - strokeWidth}
                rx={borderRadius}
                ry={borderRadius}
                fill="none"
                stroke={glowColor}
                strokeWidth={strokeWidth + 2}
                strokeLinecap="round"
                strokeDasharray={`${highlightLen} ${gapLen}`}
                strokeDashoffset={dashOffset}
              />
              <AnimatedRect
                x={inset}
                y={inset}
                width={size.width - strokeWidth}
                height={size.height - strokeWidth}
                rx={borderRadius}
                ry={borderRadius}
                fill="none"
                stroke={accentColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${highlightLen} ${gapLen}`}
                strokeDashoffset={dashOffset}
              />
            </>
          ) : null}
        </Svg>
      ) : null}

      <TouchableOpacity
        style={[styles.content, { borderRadius }, contentStyle]}
        activeOpacity={activeOpacity}
        onPress={onPress}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "visible",
  },
  borderLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  content: {
    zIndex: 0,
  },
});
