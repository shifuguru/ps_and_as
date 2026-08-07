import { useEffect } from "react";
import {
  AccessibilityInfo,
  Platform,
} from "react-native";
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
  /** Flame intensity — high in ignition, lively in idle. */
  flameIntensity: SharedValue<number>;
  /** Master opacity for all effect layers (dismissal). */
  effectOpacity: SharedValue<number>;
  /** Reward pop on the pill itself (1 = rest). */
  pillScale: SharedValue<number>;
  /** Heat shimmer phase 0→1. */
  shimmer: SharedValue<number>;
  /** Reduced motion — effects dampened / static. */
  reducedMotion: SharedValue<number>;
  phase: SharedValue<number>; // 0 off, 1 ignition, 2 idle
};

function prefersReducedMotionWeb(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
    return !!g.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
}

/**
 * Orchestrates Runs! reward ignition → continuous idle fire.
 * Motion stays on the UI thread via Reanimated.
 */
export function useRunsAnimation(active: boolean): RunsAnimation {
  const ignition = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.85);
  const flameIntensity = useSharedValue(0);
  const effectOpacity = useSharedValue(0);
  const pillScale = useSharedValue(1);
  const shimmer = useSharedValue(0);
  const reducedMotion = useSharedValue(0);
  const phase = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (!mounted) return;
      reducedMotion.value = enabled || prefersReducedMotionWeb() ? 1 : 0;
    });
    if (prefersReducedMotionWeb()) reducedMotion.value = 1;
    return () => {
      mounted = false;
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!active) {
      cancelAnimation(ignition);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      cancelAnimation(flameIntensity);
      cancelAnimation(effectOpacity);
      cancelAnimation(pillScale);
      cancelAnimation(shimmer);
      phase.value = 0;
      effectOpacity.value = withTiming(0, { duration: 220 });
      ignition.value = 0;
      glowOpacity.value = 0;
      glowScale.value = 0.85;
      flameIntensity.value = 0;
      pillScale.value = withTiming(1, { duration: 160 });
      shimmer.value = 0;
      return;
    }

    const reduce = reducedMotion.value > 0.5;
    phase.value = 1;
    effectOpacity.value = withTiming(1, { duration: 140 });

    // Subtle reward pop on the pill
    pillScale.value = withSequence(
      withTiming(0.94, { duration: 1 }),
      withTiming(1.08, {
        duration: RUNS_TIMING.pillPopMs * 0.45,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: RUNS_TIMING.pillPopMs * 0.55,
        easing: Easing.inOut(Easing.quad),
      }),
    );

    if (reduce) {
      glowOpacity.value = withTiming(0.55, { duration: 200 });
      glowScale.value = withTiming(1.02, { duration: 200 });
      flameIntensity.value = withTiming(0.55, { duration: 240 });
      ignition.value = withTiming(0, { duration: 1 });
      shimmer.value = 0;
      phase.value = 2;
      return;
    }

    // Glow bloom → lively idle pulse
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
      withTiming(1.16, {
        duration: RUNS_TIMING.glowBloomMs,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1.05, {
        duration: RUNS_TIMING.settleMs,
        easing: Easing.inOut(Easing.quad),
      }),
      withRepeat(
        withSequence(
          withTiming(1.09, {
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

    // Fire ignites hard, then stays visibly burning
    flameIntensity.value = withSequence(
      withTiming(1, {
        duration: RUNS_TIMING.flameRiseMs,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0.72, {
        duration: RUNS_TIMING.settleMs + 60,
        easing: Easing.inOut(Easing.quad),
      }),
      withRepeat(
        withSequence(
          withTiming(0.9, {
            duration: RUNS_TIMING.idleFlickerPeriodMs / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.64, {
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
        duration: RUNS_TIMING.ignitionMs * 0.5,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0, {
        duration: RUNS_TIMING.ignitionMs * 0.5,
        easing: Easing.in(Easing.quad),
      }),
    );

    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: RUNS_TIMING.shimmerPeriodMs / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: RUNS_TIMING.shimmerPeriodMs / 2,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
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
      cancelAnimation(pillScale);
      cancelAnimation(shimmer);
    };
  }, [
    active,
    ignition,
    glowOpacity,
    glowScale,
    flameIntensity,
    effectOpacity,
    pillScale,
    shimmer,
    reducedMotion,
    phase,
  ]);

  return {
    ignition,
    glowOpacity,
    glowScale,
    flameIntensity,
    effectOpacity,
    pillScale,
    shimmer,
    reducedMotion,
    phase,
  };
}
