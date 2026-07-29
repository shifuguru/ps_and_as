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
 * Stems are filled T-shapes (not strokes) so they stay readable at small sizes.
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
        <G transform="translate(208,16) rotate(-16)">
          <Path d="M18 2 L32 22 L18 42 L4 22 Z" fill={fill} />
        </G>

        {/* Spade */}
        <G transform="translate(242,14) rotate(6)">
          <Path
            d="M18 2
               C26 12, 34 18, 34 27
               C34 34, 27 39, 18 39
               C9 39, 2 34, 2 27
               C2 18, 10 12, 18 2 Z"
            fill={fill}
          />
          {/* Wide stem + flared foot */}
          <Path
            d="M13 36 H23 V48 H30 V56 H6 V48 H13 Z"
            fill={fill}
          />
        </G>

        {/* Club */}
        <G transform="translate(276,10) rotate(14)">
          <Circle cx="18" cy="12" r="8" fill={fill} />
          <Circle cx="9" cy="24" r="8" fill={fill} />
          <Circle cx="27" cy="24" r="8" fill={fill} />
          <Circle cx="18" cy="22" r="5" fill={fill} />
          {/* Wide stem + flared foot */}
          <Path
            d="M13 28 H23 V48 H30 V56 H6 V48 H13 Z"
            fill={fill}
          />
        </G>
      </Svg>
    </View>
  );
}
