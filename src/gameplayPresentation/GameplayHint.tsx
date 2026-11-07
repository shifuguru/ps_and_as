import React, { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
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
import { useTurnIndicatorMotion } from "../hooks/useDecorativeMotion";
import hintPreference from "../services/hintPreference";
import { hexToRgba } from "../utils/colorTheory";
import { triggerHaptic } from "../utils/haptics";
import {
  resolveCompactHeightTier,
  resolveHandHintSlot,
} from "../utils/compactGameLayout";

const BULB_ICON = 20;
/** Match ActionBar track width so the bulb lines up with the track's right edge. */
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
  /** Highlight the bulb when it is the local player's turn. */
  yourTurn?: boolean;
  /** Render the message and control separately when placed in different rows. */
  part?: "combined" | "message" | "button";
};

/** Hint message and toggle can share a row or render in separate controls. */
export default function GameplayHint({
  message = "Tap a card to play",
  visible = true,
  yourTurn = false,
  part = "combined",
}: Props) {
  const { colors } = useAppTheme();
  const motion = useTurnIndicatorMotion();
  const { width } = useWindowDimensions();
  const { height: shellHeight } = useVisualViewportSize();
  const trackWidth = actionTrackWidth(width);
  const barH = hintBarHeight(shellHeight || 900);
  const padBottom = resolveHandHintSlot(resolveCompactHeightTier(shellHeight || 900)) - barH;
  const styles = useMemo(
    () => createStyles(colors, barH, padBottom),
    [colors, barH, padBottom],
  );
  const expanded = useSyncExternalStore(
    hintPreference.subscribe,
    hintPreference.getSnapshot,
    hintPreference.getSnapshot,
  );
  const hostOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const textOpacity = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const bulbPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void hintPreference.preload().catch((error) => {
      console.warn("Unable to load hint preference:", error);
    });
  }, []);

  useEffect(() => {
    Animated.timing(hostOpacity, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, hostOpacity]);

  useEffect(() => {
    if (part === "message" || !visible || !yourTurn || !motion) {
      bulbPulse.setValue(0);
      return;
    }
    bulbPulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bulbPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(bulbPulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [part, visible, yourTurn, motion, bulbPulse]);

  useEffect(() => {
    Animated.timing(textOpacity, {
      toValue: expanded ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [expanded, textOpacity]);

  if (!visible) return null;

  const pulseScale = bulbPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.16],
  });
  const haloScale = bulbPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.42],
  });
  const haloOpacity = bulbPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 0.12],
  });
  const fillShadeOpacity = bulbPulse.interpolate({
    inputRange: [0, 1],
    outputRange: colors.mode === "dark" ? [0.32, 0] : [0.14, 0],
  });
  const bulb = (
    <Pressable
      onPress={() => {
        triggerHaptic("light");
        void hintPreference.setExpanded(!hintPreference.getSnapshot()).catch((error) => {
          console.warn("Unable to save hint preference:", error);
        });
      }}
      style={[styles.bulbBtn, yourTurn && styles.bulbBtnYourTurn]}
      accessibilityRole="button"
      accessibilityLabel={expanded ? "Hide hint" : "Show hint"}
      accessibilityState={{ expanded }}
      hitSlop={6}
    >
      {yourTurn && motion ? (
        <Animated.View
          testID="hint-turn-pulse"
          pointerEvents="none"
          style={[
            styles.bulbHalo,
            { opacity: haloOpacity, transform: [{ scale: haloScale }] },
          ]}
        />
      ) : null}
      {yourTurn ? (
        <Animated.View
          testID="hint-turn-fill"
          pointerEvents="none"
          style={[styles.bulbFillShade, { opacity: motion ? fillShadeOpacity : 0 }]}
        />
      ) : null}
      <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
        <MenuIcon
          name="bulb"
          size={barH >= 36 ? BULB_ICON : 16}
          color={
            yourTurn
              ? colors.mode === "dark" ? "#06140e" : "#ffffff"
              : hexToRgba(colors.textPrimary, 0.92)
          }
        />
      </Animated.View>
    </Pressable>
  );
  if (part === "button") return bulb;

  return (
    <Animated.View
      style={[styles.host, { opacity: hostOpacity }]}
      pointerEvents="box-none"
    >
      <View style={[styles.track, { width: trackWidth, maxWidth: trackWidth }]}>
        {expanded ? (
          <Animated.View
            testID="hint-message"
            style={[
              styles.messagePill,
              yourTurn && styles.messagePillYourTurn,
              { opacity: textOpacity },
            ]}
          >
            <Text style={styles.label} numberOfLines={1}>
              {message}
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.messageSpacer} />
        )}
        {part === "combined" ? bulb : null}
      </View>
    </Animated.View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  barH: number,
  padBottom: number,
) {
  const glass = hexToRgba(
    colors.mode === "dark" ? "#06140e" : "#f5f4ef",
    colors.mode === "dark" ? 0.72 : 0.92,
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
    messagePillYourTurn: {
      borderColor: hexToRgba(colors.accent, 0.45),
      borderWidth: 1,
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
    bulbBtnYourTurn: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
      borderWidth: 1,
    },
    bulbFillShade: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: barH / 2,
      backgroundColor: colors.mode === "dark" ? "#000000" : "#ffffff",
    },
    bulbHalo: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: barH / 2,
      borderWidth: 2,
      borderColor: colors.accent,
      backgroundColor: hexToRgba(colors.accent, 0.22),
    },
  });
}
