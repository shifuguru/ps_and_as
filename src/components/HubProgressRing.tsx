import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** Outer diameter of the ring host. */
  size: number;
  /** 0–1 */
  progress: number;
  strokeWidth?: number;
  trackColor: string;
  fillColor: string;
  children?: React.ReactNode;
  /** Animate ring fill when progress changes (e.g. after XP claim). */
  animated?: boolean;
};

/** Themed accent progress ring around hub avatar / achievement art. */
export default function HubProgressRing({
  size,
  progress,
  strokeWidth = 3.5,
  trackColor,
  fillColor,
  children,
  animated = false,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  const anim = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    if (!animated) {
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, {
      toValue: clamped,
      duration: 920,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, animated, clamped]);

  const offset = animated
    ? anim.interpolate({
        inputRange: [0, 1],
        outputRange: [c, 0],
      })
    : c * (1 - clamped);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        svg: {
          position: "absolute",
          left: 0,
          top: 0,
        },
      }),
    [size],
  );

  return (
    <View style={styles.host}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={mid}
          cy={mid}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <G transform={`rotate(-90 ${mid} ${mid})`}>
          {animated ? (
            <AnimatedCircle
              cx={mid}
              cy={mid}
              r={r}
              stroke={fillColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          ) : (
            <Circle
              cx={mid}
              cy={mid}
              r={r}
              stroke={fillColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )}
        </G>
      </Svg>
      {children}
    </View>
  );
}
