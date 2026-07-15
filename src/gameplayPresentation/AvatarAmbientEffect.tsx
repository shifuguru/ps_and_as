import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  size: number;
  accentColor: string;
  enabled?: boolean;
  /** Stronger, synced motion when this seat has the turn. */
  turnActive?: boolean;
};

const MOTES = [
  { x: 0.16, y: 0.2, delay: 0, scale: 1, drift: 7 },
  { x: 0.82, y: 0.26, delay: 520, scale: 0.65, drift: 5 },
  { x: 0.26, y: 0.76, delay: 1100, scale: 0.8, drift: 6 },
  { x: 0.72, y: 0.7, delay: 1600, scale: 0.5, drift: 4 },
  { x: 0.48, y: 0.1, delay: 800, scale: 0.55, drift: 5 },
  { x: 0.58, y: 0.48, delay: 2000, scale: 0.4, drift: 3 },
  { x: 0.34, y: 0.42, delay: 2400, scale: 0.35, drift: 4 },
];

/**
 * Slow drifting motes + soft bloom behind seat avatars.
 * Subconscious quality — never competing with turn rings.
 */
export default function AvatarAmbientEffect({
  size,
  accentColor,
  enabled = true,
  turnActive = false,
}: Props) {
  const glow = useRef(new Animated.Value(turnActive ? 0.32 : 0.18)).current;
  const moteAnims = useRef(MOTES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!enabled) return;
    const peak = turnActive ? 0.38 : 0.26;
    const trough = turnActive ? 0.2 : 0.14;
    const duration = turnActive ? 2000 : 3200;
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: peak,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: trough,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    glowLoop.start();

    const moteLoops = moteAnims.map((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(MOTES[i].delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: (turnActive ? 2800 : 4200) + i * 180,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: (turnActive ? 2800 : 4200) + i * 180,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return loop;
    });

    return () => {
      glowLoop.stop();
      moteLoops.forEach((l) => l.stop());
    };
  }, [enabled, glow, moteAnims, turnActive]);

  const styles = useMemo(() => createStyles(size, accentColor), [size, accentColor]);
  if (!enabled) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.View style={[styles.halo, { opacity: glow }]} />
      <Animated.View style={[styles.bloom, { opacity: glow }]} />
      {MOTES.map((m, i) => {
        const translateY = moteAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [m.drift * 0.4, -m.drift],
        });
        const translateX = moteAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [-1, 1.5],
        });
        const opacity = moteAnims[i].interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [0.02, turnActive ? 0.42 : 0.28, 0.04],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.mote,
              {
                left: size * m.x,
                top: size * m.y,
                width: 2.2 * m.scale,
                height: 2.2 * m.scale,
                borderRadius: 2 * m.scale,
                opacity,
                transform: [{ translateY }, { translateX }],
                backgroundColor: accentColor,
                shadowColor: accentColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function createStyles(size: number, accentColor: string) {
  const pad = Math.round(size * 0.34);
  return StyleSheet.create({
    host: {
      position: "absolute",
      left: -pad / 2,
      top: -pad / 2,
      width: size + pad,
      height: size + pad,
      zIndex: 0,
    },
    halo: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: (size + pad) / 2,
      backgroundColor: hexToRgba(accentColor, 0.12),
    },
    bloom: {
      position: "absolute",
      left: pad * 0.2,
      top: pad * 0.2,
      right: pad * 0.2,
      bottom: pad * 0.2,
      borderRadius: size,
      backgroundColor: hexToRgba(accentColor, 0.08),
    },
    mote: {
      position: "absolute",
      shadowOpacity: 0.55,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 0 },
    },
  });
}
