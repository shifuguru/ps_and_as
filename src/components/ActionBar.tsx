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

/** Fixed height budget for bottom-bar layout math (see GameScreen). */
export const ACTION_BAR_HEIGHT = 108;

const GOLD = "#d4af37";
const GOLD_DIM = "rgba(212, 175, 55, 0.45)";
const GOLD_GLOW = "rgba(212, 175, 55, 0.22)";

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
  const { width } = useWindowDimensions();
  const barWidth = Math.min(width - 32, 440);

  const turnGlow = useRef(new Animated.Value(0)).current;
  const passFlash = useRef(new Animated.Value(0)).current;

  const hasSelection = selectedCount > 0;
  const playLabel = hasSelection ? `Play (${selectedCount})` : "Play";
  const playHint = hasSelection
    ? "Tap to play selected cards"
    : "Select cards from your hand";

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
        outputRange: ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.92)"],
      })
    : isPlayerTurn && !passDisabled
      ? turnGlow.interpolate({
          inputRange: [0, 1],
          outputRange: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.11)"],
        })
      : "rgba(255,255,255,0.05)";

  const passBorder = showPassFlash
    ? passFlash.interpolate({
        inputRange: [0, 1],
        outputRange: [GOLD_DIM, "rgba(255,255,255,0.95)"],
      })
    : isPlayerTurn && !passDisabled
      ? turnGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [GOLD_GLOW, GOLD_DIM],
        })
      : "rgba(255,255,255,0.1)";

  const passTextColor = showPassFlash
    ? passFlash.interpolate({
        inputRange: [0, 1],
        outputRange: ["#f0f0f0", "#111111"],
      })
    : "#f0f0f0";

  const playBorderColor = playReady
    ? GOLD
    : isPlayerTurn && !playDisabled
      ? turnGlow.interpolate({
          inputRange: [0, 1],
          outputRange: [GOLD_GLOW, GOLD_DIM],
        })
      : "rgba(255,255,255,0.08)";

  const playBackground = playReady
    ? GOLD
    : isPlayerTurn && !playDisabled
      ? turnGlow.interpolate({
          inputRange: [0, 1],
          outputRange: ["rgba(212,175,55,0.12)", "rgba(212,175,55,0.22)"],
        })
      : "rgba(255,255,255,0.04)";

  return (
    <View style={[styles.container, { width: barWidth, maxWidth: barWidth }]}>
      <View style={styles.actionTrack}>
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
            showPassFlash ? "Pass turn — no valid plays available" : "Pass turn"
          }
          accessibilityState={{ disabled: passDisabled }}
        >
          {showPassFlash ? (
            <Animated.Text style={[styles.passText, { color: passTextColor }]}>
              Pass
            </Animated.Text>
          ) : (
            <Text style={[styles.passText, passDisabled && styles.textMuted]}>
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
              No valid plays
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
              playReady && styles.playTextReady,
              isPlayerTurn && !playDisabled && !playReady && styles.playTextTurn,
              playDisabled && styles.textMuted,
            ]}
          >
            {playLabel}
          </Text>
          {isPlayerTurn && !playDisabled && !hasSelection && (
            <Text style={styles.playSubtext}>Select cards first</Text>
          )}
        </AnimatedTouchable>
      </View>

      <TouchableOpacity
        style={styles.quitButton}
        onPress={onQuit}
        accessibilityRole="button"
        accessibilityLabel="Leave game"
        hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
      >
        <Text style={styles.quitText}>Leave game</Text>
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    minHeight: 58,
  },
  passButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  playButtonTurn: {
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
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
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  passText: {
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  passHint: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 3,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  playText: {
    color: "rgba(255,255,255,0.35)",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  playTextTurn: {
    color: "#f5f0e6",
  },
  playTextReady: {
    color: "#111",
  },
  playSubtext: {
    color: "rgba(212,175,55,0.65)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  quitButton: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  quitText: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
    fontSize: 12,
    letterSpacing: 0.4,
  },
  buttonMuted: {
    opacity: 0.4,
  },
  textMuted: {
    opacity: 0.65,
  },
});
