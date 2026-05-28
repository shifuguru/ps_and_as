import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Card from "./Card";
import TableCardFlight, { type CardFlightSpec } from "./TableCardFlight";
import { tableCardDimensions } from "./cardDimensions";
import type { PlayAreaLayout } from "../utils/tableLayout";
import { seatOriginInPlayArea } from "../utils/tablePlayFlight";
import type { ClientPendingTrade } from "../game/roundPrep";
import { useAppTheme } from "../context/ThemeContext";
import {
  buildClockwiseDealSteps,
  dealRecipientOrder,
} from "../utils/tableSeats";

type Props = {
  visible: boolean;
  playerIds: string[];
  layoutSeatIds: string[];
  localPlayerIds: string[];
  dealerId?: string | null;
  deadHandId?: string | null;
  layout: PlayAreaLayout | null;
  playAreaHeight: number;
  /** Screen offset of the play area (for full-screen overlay alignment). */
  playAreaOffsetTop?: number;
  playAreaOffsetLeft?: number;
  cardsPerPlayer: number;
  pendingTrades?: ClientPendingTrade[];
  onDealComplete: () => void;
  onMandatoryTradesAnimated?: () => void;
};

const SHUFFLE_MS = 3400;
const DEAL_FLIGHT_MS = 580;
/** Pause after each card lands before the next clockwise deal. */
const DEAL_STEP_GAP_MS = 180;
/** Off-table seats still advance the deal order at a readable pace. */
const HIDDEN_SEAT_DEAL_MS = 320;
const MANDATORY_TRADE_MS = 720;

