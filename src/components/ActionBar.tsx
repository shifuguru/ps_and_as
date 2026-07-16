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
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import {
  resolveActionBarHeight,
  resolveActionButtonMinHeight,
  resolveActionTrackGap,
  resolveCompactHeightTier,
} from "../utils/compactGameLayout";
import {
  TURN_INTRO_FADE,
  TURN_INTRO_PEAK,
  useTurnIntroAnimation,
} from "../hooks/useTurnIntroAnimation";

/** Fixed height budget for bottom-bar layout math (single action row). */
export const ACTION_BAR_HEIGHT = 58;

const CAPSULE_RADIUS = 999;
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
  /** Run / 10-rule on-top beat — pass ends the trick (already won). */
  onTopTurn?: boolean;
  /** Hide play/pass during deal ceremony — leave stays visible. */
  leaveOnly?: boolean;
  /** Bot open table — show Skip game in the pass/play row (spectator, etc.). */
  skipGameOnly?: boolean;
  onSkipGame?: () => void;
  /** @deprecated Utilities live in GameplayHud — kept for call-site compatibility. */
  onNavigateToSettings?: () => void;
  /** @deprecated Utilities live in GameplayHud — kept for call-site compatibility. */
  onNavigateToAchievements?: () => void;
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
  onTopTurn = false,
  leaveOnly = false,
  skipGameOnly = false,
  onSkipGame,
}: Props) {
  const { colors } = useAppTheme();
  const isLight = colors.mode === "light";
  const gold = colors.gold;
  const goldDim = hexToRgba(gold, isLight ? 0.42 : 0.38);
  const passIdleBg = colors.actionSecondaryBg;
  const passIdleBorder = colors.actionSecondaryBorder;
  const passIdleText = colors.actionSecondaryText;
  const playIdleBg = colors.actionPrimaryDisabledBg;
  const playIdleBorder = colors.actionPrimaryDisabledBorder;
  const playIdleText = colors.actionPrimaryDisabledText;
  const leaveBg = colors.leaveButtonLiveBg;
  const leaveBorder = colors.leaveButtonLiveBorder;
  const leaveText = colors.leaveButtonLiveText;
  const playTurnBgLow = hexToRgba(gold, isLight ? 0.1 : 0.14);
  const playTurnBgHigh = hexToRgba(gold, isLight ? 0.18 : 0.28);
  const playTurnBgRest = hexToRgba(gold, isLight ? 0.15 : 0.21);
  const playReadyBorder = isLight ? hexToRgba(gold, 0.92) : hexToRgba(gold, 1);
  const playTurnBorderRest = hexToRgba(gold, isLight ? 0.78 : 0.84);
  const passTurnBgLow = isLight
    ? hexToRgba(colors.textPrimary, 0.04)
    : "rgba(255,255,255,0.06)";
  const passTurnBgHigh = isLight
    ? hexToRgba(colors.textPrimary, 0.08)
    : "rgba(255,255,255,0.11)";
  const passTurnBgRest = isLight
    ? hexToRgba(colors.textPrimary, 0.06)
    : "rgba(255,255,255,0.08)";
  const { width, height: shellHeight } = useWindowDimensions();
  const viewport = useVisualViewportSize();
  const tier = resolveCompactHeightTier(viewport.height || shellHeight);
  const actionBarHeight = resolveActionBarHeight(tier);
  const buttonMinHeight = Math.max(48, resolveActionButtonMinHeight(tier));
  const actionTrackGap = resolveActionTrackGap(tier);
  const barWidth = Math.min(width - 32, 440);

  const turnIntro = useTurnIntroAnimation(isPlayerTurn);
  const passFlash = useRef(new Animated.Value(0)).current;

  const hasSelection = selectedCount > 0;
  const playLabel = "Play";
  const playHint = hasSelection
    ? "Tap to play selected cards"
    : "Select Cards From Your Hand";

  const showPassFlash =
    isPlayerTurn && noValidPlays && !passDisabled && !onTopTurn;

  const passLabel = onTopTurn ? "Skip" : "Pass";
  const passAccessibilityLabel = onTopTurn
    ? "Skip on-top play — keep trick win"
    : showPassFlash
      ? "Pass Turn — No Valid Plays Available"
      : "Pass Turn";

  const playReady = isPlayerTurn && !playDisabled && hasSelection;

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
      ? turnIntro.interpolate({
          inputRange: [0, TURN_INTRO_PEAK, 1],
          outputRange: [passTurnBgLow, passTurnBgHigh, passTurnBgRest],
        })
      : passIdleBg;

  const passBorder = showPassFlash
    ? passFlash.interpolate({
        inputRange: [0, 1],
        outputRange: [goldDim, isLight ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.95)"],
      })
    : passIdleBorder;

  const passTextColor = showPassFlash
    ? passFlash.interpolate({
        inputRange: [0, 1],
        outputRange: [isLight ? passIdleText : "#f0f0f0", "#111111"],
      })
    : passIdleText;

  const playBorderColor = playReady
    ? playReadyBorder
    : isPlayerTurn && !playDisabled
      ? turnIntro.interpolate({
          inputRange: [0, TURN_INTRO_PEAK, 1],
          outputRange: [goldDim, gold, playTurnBorderRest],
        })
      : playIdleBorder;

  const playBackground = playReady
    ? gold
    : isPlayerTurn && !playDisabled
      ? turnIntro.interpolate({
          inputRange: [0, TURN_INTRO_FADE, TURN_INTRO_PEAK, 1],
          outputRange: [playTurnBgLow, playTurnBgHigh, playTurnBgHigh, playTurnBgRest],
        })
      : playIdleBg;

  const playEnabled = isPlayerTurn && !playDisabled;

  const leaveButton = (
    <TouchableOpacity
      style={[
        styles.leaveButton,
        {
          minHeight: buttonMinHeight,
          backgroundColor: leaveBg,
          borderColor: leaveBorder,
          flex: leaveOnly || skipGameOnly ? 1 : 0.95,
        },
      ]}
      onPress={() => {
        triggerHaptic("light");
        onQuit();
      }}
      accessibilityRole="button"
      accessibilityLabel="Leave Game"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Text style={[styles.leaveText, { color: leaveText }]}>Leave</Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.container,
        { width: barWidth, maxWidth: barWidth, minHeight: actionBarHeight },
      ]}
    >
      {skipGameOnly && onSkipGame ? (
        <View style={[styles.actionTrack, { gap: actionTrackGap, minHeight: buttonMinHeight }]}>
          <TouchableOpacity
            style={[
              styles.passButton,
              {
                minHeight: buttonMinHeight,
                backgroundColor: passIdleBg,
                borderColor: passIdleBorder,
                flex: 1,
              },
            ]}
            onPress={() => {
              triggerHaptic("light");
              onSkipGame();
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip game"
          >
            <Text style={[styles.passText, { color: passIdleText }]}>Skip</Text>
          </TouchableOpacity>
          {leaveButton}
        </View>
      ) : leaveOnly ? (
        <View style={[styles.actionTrack, { gap: actionTrackGap, minHeight: buttonMinHeight }]}>
          {leaveButton}
        </View>
      ) : (
        <View style={[styles.actionTrack, { gap: actionTrackGap, minHeight: buttonMinHeight }]}>
          <AnimatedTouchable
            style={[
              styles.passButton,
              { minHeight: buttonMinHeight },
              passDisabled && styles.passButtonDisabled,
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
            accessibilityLabel={passAccessibilityLabel}
            accessibilityState={{ disabled: passDisabled }}
          >
            {showPassFlash ? (
              <Animated.Text style={[styles.passText, { color: passTextColor }]}>
                {passLabel}
              </Animated.Text>
            ) : (
              <Text style={[styles.passText, { color: passIdleText }]}>
                {passLabel}
              </Text>
            )}
          </AnimatedTouchable>

          <AnimatedTouchable
            style={[
              styles.playButton,
              { minHeight: buttonMinHeight },
              playDisabled && styles.playButtonDisabled,
              playReady && styles.playButtonReady,
              playEnabled && !playReady && styles.playButtonTurn,
              {
                backgroundColor: playBackground,
                borderColor: playBorderColor,
                borderWidth: playReady || playEnabled ? 1.5 : 1,
                ...(playReady || playEnabled
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
                playEnabled &&
                  !playReady && {
                    color: isLight ? colors.actionPrimaryText : "#f5f0e6",
                  },
              ]}
            >
              {playLabel}
            </Text>
          </AnimatedTouchable>

          {leaveButton}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
  },
  actionTrack: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    minHeight: 48,
    width: "100%",
  },
  passButton: {
    flex: 1,
    borderRadius: CAPSULE_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
    ...BUTTON_CENTER,
  },
  passButtonDisabled: {
    opacity: 0.58,
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
    borderRadius: CAPSULE_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 16,
    minHeight: 48,
    ...BUTTON_CENTER,
  },
  playButtonDisabled: {
    opacity: 0.68,
  },
  playButtonTurn: {
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.34,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  playButtonReady: {
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.52,
        shadowRadius: 14,
      },
      android: { elevation: 8 },
    }),
  },
  leaveButton: {
    borderRadius: CAPSULE_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
    ...BUTTON_CENTER,
  },
  passText: buttonLabel(15, {
    fontWeight: "700",
    letterSpacing: 0.3,
  }),
  playText: buttonLabel(16, {
    fontWeight: "800",
    letterSpacing: 0.3,
  }),
  playTextReady: {
    color: "#111",
    fontWeight: "900",
  },
  leaveText: buttonLabel(15, {
    fontWeight: "800",
    letterSpacing: 0.2,
  }),
});
