import React, { useEffect, useMemo } from "react";
import { Platform, StyleSheet } from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import {
  advancePhase,
  breatheFromPhase,
  LEGACY_NUDGE_PERIOD_MS,
  LEGACY_PULSE_PERIOD_MS,
} from "../presence/presenceOscillator";

type Props = {
  avatarSize: number;
  nudgeHighlighted?: boolean;
};

/** Continuous turn highlight ring (legacy path when PRESENCE_RING_V1 is off). */
export default function LegacyTurnRing({
  avatarSize,
  nudgeHighlighted = false,
}: Props) {
  const styles = useMemo(() => createStyles(), []);
  const pulsePhase = useSharedValue(0);
  const nudgePhase = useSharedValue(0);
  const nudgeActive = useSharedValue(nudgeHighlighted ? 1 : 0);

  const turnHaloPad = 30;
  const turnGlowPad = 16;
  const turnRingPad = 10;
  const turnCorePad = 6;

  useEffect(() => {
    nudgeActive.value = nudgeHighlighted ? 1 : 0;
  }, [nudgeHighlighted, nudgeActive]);

  useFrameCallback((frameInfo) => {
    "worklet";
    const dt = frameInfo.timeSincePreviousFrame ?? 16;
    pulsePhase.value = advancePhase(
      pulsePhase.value,
      dt,
      LEGACY_PULSE_PERIOD_MS,
    );
    if (nudgeActive.value > 0) {
      nudgePhase.value = advancePhase(
        nudgePhase.value,
        dt,
        LEGACY_NUDGE_PERIOD_MS,
      );
    }
  });

  const haloStyle = useAnimatedStyle(() => {
    const breathe = breatheFromPhase(pulsePhase.value);
    const nudgeBreathe = breatheFromPhase(nudgePhase.value);
    const nudge = nudgeActive.value;

    const scale =
      (1 + 0.1 * breathe) * (1 - nudge) + nudge * (1.08 + 0.12 * nudgeBreathe);
    const opacity =
      (0.08 + 0.16 * breathe) * (1 - nudge) +
      nudge * (0.32 + 0.28 * nudgeBreathe);

    return { transform: [{ scale }], opacity };
  });

  const glowStyle = useAnimatedStyle(() => {
    const breathe = breatheFromPhase(pulsePhase.value);
    const nudgeBreathe = breatheFromPhase(nudgePhase.value);
    const nudge = nudgeActive.value;

    const scale =
      (1 + 0.05 * breathe) * (1 - nudge) + nudge * (1.06 + 0.1 * nudgeBreathe);
    const opacity =
      (0.2 + 0.24 * breathe) * (1 - nudge) +
      nudge * (0.48 + 0.22 * nudgeBreathe);

    return { transform: [{ scale }], opacity };
  });

  const ringStyle = useAnimatedStyle(() => {
    const breathe = breatheFromPhase(pulsePhase.value);
    const nudgeBreathe = breatheFromPhase(nudgePhase.value);
    const nudge = nudgeActive.value;

    const scale =
      (1 + 0.05 * breathe) * (1 - nudge) + nudge * (1.04 + 0.1 * nudgeBreathe);
    const opacity =
      (0.7 + 0.12 * breathe) * (1 - nudge) + nudge * (0.84 + 0.08 * nudgeBreathe);

    return { transform: [{ scale }], opacity };
  });

  const coreStyle = useAnimatedStyle(() => {
    const breathe = breatheFromPhase(pulsePhase.value);
    const nudgeBreathe = breatheFromPhase(nudgePhase.value);
    const nudge = nudgeActive.value;

    const scale =
      (1 + 0.05 * breathe) * (1 - nudge) + nudge * (1.04 + 0.1 * nudgeBreathe);
    const opacity =
      (0.48 + 0.24 * breathe) * (1 - nudge) +
      nudge * (0.62 + 0.16 * nudgeBreathe);

    return { transform: [{ scale }], opacity };
  });

  return (
    <>
      <Reanimated.View
        style={[
          styles.turnRingHalo,
          {
            width: avatarSize + turnHaloPad,
            height: avatarSize + turnHaloPad,
            borderRadius: (avatarSize + turnHaloPad) / 2,
            left: -turnHaloPad / 2,
            top: -turnHaloPad / 2,
          },
          haloStyle,
        ]}
        pointerEvents="none"
      />
      <Reanimated.View
        style={[
          styles.turnRingGlow,
          {
            width: avatarSize + turnGlowPad,
            height: avatarSize + turnGlowPad,
            borderRadius: (avatarSize + turnGlowPad) / 2,
            left: -turnGlowPad / 2,
            top: -turnGlowPad / 2,
          },
          glowStyle,
        ]}
        pointerEvents="none"
      />
      <Reanimated.View
        style={[
          styles.turnRing,
          {
            width: avatarSize + turnRingPad,
            height: avatarSize + turnRingPad,
            borderRadius: (avatarSize + turnRingPad) / 2,
            left: -turnRingPad / 2,
            top: -turnRingPad / 2,
          },
          ringStyle,
        ]}
        pointerEvents="none"
      />
      <Reanimated.View
        style={[
          styles.turnRingCore,
          {
            width: avatarSize + turnCorePad,
            height: avatarSize + turnCorePad,
            borderRadius: (avatarSize + turnCorePad) / 2,
            left: -turnCorePad / 2,
            top: -turnCorePad / 2,
          },
          coreStyle,
        ]}
        pointerEvents="none"
      />
    </>
  );
}

function createStyles() {
  const whiteShadow = (radius: number, opacity = 1) =>
    Platform.select({
      ios: {
        shadowColor: "#ffffff",
        shadowOpacity: opacity,
        shadowRadius: radius,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: Math.round(radius / 2.5) },
      default: {
        shadowColor: "#ffffff",
        shadowOpacity: opacity,
        shadowRadius: radius,
        shadowOffset: { width: 0, height: 0 },
      },
    });

  return StyleSheet.create({
    turnRingHalo: {
      position: "absolute",
      backgroundColor: "rgba(255, 255, 255, 0.14)",
      ...whiteShadow(12, 0.38),
    },
    turnRingGlow: {
      position: "absolute",
      backgroundColor: "rgba(255, 255, 255, 0.24)",
      ...whiteShadow(8, 0.42),
    },
    turnRing: {
      position: "absolute",
      borderWidth: 2.5,
      borderColor: "rgba(255, 255, 255, 0.88)",
      ...whiteShadow(8, 0.52),
    },
    turnRingCore: {
      position: "absolute",
      borderWidth: 1.5,
      borderColor: "rgba(255, 255, 255, 0.82)",
      ...whiteShadow(5, 0.4),
    },
  });
}
