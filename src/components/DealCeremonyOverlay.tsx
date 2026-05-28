import React, { useEffect, useMemo, useRef, useState } from "react";
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

type Props = {
  visible: boolean;
  playerIds: string[];
  localPlayerIds: string[];
  layout: PlayAreaLayout | null;
  playAreaHeight: number;
  cardsPerPlayer: number;
  pendingTrades?: ClientPendingTrade[];
  onDealComplete: () => void;
  onMandatoryTradesAnimated?: () => void;
};

const SHUFFLE_MS = 1400;
const DEAL_ROUND_MS = 95;
const MANDATORY_TRADE_MS = 520;

export default function DealCeremonyOverlay({
  visible,
  playerIds,
  localPlayerIds,
  layout,
  playAreaHeight,
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

  const deckCenter = useMemo(() => {
    if (!layout) return { x: screenW / 2, y: playAreaHeight / 2 };
    return { x: layout.playAnchorX, y: layout.playAnchorY };
  }, [layout, screenW, playAreaHeight]);

  const dealSteps = useMemo(
    () =>
      Array.from({ length: cardsPerPlayer }, (_, round) =>
        playerIds.map((id) => ({ playerId: id, round })),
      ).flat(),
    [cardsPerPlayer, playerIds],
  );

  useEffect(() => {
    if (!visible) return;
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
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(shuffleSpin, {
            toValue: -1,
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 },
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
      if (!finished) return;
      setPhase("deal");
    });

    return () => shuffleAnim.stop();
  }, [visible, shuffleSpin, shuffleScale]);

  useEffect(() => {
    if (phase !== "deal" || !visible || !layout) return;
    if (dealRound >= dealSteps.length) {
      if (pendingTrades.length > 0) {
        setPhase("trade");
      } else {
        setPhase("done");
        onDealComplete();
      }
      return;
    }

    const step = dealSteps[dealRound];
    const target = seatOriginInPlayArea(
      layout,
      playAreaHeight,
      step.playerId,
      playerIds,
      localPlayerIds,
    );
    if (!target) {
      setDealRound((r) => r + 1);
      return;
    }

    const flightId = `deal-${dealRound}`;
    const flight: CardFlightSpec = {
      id: flightId,
      cards: [{ suit: "spades", value: 0, hidden: true }],
      fromX: deckCenter.x,
      fromY: deckCenter.y,
      toX: target.x,
      toY: target.y,
      cardW: dims.width * 0.72,
      cardH: dims.height * 0.72,
    };

    setActiveFlights([flight]);

    const timer = setTimeout(() => {
      setDealtCounts((prev) => ({
        ...prev,
        [step.playerId]: (prev[step.playerId] ?? 0) + 1,
      }));
      setDealRound((r) => r + 1);
    }, DEAL_ROUND_MS);

    return () => clearTimeout(timer);
  }, [
    phase,
    dealRound,
    dealSteps,
    visible,
    layout,
    playAreaHeight,
    playerIds,
    localPlayerIds,
    deckCenter,
    dims,
    pendingTrades.length,
    onDealComplete,
  ]);

  useEffect(() => {
    if (phase !== "trade" || !visible || !layout) return;

    const flights: CardFlightSpec[] = [];
    pendingTrades.forEach((trade, idx) => {
      const from = seatOriginInPlayArea(
        layout,
        playAreaHeight,
        trade.loserId,
        playerIds,
        localPlayerIds,
      );
      const to = seatOriginInPlayArea(
        layout,
        playAreaHeight,
        trade.winnerId,
        playerIds,
        localPlayerIds,
      );
      if (!from || !to) return;
      flights.push({
        id: `trade-${idx}`,
        cards: trade.incoming.length
          ? trade.incoming
          : [{ suit: "hearts", value: 10 }],
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        cardW: dims.width * 0.65,
        cardH: dims.height * 0.65,
      });
    });

    if (flights.length === 0) {
      setPhase("done");
      onDealComplete();
      onMandatoryTradesAnimated?.();
      return;
    }

    setActiveFlights(flights);
    const timer = setTimeout(() => {
      setPhase("done");
      onMandatoryTradesAnimated?.();
      onDealComplete();
    }, MANDATORY_TRADE_MS + 120);

    return () => clearTimeout(timer);
  }, [
    phase,
    visible,
    layout,
    playAreaHeight,
    pendingTrades,
    playerIds,
    localPlayerIds,
    dims,
    onDealComplete,
    onMandatoryTradesAnimated,
  ]);

  if (!visible || phase === "done") return null;

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
              left: deckCenter.x - dims.width / 2,
              top: deckCenter.y - dims.height / 2,
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
          durationMs={phase === "trade" ? MANDATORY_TRADE_MS : 280}
          onComplete={(id) => {
            setActiveFlights((prev) => prev.filter((f) => f.id !== id));
          }}
        />
      ))}

      {phase === "deal"
        ? playerIds.map((id) => {
            const count = dealtCounts[id] ?? 0;
            if (count <= 0 || !layout) return null;
            const pos = seatOriginInPlayArea(
              layout,
              playAreaHeight,
              id,
              playerIds,
              localPlayerIds,
            );
            if (!pos) return null;
            return (
              <View
                key={`count-${id}`}
                style={[
                  styles.dealtBadge,
                  { left: pos.x - 14, top: pos.y - 28 },
                ]}
              >
                <Text style={styles.dealtBadgeText}>{count}</Text>
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
  dealtBadge: {
    position: "absolute",
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(212, 175, 55, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 81,
  },
  dealtBadgeText: {
    color: "#111",
    fontWeight: "800",
    fontSize: 12,
  },
});
