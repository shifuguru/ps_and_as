import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  type AnimatedStyle,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { ViewStyle } from "react-native";
import {
  DealStackPile,
  handDealStackCenterFrame,
} from "./DealHandStack";

type Props = {
  cardW: number;
  cardH: number;
  left: number;
  top: number;
  running: boolean;
  durationMs?: number;
  deckCount?: number;
  onComplete?: () => void;
  /** Render inside the bottom hand zone instead of a screen-positioned overlay. */
  embedded?: boolean;
};

const SHUFFLE_CYCLES = 4;

function CenteredPile({
  cardW,
  cardH,
  count,
  deckSize,
  style,
}: {
  cardW: number;
  cardH: number;
  count: number;
  deckSize: number;
  style?: AnimatedStyle<ViewStyle>;
}) {
  const frame = useMemo(
    () => handDealStackCenterFrame(count, cardW, cardH, deckSize),
    [count, cardW, cardH, deckSize],
  );

  return (
    <Animated.View
      style={[
        styles.pileSlot,
        {
          width: frame.width,
          height: frame.height,
          marginLeft: frame.left,
          marginTop: frame.top,
        },
        style,
      ]}
    >
      <DealStackPile
        count={count}
        cardWidth={cardW}
        cardHeight={cardH}
        deckSize={deckSize}
      />
    </Animated.View>
  );
}

function riffleWiggleSteps(riffleMs: number) {
  const riffleTicks = Math.max(4, Math.round(riffleMs / 120));
  const steps = [];
  for (let i = 0; i < riffleTicks; i += 1) {
    steps.push(
      withTiming(1, { duration: 60, easing: Easing.inOut(Easing.quad) }),
      withTiming(-1, { duration: 60, easing: Easing.inOut(Easing.quad) }),
    );
  }
  return steps;
}

