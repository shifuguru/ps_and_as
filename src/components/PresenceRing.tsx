import React, { useEffect, useMemo } from "react";
import { Platform, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import Reanimated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import {
  advancePhase,
  advanceRotationDeg,
  breatheFromPhase,
  PRESENCE_PARAM_SMOOTH_MS,
  PRESENCE_WAVE_MAX_AMPLITUDE_PX,
  smoothToward,
} from "../presence/presenceOscillator";
import {
  PRESENCE_NUDGE_PULSE_MS,
  PRESENCE_RING_PAD,
} from "../presence/presenceTokens";
import type { PresenceRingSpec } from "../presence/types";
import { buildPresenceWavePath } from "../presence/wavePath";

type Props = {
  spec: PresenceRingSpec;
  avatarSize: number;
};

export default function PresenceRing({ spec, avatarSize }: Props) {
  const styles = useMemo(() => createStyles(), []);

  const pulsePeriodSv = useSharedValue(spec.pulsePeriodMs);
  const pulseStrengthSv = useSharedValue(spec.pulseStrength);
  const haloStrengthSv = useSharedValue(spec.haloStrength);
  const intensitySv = useSharedValue(spec.intensity);
  const waveAmplitudeSv = useSharedValue(spec.wave.amplitudePx);
  const wavePeriodSv = useSharedValue(spec.wave.rotationPeriodMs);

  const pulsePeriodTargetSv = useSharedValue(spec.pulsePeriodMs);
  const pulseStrengthTargetSv = useSharedValue(spec.pulseStrength);
  const haloStrengthTargetSv = useSharedValue(spec.haloStrength);
  const intensityTargetSv = useSharedValue(spec.intensity);
  const waveAmplitudeTargetSv = useSharedValue(spec.wave.amplitudePx);
  const wavePeriodTargetSv = useSharedValue(spec.wave.rotationPeriodMs);

  const pulsePhase = useSharedValue(0);
  const nudgePhase = useSharedValue(0);
  const nudgeActive = useSharedValue(spec.nudge ? 1 : 0);
  const waveRotation = useSharedValue(0);

  const useNudge = spec.nudge;
  const showWave =
    spec.wave.rotationPeriodMs > 0 &&
    (spec.wave.amplitudePx > 0 || spec.wave.lobeCount > 0);

  useEffect(() => {
    pulsePeriodTargetSv.value = spec.pulsePeriodMs;
    pulseStrengthTargetSv.value = spec.pulseStrength;
    haloStrengthTargetSv.value = spec.haloStrength;
    intensityTargetSv.value = spec.intensity;
    waveAmplitudeTargetSv.value = spec.wave.amplitudePx;
    wavePeriodTargetSv.value = spec.wave.rotationPeriodMs;
  }, [
    spec.pulsePeriodMs,
    spec.pulseStrength,
    spec.haloStrength,
    spec.intensity,
    spec.wave.amplitudePx,
    spec.wave.rotationPeriodMs,
    pulsePeriodTargetSv,
    pulseStrengthTargetSv,
    haloStrengthTargetSv,
    intensityTargetSv,
    waveAmplitudeTargetSv,
    wavePeriodTargetSv,
  ]);

  useEffect(() => {
    nudgeActive.value = useNudge ? 1 : 0;
  }, [useNudge, nudgeActive]);

  useFrameCallback((frameInfo) => {
    "worklet";
    const dt = frameInfo.timeSincePreviousFrame ?? 16;
    const smooth = PRESENCE_PARAM_SMOOTH_MS;

    pulsePeriodSv.value = pulsePeriodTargetSv.value;
    wavePeriodSv.value = wavePeriodTargetSv.value;

    pulseStrengthSv.value = smoothToward(
      pulseStrengthSv.value,
      pulseStrengthTargetSv.value,
      dt,
      smooth,
    );
    haloStrengthSv.value = smoothToward(
      haloStrengthSv.value,
      haloStrengthTargetSv.value,
      dt,
      smooth,
    );
    intensitySv.value = smoothToward(
      intensitySv.value,
      intensityTargetSv.value,
      dt,
      smooth,
    );
    waveAmplitudeSv.value = smoothToward(
      waveAmplitudeSv.value,
      waveAmplitudeTargetSv.value,
      dt,
      smooth,
    );

    const pulsePeriod = pulsePeriodSv.value;
    if (pulsePeriod > 0) {
      pulsePhase.value = advancePhase(pulsePhase.value, dt, pulsePeriod);
    }

    if (nudgeActive.value > 0) {
      nudgePhase.value = advancePhase(
        nudgePhase.value,
        dt,
        PRESENCE_NUDGE_PULSE_MS * 2,
      );
    }

    const wavePeriod = wavePeriodSv.value;
    if (wavePeriod > 0) {
      waveRotation.value = advanceRotationDeg(
        waveRotation.value,
        dt,
        wavePeriod,
      );
    }
  });

  const haloStyle = useAnimatedStyle(() => {
    const breathe = breatheFromPhase(pulsePhase.value);
    const nudgeBreathe = breatheFromPhase(nudgePhase.value);
    const nudge = nudgeActive.value;
    const strength = haloStrengthSv.value;
    const intensity = intensitySv.value;

    const scale = 1 + strength * breathe * (1 - nudge) + nudge * (0.08 + 0.12 * nudgeBreathe);
    const opacity =
      (0.08 + 0.18 * breathe * intensity) * (1 - nudge) +
      nudge * (0.32 + 0.28 * nudgeBreathe);

    return { transform: [{ scale }], opacity };
  });

  const glowStyle = useAnimatedStyle(() => {
    const breathe = breatheFromPhase(pulsePhase.value);
    const nudgeBreathe = breatheFromPhase(nudgePhase.value);
    const nudge = nudgeActive.value;
    const strength = pulseStrengthSv.value;
    const intensity = intensitySv.value;

    const scale = 1 + strength * breathe * (1 - nudge) + nudge * (0.06 + 0.1 * nudgeBreathe);
    const opacity =
      (0.16 + 0.28 * breathe * intensity) * (1 - nudge) +
      nudge * (0.48 + 0.22 * nudgeBreathe);

    return { transform: [{ scale }], opacity };
  });

  const ringStyle = useAnimatedStyle(() => {
    const breathe = breatheFromPhase(pulsePhase.value);
    const nudgeBreathe = breatheFromPhase(nudgePhase.value);
    const nudge = nudgeActive.value;
    const strength = pulseStrengthSv.value;

    const scale = 1 + strength * breathe * (1 - nudge) + nudge * (0.04 + 0.1 * nudgeBreathe);
    const opacity =
      (0.68 + 0.12 * breathe) * (1 - nudge) + nudge * (0.84 + 0.08 * nudgeBreathe);

    return { transform: [{ scale }], opacity };
  });

  const coreStyle = useAnimatedStyle(() => {
    const breathe = breatheFromPhase(pulsePhase.value);
    const nudgeBreathe = breatheFromPhase(nudgePhase.value);
    const nudge = nudgeActive.value;

    const scale =
      1 +
      pulseStrengthSv.value * breathe * (1 - nudge) +
      nudge * (0.04 + 0.1 * nudgeBreathe);
    const opacity =
      (0.48 + 0.24 * breathe) * (1 - nudge) +
      nudge * (0.62 + 0.16 * nudgeBreathe);

    return { transform: [{ scale }], opacity };
  });

  const { halo, glow, ring, core } = PRESENCE_RING_PAD;
  const waveSize = avatarSize + ring + 8;
  const wavePath = useMemo(
    () =>
      buildPresenceWavePath(
        waveSize,
        PRESENCE_WAVE_MAX_AMPLITUDE_PX,
        spec.wave.lobeCount,
      ),
    [waveSize, spec.wave.lobeCount],
  );

  const waveStyle = useAnimatedStyle(() => {
    const amp = waveAmplitudeSv.value;
    const maxAmp = PRESENCE_WAVE_MAX_AMPLITUDE_PX;
    const ampScale = maxAmp > 0 ? amp / maxAmp : 0;
    const strokeAlpha = 0.28 + intensitySv.value * 0.36;

    return {
      transform: [{ rotate: `${waveRotation.value}deg` }, { scale: ampScale }],
      opacity: ampScale > 0.02 ? strokeAlpha : 0,
    };
  });

  return (
    <>
      <Reanimated.View
        style={[
          styles.turnRingHalo,
          {
            width: avatarSize + halo,
            height: avatarSize + halo,
            borderRadius: (avatarSize + halo) / 2,
            left: -halo / 2,
            top: -halo / 2,
          },
          haloStyle,
        ]}
        pointerEvents="none"
        accessibilityLabel={spec.a11yLabel}
      />
      <Reanimated.View
        style={[
          styles.turnRingGlow,
          {
            width: avatarSize + glow,
            height: avatarSize + glow,
            borderRadius: (avatarSize + glow) / 2,
            left: -glow / 2,
            top: -glow / 2,
          },
          glowStyle,
        ]}
        pointerEvents="none"
      />
      {showWave && wavePath ? (
        <Reanimated.View
          style={[
            styles.waveLayer,
            {
              width: waveSize,
              height: waveSize,
              left: -(waveSize - avatarSize) / 2,
              top: -(waveSize - avatarSize) / 2,
            },
            waveStyle,
          ]}
          pointerEvents="none"
        >
          <Svg width={waveSize} height={waveSize}>
            <Path
              d={wavePath}
              fill="none"
              stroke="rgba(255, 255, 255, 0.92)"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          </Svg>
        </Reanimated.View>
      ) : null}
      <Reanimated.View
        style={[
          styles.turnRing,
          {
            width: avatarSize + ring,
            height: avatarSize + ring,
            borderRadius: (avatarSize + ring) / 2,
            left: -ring / 2,
            top: -ring / 2,
          },
          ringStyle,
        ]}
        pointerEvents="none"
      />
      <Reanimated.View
        style={[
          styles.turnRingCore,
          {
            width: avatarSize + core,
            height: avatarSize + core,
            borderRadius: (avatarSize + core) / 2,
            left: -core / 2,
            top: -core / 2,
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
    waveLayer: {
      position: "absolute",
      zIndex: 1,
    },
  });
}
