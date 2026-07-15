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
import { hexToRgba } from "../utils/colorTheory";
import { triggerHaptic } from "../utils/haptics";

const BAR_H = 40;
/** Circular bulb control — same outer size as the message pill height. */
const BULB_SIZE = BAR_H;
const BULB_ICON = 20;
/** Match ActionBar track width so the bulb lines up with Leave’s right edge. */
function actionTrackWidth(windowWidth: number): number {
  return Math.min(windowWidth - 32, 440);
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
  const trackWidth = actionTrackWidth(width);
  const styles = useMemo(() => createStyles(colors), [colors]);
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
            size={BULB_ICON}
            color={hexToRgba(colors.textPrimary, 0.92)}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  // Same glass band both modes — table lighting carries theme brightness.
  const glass = hexToRgba(
    colors.mode === "dark" ? "#06140e" : "#0a1a12",
    0.42,
  );
  return StyleSheet.create({
    host: {
      width: "100%",
      alignItems: "center",
      paddingBottom: 6,
      minHeight: BAR_H + 6,
      justifyContent: "center",
    },
    track: {
      minHeight: BAR_H,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    messagePill: {
      flex: 1,
      minHeight: BAR_H,
      borderRadius: BAR_H / 2,
      paddingHorizontal: 16,
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
      color: hexToRgba(colors.textPrimary, 0.95),
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 0.2,
    },
    bulbBtn: {
      width: BULB_SIZE,
      height: BULB_SIZE,
      borderRadius: BULB_SIZE / 2,
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
