import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  Platform,
} from "react-native";
import { createPortal } from "react-dom";
import DealShuffleAnimation from "./DealShuffleAnimation";
import DealCardFlight from "./DealCardFlight";
import {
  DealStackPile,
  handDealStackCenterFrame,
  handDealStackTopCardCenter,
} from "./DealHandStack";
import TableCardFlight, { type CardFlightSpec } from "./TableCardFlight";
import {
  ceremonyCardCornerRadius,
  tableCardDimensions,
} from "./cardDimensions";
import { avatarSizeForSeat, seatMiniCardDimensions } from "../utils/seatDimensions";
import type { PlayAreaLayout } from "../utils/tableLayout";
import {
  seatDealStackInPlayArea,
  seatOriginInPlayArea,
} from "../utils/tablePlayFlight";
import type { ClientPendingTrade } from "../game/roundPrep";
import { FULL_DECK_SIZE } from "../game/ruleset";
import {
  buildClockwiseDealSteps,
  dealRecipientOrder,
  isDeadHandSeatId,
} from "../utils/tableSeats";
import { getWebOverlayPortalHost } from "../utils/webOverlayPortal";

/** Above play-area seats/flights; web portals to #ps-overlay-portal (z 300). */
const CEREMONY_OVERLAY_Z = 200;

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
  /** President↔Asshole trade skipped (triple Asshole streak). */
  freshRound?: boolean;
  /** Skip shuffle/deal only — still run mandatory role-trade flights. */
  skipDealPhases?: boolean;
  onDealComplete: () => void;
  onMandatoryTradesAnimated?: () => void;
  /** Live per-player dealt counts while the deal phase runs. */
  onDealtCountsChange?: (counts: Record<string, number>) => void;
  /** Deal pacing for the local dealer stack (remaining cards + in-flight card). */
  onDealProgressChange?: (progress: {
    phase: "shuffle" | "deal" | "trade" | "done";
    dealRound: number;
    flightActive: boolean;
  }) => void;
  /** Ceremony status line for the game header row (shuffling, dealing, etc.). */
  onStatusTextChange?: (text: string | null) => void;
  /** When the local player is dealer, riffle shuffle plays here (screen coords). */
  localHandShuffleCenter?: { x: number; y: number } | null;
  localHandShuffleCardSize?: { width: number; height: number } | null;
  /** Deal flights for local humans land in the bottom hand zone (screen coords). */
  localHandDealTarget?: { x: number; y: number } | null;
  localHandDealCardSize?: { width: number; height: number } | null;
  /** Local dealer renders shuffle + remaining deck inside the bottom hand zone. */
  localDealerDeckInHandZone?: boolean;
  onCeremonyControls?: (controls: { completeShuffle: () => void }) => void;
};

const SHUFFLE_MS = 4800;
export { SHUFFLE_MS as DEAL_CEREMONY_SHUFFLE_MS };
const DEAL_PEEL_MS = 90;
/** Deal pacing — slow at first/last card, fastest mid-deal (sin arc). */
const DEAL_FLIGHT_MS_SLOW = 380;
const DEAL_FLIGHT_MS_FAST = 150;
const DEAL_STEP_GAP_MS_SLOW = 58;
const DEAL_STEP_GAP_MS_FAST = 6;
/** Off-table seats still advance the deal order at a readable pace. */
const HIDDEN_SEAT_DEAL_MS_SLOW = 170;
const HIDDEN_SEAT_DEAL_MS_FAST = 35;
const MANDATORY_TRADE_MS = 720;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Progress through the deal: 0 at first card, 1 at last. */
function dealStepProgress(roundIndex: number, totalSteps: number): number {
  if (totalSteps <= 1) return 0;
  return roundIndex / (totalSteps - 1);
}

/** 0 at deal start/end (normal), 1 at mid-deal (fastest). */
function dealPaceIntensity(roundIndex: number, totalSteps: number): number {
  const t = dealStepProgress(roundIndex, totalSteps);
  return Math.sin(t * Math.PI);
}

