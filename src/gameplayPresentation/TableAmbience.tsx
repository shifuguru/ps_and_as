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
  /** SE / compact stages — quieter glow so it doesn’t read as a plate. */
  compact?: boolean;
};

/**
 * Table polish that never paints a rectangular plate.
 * Host is layout-only (no background). Glow is an ellipse that fades to 0.
 */
export default function TableAmbience({
  width,
  height,
  waitingForPlay = false,
  compact = false,
}: Props) {
  const { colors, palette } = useAppTheme();
  const breath = useRef(new Animated.Value(0.35)).current;
  const glow = palette.complementBright;
  const centre = colors.environment.centreLight;

  useEffect(() => {
    const peak = compact
      ? waitingForPlay
        ? 0.28
        : 0.16
      : waitingForPlay
        ? 0.55
        : 0.32;
    const trough = compact
      ? waitingForPlay
        ? 0.12
        : 0.08
      : waitingForPlay
        ? 0.28
        : 0.18;
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
  }, [breath, waitingForPlay, compact]);

  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  if (width <= 0 || height <= 0) return null;

  const cx = width / 2;
  const cy = height / 2;
  const rx = Math.max(width * (compact ? 0.22 : 0.28), compact ? 48 : 72);
  const ry = Math.max(height * (compact ? 0.14 : 0.18), compact ? 32 : 48);
  const core =
    centre *
    (compact
      ? colors.mode === "light"
        ? 0.7
        : 0.55
      : colors.mode === "light"
        ? 1.35
        : 1.2);
  const mid =
    centre *
    (compact
      ? colors.mode === "light"
        ? 0.22
        : 0.14
      : colors.mode === "light"
        ? 0.5
        : 0.35);

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
      {!compact ? (
        <Text style={[styles.crest, gameTitleFaceStyle()]} numberOfLines={1}>
          {"P's & A's"}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  compact: boolean,
) {
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
      fontSize: compact ? 16 : 22,
      fontWeight: "700",
      color: hexToRgba(colors.accent, colors.mode === "light" ? 0.1 : 0.07),
      letterSpacing: 1.2,
    },
  });
}
