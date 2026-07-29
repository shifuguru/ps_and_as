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
        {/* Spade */}
        <G transform="translate(244,20) rotate(6)">
          <Path
            d="M16 2
               C22 10, 30 16, 30 24
               C30 30, 25 34, 16 34
               C7 34, 2 30, 2 24
               C2 16, 10 10, 16 2 Z"
            fill={fill}
          />
          <Path d="M13.2 31 L16 46 L18.8 31 Z" fill={fill} />
        </G>
        {/* Club */}
        <G transform="translate(278,16) rotate(14)">
          <Circle cx="16" cy="9" r="6.5" fill={fill} />
          <Circle cx="9" cy="18" r="6.5" fill={fill} />
          <Circle cx="23" cy="18" r="6.5" fill={fill} />
          <Circle cx="16" cy="18" r="4" fill={fill} />
          <Path d="M13.2 22 L16 40 L18.8 22 Z" fill={fill} />
        </G>
      </Svg>
    </View>
  );
}
