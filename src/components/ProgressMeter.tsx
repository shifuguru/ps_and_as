/**
 * Hub XP / goal progress meter — presentation only.
 * Does not store or mutate career XP; `progress` is always derived by the caller.
 */
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  /** 0–1 */
  progress: number;
  label?: string;
  /** Right-aligned caption (e.g. "45 / 100") */
  valueLabel?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Override fill color (defaults to gold). */
  fillColor?: string;
  /** Animate fill width when progress changes (level-up hook ready). */
  animated?: boolean;
  /** Slightly richer chrome for identity XP bar. */
  prestige?: boolean;
};

export default function ProgressMeter({
  progress,
  label,
  valueLabel,
  height = 8,
  style,
  fillColor,
  animated = false,
  prestige = false,
}: Props) {
  const { colors } = useAppTheme();
  const barHeight = prestige ? Math.max(height, 10) : height;
  const styles = useMemo(
    () => createStyles(colors, barHeight, prestige),
    [colors, barHeight, prestige],
  );
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = fillColor ?? colors.gold;
  const anim = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    if (!animated) {
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, {
      toValue: clamped,
      duration: 520,
      useNativeDriver: false,
    }).start();
  }, [anim, animated, clamped]);

  const widthInterp = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.wrap, style]}>
      {label || valueLabel ? (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.label}>{label}</Text> : <View />}
          {valueLabel ? <Text style={styles.value}>{valueLabel}</Text> : null}
        </View>
      ) : null}
      <View style={styles.track}>
        {animated ? (
          <Animated.View
            style={[styles.fill, { width: widthInterp, backgroundColor: fill }]}
          />
        ) : (
          <View
            style={[
              styles.fill,
              { width: `${clamped * 100}%`, backgroundColor: fill },
            ]}
          />
        )}
        {prestige ? <View style={styles.fillSheen} pointerEvents="none" /> : null}
      </View>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  height: number,
  prestige: boolean,
) {
  return StyleSheet.create({
    wrap: {
      width: "100%",
      gap: 6,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    label: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: prestige ? 11 : 12,
      fontWeight: "700",
      letterSpacing: prestige ? 0.4 : 0,
      textTransform: prestige ? "uppercase" : "none",
    },
    value: {
      color: colors.textPrimary,
      fontSize: prestige ? 13 : 12,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    track: {
      height,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: hexToRgba(colors.textPrimary, prestige ? 0.18 : 0.14),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: prestige
        ? hexToRgba(colors.gold, 0.38)
        : hexToRgba(colors.textPrimary, colors.mode === "light" ? 0.16 : 0.2),
    },
    fill: {
      height: "100%",
      borderRadius: 999,
    },
    fillSheen: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: hexToRgba("#ffffff", colors.mode === "light" ? 0.06 : 0.08),
      maxHeight: height / 2,
    },
  });
}
