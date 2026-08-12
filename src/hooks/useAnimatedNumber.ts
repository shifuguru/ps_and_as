import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

/** Smoothly tween a displayed integer (e.g. career XP counter). */
export function useAnimatedNumber(source: number) {
  const anim = useRef(new Animated.Value(source)).current;
  const [display, setDisplay] = useState(source);
  const animatingRef = useRef(false);

  const sync = useCallback(
    (value: number) => {
      anim.setValue(value);
      setDisplay(value);
    },
    [anim],
  );

  const animateTo = useCallback(
    (target: number, duration = 920) => {
      animatingRef.current = true;
      const listener = anim.addListener(({ value }) => {
        setDisplay(Math.round(value));
      });
      Animated.timing(anim, {
        toValue: target,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        anim.removeListener(listener);
        if (finished) {
          setDisplay(target);
          anim.setValue(target);
        }
        animatingRef.current = false;
      });
    },
    [anim],
  );

  useEffect(() => {
    if (!animatingRef.current) {
      sync(source);
    }
  }, [source, sync]);

  return { display, animateTo, sync, isAnimating: animatingRef };
}
