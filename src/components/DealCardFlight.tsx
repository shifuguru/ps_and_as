import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Card from "./Card";
import type { CardFlightSpec } from "./TableCardFlight";

type Props = {
  flight: CardFlightSpec;
  durationMs?: number;
  onComplete: (id: string) => void;
};

const LAND_AT = 0.9;
const PEEL_LIFT = -10;
const PEEL_ROTATE_DEG = 3.5;

export default function DealCardFlight({
  flight,
  durationMs = 480,
  onComplete,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const completeFiredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  onCompleteRef.current = onComplete;

  const fromW = flight.fromCardW ?? flight.cardW;
  const fromH = flight.fromCardH ?? flight.cardH;
  const toScaleX = flight.cardW / fromW;
  const toScaleY = flight.cardH / fromH;
  const peelEnd = Math.min(0.18, 90 / Math.max(durationMs, 1));

  const deltaX = flight.toX - flight.fromX;
  const deltaY = flight.toY - flight.fromY;
  const travel = Math.hypot(deltaX, deltaY);
  const arcLift = Math.min(36, Math.max(12, travel * 0.14));
  const flyMid = peelEnd + (LAND_AT - peelEnd) * 0.45;

  useEffect(() => {
    completeFiredRef.current = false;
    progress.setValue(0);

    const finish = () => {
      if (completeFiredRef.current) return;
      completeFiredRef.current = true;
      onCompleteRef.current(flight.id);
    };

    const landListener = progress.addListener(({ value }) => {
      if (value >= LAND_AT) {
        progress.removeListener(landListener);
        animRef.current?.stop();
        finish();
      }
    });

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animRef.current = anim;

    anim.start(({ finished }) => {
      progress.removeListener(landListener);
      if (finished) finish();
    });

    return () => {
      anim.stop();
      progress.removeListener(landListener);
      animRef.current = null;
    };
  }, [flight.id, durationMs, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, peelEnd, LAND_AT],
    outputRange: [0, 0, deltaX],
    extrapolate: "clamp",
  });

  const translateY = progress.interpolate({
    inputRange: [0, peelEnd, flyMid, LAND_AT],
    outputRange: [0, PEEL_LIFT, PEEL_LIFT - arcLift, deltaY],
    extrapolate: "clamp",
  });

  const rotate = progress.interpolate({
    inputRange: [0, peelEnd, LAND_AT],
    outputRange: ["0deg", `${PEEL_ROTATE_DEG}deg`, "0deg"],
    extrapolate: "clamp",
  });

  const scaleX = progress.interpolate({
    inputRange: [0, peelEnd, LAND_AT],
    outputRange: [1, 1.03, toScaleX],
    extrapolate: "clamp",
  });

  const scaleY = progress.interpolate({
    inputRange: [0, peelEnd, LAND_AT],
    outputRange: [1, 1.03, toScaleY],
    extrapolate: "clamp",
  });

  return (
    <View
      pointerEvents="none"
      style={[
        styles.anchor,
        {
          left: flight.fromX,
          top: flight.fromY,
          width: 0,
          height: 0,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.flight,
          {
            width: fromW,
            height: fromH,
            marginLeft: -fromW / 2,
            marginTop: -fromH / 2,
            transform: [
              { translateX },
              { translateY },
              { rotate },
              { scaleX },
              { scaleY },
            ],
          },
        ]}
      >
        <Card
          card={flight.cards[0] ?? { suit: "spades", value: 0, hidden: true }}
          selected={false}
          variant="table"
          faceDown={!!flight.cards[0]?.hidden}
          cornerRadius={flight.cornerRadius}
          style={{ width: fromW, height: fromH }}
          onPress={() => {}}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    overflow: "visible",
    zIndex: 210,
    elevation: 210,
  },
  flight: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
