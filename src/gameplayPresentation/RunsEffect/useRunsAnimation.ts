import { useEffect } from "react";
import {
  Easing,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  type SharedValue,
} from "react-native-reanimated";
import { RUNS_TIMING } from "./constants";

export type RunsAnimPhase = "ignition" | "idle" | "off";

export type RunsAnimation = {
  /** 0→1 ignition progress (drives burst / flame rise). */
  ignition: SharedValue<number>;
  /** Soft glow opacity (ignition peak then idle breathe). */
  glowOpacity: SharedValue<number>;
  /** Glow scale (bloom then idle). */
  glowScale: SharedValue<number>;
  /** Flame intensity — high in ignition, low in idle. */
  flameIntensity: SharedValue<number>;
  /** Master opacity for all effect layers (dismissal). */
  effectOpacity: SharedValue<number>;
  phase: SharedValue<number>; // 0 off, 1 ignition, 2 idle
};

/**
 * Orchestrates Runs! energy: ignition (~850ms) → idle flicker.
 * Motion stays on the UI thread via Reanimated.
 */
export function useRunsAnimation(active: boolean): RunsAnimation {
  const ignition = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.85);
  const flameIntensity = useSharedValue(0);
  const effectOpacity = useSharedValue(0);
  const phase = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(ignition);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      cancelAnimation(flameIntensity);
      cancelAnimation(effectOpacity);
      phase.value = 0;
      effectOpacity.value = withTiming(0, { duration: 220 });
      ignition.value = 0;
      glowOpacity.value = 0;
      glowScale.value = 0.85;
      flameIntensity.value = 0;
      return;
    }

    phase.value = 1;
    effectOpacity.value = withTiming(1, { duration: 160 });

    // Ignition bloom — hot flash, then a lively idle breathe (stay visibly on fire)
    glowOpacity.value = withSequence(
      withTiming(1, {
        duration: RUNS_TIMING.glowBloomMs,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0.62, {
        duration: RUNS_TIMING.settleMs,
        easing: Easing.inOut(Easing.quad),
      }),
      withRepeat(
        withSequence(
          withTiming(0.78, {
            duration: RUNS_TIMING.idleGlowPeriodMs / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.55, {
            duration: RUNS_TIMING.idleGlowPeriodMs / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );

    glowScale.value = withSequence(
      withTiming(1.12, {
        duration: RUNS_TIMING.glowBloomMs,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1.04, {
        duration: RUNS_TIMING.settleMs,
        easing: Easing.inOut(Easing.quad),
      }),
      withRepeat(
        withSequence(
          withTiming(1.07, {
            duration: RUNS_TIMING.idleGlowPeriodMs / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(1.02, {
            duration: RUNS_TIMING.idleGlowPeriodMs / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );

    // Flame rise then settle to a strong idle flicker (reference = always burning)
    flameIntensity.value = withSequence(
      withTiming(1, {
        duration: RUNS_TIMING.flameRiseMs,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0.68, {
        duration: RUNS_TIMING.settleMs + 80,
        easing: Easing.inOut(Easing.quad),
      }),
      withRepeat(
        withSequence(
          withTiming(0.88, {
            duration: RUNS_TIMING.idleFlickerPeriodMs / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.58, {
            duration: RUNS_TIMING.idleFlickerPeriodMs / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );

    ignition.value = withSequence(
      withTiming(1, {
        duration: RUNS_TIMING.ignitionMs * 0.55,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0, {
        duration: RUNS_TIMING.ignitionMs * 0.45,
        easing: Easing.in(Easing.quad),
      }),
    );

    phase.value = withDelay(
      RUNS_TIMING.ignitionMs,
      withTiming(2, { duration: 1 }),
    );

    return () => {
      cancelAnimation(ignition);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      cancelAnimation(flameIntensity);
      cancelAnimation(effectOpacity);
    };
  }, [
    active,
    ignition,
    glowOpacity,
    glowScale,
    flameIntensity,
    effectOpacity,
    phase,
  ]);

  return {
    ignition,
    glowOpacity,
    glowScale,
    flameIntensity,
    effectOpacity,
    phase,
  };
}
