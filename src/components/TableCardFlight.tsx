import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { CARD_PLAY_FLIGHT_Z } from "../styles/overlayZIndex";
import {
  PLAY_CARD_FLIGHT_MS,
  playFlightMotionVariance,
} from "../utils/playAnimationTiming";
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
  /** Same cap as playGroupTargetFromSpot — keeps flight centre aligned with pile target. */
  maxBundleWidth?: number;
};

type Props = {
  flight: CardFlightSpec;
  durationMs?: number;
  onComplete: (id: string) => void;
};

/** Ease-out deceleration into the pile slot. */
const FLIGHT_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const LAND_AT = 1;

/** Lift before horizontal travel (fraction of progress). */
const LIFT_END = 0.18;
/** Peak arc + rotation during travel. */
const TRAVEL_PEAK = 0.58;
/** Travel nearly complete — gentle settle follows. */
const TRAVEL_END = 0.92;

const LIFT_ROTATE_RATIO = 0.35;
const SETTLE_OVERSHOOT_Y = 1;

export default function TableCardFlight({
  flight,
  durationMs = PLAY_CARD_FLIGHT_MS,
  onComplete,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const completeFiredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  onCompleteRef.current = onComplete;

  const motion = useMemo(() => {
    const isPlayFlight = Math.abs(durationMs - PLAY_CARD_FLIGHT_MS) < 40;
    return isPlayFlight
      ? playFlightMotionVariance(flight.id)
      : {
          durationMs,
          liftPx: 8,
          peakRotateDeg: 1,
        };
  }, [durationMs, flight.id]);

  const bundle = useMemo(
    () =>
      layoutPlayBundle(
        flight.cards,
        flight.cardW,
        flight.maxBundleWidth,
        flight.cardH,
      ),
    [flight.cards, flight.cardW, flight.cardH, flight.maxBundleWidth],
  );

  const deltaX = flight.toX - flight.fromX;
  const deltaY = flight.toY - flight.fromY;
  const travel = Math.hypot(deltaX, deltaY);
  const arcLift = Math.min(24, Math.max(10, travel * 0.12));
  const liftPx = motion.liftPx;
  const rotateSign = deltaX >= 0 ? 1 : -1;
  const peakRotate = `${rotateSign * motion.peakRotateDeg}deg`;
  const liftRotate = `${rotateSign * motion.peakRotateDeg * LIFT_ROTATE_RATIO}deg`;
  const travelRotate = `${rotateSign * motion.peakRotateDeg * 0.15}deg`;
  const arcMidY = deltaY * TRAVEL_PEAK - Math.max(arcLift * 0.65, liftPx * 0.4);

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
      duration: motion.durationMs,
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
  }, [flight.id, motion.durationMs, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, LIFT_END, TRAVEL_END, LAND_AT],
    outputRange: [0, 0, deltaX * 0.97, deltaX],
    extrapolate: "clamp",
  });

  const translateY = progress.interpolate({
    inputRange: [0, LIFT_END, TRAVEL_PEAK, TRAVEL_END, LAND_AT],
    outputRange: [
      0,
      -liftPx,
      arcMidY,
      deltaY + SETTLE_OVERSHOOT_Y,
      deltaY,
    ],
    extrapolate: "clamp",
  });

  const startScale =
    flight.fromCardW && flight.cardW > 0
      ? flight.fromCardW / flight.cardW
      : 0.68;

  const scale = progress.interpolate({
    inputRange: [0, LIFT_END, TRAVEL_PEAK, TRAVEL_END, LAND_AT],
    outputRange: [
      startScale,
      startScale * 1.02,
      1.008,
      1.002,
      1,
    ],
    extrapolate: "clamp",
  });

  const rotate = progress.interpolate({
    inputRange: [0, LIFT_END, TRAVEL_PEAK, TRAVEL_END, LAND_AT],
    outputRange: ["0deg", liftRotate, peakRotate, travelRotate, "0deg"],
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
          zIndex: CARD_PLAY_FLIGHT_Z,
          elevation: CARD_PLAY_FLIGHT_Z,
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
            transform: [{ translateX }, { translateY }, { rotate }, { scale }],
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
