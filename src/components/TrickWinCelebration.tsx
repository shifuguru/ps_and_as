import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Platform } from "react-native";

const CONFETTI_COLORS = [
  "#d4af37",
  "#ffd700",
  "#ff6b6b",
  "#4ecdc4",
  "#ffe66d",
  "#ff85c0",
  "#ffffff",
  "#7ec8ff",
];

const PARTICLE_COUNT = 14;

type ParticleSpec = {
  angle: number;
  distance: number;
  sizeW: number;
  sizeH: number;
  color: string;
  spin: number;
};

function buildParticles(seed: number): ParticleSpec[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const t = (seed + i * 17) % 1000;
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (t / 1000) * 0.8;
    return {
      angle,
      distance: 0.55 + (t % 400) / 1000,
      sizeW: 3 + (t % 3),
      sizeH: 5 + (t % 4),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      spin: (t % 180) - 90,
    };
  });
}

type Props = {
  active: boolean;
  avatarSize: number;
};

export default function TrickWinCelebration({ active, avatarSize }: Props) {
  const burst = useRef(new Animated.Value(0)).current;
  const flagPop = useRef(new Animated.Value(0)).current;
  const flagWave = useRef(new Animated.Value(0)).current;
  const particles = useMemo(() => buildParticles(avatarSize), [avatarSize]);

  useEffect(() => {
    if (!active) {
      burst.stopAnimation();
      flagPop.stopAnimation();
      flagWave.stopAnimation();
      burst.setValue(0);
      flagPop.setValue(0);
      flagWave.setValue(0);
      return;
    }

    burst.setValue(0);
    flagPop.setValue(0);
    flagWave.setValue(0);

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

    return () => {
      burstAnim.stop();
      flagAnim.stop();
    };
  }, [active, burst, flagPop, flagWave]);

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

const styles = StyleSheet.create({
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
  winRing: {
    position: "absolute",
    borderWidth: 2.5,
    borderColor: "rgba(255, 215, 0, 0.9)",
    backgroundColor: "rgba(212, 175, 55, 0.12)",
    zIndex: 28,
    ...Platform.select({
      ios: {
        shadowColor: "#ffd700",
        shadowOpacity: 0.55,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
});
