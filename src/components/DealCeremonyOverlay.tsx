import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Card from "./Card";
import DealShuffleAnimation from "./DealShuffleAnimation";
import TableCardFlight, { type CardFlightSpec } from "./TableCardFlight";
import {
  ceremonyCardCornerRadius,
  tableCardDimensions,
} from "./cardDimensions";
import { avatarSizeForSeat } from "../utils/seatDimensions";
import type { PlayAreaLayout } from "../utils/tableLayout";
import {
  seatDealStackInPlayArea,
  seatOriginInPlayArea,
} from "../utils/tablePlayFlight";
import type { ClientPendingTrade } from "../game/roundPrep";
import { useAppTheme } from "../context/ThemeContext";
import { FULL_DECK_SIZE } from "../game/ruleset";
import {
  buildClockwiseDealSteps,
  dealRecipientOrder,
  isDeadHandSeatId,
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
  /** Total cards in the deck being dealt (default 54). */
  totalCards?: number;
  pendingTrades?: ClientPendingTrade[];
  onDealComplete: () => void;
  onMandatoryTradesAnimated?: () => void;
  /** Live per-player dealt counts while the deal phase runs. */
  onDealtCountsChange?: (counts: Record<string, number>) => void;
};

const SHUFFLE_MS = 3600;
/** Deal pacing — linear ramp from slow (start) to fast (end). */
const DEAL_FLIGHT_MS_SLOW = 380;
const DEAL_FLIGHT_MS_FAST = 150;
const DEAL_STEP_GAP_MS_SLOW = 58;
const DEAL_STEP_GAP_MS_FAST = 6;
/** Off-table seats still advance the deal order at a readable pace. */
const HIDDEN_SEAT_DEAL_MS_SLOW = 170;
const HIDDEN_SEAT_DEAL_MS_FAST = 35;
const MANDATORY_TRADE_MS = 720;
/** Pill height estimate — used to nudge the status label below the top edge. */
const STATUS_LABEL_HEIGHT = 34;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Progress through the deal: 0 at first card, 1 at last. */
function dealStepProgress(roundIndex: number, totalSteps: number): number {
  if (totalSteps <= 1) return 0;
  return roundIndex / (totalSteps - 1);
}

function dealStepTiming(roundIndex: number, totalSteps: number) {
  const t = dealStepProgress(roundIndex, totalSteps);
  return {
    flightMs: Math.round(lerp(DEAL_FLIGHT_MS_SLOW, DEAL_FLIGHT_MS_FAST, t)),
    gapMs: Math.round(lerp(DEAL_STEP_GAP_MS_SLOW, DEAL_STEP_GAP_MS_FAST, t)),
    hiddenMs: Math.round(
      lerp(HIDDEN_SEAT_DEAL_MS_SLOW, HIDDEN_SEAT_DEAL_MS_FAST, t),
    ),
  };
}

/** Mini stack sized to sit inside the seat avatar ring. */
function dealStackLayout(
  layout: PlayAreaLayout,
  layoutSeatIds: string[],
  localPlayerIds: string[],
  playerId: string,
) {
  const compact = layoutSeatIds.length >= 6;
  const isLocal = localPlayerIds.includes(playerId);
  const avatarSize = avatarSizeForSeat(layout.seatDimensions, {
    compact,
    isLocal,
  });
  const miniW = Math.max(18, Math.round(avatarSize * 0.32));
  const miniH = Math.max(26, Math.round(avatarSize * 0.46));
  return {
    miniW,
    miniH,
    cornerRadius: ceremonyCardCornerRadius(miniW, miniH),
  };
}

