import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Card from "./Card";

type Props = {
  cardW: number;
  cardH: number;
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
  style,
}: {
  cardW: number;
  cardH: number;
  style?: object;
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
            onPress={() => {}}
            style={{ width: cardW, height: cardH }}
          />
        </View>
      ))}
    </Animated.View>
  );
}

/** One riffle: split two halves, bridge-wiggle, square back up. */
function riffleCycle(
  split: Animated.Value,
  riffle: Animated.Value,
  lift: Animated.Value,
  splitMs: number,
  riffleMs: number,
  mergeMs: number,
) {
  const riffleTicks = Math.max(3, Math.round(riffleMs / 140));
  return Animated.sequence([
    Animated.parallel([
      Animated.timing(split, {
        toValue: 1,
        duration: splitMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 1,
        duration: splitMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]),
    Animated.loop(
      Animated.sequence([
        Animated.timing(riffle, {
          toValue: 1,
          duration: 70,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(riffle, {
          toValue: -1,
          duration: 70,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
      { iterations: riffleTicks },
    ),
    Animated.parallel([
      Animated.timing(split, {
        toValue: 0,
        duration: mergeMs,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: mergeMs,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(riffle, {
        toValue: 0,
        duration: mergeMs,
        useNativeDriver: true,
      }),
    ]),
  ]);
}

export default function DealShuffleAnimation({
  cardW,
  cardH,
  left,
  top,
  running,
  durationMs = 3600,
  onComplete,
}: Props) {
  const split = useRef(new Animated.Value(0)).current;
  const riffle = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const entry = useRef(new Animated.Value(0.82)).current;
  const genRef = useRef(0);

  const splitX = cardW * 0.48;

  useEffect(() => {
    if (!running) return;
    const gen = ++genRef.current;
    const onDone = onComplete;

    split.setValue(0);
    riffle.setValue(0);
    lift.setValue(0);
    entry.setValue(0.82);

    const introMs = 220;
    const settleMs = 260;
    const cycleBudget = Math.max(
      700,
      (durationMs - introMs - settleMs) / SHUFFLE_CYCLES,
    );
    const splitMs = Math.round(cycleBudget * 0.32);
    const riffleMs = Math.round(cycleBudget * 0.38);
    const mergeMs = Math.round(cycleBudget * 0.3);

    const anim = Animated.sequence([
      Animated.timing(entry, {
        toValue: 1,
        duration: introMs,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      ...Array.from({ length: SHUFFLE_CYCLES }, () =>
        riffleCycle(split, riffle, lift, splitMs, riffleMs, mergeMs),
      ),
      Animated.timing(entry, {
        toValue: 1,
        duration: settleMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    anim.start(({ finished }) => {
      if (!finished || gen !== genRef.current) return;
      onDone?.();
    });

    return () => {
      genRef.current += 1;
      anim.stop();
    };
  }, [running, durationMs, split, riffle, lift, entry]);

  const baseCenter = -cardW / 2;

  const leftX = Animated.add(
    split.interpolate({
      inputRange: [0, 1],
      outputRange: [baseCenter, baseCenter - splitX],
    }),
    riffle.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [5, 0, -5],
    }),
  );

  const rightX = Animated.add(
    split.interpolate({
      inputRange: [0, 1],
      outputRange: [baseCenter, baseCenter + splitX],
    }),
    riffle.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [-5, 0, 5],
    }),
  );

  const leftY = Animated.add(
    -cardH / 2,
    Animated.add(
      lift.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -cardH * 0.14],
      }),
      riffle.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [2, 0, -2],
      }),
    ),
  );

  const rightY = Animated.add(
    -cardH / 2,
    Animated.add(
      lift.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -cardH * 0.1],
      }),
      riffle.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [-2, 0, 2],
      }),
    ),
  );

  const leftRotate = Animated.add(
    split.interpolate({
      inputRange: [0, 1],
      outputRange: [-3, -16],
    }),
    riffle.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [4, 0, -4],
    }),
  );

  const rightRotate = Animated.add(
    split.interpolate({
      inputRange: [0, 1],
      outputRange: [3, 16],
    }),
    riffle.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [-4, 0, 4],
    }),
  );

  const leftRotateStr = leftRotate.interpolate({
    inputRange: [-25, 25],
    outputRange: ["-25deg", "25deg"],
  });
  const rightRotateStr = rightRotate.interpolate({
    inputRange: [-25, 25],
    outputRange: ["-25deg", "25deg"],
  });

  if (!running) return null;

  return (
    <Animated.View
      style={[
        styles.root,
        {
          left,
          top,
          transform: [{ scale: entry }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.shadow} />
      <CardPacket
        cardW={cardW}
        cardH={cardH}
        style={{
          zIndex: 2,
          transform: [
            { translateX: leftX },
            { translateY: leftY },
            { rotate: leftRotateStr },
          ],
        }}
      />
      <CardPacket
        cardW={cardW}
        cardH={cardH}
        style={{
          zIndex: 1,
          transform: [
            { translateX: rightX },
            { translateY: rightY },
            { rotate: rightRotateStr },
          ],
        }}
      />
    </Animated.View>
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