export default function DealCeremonyOverlay({
  visible,
  playerIds,
  layoutSeatIds,
  localPlayerIds,
  dealerId = null,
  deadHandId = null,
  layout,
  playAreaHeight,
  playAreaOffsetTop = 0,
  playAreaOffsetLeft = 0,
  cardsPerPlayer,
  pendingTrades = [],
  onDealComplete,
  onMandatoryTradesAnimated,
}: Props) {
  const { colors } = useAppTheme();
  const { width: screenW } = useWindowDimensions();
  const dims = tableCardDimensions();
  const shuffleSpin = useRef(new Animated.Value(0)).current;
  const shuffleScale = useRef(new Animated.Value(0.85)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;

  const [phase, setPhase] = useState<"shuffle" | "deal" | "trade" | "done">(
    "shuffle",
  );
  const [dealRound, setDealRound] = useState(0);
  const [activeFlights, setActiveFlights] = useState<CardFlightSpec[]>([]);
  const [dealtCounts, setDealtCounts] = useState<Record<string, number>>({});

  const onDealCompleteRef = useRef(onDealComplete);
  onDealCompleteRef.current = onDealComplete;
  const onMandatoryTradesAnimatedRef = useRef(onMandatoryTradesAnimated);
  onMandatoryTradesAnimatedRef.current = onMandatoryTradesAnimated;
  const ceremonyFinishedRef = useRef(false);
  const dealRoundRef = useRef(dealRound);
  dealRoundRef.current = dealRound;
  const dealStepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shuffleGenRef = useRef(0);

  const offsetPoint = useCallback(
    (x: number, y: number) => ({
      x: x + playAreaOffsetLeft,
      y: y + playAreaOffsetTop,
    }),
    [playAreaOffsetLeft, playAreaOffsetTop],
  );

  const finishCeremony = () => {
    if (ceremonyFinishedRef.current) return;
    ceremonyFinishedRef.current = true;
    setPhase("done");
    onDealCompleteRef.current();
  };

  const seatOptions = useMemo(
    () => ({ deadHandId }),
    [deadHandId],
  );

  const deckCenter = useMemo(() => {
    if (layout && dealerId) {
      const dealerPos = seatOriginInPlayArea(
        layout,
        playAreaHeight,
        dealerId,
        layoutSeatIds,
        localPlayerIds,
        seatOptions,
      );
      if (dealerPos) return dealerPos;
    }
    if (!layout) return { x: screenW / 2, y: playAreaHeight / 2 };
    return { x: layout.playAnchorX, y: layout.playAnchorY };
  }, [
    layout,
    screenW,
    playAreaHeight,
    dealerId,
    layoutSeatIds,
    localPlayerIds,
    seatOptions,
  ]);

  const dealSteps = useMemo(() => {
    const recipientOrder = dealRecipientOrder(playerIds, dealerId);
    return buildClockwiseDealSteps(recipientOrder, cardsPerPlayer);
  }, [cardsPerPlayer, playerIds, dealerId]);

  const dealStepsRef = useRef(dealSteps);
  dealStepsRef.current = dealSteps;

  const advanceDealRound = useCallback((playerId: string) => {
    setDealtCounts((prev) => ({
      ...prev,
      [playerId]: (prev[playerId] ?? 0) + 1,
    }));
    if (dealStepTimerRef.current) {
      clearTimeout(dealStepTimerRef.current);
    }
    dealStepTimerRef.current = setTimeout(() => {
      dealStepTimerRef.current = null;
      setDealRound((r) => r + 1);
    }, DEAL_STEP_GAP_MS);
  }, []);

  const handleDealFlightComplete = useCallback(
    (flightId: string) => {
      const round = dealRoundRef.current;
      if (flightId !== `deal-${round}`) return;
      const step = dealStepsRef.current[round];
      if (!step) return;
      setActiveFlights([]);
      advanceDealRound(step.playerId);
    },
    [advanceDealRound],
  );

  useEffect(() => {
    if (!visible) return;
    const gen = ++shuffleGenRef.current;
    ceremonyFinishedRef.current = false;
    setPhase("shuffle");
    setDealRound(0);
    setDealtCounts({});
    setActiveFlights([]);
    shuffleSpin.setValue(0);
    shuffleScale.setValue(0.85);

    const shuffleAnim = Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(shuffleSpin, {
            toValue: 1,
            duration: 280,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(shuffleSpin, {
            toValue: -1,
            duration: 280,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        { iterations: 5 },
      ),
      Animated.sequence([
        Animated.timing(shuffleScale, {
          toValue: 1.05,
          duration: SHUFFLE_MS / 2,
          useNativeDriver: true,
        }),
        Animated.timing(shuffleScale, {
          toValue: 1,
          duration: SHUFFLE_MS / 2,
          useNativeDriver: true,
        }),
      ]),
    ]);

    shuffleAnim.start(({ finished }) => {
      if (!finished || gen !== shuffleGenRef.current) return;
      setPhase("deal");
    });

    return () => {
      shuffleGenRef.current += 1;
      shuffleAnim.stop();
    };
  }, [visible, shuffleSpin, shuffleScale]);

  useEffect(() => {
    return () => {
      if (dealStepTimerRef.current) {
        clearTimeout(dealStepTimerRef.current);
        dealStepTimerRef.current = null;
      }
      if (dealWatchdogRef.current) {
        clearTimeout(dealWatchdogRef.current);
        dealWatchdogRef.current = null;
      }
    };
  }, []);

  // Belt-and-suspenders: never leave the table locked if layout or timers stall.
  useEffect(() => {
    if (!visible) return;
    const perCardMs = DEAL_FLIGHT_MS + DEAL_STEP_GAP_MS + 80;
    const maxMs =
      SHUFFLE_MS +
      Math.max(dealSteps.length, 1) * perCardMs +
      (pendingTrades.length > 0 ? MANDATORY_TRADE_MS + 600 : 600);
    const timer = setTimeout(() => finishCeremony(), maxMs);
    return () => clearTimeout(timer);
  }, [visible, dealSteps.length, pendingTrades.length]);

  useEffect(() => {
    if (phase !== "deal" || !visible) return;
    if (dealRound >= dealSteps.length) {
      if (pendingTrades.length > 0) {
        setPhase("trade");
      } else {
        finishCeremony();
      }
      return;
    }

    const step = dealSteps[dealRound];
    const visibleSeat = layoutSeatIds.includes(step.playerId);
    const target =
      layout && visibleSeat
        ? seatOriginInPlayArea(
            layout,
            playAreaHeight,
            step.playerId,
            layoutSeatIds,
            localPlayerIds,
            seatOptions,
          )
        : null;

    if (!layout || !visibleSeat || !target) {
      const timer = setTimeout(
        () => advanceDealRound(step.playerId),
        HIDDEN_SEAT_DEAL_MS,
      );
      return () => clearTimeout(timer);
    }

    const flightId = `deal-${dealRound}`;
    const from = offsetPoint(deckCenter.x, deckCenter.y);
    const to = offsetPoint(target.x, target.y);
    const flight: CardFlightSpec = {
      id: flightId,
      cards: [{ suit: "spades", value: 0, hidden: true }],
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      cardW: dims.width * 0.72,
      cardH: dims.height * 0.72,
    };

    if (dealWatchdogRef.current) {
      clearTimeout(dealWatchdogRef.current);
    }
    const roundAtStart = dealRound;
    dealWatchdogRef.current = setTimeout(() => {
      dealWatchdogRef.current = null;
      if (dealRoundRef.current !== roundAtStart) return;
      handleDealFlightComplete(flightId);
    }, DEAL_FLIGHT_MS + DEAL_STEP_GAP_MS + 120);

    setActiveFlights([flight]);
  }, [
    phase,
    dealRound,
    dealSteps,
    visible,
    layout,
    playAreaHeight,
    layoutSeatIds,
    localPlayerIds,
    deckCenter,
    dims,
    pendingTrades.length,
    seatOptions,
    advanceDealRound,
    offsetPoint,
    handleDealFlightComplete,
  ]);

  useEffect(() => {
    if (phase !== "trade" || !visible) return;

    if (!layout) {
      onMandatoryTradesAnimatedRef.current?.();
      finishCeremony();
      return;
    }

    const flights: CardFlightSpec[] = [];
    pendingTrades.forEach((trade, idx) => {
      const from = seatOriginInPlayArea(
        layout,
        playAreaHeight,
        trade.loserId,
        layoutSeatIds,
        localPlayerIds,
        seatOptions,
      );
      const to = seatOriginInPlayArea(
        layout,
        playAreaHeight,
        trade.winnerId,
        layoutSeatIds,
        localPlayerIds,
        seatOptions,
      );
      if (!from || !to) return;
      const fromPt = offsetPoint(from.x, from.y);
      const toPt = offsetPoint(to.x, to.y);
      flights.push({
        id: `trade-${idx}`,
        cards: trade.incoming.length
          ? trade.incoming
          : [{ suit: "hearts", value: 10 }],
        fromX: fromPt.x,
        fromY: fromPt.y,
        toX: toPt.x,
        toY: toPt.y,
        cardW: dims.width * 0.65,
        cardH: dims.height * 0.65,
      });
    });

    if (flights.length === 0) {
      onMandatoryTradesAnimatedRef.current?.();
      finishCeremony();
      return;
    }

    setActiveFlights(flights);
    const timer = setTimeout(() => {
      onMandatoryTradesAnimatedRef.current?.();
      finishCeremony();
    }, MANDATORY_TRADE_MS + 180);

    return () => clearTimeout(timer);
  }, [
    phase,
    visible,
    layout,
    playAreaHeight,
    pendingTrades,
    layoutSeatIds,
    localPlayerIds,
    dims,
    seatOptions,
    offsetPoint,
  ]);

  if (!visible || phase === "done") return null;

  const deckScreen = offsetPoint(deckCenter.x, deckCenter.y);

  const shuffleRotate = shuffleSpin.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-7deg", "7deg"],
  });

  const statusText =
    phase === "shuffle"
      ? "Shuffling…"
      : phase === "deal"
        ? `Dealing… ${Math.min(dealRound, dealSteps.length)} / ${dealSteps.length}`
        : "Role trades…";

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.labelWrap, { opacity: labelOpacity }]}>
        <Text style={[styles.label, { color: colors.gold }]}>{statusText}</Text>
      </Animated.View>

      {phase === "shuffle" ? (
        <Animated.View
          style={[
            styles.deckStack,
            {
              left: deckScreen.x - dims.width / 2,
              top: deckScreen.y - dims.height / 2,
              transform: [{ rotate: shuffleRotate }, { scale: shuffleScale }],
            },
          ]}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.stackCard,
                {
                  left: i * 3,
                  top: i * 2,
                  width: dims.width * 0.8,
                  height: dims.height * 0.8,
                },
              ]}
            >
              <Card
                card={{ suit: "spades", value: 0 }}
                selected={false}
                faceDown
                onPress={() => {}}
                style={{ width: "100%", height: "100%" }}
              />
            </View>
          ))}
        </Animated.View>
      ) : null}

      {activeFlights.map((flight) => (
        <TableCardFlight
          key={flight.id}
          flight={flight}
          durationMs={phase === "trade" ? MANDATORY_TRADE_MS : DEAL_FLIGHT_MS}
          onComplete={(id) => {
            if (phase === "deal" && id.startsWith("deal-")) {
              handleDealFlightComplete(id);
              return;
            }
            setActiveFlights((prev) => prev.filter((f) => f.id !== id));
          }}
        />
      ))}

      {phase === "deal"
        ? layoutSeatIds.map((id) => {
            const count = dealtCounts[id] ?? 0;
            if (count <= 0 || !layout) return null;
            const pos = seatOriginInPlayArea(
              layout,
              playAreaHeight,
              id,
              layoutSeatIds,
              localPlayerIds,
              seatOptions,
            );
            if (!pos) return null;
            const miniW = dims.width * 0.36;
            const miniH = dims.height * 0.36;
            const stackCount = Math.min(3, count);
            const screenPos = offsetPoint(pos.x, pos.y);
            return (
              <View
                key={`stack-${id}`}
                style={[
                  styles.dealtStack,
                  {
                    left: screenPos.x - miniW / 2,
                    top: screenPos.y - miniH - 8,
                    width: miniW + (stackCount - 1) * 4,
                    height: miniH + (stackCount - 1) * 2,
                  },
                ]}
              >
                {Array.from({ length: stackCount }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dealtStackCard,
                      {
                        left: i * 4,
                        top: i * 2,
                        width: miniW,
                        height: miniH,
                      },
                    ]}
                  >
                    <Card
                      card={{ suit: "spades", value: 0, hidden: true }}
                      selected={false}
                      faceDown
                      variant="table"
                      onPress={() => {}}
                      style={{ width: miniW, height: miniH }}
                    />
                  </View>
                ))}
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 80,
  },
  labelWrap: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  deckStack: {
    position: "absolute",
  },
  stackCard: {
    position: "absolute",
  },
  dealtStack: {
    position: "absolute",
    zIndex: 81,
  },
  dealtStackCard: {
    position: "absolute",
  },
});