function estimateDealDurationMs(totalSteps: number): number {
  let ms = 0;
  for (let i = 0; i < totalSteps; i += 1) {
    const step = dealStepTiming(i, totalSteps);
    ms += step.flightMs + step.gapMs + 120;
  }
  return ms;
}

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
  totalCards = FULL_DECK_SIZE,
  pendingTrades = [],
  onDealComplete,
  onMandatoryTradesAnimated,
  onDealtCountsChange,
}: Props) {
  const { colors } = useAppTheme();
  const { width: screenW } = useWindowDimensions();
  const dims = useMemo(() => tableCardDimensions(), []);
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
  const dealFlightRoundRef = useRef<number | null>(null);
  const activeDealFlightMsRef = useRef(DEAL_FLIGHT_MS_SLOW);
  const offsetPoint = useCallback(
    (x: number, y: number) => ({
      x: x + playAreaOffsetLeft,
      y: y + playAreaOffsetTop,
    }),
    [playAreaOffsetLeft, playAreaOffsetTop],
  );

  const onDealtCountsChangeRef = useRef(onDealtCountsChange);
  onDealtCountsChangeRef.current = onDealtCountsChange;

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

  const effectiveDealerId = useMemo(() => {
    if (!dealerId) return null;
    if (isDeadHandSeatId(dealerId) || dealerId === deadHandId) return null;
    return dealerId;
  }, [dealerId, deadHandId]);

  const deckCenter = useMemo(() => {
    if (layout && effectiveDealerId) {
      const dealerPos = seatOriginInPlayArea(
        layout,
        playAreaHeight,
        effectiveDealerId,
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
    effectiveDealerId,
    layoutSeatIds,
    localPlayerIds,
    seatOptions,
  ]);

  const dealSteps = useMemo(() => {
    const recipientOrder = dealRecipientOrder(playerIds, effectiveDealerId);
    return buildClockwiseDealSteps(recipientOrder, totalCards);
  }, [totalCards, playerIds, effectiveDealerId]);

  const dealStepsRef = useRef(dealSteps);
  dealStepsRef.current = dealSteps;

  const advanceDealRound = useCallback((playerId: string, roundIndex: number) => {
    setDealtCounts((prev) => ({
      ...prev,
      [playerId]: (prev[playerId] ?? 0) + 1,
    }));
    if (dealStepTimerRef.current) {
      clearTimeout(dealStepTimerRef.current);
    }
    const { gapMs } = dealStepTiming(
      roundIndex,
      dealStepsRef.current.length,
    );
    dealStepTimerRef.current = setTimeout(() => {
      dealStepTimerRef.current = null;
      setDealRound((r) => r + 1);
    }, gapMs);
  }, []);

  const handleDealFlightComplete = useCallback(
    (flightId: string) => {
      const round = dealRoundRef.current;
      if (flightId !== `deal-${round}`) return;
      const step = dealStepsRef.current[round];
      if (!step) return;
      setActiveFlights([]);
      advanceDealRound(step.playerId, round);
    },
    [advanceDealRound],
  );

  const beginDealPhase = useCallback(
    () => setPhase((current) => (current === "shuffle" ? "deal" : current)),
    [],
  );

  useEffect(() => {
    if (!visible) return;
    ceremonyFinishedRef.current = false;
    dealFlightRoundRef.current = null;
    setPhase("shuffle");
    setDealRound(0);
    setDealtCounts({});
    setActiveFlights([]);
    onDealtCountsChangeRef.current?.({});
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      onDealtCountsChangeRef.current?.({});
      return;
    }
    onDealtCountsChangeRef.current?.(dealtCounts);
  }, [visible, dealtCounts]);

  // Web/native fallback — riffle animation can stall without firing onComplete.
  useEffect(() => {
    if (!visible || phase !== "shuffle") return;
    const timer = setTimeout(() => {
      setPhase((current) => (current === "shuffle" ? "deal" : current));
    }, SHUFFLE_MS + 120);
    return () => clearTimeout(timer);
  }, [visible, phase]);

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
    const perCardMs = estimateDealDurationMs(Math.max(dealSteps.length, 1));
    const maxMs =
      SHUFFLE_MS +
      perCardMs +
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
    const stepTiming = dealStepTiming(dealRound, dealSteps.length);
    const visibleSeat = layoutSeatIds.includes(step.playerId);
    const target =
      layout && visibleSeat
        ? seatDealStackInPlayArea(
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
        () => advanceDealRound(step.playerId, dealRound),
        stepTiming.hiddenMs,
      );
      return () => clearTimeout(timer);
    }

    const flightId = `deal-${dealRound}`;
    if (dealFlightRoundRef.current === dealRound) return;
    dealFlightRoundRef.current = dealRound;
    activeDealFlightMsRef.current = stepTiming.flightMs;

    const from = offsetPoint(deckCenter.x, deckCenter.y);
    const to = offsetPoint(target.x, target.y);
    const stack = dealStackLayout(
      layout,
      layoutSeatIds,
      localPlayerIds,
      step.playerId,
    );
    const flight: CardFlightSpec = {
      id: flightId,
      cards: [{ suit: "spades", value: 0, hidden: true }],
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      cardW: stack.miniW,
      cardH: stack.miniH,
      cornerRadius: stack.cornerRadius,
    };

    if (dealWatchdogRef.current) {
      clearTimeout(dealWatchdogRef.current);
    }
    const roundAtStart = dealRound;
    dealWatchdogRef.current = setTimeout(() => {
      dealWatchdogRef.current = null;
      if (dealRoundRef.current !== roundAtStart) return;
      handleDealFlightComplete(flightId);
    }, stepTiming.flightMs + stepTiming.gapMs + 120);

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
    deckCenter.x,
    deckCenter.y,
    dims.width,
    dims.height,
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

  const statusText =
    phase === "shuffle"
      ? "Shuffling…"
      : phase === "deal"
        ? `Dealing… ${Math.min(dealRound, dealSteps.length)} / ${dealSteps.length}`
        : "Role trades…";

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.labelWrap,
          { opacity: labelOpacity, top: 12 + STATUS_LABEL_HEIGHT },
        ]}
      >
        <Text style={[styles.label, { color: colors.gold }]}>{statusText}</Text>
      </Animated.View>

      {phase === "shuffle" ? (
        <DealShuffleAnimation
          cardW={dims.width * 0.78}
          cardH={dims.height * 0.78}
          cornerRadius={ceremonyCardCornerRadius(
            dims.width * 0.78,
            dims.height * 0.78,
          )}
          left={deckScreen.x}
          top={deckScreen.y}
          running
          durationMs={SHUFFLE_MS}
          onComplete={beginDealPhase}
        />
      ) : null}

      {activeFlights.map((flight) => (
        <TableCardFlight
          key={flight.id}
          flight={flight}
          durationMs={
            phase === "trade"
              ? MANDATORY_TRADE_MS
              : activeDealFlightMsRef.current
          }
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
            const pos = seatDealStackInPlayArea(
              layout,
              playAreaHeight,
              id,
              layoutSeatIds,
              localPlayerIds,
              seatOptions,
            );
            if (!pos) return null;
            const { miniW, miniH, cornerRadius } = dealStackLayout(
              layout,
              layoutSeatIds,
              localPlayerIds,
              id,
            );
            const stackCount = Math.min(3, count);
            const stackW = miniW + (stackCount - 1) * 4;
            const stackH = miniH + (stackCount - 1) * 2;
            const screenPos = offsetPoint(pos.x, pos.y);
            return (
              <View
                key={`stack-${id}`}
                style={[
                  styles.dealtStack,
                  {
                    left: screenPos.x - stackW / 2,
                    top: screenPos.y - stackH / 2,
                    width: stackW,
                    height: stackH,
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
                      cornerRadius={cornerRadius}
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
  dealtStack: {
    position: "absolute",
    zIndex: 81,
  },
  dealtStackCard: {
    position: "absolute",
  },
});
