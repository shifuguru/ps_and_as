import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";
import { BUTTON_CENTER, buttonLabel } from "../styles/buttonStyles";
import { hexToRgba } from "../utils/colorTheory";

/** Fixed height budget for bottom-bar layout math (see GameScreen). */
export const ACTION_BAR_HEIGHT = 108;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type Props = {
  selectedCount: number;
  onPlay: () => void;
  onPass: () => void;
  onQuit: () => void;
  playDisabled: boolean;
  passDisabled: boolean;
  isPlayerTurn?: boolean;
  noValidPlays?: boolean;
};

export default function ActionBar({
  selectedCount,
  onPlay,
  onPass,
  onQuit,
  playDisabled,
  passDisabled,
  isPlayerTurn = false,
  noValidPlays = false,
}: Props) {
  const { colors, ui } = useAppTheme();
  const isLight = colors.mode === "light";
  const gold = colors.gold;
  const goldDim =
    colors.mode === "light"
      ? "rgba(0, 122, 255, 0.42)"
      : "rgba(100, 210, 255, 0.42)";
  const goldGlow =
    colors.mode === "light"
      ? "rgba(0, 122, 255, 0.18)"
      : "rgba(100, 210, 255, 0.2)";
  const passIdleBg = colors.actionSecondaryBg;
  const passIdleBorder = colors.actionSecondaryBorder;
  const passIdleText = colors.actionSecondaryText;
  const playIdleBg = colors.actionPrimaryDisabledBg;
  const playIdleBorder = colors.actionPrimaryDisabledBorder;
  const playIdleText = colors.actionPrimaryDisabledText;
  const playTurnBgLow = isLight
    ? hexToRgba(colors.gold, 0.08)
    : "rgba(10,132,255,0.12)";
  const playTurnBgHigh = isLight
    ? hexToRgba(colors.gold, 0.14)
    : "rgba(10,132,255,0.22)";
  const passTurnBgLow = isLight
    ? hexToRgba(colors.textPrimary, 0.04)
    : "rgba(255,255,255,0.06)";
  const passTurnBgHigh = isLight
    ? hexToRgba(colors.textPrimary, 0.08)
    : "rgba(255,255,255,0.11)";
  const { width } = useWindowDimensions();
  const barWidth = Math.min(width - 32, 440);

  const turnGlow = useRef(new Animated.Value(0)).current;
  const passFlash = useRef(new Animated.Value(0)).current;

  const hasSelection = selectedCount > 0;
  const playLabel = hasSelection ? `Play (${selectedCount})` : "Play";
  const playHint = hasSelection
    ? "Tap to play selected cards"
    : "Select Cards From Your Hand";

  const showPassFlash =
    isPlayerTurn && noValidPlays && !passDisabled;

  const playReady = isPlayerTurn && !playDisabled && hasSelection;

  useEffect(() => {
    if (!isPlayerTurn) {
      turnGlow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(turnGlow, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(turnGlow, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isPlayerTurn, turnGlow]);

  useEffect(() => {
    if (!showPassFlash) {
      passFlash.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(passFlash, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(passFlash, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showPassFlash, passFlash]);

  const passBackground = showPassFlash
    ? passFlash.interpolate({
        inputRange: [0, 1],
        outputRange: [
          isLight ? passIdleBg : "rgba(255,255,255,0.08)",
          isLight ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.92)",
        ],
      })
    : isPlayerTurn && !passDisabled
      ? turnGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [passTurnBgLow, passTurnBgHigh],
        })
      : passIdleBg;

  const passBorder = showPassFlash
    ? passFlash.interpolate({
        inputRange: [0, 1],
        outputRange: [goldDim, isLight ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.95)"],
      })
    : isPlayerTurn && !passDisabled
      ? turnGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [goldGlow, goldDim],
        })
      : passIdleBorder;

  const passTextColor = showPassFlash
    ? passFlash.interpolate({
        inputRange: [0, 1],
        outputRange: [isLight ? passIdleText : "#f0f0f0", "#111111"],
      })
    : passIdleText;

  const playBorderColor = playReady
    ? gold
    : isPlayerTurn && !playDisabled
      ? turnGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [goldGlow, goldDim],
        })
      : playIdleBorder;

  const playBackground = playReady
    ? gold
    : isPlayerTurn && !playDisabled
      ? turnGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [playTurnBgLow, playTurnBgHigh],
        })
      : playIdleBg;

  return (
    <View style={[styles.container, { width: barWidth, maxWidth: barWidth }]}>
      <View
        style={[
          styles.actionTrack,
          {
            backgroundColor: colors.actionTrackBg,
            borderColor: colors.actionTrackBorder,
          },
        ]}
      >
        <AnimatedTouchable
          style={[
            styles.passButton,
            passDisabled && styles.buttonMuted,
            showPassFlash && styles.passButtonFlash,
            {
              backgroundColor: passBackground,
              borderColor: passBorder,
            },
          ]}
          onPress={() => {
            triggerHaptic("light");
            onPass();
          }}
          disabled={passDisabled}
          accessibilityRole="button"
          accessibilityLabel={
            showPassFlash ? "Pass Turn — No Valid Plays Available" : "Pass Turn"
          }
          accessibilityState={{ disabled: passDisabled }}
        >
          {showPassFlash ? (
            <Animated.Text style={[styles.passText, { color: passTextColor }]}>
              Pass
            </Animated.Text>
          ) : (
            <Text
              style={[
                styles.passText,
                { color: passIdleText },
                passDisabled && styles.textMuted,
              ]}
            >
              Pass
            </Text>
          )}
          {showPassFlash && (
            <Animated.Text
              style={[
                styles.passHint,
                {
                  color: passFlash.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      "rgba(240,240,240,0.55)",
                      "rgba(17,17,17,0.6)",
                    ],
                  }),
                },
              ]}
            >
              No Valid Plays
            </Animated.Text>
          )}
        </AnimatedTouchable>

        <AnimatedTouchable
          style={[
            styles.playButton,
            playDisabled && styles.buttonMuted,
            playReady && styles.playButtonReady,
            isPlayerTurn && !playDisabled && !playReady && styles.playButtonTurn,
            {
              backgroundColor: playBackground,
              borderColor: playBorderColor,
              ...(playReady || (isPlayerTurn && !playDisabled && !playReady)
                ? Platform.select({
                    ios: { shadowColor: gold },
                    default: {},
                  })
                : null),
            },
          ]}
          onPress={() => {
            triggerHaptic("medium");
            onPlay();
          }}
          disabled={playDisabled}
          accessibilityRole="button"
          accessibilityLabel={playLabel}
          accessibilityHint={playHint}
          accessibilityState={{ disabled: playDisabled }}
        >
          <Text
            style={[
              styles.playText,
              { color: playIdleText },
              playReady && styles.playTextReady,
              isPlayerTurn &&
                !playDisabled &&
                !playReady && {
                  color: isLight ? colors.actionPrimaryText : "#f5f0e6",
                },
              playDisabled && styles.textMuted,
            ]}
          >
            {playLabel}
          </Text>
          {isPlayerTurn && !playDisabled && !hasSelection && (
            <Text style={styles.playSubtext}>Select Cards First</Text>
          )}
        </AnimatedTouchable>
      </View>

      <TouchableOpacity
        style={ui.leaveButton}
        onPress={onQuit}
        accessibilityRole="button"
        accessibilityLabel="Leave Game"
        hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
      >
        <Text style={ui.leaveButtonText}>Leave Game</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    gap: 12,
  },
  actionTrack: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    padding: 5,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 58,
  },
  passButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    minHeight: 48,
    ...BUTTON_CENTER,
  },
  passButtonFlash: {
    ...Platform.select({
      ios: {
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  playButton: {
    flex: 1.45,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    minHeight: 48,
    ...BUTTON_CENTER,
  },
  playButtonTurn: {
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  playButtonReady: {
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  passText: buttonLabel(15, {
    fontWeight: "700",
    letterSpacing: 0.3,
  }),
  passHint: buttonLabel(9, {
    fontWeight: "600",
    marginTop: 3,
    letterSpacing: 0.2,
  }),
  playText: buttonLabel(15, {
    fontWeight: "800",
    letterSpacing: 0.3,
  }),
  playTextReady: {
    color: "#111",
  },
  playSubtext: buttonLabel(10, {
    color: "rgba(212,175,55,0.65)",
    fontWeight: "600",
    marginTop: 3,
    letterSpacing: 0.2,
  }),
  buttonMuted: {
    opacity: 0.4,
  },
  textMuted: {
    opacity: 0.65,
  },
});