export default function DealShuffleAnimation({
  cardW,
  cardH,
  left,
  top,
  running,
  durationMs = 4800,
  deckCount = 54,
  onComplete,
  embedded = false,
}: Props) {
  const split = useSharedValue(0);
  const riffle = useSharedValue(0);
  const lift = useSharedValue(0);
  const entry = useSharedValue(0.92);
  const genRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const halfCount = Math.max(1, Math.floor(deckCount / 2));
  const rightCount = deckCount - halfCount;
  const splitX = cardW * 0.44;
  const stageFrame = useMemo(
    () => handDealStackCenterFrame(deckCount, cardW, cardH, deckCount),
    [deckCount, cardW, cardH],
  );

  const timing = useMemo(() => {
    const introMs = 380;
    const splitOutMs = 520;
    const mergeInMs = 580;
    const holdMs = 480;
    const riffleBudget = Math.max(
      1600,
      durationMs - introMs - splitOutMs - mergeInMs - holdMs,
    );
    const cycleBudget = riffleBudget / SHUFFLE_CYCLES;
    const splitMs = Math.round(cycleBudget * 0.32);
    const riffleMs = Math.round(cycleBudget * 0.4);
    const mergeCycleMs = Math.round(cycleBudget * 0.28);
    const riffleStart = introMs + splitOutMs;
    return {
      introMs,
      splitOutMs,
      mergeInMs,
      riffleStart,
      splitMs,
      riffleMs,
      mergeCycleMs,
    };
  }, [durationMs]);

  useEffect(() => {
    if (!running) return;
    const gen = ++genRef.current;

    split.value = 0;
    riffle.value = 0;
    lift.value = 0;
    entry.value = 0.92;

    const { introMs, splitOutMs, mergeInMs, riffleStart, splitMs, riffleMs, mergeCycleMs } =
      timing;

    const riffleCycle = withSequence(
      withTiming(0, {
        duration: mergeCycleMs,
        easing: Easing.inOut(Easing.cubic),
      }),
      withTiming(0, { duration: riffleMs }),
      withTiming(1, {
        duration: splitMs,
        easing: Easing.out(Easing.cubic),
      }),
    );

    const liftCycle = withSequence(
      withTiming(0, { duration: mergeCycleMs }),
      withTiming(1, {
        duration: splitMs * 0.85,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0, {
        duration: riffleMs,
        easing: Easing.inOut(Easing.quad),
      }),
    );

    const riffleWiggleCycle = withSequence(
      withTiming(0, { duration: mergeCycleMs }),
      ...riffleWiggleSteps(riffleMs),
      withTiming(0, { duration: splitMs }),
    );

    entry.value = withTiming(1, {
      duration: introMs,
      easing: Easing.out(Easing.cubic),
    });

    split.value = withSequence(
      withDelay(introMs, withTiming(1, { duration: splitOutMs, easing: Easing.inOut(Easing.cubic) })),
      withRepeat(riffleCycle, SHUFFLE_CYCLES, false),
      withTiming(0, { duration: mergeInMs, easing: Easing.inOut(Easing.cubic) }),
    );

    lift.value = withDelay(riffleStart, withRepeat(liftCycle, SHUFFLE_CYCLES, false));
    riffle.value = withDelay(
      riffleStart,
      withRepeat(riffleWiggleCycle, SHUFFLE_CYCLES, false),
    );

    const completeTimer = setTimeout(() => {
      if (gen !== genRef.current) return;
      onCompleteRef.current?.();
    }, durationMs);

    return () => {
      genRef.current += 1;
      clearTimeout(completeTimer);
      cancelAnimation(split);
      cancelAnimation(lift);
      cancelAnimation(riffle);
      cancelAnimation(entry);
    };
  }, [running, durationMs, timing, split, lift, riffle, entry]);

  const rootStyle = useAnimatedStyle(() => ({
    transform: [{ scale: entry.value }],
  }));

  const fullDeckStyle = useAnimatedStyle(() => {
    const t = split.value;
    const visible = t < 0.06 ? 1 : Math.max(0, 1 - (t - 0.06) * 3.5);
    return { opacity: visible };
  });

  const halvesStyle = useAnimatedStyle(() => {
    const t = split.value;
    const visible = t < 0.04 ? 0 : Math.min(1, t * 2.2);
    return { opacity: visible };
  });

  const leftStyle = useAnimatedStyle(() => {
    const sep = split.value;
    const translateX = -splitX * sep + riffle.value * 4;
    const translateY = lift.value * -cardH * 0.12 + riffle.value * 2;
    const rotateDeg = -2 + sep * -12 + riffle.value * 4;
    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotateDeg}deg` },
      ],
    } as ViewStyle;
  });

  const rightStyle = useAnimatedStyle(() => {
    const sep = split.value;
    const translateX = splitX * sep + riffle.value * -4;
    const translateY = lift.value * -cardH * 0.1 + riffle.value * -2;
    const rotateDeg = 2 + sep * 12 + riffle.value * -4;
    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotateDeg}deg` },
      ],
    } as ViewStyle;
  });

  if (!running) return null;

  const stage = (
    <Animated.View
      style={[
        styles.stage,
        {
          width: stageFrame.width,
          height: stageFrame.height,
          marginLeft: stageFrame.left,
          marginTop: stageFrame.top,
        },
        rootStyle,
      ]}
    >
      <Animated.View style={[styles.pileLayer, fullDeckStyle]}>
        <DealStackPile
          count={deckCount}
          cardWidth={cardW}
          cardHeight={cardH}
          deckSize={deckCount}
        />
      </Animated.View>
      <Animated.View style={[styles.pileLayer, halvesStyle]}>
        <View
          style={{
            position: "absolute",
            left: stageFrame.width / 2,
            top: stageFrame.height / 2,
          }}
        >
          <CenteredPile
            cardW={cardW}
            cardH={cardH}
            count={halfCount}
            deckSize={deckCount}
            style={leftStyle}
          />
          <CenteredPile
            cardW={cardW}
            cardH={cardH}
            count={rightCount}
            deckSize={deckCount}
            style={rightStyle}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );

  if (embedded) {
    return (
      <View style={styles.embeddedRoot} pointerEvents="none" collapsable={false}>
        {stage}
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { left, top }]}
      pointerEvents="none"
      collapsable={false}
    >
      {stage}
    </View>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  root: {
    position: "absolute",
    zIndex: 201,
    elevation: 201,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    position: "relative",
  },
  pileLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  pileSlot: {
    position: "absolute",
  },
});
