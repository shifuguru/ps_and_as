import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Card from "./Card";
import type { Card as CardType } from "../game/ruleset";
import { layoutPlayBundle } from "../utils/tablePlayLayout";

export type CardFlightSpec = {
  id: string;
  cards: CardType[];
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  cardW: number;
  cardH: number;
  cornerRadius?: number;
  /** Deal ceremony — size of the card on the deck before peel. */
  fromCardW?: number;
  fromCardH?: number;
  /** Play flew from the local hand — parent may render in a screen-level overlay. */
  fromLocalHand?: boolean;
};

type Props = {
  flight: CardFlightSpec;
  durationMs?: number;
  onComplete: (id: string) => void;
};

const FLIGHT_EASING = Easing.bezier(0.25, 0.85, 0.35, 1);
/** Progress when the flying copy reaches the table slot — hand off to GameTable here. */
const LAND_AT = 1;

export default function TableCardFlight({
  flight,
  durationMs = 640,
  onComplete,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const completeFiredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  onCompleteRef.current = onComplete;

  const bundle = useMemo(
    () =>
      layoutPlayBundle(flight.cards.length, flight.cardW, undefined, flight.cardH),
    [flight.cards.length, flight.cardW, flight.cardH],
  );

  const deltaX = flight.toX - flight.fromX;
  const deltaY = flight.toY - flight.fromY;
  const travel = Math.hypot(deltaX, deltaY);
  const arcLift = Math.min(36, Math.max(12, travel * 0.14));

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
      easing: FLIGHT_EASING,
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
    inputRange: [0, LAND_AT],
    outputRange: [0, deltaX],
    extrapolate: "clamp",
  });

  const translateY = progress.interpolate({
    inputRange: [0, 0.45, LAND_AT],
    outputRange: [0, -arcLift, deltaY],
    extrapolate: "clamp",
  });

  const startScale =
    flight.fromCardW && flight.cardW > 0
      ? flight.fromCardW / flight.cardW
      : 0.68;

  const scale = progress.interpolate({
    inputRange: [0, LAND_AT],
    outputRange: [startScale, 1],
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
          zIndex: 10000,
          elevation: 10000,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.flight,
          {
            width: bundle.width,
            height: bundle.height,
            marginLeft: -bundle.width / 2,
            marginTop: -bundle.height / 2,
            transform: [{ translateX }, { translateY }, { scale }],
          },
        ]}
      >
        {flight.cards.map((card, cardIndex) => (
          <View
            key={`${card.suit}-${card.value}-${cardIndex}`}
            style={[
              styles.bundleCard,
              {
                left: bundle.cardOffsets[cardIndex] ?? 0,
                width: flight.cardW,
                height: flight.cardH,
                zIndex: cardIndex,
              },
            ]}
          >
            <Card
              card={card}
              selected={false}
              highlight={0}
              disabled={false}
              variant="table"
              faceDown={!!card.hidden}
              cornerRadius={flight.cornerRadius}
              style={{ width: flight.cardW, height: flight.cardH }}
              onPress={() => {}}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    overflow: "visible",
  },
  flight: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "visible",
  },
  bundleCard: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
});