function dealStepTiming(roundIndex: number, totalSteps: number) {
  const intensity = dealPaceIntensity(roundIndex, totalSteps);
  return {
    flightMs: Math.round(lerp(DEAL_FLIGHT_MS_SLOW, DEAL_FLIGHT_MS_FAST, intensity)),
    gapMs: Math.round(lerp(DEAL_STEP_GAP_MS_SLOW, DEAL_STEP_GAP_MS_FAST, intensity)),
    hiddenMs: Math.round(
      lerp(HIDDEN_SEAT_DEAL_MS_SLOW, HIDDEN_SEAT_DEAL_MS_FAST, intensity),
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
  const { width: miniW, height: miniH } = seatMiniCardDimensions(avatarSize);
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
    ms += step.flightMs + DEAL_PEEL_MS + step.gapMs + 120;
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
  freshRound = false,
  skipDealPhases = false,
  onDealComplete,
  onMandatoryTradesAnimated,
  onDealtCountsChange,
  onDealProgressChange,
  onStatusTextChange,
  localHandShuffleCenter = null,
  localHandShuffleCardSize = null,
  localHandDealTarget = null,
  localHandDealCardSize = null,
  localDealerDeckInHandZone = false,
  onCeremonyControls,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const dims = useMemo(() => tableCardDimensions(), []);

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
  const onDealProgressChangeRef = useRef(onDealProgressChange);
  onDealProgressChangeRef.current = onDealProgressChange;
  const onStatusTextChangeRef = useRef(onStatusTextChange);
  onStatusTextChangeRef.current = onStatusTextChange;

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

  const isLocalDealer =
    effectiveDealerId != null &&
    localPlayerIds.includes(effectiveDealerId);

  const deckOriginScreen = useMemo(() => {
    if (isLocalDealer && localHandShuffleCenter) {
      return localHandShuffleCenter;
    }
    return offsetPoint(deckCenter.x, deckCenter.y);
  }, [
    isLocalDealer,
    localHandShuffleCenter,
    deckCenter.x,
    deckCenter.y,
    offsetPoint,
  ]);

  const shuffleCardSize = useMemo(() => {
    if (isLocalDealer && localHandShuffleCardSize) {
      return localHandShuffleCardSize;
    }
    return {
      width: dims.width * 0.78,
      height: dims.height * 0.78,
    };
  }, [isLocalDealer, localHandShuffleCardSize, dims.width, dims.height]);

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
    onCeremonyControls?.({ completeShuffle: beginDealPhase });
  }, [beginDealPhase, onCeremonyControls]);

  useEffect(() => {
    if (!visible) return;
    ceremonyFinishedRef.current = false;
    dealFlightRoundRef.current = null;
    setActiveFlights([]);

    if (skipDealPhases) {
      const fullCounts: Record<string, number> = {};
      for (const step of dealSteps) {
        fullCounts[step.playerId] = (fullCounts[step.playerId] ?? 0) + 1;
      }
      setDealtCounts(fullCounts);
      setDealRound(dealSteps.length);
      if (pendingTrades.length > 0) {
        setPhase("trade");
      } else {
        setPhase("done");
        finishCeremony();
      }
      return;
    }

    setPhase("shuffle");
    setDealRound(0);
    setDealtCounts({});
    onDealtCountsChangeRef.current?.({});
  }, [visible, skipDealPhases, dealSteps, pendingTrades.length]);

  useEffect(() => {
    if (!visible) {
      onDealtCountsChangeRef.current?.({});
      return;
    }
    onDealtCountsChangeRef.current?.(dealtCounts);
  }, [visible, dealtCounts]);

  useEffect(() => {
    if (!visible) {
      onDealProgressChangeRef.current?.({
        phase: "done",
        dealRound: 0,
        flightActive: false,
      });
      return;
    }
    onDealProgressChangeRef.current?.({
      phase,
      dealRound,
      flightActive: activeFlights.some((f) => f.id.startsWith("deal-")),
    });
  }, [visible, phase, dealRound, activeFlights]);

  // Web/native fallback — riffle animation can stall without firing onComplete.
  useEffect(() => {
    if (!visible || phase !== "shuffle" || skipDealPhases) return;
    const timer = setTimeout(() => {
      setPhase((current) => (current === "shuffle" ? "deal" : current));
    }, SHUFFLE_MS + 120);
    return () => clearTimeout(timer);
  }, [visible, phase, skipDealPhases]);

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
    const maxMs = skipDealPhases
      ? pendingTrades.length > 0
        ? MANDATORY_TRADE_MS + 600
        : 600
      : SHUFFLE_MS +
        perCardMs +
        (pendingTrades.length > 0 ? MANDATORY_TRADE_MS + 600 : 600);
    const timer = setTimeout(() => finishCeremony(), maxMs);
    return () => clearTimeout(timer);
  }, [visible, dealSteps.length, pendingTrades.length, skipDealPhases]);

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
    const stack =
      layout && visibleSeat
        ? dealStackLayout(
            layout,
            layoutSeatIds,
            localPlayerIds,
            step.playerId,
          )
        : null;
    const seatTarget =
      layout && visibleSeat && stack
        ? seatDealStackInPlayArea(
            layout,
            playAreaHeight,
            step.playerId,
            layoutSeatIds,
            localPlayerIds,
            { ...seatOptions, stackH: stack.miniH },
          )
        : null;

    const target =
      seatTarget && stack
        ? {
            x: offsetPoint(seatTarget.x, seatTarget.y).x,
            y: offsetPoint(seatTarget.x, seatTarget.y).y,
            cardW: stack.miniW,
            cardH: stack.miniH,
            cornerRadius: stack.cornerRadius,
          }
        : null;

    if (!target) {
      const timer = setTimeout(
        () => advanceDealRound(step.playerId, dealRound),
        stepTiming.hiddenMs,
      );
      return () => clearTimeout(timer);
    }

    const flightId = `deal-${dealRound}`;
    if (dealFlightRoundRef.current === dealRound) return;
    dealFlightRoundRef.current = dealRound;
    activeDealFlightMsRef.current = stepTiming.flightMs + DEAL_PEEL_MS;

    const remainingInDeck = totalCards - dealRound;
    const deckCardW =
      isLocalDealer && localHandDealCardSize
        ? localHandDealCardSize.width
        : shuffleCardSize.width;
    const deckCardH =
      isLocalDealer && localHandDealCardSize
        ? localHandDealCardSize.height
        : shuffleCardSize.height;
    const top = handDealStackTopCardCenter(
      remainingInDeck,
      deckCardW,
      deckCardH,
      totalCards,
    );
    const flightFrom = {
      x: deckOriginScreen.x + top.x,
      y: deckOriginScreen.y + top.y,
    };
    const flight: CardFlightSpec = {
      id: flightId,
      cards: [{ suit: "spades", value: 0, hidden: true }],
      fromX: flightFrom.x,
      fromY: flightFrom.y,
      toX: target.x,
      toY: target.y,
      cardW: target.cardW,
      cardH: target.cardH,
      fromCardW: deckCardW,
      fromCardH: deckCardH,
      cornerRadius: target.cornerRadius,
    };

    if (dealWatchdogRef.current) {
      clearTimeout(dealWatchdogRef.current);
    }
    const roundAtStart = dealRound;
    dealWatchdogRef.current = setTimeout(() => {
      dealWatchdogRef.current = null;
      if (dealRoundRef.current !== roundAtStart) return;
      handleDealFlightComplete(flightId);
    }, stepTiming.flightMs + DEAL_PEEL_MS + stepTiming.gapMs + 120);

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
    deckOriginScreen,
    localHandDealCardSize,
    shuffleCardSize.width,
    shuffleCardSize.height,
    totalCards,
    isLocalDealer,
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
          ? trade.incoming.map((c) => ({ ...c, hidden: true }))
          : [{ suit: "spades", value: 0, hidden: true }],
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

  const statusText =
    !visible || phase === "done"
      ? null
      : phase === "shuffle"
        ? freshRound
          ? "Fresh round — shuffling…"
          : "Shuffling…"
        : phase === "deal"
          ? freshRound
            ? `Fresh round — dealing… ${Math.min(dealRound, dealSteps.length)} / ${dealSteps.length}`
            : `Dealing… ${Math.min(dealRound, dealSteps.length)} / ${dealSteps.length}`
          : freshRound && pendingTrades.length === 0
            ? "Fresh round — no President trade"
            : "Role trades…";

  useEffect(() => {
    onStatusTextChangeRef.current?.(statusText);
  }, [statusText]);

  if (!visible || phase === "done") return null;

  const dealFlightActive = activeFlights.some((f) => f.id.startsWith("deal-"));
  const deckRemaining =
    phase === "deal"
      ? Math.max(0, totalCards - dealRound - (dealFlightActive ? 1 : 0))
      : 0;
  const localDeckInHandZone =
    localDealerDeckInHandZone && isLocalDealer && !!localHandShuffleCenter;
  const showShuffleInOverlay = phase === "shuffle" && !localDeckInHandZone;
  const showDeckInOverlay =
    phase === "deal" && deckRemaining > 0 && !localDeckInHandZone;

  const overlay = (
    <View style={styles.overlay} pointerEvents="box-none">
      {showShuffleInOverlay ? (
        <DealShuffleAnimation
          cardW={shuffleCardSize.width}
          cardH={shuffleCardSize.height}
          left={deckOriginScreen.x}
          top={deckOriginScreen.y}
          deckCount={totalCards}
          running
          durationMs={SHUFFLE_MS}
          onComplete={beginDealPhase}
        />
      ) : null}

      {showDeckInOverlay && deckRemaining > 0 ? (
        <View
          style={[
            styles.deckAnchor,
            { left: deckOriginScreen.x, top: deckOriginScreen.y },
          ]}
          pointerEvents="none"
        >
          {(() => {
            const frame = handDealStackCenterFrame(
              deckRemaining,
              shuffleCardSize.width,
              shuffleCardSize.height,
              totalCards,
            );
            return (
              <View
                style={{
                  width: frame.width,
                  height: frame.height,
                  marginLeft: frame.left,
                  marginTop: frame.top,
                }}
              >
                <DealStackPile
                  count={deckRemaining}
                  cardWidth={shuffleCardSize.width}
                  cardHeight={shuffleCardSize.height}
                  deckSize={totalCards}
                />
              </View>
            );
          })()}
        </View>
      ) : null}

      {activeFlights.map((flight) =>
        phase === "deal" && flight.id.startsWith("deal-") ? (
          <DealCardFlight
            key={flight.id}
            flight={flight}
            durationMs={activeDealFlightMsRef.current}
            onComplete={(id) => {
              handleDealFlightComplete(id);
            }}
          />
        ) : (
          <TableCardFlight
            key={flight.id}
            flight={flight}
            durationMs={
              phase === "trade"
                ? MANDATORY_TRADE_MS
                : activeDealFlightMsRef.current
            }
            onComplete={(id) => {
              setActiveFlights((prev) => prev.filter((f) => f.id !== id));
            }}
          />
        ),
      )}
    </View>
  );

  if (Platform.OS === "web") {
    const host = getWebOverlayPortalHost();
    if (host) {
      return createPortal(overlay, host);
    }
  }

  return overlay;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: CEREMONY_OVERLAY_Z,
    elevation: CEREMONY_OVERLAY_Z,
  },
  deckAnchor: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
