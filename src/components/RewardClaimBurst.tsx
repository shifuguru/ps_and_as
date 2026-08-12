import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

const PARTICLE_COUNT = 18;

type ParticleSpec = {
  angle: number;
  distance: number;
  size: number;
  color: string;
};

function buildParticles(seed: number, accent: string): ParticleSpec[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const t = (seed + i * 23) % 1000;
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (t / 1000) * 0.6;
    return {
      angle,
      distance: 0.42 + (t % 380) / 650,
      size: 4 + (t % 6),
      color: i % 3 === 0 ? "#ffffff" : accent,
    };
  });
}

type Props = {
  /** Resolves with granted XP (0 = no burst). */
  onClaim: () => Promise<number>;
  disabled?: boolean;
  accessibilityLabel: string;
  onBurstComplete?: (grantedXp: number) => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * Tap-to-claim wrapper — inflates like a balloon, then bursts away with a poof.
 */
export default function RewardClaimBurst({
  onClaim,
  disabled = false,
  accessibilityLabel,
  onBurstComplete,
  style,
  children,
}: Props) {
  const { colors } = useAppTheme();
  const [phase, setPhase] = useState<"idle" | "claiming" | "bursting" | "done">(
    "idle",
  );
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const poof = useRef(new Animated.Value(0)).current;
  const grantedXpRef = useRef(0);
  const particles = useMemo(
    () => buildParticles(42, colors.accent),
    [colors.accent],
  );

  useEffect(() => {
    if (phase !== "done") return;
    onBurstComplete?.(grantedXpRef.current);
  }, [phase, onBurstComplete]);

  const handlePress = async () => {
    if (phase !== "idle" || disabled) return;
    setPhase("claiming");
    try {
      const grantedXp = await onClaim();
      if (grantedXp <= 0) {
        setPhase("idle");
        return;
      }
      grantedXpRef.current = grantedXp;
      setPhase("bursting");
      burst.setValue(0);
      poof.setValue(0);
      opacity.setValue(1);
      scale.setValue(1);

      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.5,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(burst, {
            toValue: 1,
            duration: 540,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(poof, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setPhase("done");
      });
    } catch {
      setPhase("idle");
    }
  };

  if (phase === "done") return null;

  const showParticles = phase === "bursting";
  const busy = phase === "claiming" || phase === "bursting";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled || busy}
      onPress={() => {
        void handlePress();
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <View style={styles.host}>
        <Animated.View
          style={{
            transform: [{ scale }],
            opacity,
          }}
        >
          {children}
        </Animated.View>
        {showParticles ? (
          <View style={styles.particleLayer} pointerEvents="none">
            <Animated.View
              style={[
                styles.poofRing,
                {
                  borderColor: hexToRgba(colors.accent, 0.6),
                  transform: [
                    {
                      scale: poof.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.25, 2.4],
                      }),
                    },
                  ],
                  opacity: poof.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0.95, 0.55, 0],
                  }),
                },
              ]}
            />
            {particles.map((p, i) => {
              const travel = 80 * p.distance;
              const translateX = burst.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.cos(p.angle) * travel],
              });
              const translateY = burst.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.sin(p.angle) * travel],
              });
              const particleOpacity = burst.interpolate({
                inputRange: [0, 0.08, 0.6, 1],
                outputRange: [0, 1, 0.8, 0],
              });
              const particleScale = burst.interpolate({
                inputRange: [0, 0.12, 1],
                outputRange: [0.15, 1.25, 0.35],
              });

              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.particle,
                    {
                      width: p.size,
                      height: p.size,
                      borderRadius: p.size / 2,
                      backgroundColor: p.color,
                      opacity: particleOpacity,
                      transform: [
                        { translateX },
                        { translateY },
                        { scale: particleScale },
                      ],
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "relative",
  },
  particleLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  poofRing: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 3,
  },
  particle: {
    position: "absolute",
  },
});
