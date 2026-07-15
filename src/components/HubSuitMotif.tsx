import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Circle, G } from "react-native-svg";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  color: string;
  /** Overall opacity of the motif layer. */
  opacity?: number;
};

/**
 * Subtle suit fan — card-game identity without cluttering hub content.
 */
export default function HubSuitMotif({ color, opacity = 0.14 }: Props) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          ...StyleSheet.absoluteFillObject,
          overflow: "hidden",
          opacity,
        },
      }),
    [opacity],
  );

  const fill = hexToRgba(color, 0.9);

  return (
    <View style={styles.host} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 320 100"
        preserveAspectRatio="xMaxYMid meet"
      >
        {/* Diamond */}
        <G transform="translate(210,18) rotate(-16)">
          <Path d="M18 2 L30 22 L18 42 L6 22 Z" fill={fill} />
        </G>
        {/* Spade-ish leaf */}
        <G transform="translate(244,22) rotate(6)">
          <Path
            d="M16 4c5 8 12 12 12 20 0 7-5 12-12 12S4 31 4 24c0-8 7-12 12-20z"
            fill={fill}
          />
          <Path d="M16 36 L16 46" stroke={fill} strokeWidth={2.5} />
        </G>
        {/* Club */}
        <G transform="translate(278,16) rotate(14)">
          <Circle cx="10" cy="14" r="7" fill={fill} />
          <Circle cx="22" cy="14" r="7" fill={fill} />
          <Circle cx="16" cy="24" r="7" fill={fill} />
          <Path d="M16 28 L16 42 L11 38 M16 42 L21 38" stroke={fill} strokeWidth={2} />
        </G>
      </Svg>
    </View>
  );
}
