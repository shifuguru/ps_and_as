import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MenuIcon from "../components/MenuIcon";
import { useAppTheme } from "../context/ThemeContext";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import { hexToRgba } from "../utils/colorTheory";
import { triggerHaptic } from "../utils/haptics";
import {
  resolveCompactHeightTier,
  resolveHandHintSlot,
} from "../utils/compactGameLayout";

const BULB_ICON = 20;
/** Match ActionBar track width so the bulb lines up with Leave’s right edge. */
function actionTrackWidth(windowWidth: number): number {
  return Math.min(windowWidth - 32, 440);
}

function hintBarHeight(shellHeight: number): number {
  const slot = resolveHandHintSlot(resolveCompactHeightTier(shellHeight));
  // Slot includes host paddingBottom — keep bar inside the reserved budget.
  return Math.max(28, slot - (shellHeight < 720 ? 4 : 6));
}

type Props = {
  /** Instruction copy — shown in the left/center pill when expanded. */
  message?: string;
  visible?: boolean;
  /**
   * When true, start with message hidden.
   * Bulb always stays pinned to the right (Leave edge).
   */
  startCollapsed?: boolean;
};

/**
 * Hint row: message pill + lightbulb.
 * Track width matches ActionBar; bulb is always on the right edge (Leave align).
 */
export default function GameplayHint({
  message = "Tap a card to play",
  visible = true,
  startCollapsed = false,
}: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { height: shellHeight } = useVisualViewportSize();
  const trackWidth = actionTrackWidth(width);
  const barH = hintBarHeight(shellHeight || 900);
  const padBottom = resolveHandHintSlot(resolveCompactHeightTier(shellHeight || 900)) - barH;
  const styles = useMemo(
    () => createStyles(colors, barH, padBottom),
    [colors, barH, padBottom],
  );
  const [expanded, setExpanded] = useState(!startCollapsed);
  const hostOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const textOpacity = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(hostOpacity, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    if (!visible) setExpanded(true);
  }, [visible, hostOpacity]);

  useEffect(() => {
    Animated.timing(textOpacity, {
      toValue: expanded ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [expanded, textOpacity]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.host, { opacity: hostOpacity }]}
      pointerEvents="box-none"
    >
      <View style={[styles.track, { width: trackWidth, maxWidth: trackWidth }]}>
        {expanded ? (
          <Animated.View style={[styles.messagePill, { opacity: textOpacity }]}>
            <Text style={styles.label} numberOfLines={1}>
              {message}
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.messageSpacer} />
        )}

        <Pressable
          onPress={() => {
            triggerHaptic("light");
            setExpanded((v) => !v);
          }}
          style={styles.bulbBtn}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Hide hint" : "Show hint"}
          accessibilityState={{ expanded }}
          hitSlop={6}
        >
          <MenuIcon
            name="bulb"
            size={barH >= 36 ? BULB_ICON : 16}
            color={hexToRgba(colors.textPrimary, 0.92)}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  barH: number,
  padBottom: number,
) {
  // Same glass band both modes — table lighting carries theme brightness.
  const glass = hexToRgba(
    colors.mode === "dark" ? "#06140e" : "#0a1a12",
    0.42,
  );
  return StyleSheet.create({
    host: {
      width: "100%",
      alignItems: "center",
      paddingBottom: Math.max(0, padBottom),
      minHeight: barH + Math.max(0, padBottom),
      justifyContent: "center",
    },
    track: {
      minHeight: barH,
      flexDirection: "row",
      alignItems: "center",
      gap: barH < 36 ? 6 : 8,
    },
    messagePill: {
      flex: 1,
      minHeight: barH,
      borderRadius: barH / 2,
      paddingHorizontal: barH < 36 ? 12 : 16,
      justifyContent: "center",
      backgroundColor: glass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.textPrimary, 0.12),
      minWidth: 0,
    },
    messageSpacer: {
      flex: 1,
      minWidth: 0,
    },
    label: {
      color: colors.textPrimary,
      fontSize: barH < 36 ? 12 : 14,
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 0.2,
    },
    bulbBtn: {
      width: barH,
      height: barH,
      borderRadius: barH / 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: glass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.textPrimary, 0.18),
      flexShrink: 0,
      marginLeft: "auto",
    },
  });
}
