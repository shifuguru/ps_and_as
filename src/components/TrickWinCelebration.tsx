import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Platform } from "react-native";
import { TRICK_WIN_XP } from "../services/playerStats";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

const PARTICLE_COUNT = 14;

type ParticleSpec = {
  angle: number;
  distance: number;
  sizeW: number;
  sizeH: number;
  color: string;
  spin: number;
};

function buildParticles(seed: number, colors: readonly string[]): ParticleSpec[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const t = (seed + i * 17) % 1000;
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (t / 1000) * 0.8;
    return {
      angle,
      distance: 0.55 + (t % 400) / 1000,
      sizeW: 3 + (t % 3),
      sizeH: 5 + (t % 4),
      color: colors[i % colors.length],
      spin: (t % 180) - 90,
    };
  });
}

type Props = {
  active: boolean;
  avatarSize: number;
  /** Show floating +XP text (local human trick win). */
  showXp?: boolean;
  xpAmount?: number;
  /** Winner's theme — defaults to local palette when omitted. */
  celebrationColors?: readonly string[];
};

export default function TrickWinCelebration({
  active,
  avatarSize,
  showXp = false,
  xpAmount = TRICK_WIN_XP,
  celebrationColors,
}: Props) {
  const { colors, palette } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const burst = useRef(new Animated.Value(0)).current;
  const flagPop = useRef(new Animated.Value(0)).current;
  const flagWave = useRef(new Animated.Value(0)).current;
  const xpFloat = useRef(new Animated.Value(0)).current;
  const particleColors = celebrationColors ?? palette.celebrationColors;
  const particles = useMemo(
    () => buildParticles(avatarSize, particleColors),
    [avatarSize, particleColors],
  );

  useEffect(() => {
    if (!active) {
      burst.stopAnimation();
      flagPop.stopAnimation();
      flagWave.stopAnimation();
      xpFloat.stopAnimation();
      burst.setValue(0);
      flagPop.setValue(0);
      flagWave.setValue(0);
      xpFloat.setValue(0);
      return;
    }

    burst.setValue(0);
    flagPop.setValue(0);
    flagWave.setValue(0);
    xpFloat.setValue(0);

    const burstAnim = Animated.timing(burst, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const flagAnim = Animated.sequence([
      Animated.spring(flagPop, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(flagWave, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(flagWave, {
            toValue: 0,
            duration: 420,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 },
      ),
    ]);

    burstAnim.start();
    flagAnim.start();

    if (showXp) {
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(xpFloat, {
          toValue: 1,
          duration: 920,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      burstAnim.stop();
      flagAnim.stop();
    };
  }, [active, burst, flagPop, flagWave, showXp, xpFloat]);

  if (!active) return null;

  const spread = avatarSize * 0.95;
  const flagRotate = flagWave.interpolate({
    inputRange: [0, 1],
    outputRange: ["-14deg", "14deg"],
  });

  return (
    <View
      style={[
        styles.host,
        {
          width: avatarSize + spread * 2,
          height: avatarSize + spread * 2,
          left: -spread,
          top: -spread - avatarSize * 0.15,
        },
      ]}
      pointerEvents="none"
    >
      {particles.map((p, i) => {
        const travel = spread * p.distance;
        const translateX = burst.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * travel],
        });
        const translateY = burst.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * travel - avatarSize * 0.08],
        });
        const opacity = burst.interpolate({
          inputRange: [0, 0.15, 0.7, 1],
          outputRange: [0, 1, 1, 0],
        });
        const spin = burst.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${p.spin}deg`],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.confetti,
              {
                width: p.sizeW,
                height: p.sizeH,
                backgroundColor: p.color,
                left: spread + avatarSize / 2 - p.sizeW / 2,
                top: spread + avatarSize / 2 - p.sizeH / 2,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate: spin }],
              },
            ]}
          />
        );
      })}

      <Animated.View
        style={[
          styles.flagWrap,
          {
            left: spread + avatarSize / 2 - 12,
            top: spread - avatarSize * 0.42,
            opacity: flagPop,
            transform: [
              {
                scale: flagPop.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 1],
                }),
              },
              { rotate: flagRotate },
            ],
          },
        ]}
      >
        <Text style={styles.flagEmoji}>🏁</Text>
      </Animated.View>

      {showXp ? (
        <Animated.View
          style={[
            styles.xpWrap,
            {
              left: spread + avatarSize / 2 - 36,
              top: spread - avatarSize * 0.72,
              opacity: xpFloat.interpolate({
                inputRange: [0, 0.12, 0.75, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: xpFloat.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, -32],
                  }),
                },
                {
                  scale: xpFloat.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0.7, 1.08, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.xpText}>+{xpAmount} XP</Text>
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.winRing,
          {
            width: avatarSize + 14,
            height: avatarSize + 14,
            borderRadius: (avatarSize + 14) / 2,
            left: spread + avatarSize / 2 - (avatarSize + 14) / 2,
            top: spread + avatarSize / 2 - (avatarSize + 14) / 2,
            opacity: burst.interpolate({
              inputRange: [0, 0.2, 1],
              outputRange: [0, 0.95, 0.35],
            }),
            transform: [
              {
                scale: burst.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1.12],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  const accent = colors.gold;
  const accentBright = colors.onFelt.accent;

  return StyleSheet.create({
  host: {
    position: "absolute",
    zIndex: 30,
    overflow: "visible",
  },
  confetti: {
    position: "absolute",
    borderRadius: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 1,
        shadowOffset: { width: 0, height: 1 },
      },
      default: {},
    }),
  },
  flagWrap: {
    position: "absolute",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 32,
  },
  flagEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  xpWrap: {
    position: "absolute",
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 33,
  },
  xpText: {
    color: accentBright,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  winRing: {
    position: "absolute",
    borderWidth: 2.5,
    borderColor: hexToRgba(accentBright, 0.9),
    backgroundColor: hexToRgba(accent, 0.12),
    zIndex: 28,
    ...Platform.select({
      ios: {
        shadowColor: accentBright,
        shadowOpacity: 0.55,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  });
}
