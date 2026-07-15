import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { gameTitleFaceStyle } from "../utils/gameTitleFont";

type Props = {
  width: number;
  height: number;
  /** Soft breathing under the pile while waiting for a lead. */
  waitingForPlay?: boolean;
};

/**
 * Table polish that never paints a rectangular plate.
 * Host is layout-only (no background). Glow is an ellipse that fades to 0.
 */
export default function TableAmbience({
  width,
  height,
  waitingForPlay = false,
}: Props) {
  const { colors, palette } = useAppTheme();
  const breath = useRef(new Animated.Value(0.35)).current;
  const glow = palette.complementBright;
  const centre = colors.environment.centreLight;

  useEffect(() => {
    const peak = waitingForPlay ? 0.55 : 0.32;
    const trough = waitingForPlay ? 0.28 : 0.18;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: peak,
          duration: waitingForPlay ? 2200 : 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: trough,
          duration: waitingForPlay ? 2200 : 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, waitingForPlay]);

  const styles = useMemo(() => createStyles(colors), [colors]);
  if (width <= 0 || height <= 0) return null;

  const cx = width / 2;
  const cy = height / 2;
  const rx = Math.max(width * 0.28, 72);
  const ry = Math.max(height * 0.18, 48);
  const core = centre * (colors.mode === "light" ? 1.35 : 1.2);
  const mid = centre * (colors.mode === "light" ? 0.5 : 0.35);

  return (
    <View style={[styles.host, { width, height }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.centreGlow,
          {
            left: cx - rx,
            top: cy - ry,
            width: rx * 2,
            height: ry * 2,
            opacity: breath,
          },
        ]}
      >
        <Svg width={rx * 2} height={ry * 2}>
          <Defs>
            <RadialGradient id="tableCentreGlowLocal" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={hexToRgba(glow, core)} />
              <Stop offset="55%" stopColor={hexToRgba(glow, mid)} />
              <Stop offset="100%" stopColor="rgba(0,0,0,0)" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={rx}
            cy={ry}
            rx={rx}
            ry={ry}
            fill="url(#tableCentreGlowLocal)"
          />
        </Svg>
      </Animated.View>
      <Text style={[styles.crest, gameTitleFaceStyle()]} numberOfLines={1}>
        {"P's & A's"}
      </Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    /** Positioning only — never paint a fill here. */
    host: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
      overflow: "visible",
      backgroundColor: "transparent",
    },
    centreGlow: {
      position: "absolute",
      backgroundColor: "transparent",
    },
    crest: {
      position: "absolute",
      alignSelf: "center",
      top: "46%",
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: 22,
      fontWeight: "700",
      color: hexToRgba(colors.gold, colors.mode === "light" ? 0.1 : 0.07),
      letterSpacing: 1.2,
    },
  });
}
