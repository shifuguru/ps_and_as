import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

type Props = {
  /** Outer diameter of the ring host. */
  size: number;
  /** 0–1 */
  progress: number;
  strokeWidth?: number;
  trackColor: string;
  fillColor: string;
  children?: React.ReactNode;
};

/** Gold (or themed) progress ring around hub avatar / achievement art. */
export default function HubProgressRing({
  size,
  progress,
  strokeWidth = 3.5,
  trackColor,
  fillColor,
  children,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);
  const mid = size / 2;

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
        <G rotation={-90} origin={`${mid}, ${mid}`}>
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
        </G>
      </Svg>
      {children}
    </View>
  );
}
