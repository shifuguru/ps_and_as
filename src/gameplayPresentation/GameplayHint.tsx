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
import {
  TURN_INTRO_FADE,
  TURN_INTRO_PEAK,
  useTurnIntroAnimation,
} from "../hooks/useTurnIntroAnimation";

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
  /**
   * Stronger turn cue — gold pulse + weight when it is the local player's turn.
   */
  yourTurn?: boolean;
};

/**
 * Hint row: message pill + lightbulb.
 * Track width matches ActionBar; bulb is always on the right edge (Leave align).
 */
export default function GameplayHint({
  message = "Tap a card to play",
  visible = true,
  startCollapsed = false,
  yourTurn = false,
}: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const trackWidth = actionTrackWidth(width);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(!startCollapsed);
  const hostOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const textOpacity = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const turnIntro = useTurnIntroAnimation(yourTurn && visible);

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

  const accent = colors.accent;
  const pillBorder = yourTurn
    ? turnIntro.interpolate({
        inputRange: [0, TURN_INTRO_FADE, TURN_INTRO_PEAK, 1],
        outputRange: [
          hexToRgba(accent, 0.22),
          hexToRgba(accent, 0.85),
          hexToRgba(accent, 1),
          hexToRgba(accent, 0.72),
        ],
      })
    : hexToRgba(colors.textPrimary, 0.12);

  const pillBg = yourTurn
    ? turnIntro.interpolate({
        inputRange: [0, TURN_INTRO_PEAK, 1],
        outputRange: [
          hexToRgba(colors.mode === "dark" ? "#06140e" : "#0a1a12", 0.42),
          hexToRgba(accent, colors.mode === "light" ? 0.28 : 0.34),
          hexToRgba(accent, colors.mode === "light" ? 0.18 : 0.24),
        ],
      })
    : hexToRgba(colors.mode === "dark" ? "#06140e" : "#0a1a12", 0.42);

  return (
    <Animated.View
      style={[styles.host, { opacity: hostOpacity }]}
      pointerEvents="box-none"
    >
      <View style={[styles.track, { width: trackWidth, maxWidth: trackWidth }]}>
        {expanded ? (
          <Animated.View
            style={[
              styles.messagePill,
              yourTurn && styles.messagePillYourTurn,
              {
                opacity: textOpacity,
                borderColor: pillBorder,
                backgroundColor: pillBg,
              },
            ]}
          >
            <Text
              style={[styles.label, yourTurn && styles.labelYourTurn]}
              numberOfLines={1}
            >
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
          style={[styles.bulbBtn, yourTurn && styles.bulbBtnYourTurn]}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Hide hint" : "Show hint"}
          accessibilityState={{ expanded }}
          hitSlop={6}
        >
          <MenuIcon
            name="bulb"
            size={BULB_ICON}
            color={
              yourTurn
                ? hexToRgba(accent, 0.98)
                : hexToRgba(colors.textPrimary, 0.92)
            }
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
    messagePillYourTurn: {
      borderWidth: 1.5,
    },
    messageSpacer: {
      flex: 1,
      minWidth: 0,
    },
    label: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 0.2,
    },
    labelYourTurn: {
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: colors.mode === "light" ? "#1a1208" : "#fff8e8",
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
    bulbBtnYourTurn: {
      borderColor: hexToRgba(colors.accent, 0.65),
      borderWidth: 1.5,
    },
  });
}
