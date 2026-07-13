import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

/** Fade in → scale → one gentle pulse → static rest. */
export const TURN_INTRO_MS = 520;

export const TURN_INTRO_FADE = 0.28;
export const TURN_INTRO_PEAK = 0.52;
export const TURN_INTRO_SETTLE = 0.78;

const TURN_INTRO_EASING = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Runs a one-shot turn intro when `active` rises false → true.
 * Holds at progress 1 while the turn continues; resets when inactive.
 */
export function useTurnIntroAnimation(active: boolean, disabled = false) {
  const progress = useRef(new Animated.Value(0)).current;
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (!active || disabled) {
      progress.stopAnimation();
      progress.setValue(0);
      wasActiveRef.current = false;
      return;
    }

    if (wasActiveRef.current) {
      progress.setValue(1);
      return;
    }

    wasActiveRef.current = true;
    progress.setValue(0);

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: TURN_INTRO_MS,
      easing: TURN_INTRO_EASING,
      useNativeDriver: true,
    });
    anim.start();

    return () => anim.stop();
  }, [active, disabled, progress]);

  return progress;
}
