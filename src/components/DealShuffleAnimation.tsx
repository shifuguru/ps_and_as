import React, { useEffect, useRef } from "react";
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
import Card from "./Card";

type Props = {
  cardW: number;
  cardH: number;
  cornerRadius?: number;
  left: number;
  top: number;
  running: boolean;
  durationMs?: number;
  onComplete?: () => void;
};

const CARDS_PER_PACKET = 5;
const SHUFFLE_CYCLES = 3;

function CardPacket({
  cardW,
  cardH,
  cornerRadius,
  style,
}: {
  cardW: number;
  cardH: number;
  cornerRadius?: number;
  style?: AnimatedStyle<ViewStyle>;
}) {
  return (
    <Animated.View style={[styles.packet, style]}>
      {Array.from({ length: CARDS_PER_PACKET }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.packetCard,
            {
              left: i * 1.8,
              top: i * 1.2,
              width: cardW,
              height: cardH,
              zIndex: i,
            },
          ]}
        >
          <Card
            card={{ suit: "spades", value: 0 }}
            selected={false}
            faceDown
            variant="table"
            cornerRadius={cornerRadius}
            onPress={() => {}}
            style={{ width: cardW, height: cardH }}
          />
        </View>
      ))}
    </Animated.View>
  );
}

function riffleWiggleSteps(riffleMs: number) {
  const riffleTicks = Math.max(3, Math.round(riffleMs / 140));
  const steps = [];
  for (let i = 0; i < riffleTicks; i += 1) {
    steps.push(
      withTiming(1, { duration: 70, easing: Easing.inOut(Easing.quad) }),
      withTiming(-1, { duration: 70, easing: Easing.inOut(Easing.quad) }),
    );
  }
  return steps;
}

export default function DealShuffleAnimation({
  cardW,
  cardH,
  cornerRadius,
  left,
  top,
  running,
  durationMs = 3600,
  onComplete,
}: Props) {
  const split = useSharedValue(0);
  const riffle = useSharedValue(0);
  const lift = useSharedValue(0);
  const entry = useSharedValue(0.82);
  const genRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const splitX = cardW * 0.48;
  const baseCenter = -cardW / 2;
  const packetCenterY = -cardH / 2;

  useEffect(() => {
    if (!running) return;
    const gen = ++genRef.current;

    split.value = 0;
    riffle.value = 0;
    lift.value = 0;
    entry.value = 0.82;

    const introMs = 220;
    const settleMs = 260;
    const cycleBudget = Math.max(
      700,
      (durationMs - introMs - settleMs) / SHUFFLE_CYCLES,
    );
    const splitMs = Math.round(cycleBudget * 0.32);
    const riffleMs = Math.round(cycleBudget * 0.38);
    const mergeMs = Math.round(cycleBudget * 0.3);

    const splitCycle = withSequence(
      withTiming(1, {
        duration: splitMs,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0, {
        duration: mergeMs,
        easing: Easing.inOut(Easing.cubic),
      }),
    );

    const liftCycle = withSequence(
      withTiming(1, {
        duration: splitMs,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0, {
        duration: mergeMs,
        easing: Easing.inOut(Easing.cubic),
      }),
    );

    const riffleWiggleCycle = withSequence(
      withTiming(0, { duration: splitMs }),
      ...riffleWiggleSteps(riffleMs),
      withTiming(0, { duration: mergeMs }),
    );

    entry.value = withTiming(1, {
      duration: introMs,
      easing: Easing.out(Easing.back(1.4)),
    });

    split.value = withDelay(
      introMs,
      withRepeat(splitCycle, SHUFFLE_CYCLES, false),
    );
    lift.value = withDelay(
      introMs,
      withRepeat(liftCycle, SHUFFLE_CYCLES, false),
    );
    riffle.value = withDelay(
      introMs,
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
  }, [running, durationMs, split, lift, riffle, entry]);

  const rootStyle = useAnimatedStyle(() => ({
    transform: [{ scale: entry.value }],
  }));

  const leftStyle = useAnimatedStyle(() => {
    const translateX =
      baseCenter + split.value * -splitX + riffle.value * 5;
    const translateY = lift.value * -cardH * 0.14 + riffle.value * 2;
    const rotateDeg = -3 + split.value * -13 + riffle.value * 4;
    return {
      top: packetCenterY,
      zIndex: 2,
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotateDeg}deg` },
      ],
    } as any;
  });

  const rightStyle = useAnimatedStyle(() => {
    const translateX =
      baseCenter + split.value * splitX + riffle.value * -5;
    const translateY = lift.value * -cardH * 0.1 + riffle.value * -2;
    const rotateDeg = 3 + split.value * 13 + riffle.value * -4;
    return {
      top: packetCenterY,
      zIndex: 1,
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotateDeg}deg` },
      ],
    } as any;
  });

  if (!running) return null;

  return (
    <View
      style={[styles.root, { left, top }]}
      pointerEvents="none"
      collapsable={false}
    >
      <View style={styles.shadow} />
      <Animated.View style={rootStyle}>
        <CardPacket
          cardW={cardW}
          cardH={cardH}
          cornerRadius={cornerRadius}
          style={leftStyle}
        />
        <CardPacket
          cardW={cardW}
          cardH={cardH}
          cornerRadius={cornerRadius}
          style={rightStyle}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    zIndex: 82,
    alignItems: "center",
    justifyContent: "center",
  },
  shadow: {
    position: "absolute",
    width: 72,
    height: 10,
    bottom: -6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  packet: {
    position: "absolute",
  },
  packetCard: {
    position: "absolute",
  },
});
