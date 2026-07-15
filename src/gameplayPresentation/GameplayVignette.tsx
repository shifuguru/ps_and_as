import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useAppTheme } from "../context/ThemeContext";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";

type Props = {
  /** Optional override; defaults to the visual viewport. */
  width?: number;
  height?: number;
};

/**
 * Full-screen photography vignette — environment layer with the felt.
 * Light mode softens edges (brighter table centre); dark keeps deep falloff.
 * Glass chrome sits above this layer.
 */
export default function GameplayVignette({
  width: widthProp,
  height: heightProp,
}: Props) {
  const { mode, colors } = useAppTheme();
  const isLight = mode === "light";
  const env = colors.environment;
  const viewport = useVisualViewportSize();
  const width = widthProp ?? viewport.width;
  const height = heightProp ?? viewport.height;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 0,
          overflow: "hidden",
          backgroundColor: "transparent",
        },
      }),
    [],
  );

  if (width <= 0 || height <= 0) return null;

  const vs = env.vignetteStrength;
  const vr = env.vignetteRadius;
  const topBand = Math.round(height * 0.28);
  const bottomBand = Math.round(height * 0.36);
  // Soft centre: scale edge falloff; radius widens the lit centre.
  const radialEdge = (isLight ? 0.28 : 0.55) * vs;
  const radialMid = (isLight ? 0.1 : 0.22) * vs;
  const topEdge = (isLight ? 0.38 : 0.72) * vs;
  const topMid = (isLight ? 0.16 : 0.38) * vs;
  const bottomEdge = (isLight ? 0.42 : 0.78) * vs;
  const bottomMid = (isLight ? 0.18 : 0.42) * vs;
  const rx = `${Math.round(78 * vr)}%`;
  const ry = `${Math.round(62 * vr)}%`;

  return (
    <View style={styles.host} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient
            id="gameplayPhotoVignette"
            cx="50%"
            cy="42%"
            rx={rx}
            ry={ry}
          >
            <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="45%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="72%" stopColor="#000000" stopOpacity={radialMid} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={radialEdge} />
          </RadialGradient>
          <LinearGradient id="gameplayVignetteTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#000000" stopOpacity={topEdge} />
            <Stop offset="35%" stopColor="#000000" stopOpacity={topMid} />
            <Stop offset="70%" stopColor="#000000" stopOpacity={(isLight ? 0.04 : 0.12) * vs} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient
            id="gameplayVignetteBottom"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="25%" stopColor="#000000" stopOpacity={(isLight ? 0.06 : 0.14) * vs} />
            <Stop offset="55%" stopColor="#000000" stopOpacity={bottomMid} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={bottomEdge} />
          </LinearGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#gameplayPhotoVignette)"
        />
        <Rect
          x={0}
          y={0}
          width={width}
          height={topBand}
          fill="url(#gameplayVignetteTop)"
        />
        <Rect
          x={0}
          y={height - bottomBand}
          width={width}
          height={bottomBand}
          fill="url(#gameplayVignetteBottom)"
        />
      </Svg>
    </View>
  );
}
