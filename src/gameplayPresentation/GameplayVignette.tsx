import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
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
  // Soft centre falloff only — no top/bottom linear bands (those read as
  // painted chrome plates and shrink the fullscreen table look).
  const radialEdge = (isLight ? 0.22 : 0.42) * vs;
  const radialMid = (isLight ? 0.08 : 0.16) * vs;
  const rx = `${Math.round(82 * vr)}%`;
  const ry = `${Math.round(68 * vr)}%`;

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
            <Stop offset="50%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="78%" stopColor="#000000" stopOpacity={radialMid} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={radialEdge} />
          </RadialGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#gameplayPhotoVignette)"
        />
      </Svg>
    </View>
  );
}
