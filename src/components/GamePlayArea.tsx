import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { View, StyleSheet, LayoutChangeEvent, Platform } from "react-native";
import ScreenFlightPortal from "./ScreenFlightPortal";
import OpponentRing from "./OpponentRing";
import TableCardFlight, { type CardFlightSpec } from "./TableCardFlight";
import { computePlayAreaLayout, tableScaleLimits } from "../utils/tableLayout";
import type { PlayAreaLayout } from "../utils/tableLayout";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import type { TrickPlayDisplay } from "../utils/trickDisplay";
import {
  computePlayStackLayout,
  MAX_SPREAD_WIDTH_RATIO,
  stackSpotForPlay,
} from "../utils/tablePlayLayout";
import {
  playDisplayKey,
  playGroupTargetFromSpot,
  seatOriginInPlayArea,
} from "../utils/tablePlayFlight";
export { LOCAL_SEAT_BAND as LOCAL_SEAT_HEIGHT } from "../utils/tableLayout";

type RingProps = Omit<
  React.ComponentProps<typeof OpponentRing>,
  | "arenaWidth"
  | "arenaHeight"
  | "ringLayout"
  | "seatFootprintW"
  | "seatFootprintH"
  | "seatDimensions"
  | "sideAnchorMargin"
>;

/** Default duration for hand → pile play flights. */
export const PLAY_CARD_FLIGHT_MS = 640;

/** Selected-hand position captured at Play — matched to the outgoing play by key. */
export type LocalHandFlightCapture = {
  playKey: string;
  screenX: number;
  screenY: number;
  fromCardW: number;
  fromCardH: number;
};

function measureViewInWindow(
  node: { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null,
): Promise<{ x: number; y: number } | null> {
  return new Promise((resolve) => {
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y) => {
      resolve({ x, y });
    });
  });
}

type Props = RingProps & {
  lastPlayPlayerId?: string | null;
  playCountLabel?: string | null;
  playModifierLabel?: string | null;
  runXpPoolAmount?: number | null;
  /** "Your turn" / "Waiting for …" below the play-type badge on the table. */
  turnHintText?: string | null;
  turnHintFlash?: boolean;
  plays?: TrickPlayDisplay[];
  /** Skip fly-in (trick-end pause snapshot, etc.) */
  skipPlayFlights?: boolean;
  flightDurationMs?: number;
  trickWinnerPlayerId?: string | null;
  trickWinnerXpAmount?: number;
  trickWinnerShout?: string | null;
  avatarBordersByPlayerId?: Record<string, import("../rewards/avatarBorders").AvatarBorderDesign>;
  /** Ring geometry seat count (local + visible opponents). Defaults to players + locals. */
  tableSeatCount?: number;
  deadHandId?: string | null;
  layoutSeatIds?: string[];
  deadHandGraveyard?: boolean;
  turnBellPlayerId?: string | null;
  onTurnBellPress?: (playerId: string) => void;
  nudgeHighlightPlayerId?: string | null;
  /** Per-player dealt counts during deal ceremony. */
  dealtStackCounts?: Record<string, number>;
  /** Open a player's profile / stats card. */
  onPlayerPress?: (playerId: string) => void;
  /** Live play-area layout from onLayout (for overlay alignment). */
  onPlayAreaMetrics?: (metrics: {
    layout: PlayAreaLayout;
    width: number;
    height: number;
  }) => void;
  /** Where the selected cards were when Play was pressed (window coords). */
  localHandFlight?: LocalHandFlightCapture | null;
  /** Sync ref — set before state so the flight effect sees hand origin immediately. */
  localHandFlightRef?: MutableRefObject<LocalHandFlightCapture | null>;
  onLocalHandFlightConsumed?: (playKey: string) => void;
  /** Fired when the flying copy is on screen (hide matching hand cards). */
  onPlayFlightStarted?: (playKey: string) => void;
  /** Fired when a play flight reaches the pile (hand can drop selection / apply state). */
  onPlayFlightLanded?: (playKey: string) => void;
  /** Hand-origin flights (play-area coords) — render in a screen overlay above the bottom bar. */
  onElevatedHandFlightsChange?: (flights: CardFlightSpec[]) => void;
  /** Parent overlay calls this when an elevated hand flight completes. */
  elevatedFlightCompleteRef?: MutableRefObject<((id: string) => void) | null>;
};

export default function GamePlayArea({
  players,
  localPlayerIds,
  currentPlayerId,
  finishedOrder,
  passedPlayerIds,
  lastPlayPlayerId,
  playCountLabel,
  playModifierLabel,
  runXpPoolAmount = null,
  turnHintText,
  turnHintFlash,
  plays = [],
  skipPlayFlights = false,
  flightDurationMs = PLAY_CARD_FLIGHT_MS,
  trickWinnerPlayerId = null,
  trickWinnerXpAmount,
  trickWinnerShout = null,
  avatarBordersByPlayerId = {},
  tableSeatCount,
  deadHandId = null,
  layoutSeatIds,
  deadHandGraveyard = false,
  disconnectedPlayerIds = [],
  turnBellPlayerId = null,
  onTurnBellPress,
  nudgeHighlightPlayerId = null,
  dealtStackCounts,
  onPlayerPress,
  onPlayAreaMetrics,
  localHandFlight = null,
  localHandFlightRef,
  onLocalHandFlightConsumed,
  onPlayFlightStarted,
  onPlayFlightLanded,
  onElevatedHandFlightsChange,
  elevatedFlightCompleteRef,
  children,
}: Props & { children: React.ReactNode }) {
  const rootRef = useRef<View>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { height: shellHeight } = useVisualViewportSize();
  const [activeFlights, setActiveFlights] = useState<CardFlightSpec[]>([]);
  const [playAreaScreenOrigin, setPlayAreaScreenOrigin] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [landedKeys, setLandedKeys] = useState<Set<string>>(() => new Set());
  const prevPlayKeysRef = useRef<Set<string>>(new Set());
  const flightsInProgressRef = useRef<Set<string>>(new Set());
  const flightsInitializedRef = useRef(false);

  const resolveLocalHandCapture = useCallback(
    (playKey: string): LocalHandFlightCapture | null => {
      const fromRef = localHandFlightRef?.current;
      if (fromRef?.playKey === playKey) return fromRef;
      if (localHandFlight?.playKey === playKey) return localHandFlight;
      return null;
    },
    [localHandFlight, localHandFlightRef],
  );

  const hasPendingHandFlight = useCallback(
    () =>
      plays.some((p) => {
        const key = playDisplayKey(p);
        return resolveLocalHandCapture(key) != null;
      }),
    [plays, resolveLocalHandCapture],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const layout = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return null;
    const seats =
      tableSeatCount ??
      Math.max(players.length + localPlayerIds.length, 1);
    return computePlayAreaLayout(size.width, size.height, seats, shellHeight);
  }, [size.width, size.height, players.length, localPlayerIds.length, tableSeatCount, shellHeight]);

  useEffect(() => {
    if (!layout || !onPlayAreaMetrics) return;
    onPlayAreaMetrics({
      layout,
      width: size.width,
      height: size.height,
    });
  }, [layout, size.width, size.height, onPlayAreaMetrics]);

  useEffect(() => {
    if (!layout || size.height <= 0) return;
    void measureViewInWindow(rootRef.current).then((win) => {
      if (win) setPlayAreaScreenOrigin(win);
    });
  }, [layout, size.width, size.height]);

  const stackLayoutState = useMemo(() => {
    if (!layout) {
      return {
        cardWidth: undefined as number | undefined,
        cardHeight: undefined as number | undefined,
        scaleLimits: tableScaleLimits({
          isCompact: false,
          isVeryCompact: false,
          isTall: false,
          isWide: false,
          isStretchy: false,
        }),
      };
    }
    const scaleLimits = tableScaleLimits(layout);
    if (plays.length === 0) {
      return { cardWidth: undefined, cardHeight: undefined, scaleLimits };
    }
    const stackLayout = computePlayStackLayout({
      plays,
      zoneWidth: layout.cardZoneWidth,
      zoneHeight: layout.cardZoneHeight,
      maxFillScale: scaleLimits.maxFillScale,
      displayScale: scaleLimits.displayScale,
    });
    return {
      cardWidth: stackLayout.cardWidth,
      cardHeight: stackLayout.cardHeight,
      scaleLimits,
    };
  }, [plays, layout]);

  const seatIds = useMemo(() => {
    if (layoutSeatIds && layoutSeatIds.length > 0) return layoutSeatIds;
    const localSet = new Set(localPlayerIds);
    return [
      ...localPlayerIds,
      ...players.filter((p) => !localSet.has(p.id)).map((p) => p.id),
    ];
  }, [layoutSeatIds, localPlayerIds, players]);

  const seatOptions = useMemo(
    () => ({ deadHandId }),
    [deadHandId],
  );

  useLayoutEffect(() => {
    if (plays.length !== 0) return;
    flightsInitializedRef.current = false;
    prevPlayKeysRef.current = new Set();
    flightsInProgressRef.current = new Set();
    setLandedKeys(new Set());
    setActiveFlights([]);
  }, [plays.length]);

  useLayoutEffect(() => {
    if (!skipPlayFlights) return;
    const currentKeys = new Set(plays.map(playDisplayKey));
    prevPlayKeysRef.current = currentKeys;
    setLandedKeys(currentKeys);
    setActiveFlights([]);
  }, [skipPlayFlights, plays]);

  useEffect(() => {
    const currentKeys = new Set(plays.map(playDisplayKey));

    if (plays.length === 0) {
      return;
    }

    if (!flightsInitializedRef.current) {
      flightsInitializedRef.current = true;
      const incoming = plays.filter(
        (p) => !prevPlayKeysRef.current.has(playDisplayKey(p)),
      );
      const joinedFullTrick =
        incoming.length === plays.length &&
        plays.length > 2 &&
        !hasPendingHandFlight();
      if (joinedFullTrick) {
        prevPlayKeysRef.current = currentKeys;
        setLandedKeys(currentKeys);
        return;
      }
    }

    if (skipPlayFlights) {
      prevPlayKeysRef.current = currentKeys;
      setLandedKeys(currentKeys);
      setActiveFlights([]);
      return;
    }

    if (currentKeys.size < prevPlayKeysRef.current.size) {
      prevPlayKeysRef.current = currentKeys;
      setLandedKeys(new Set(currentKeys));
      setActiveFlights((prev) => prev.filter((f) => currentKeys.has(f.id)));
      return;
    }

    if (!layout || size.height <= 0) {
      return;
    }

    const newPlays = plays.filter((p) => {
      const key = playDisplayKey(p);
      return (
        !prevPlayKeysRef.current.has(key) && !flightsInProgressRef.current.has(key)
      );
    });

    if (newPlays.length === 0) return;

    const scaleLimits = stackLayoutState.scaleLimits;
    const cardW = stackLayoutState.cardWidth;
    const cardH = stackLayoutState.cardHeight;
    const playKeys = newPlays.map((p) => playDisplayKey(p));
    for (const key of playKeys) {
      flightsInProgressRef.current.add(key);
    }
    let cancelled = false;

    const markPlayKeysSeen = (keys: string[]) => {
      for (const key of keys) {
        prevPlayKeysRef.current.add(key);
      }
    };

    void (async () => {
      try {
      const playAreaWin = await measureViewInWindow(rootRef.current);
      if (cancelled) return;
      if (!playAreaWin) {
        markPlayKeysSeen(playKeys);
        for (const key of playKeys) {
          setLandedKeys((prev) => new Set(prev).add(key));
          onPlayFlightLanded?.(key);
        }
        return;
      }
      setPlayAreaScreenOrigin(playAreaWin);

      const flightsToStart: CardFlightSpec[] = [];

      for (const play of newPlays) {
        const key = playDisplayKey(play);
        const playIndex = plays.findIndex((p) => playDisplayKey(p) === key);
        if (playIndex < 0) {
          continue;
        }

        const spot = stackSpotForPlay(
          playIndex,
          plays.length,
          play,
          layout.cardZoneWidth,
          layout.cardZoneHeight,
          layout.cardZoneWidth * MAX_SPREAD_WIDTH_RATIO * 0.55,
          plays,
          {
            maxFillScale: scaleLimits.maxFillScale,
            displayScale: scaleLimits.displayScale,
          },
        );

        let origin = seatOriginInPlayArea(
          layout,
          size.height,
          play.playerId,
          seatIds,
          localPlayerIds,
          seatOptions,
        );
        let fromCardW: number | undefined;
        let fromCardH: number | undefined;
        const handCapture = resolveLocalHandCapture(key);
        if (handCapture) {
          origin = {
            x: handCapture.screenX - playAreaWin.x,
            y: handCapture.screenY - playAreaWin.y,
          };
          fromCardW = handCapture.fromCardW;
          fromCardH = handCapture.fromCardH;
        }
        if (!cardW || !cardH) {
          continue;
        }
        const target = playGroupTargetFromSpot(spot, play, layout, cardW, cardH);

        if (!origin) {
          continue;
        }

        flightsToStart.push({
          id: key,
          cards: play.cards,
          fromX: origin.x,
          fromY: origin.y,
          toX: target.x,
          toY: target.y,
          cardW: target.cardW,
          cardH: target.cardH,
          fromCardW,
          fromCardH,
          fromLocalHand: !!handCapture,
        });
      }

      if (cancelled) return;
      if (flightsToStart.length > 0) {
        const elevated = flightsToStart
          .filter((f) => f.fromLocalHand)
          .map((f) => ({
            ...f,
            fromX: playAreaWin.x + f.fromX,
            fromY: playAreaWin.y + f.fromY,
            toX: playAreaWin.x + f.toX,
            toY: playAreaWin.y + f.toY,
          }));
        if (elevated.length > 0) {
          onElevatedHandFlightsChange?.(elevated);
        }
        setActiveFlights((prev) => [...prev, ...flightsToStart]);
        for (const f of flightsToStart) {
          prevPlayKeysRef.current.add(f.id);
          onPlayFlightStarted?.(f.id);
          if (resolveLocalHandCapture(f.id)) {
            onLocalHandFlightConsumed?.(f.id);
          }
        }
      }
      for (const key of playKeys) {
        if (!flightsToStart.some((f) => f.id === key)) {
          prevPlayKeysRef.current.add(key);
          setLandedKeys((prev) => new Set(prev).add(key));
          onPlayFlightLanded?.(key);
        }
      }
      } finally {
        for (const key of playKeys) {
          flightsInProgressRef.current.delete(key);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    plays,
    layout,
    size.height,
    seatIds,
    localPlayerIds,
    seatOptions,
    skipPlayFlights,
    stackLayoutState,
    resolveLocalHandCapture,
    hasPendingHandFlight,
    onLocalHandFlightConsumed,
    onPlayFlightStarted,
    onPlayFlightLanded,
    onElevatedHandFlightsChange,
  ]);

  /** Hand capture can arrive after plays sync landed early — fly from the hand. */
  useEffect(() => {
    if (skipPlayFlights || !layout || size.height <= 0) return;
    const cap = localHandFlight ?? localHandFlightRef?.current ?? null;
    if (!cap) return;
    const key = cap.playKey;
    if (!plays.some((p) => playDisplayKey(p) === key)) return;
    if (activeFlights.some((f) => f.id === key)) return;
    if (!landedKeys.has(key)) return;

    let cancelled = false;
    const play = plays.find((p) => playDisplayKey(p) === key);
    if (!play) return;

    setLandedKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    const scaleLimits = stackLayoutState.scaleLimits;
    const cardW = stackLayoutState.cardWidth;
    const cardH = stackLayoutState.cardHeight;
    const playIndex = plays.findIndex((p) => playDisplayKey(p) === key);

    void (async () => {
      const playAreaWin = await measureViewInWindow(rootRef.current);
      if (cancelled || !playAreaWin || !cardW || !cardH || playIndex < 0) {
        if (!cancelled) {
          setLandedKeys((prev) => new Set(prev).add(key));
        }
        return;
      }

      const spot = stackSpotForPlay(
        playIndex,
        plays.length,
        play,
        layout.cardZoneWidth,
        layout.cardZoneHeight,
        layout.cardZoneWidth * MAX_SPREAD_WIDTH_RATIO * 0.55,
        plays,
        {
          maxFillScale: scaleLimits.maxFillScale,
          displayScale: scaleLimits.displayScale,
        },
      );
      const target = playGroupTargetFromSpot(spot, play, layout, cardW, cardH);
      const origin = {
        x: cap.screenX - playAreaWin.x,
        y: cap.screenY - playAreaWin.y,
      };

      if (cancelled) return;
      const flightSpec = {
        id: key,
        cards: play.cards,
        fromX: origin.x,
        fromY: origin.y,
        toX: target.x,
        toY: target.y,
        cardW: target.cardW,
        cardH: target.cardH,
        fromCardW: cap.fromCardW,
        fromCardH: cap.fromCardH,
        fromLocalHand: true,
      };
      onElevatedHandFlightsChange?.([
        {
          ...flightSpec,
          fromX: playAreaWin.x + origin.x,
          fromY: playAreaWin.y + origin.y,
          toX: playAreaWin.x + target.x,
          toY: playAreaWin.y + target.y,
        },
      ]);
      setActiveFlights((prev) => {
        if (prev.some((f) => f.id === key)) return prev;
        return [...prev, flightSpec];
      });
      onPlayFlightStarted?.(key);
      onLocalHandFlightConsumed?.(key);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    localHandFlight,
    localHandFlightRef,
    plays,
    layout,
    size.height,
    skipPlayFlights,
    stackLayoutState,
    activeFlights,
    landedKeys,
    onLocalHandFlightConsumed,
    onElevatedHandFlightsChange,
  ]);

  const handleFlightComplete = useCallback(
    (id: string) => {
      setLandedKeys((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      let clearElevated = false;
      setActiveFlights((prev) => {
        const completing = prev.find((f) => f.id === id);
        const next = prev.filter((f) => f.id !== id);
        clearElevated = !!(
          completing?.fromLocalHand &&
          !next.some((f) => f.fromLocalHand)
        );
        return next;
      });
      if (clearElevated) {
        onElevatedHandFlightsChange?.([]);
      }
      onPlayFlightLanded?.(id);
    },
    [onPlayFlightLanded, onElevatedHandFlightsChange],
  );

  useEffect(() => {
    if (elevatedFlightCompleteRef) {
      elevatedFlightCompleteRef.current = handleFlightComplete;
      return () => {
        elevatedFlightCompleteRef.current = null;
      };
    }
  }, [elevatedFlightCompleteRef, handleFlightComplete]);

  const arenaFlights = useMemo(
    () => activeFlights.filter((f) => !f.fromLocalHand),
    [activeFlights],
  );
  const arenaFlightsScreen = useMemo(() => {
    if (Platform.OS !== "web") return arenaFlights;
    const { x, y } = playAreaScreenOrigin;
    return arenaFlights.map((f) => ({
      ...f,
      fromX: x + f.fromX,
      fromY: y + f.fromY,
      toX: x + f.toX,
      toY: y + f.toY,
    }));
  }, [arenaFlights, playAreaScreenOrigin]);
  const elevatedHandFlights = useMemo(
    () => activeFlights.filter((f) => f.fromLocalHand),
    [activeFlights],
  );

  useEffect(() => {
    if (!onElevatedHandFlightsChange) return;
    if (elevatedHandFlights.length === 0) {
      onElevatedHandFlightsChange([]);
    }
  }, [elevatedHandFlights.length, onElevatedHandFlightsChange]);

  const hiddenPlayKeys = useMemo(() => {
    const hidden = new Set<string>();
    for (const play of plays) {
      const key = playDisplayKey(play);
      if (!landedKeys.has(key)) {
        hidden.add(key);
      }
    }
    return hidden;
  }, [plays, landedKeys]);

  const tableChild =
    layout && React.isValidElement(children)
      ? React.cloneElement(
          children as React.ReactElement<{
            layoutHint?: typeof layout;
            playCountLabel?: string | null;
            playModifierLabel?: string | null;
            runXpPoolAmount?: number | null;
            turnHintText?: string | null;
            turnHintFlash?: boolean;
            hiddenPlayKeys?: Set<string>;
          }>,
          {
            layoutHint: layout,
            playCountLabel,
            playModifierLabel,
            runXpPoolAmount,
            turnHintText,
            turnHintFlash,
            hiddenPlayKeys,
          },
        )
      : children;

  return (
    <View
      ref={rootRef}
      style={styles.root}
      onLayout={onLayout}
    >
      {layout && layout.cardZoneHeight > 0 && (
        <View
          style={[
            styles.cardZone,
            {
              top: layout.cardZoneTop,
              left: layout.cardZoneLeft,
              width: layout.cardZoneWidth,
              height: layout.cardZoneHeight,
              minWidth: layout.cardZoneWidth,
              minHeight: layout.cardZoneHeight,
            },
          ]}
          pointerEvents="box-none"
        >
          {tableChild}
        </View>
      )}

      <View style={styles.flightLayer} pointerEvents="none">
        {Platform.OS === "web"
          ? null
          : arenaFlights.map((flight) => (
              <TableCardFlight
                key={flight.id}
                flight={flight}
                durationMs={flightDurationMs}
                onComplete={handleFlightComplete}
              />
            ))}
      </View>

      {Platform.OS === "web" && arenaFlightsScreen.length > 0 ? (
        <ScreenFlightPortal>
          {arenaFlightsScreen.map((flight) => (
            <TableCardFlight
              key={flight.id}
              flight={flight}
              durationMs={flightDurationMs}
              onComplete={handleFlightComplete}
            />
          ))}
        </ScreenFlightPortal>
      ) : null}

      {layout && (
        <View style={styles.seatOverlay} pointerEvents="box-none">
          <OpponentRing
            players={players}
            localPlayerIds={localPlayerIds}
            currentPlayerId={currentPlayerId}
            finishedOrder={finishedOrder}
            passedPlayerIds={passedPlayerIds}
            arenaWidth={layout.width}
            arenaHeight={layout.height}
            ringLayout={layout.opponentRing}
            seatFootprintW={layout.seatFootprintW}
            seatFootprintH={layout.seatFootprintH}
            seatDimensions={layout.seatDimensions}
            sideAnchorMargin={layout.sideAnchorMargin}
            lastPlayPlayerId={lastPlayPlayerId}
            trickWinnerPlayerId={trickWinnerPlayerId}
            trickWinnerXpAmount={trickWinnerXpAmount}
            trickWinnerShout={trickWinnerShout}
            avatarBordersByPlayerId={avatarBordersByPlayerId}
            layoutSeatIds={seatIds}
            deadHandId={deadHandId}
            deadHandGraveyard={deadHandGraveyard}
            disconnectedPlayerIds={disconnectedPlayerIds}
            turnBellPlayerId={turnBellPlayerId}
            onTurnBellPress={onTurnBellPress}
            nudgeHighlightPlayerId={nudgeHighlightPlayerId}
            dealtStackCounts={dealtStackCounts}
            onPlayerPress={onPlayerPress}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
    minHeight: 0,
  },
  /** Reserved gameplay stage — fixed size; inner layers do not reflow it. */
  cardZone: {
    position: "absolute",
    zIndex: 8,
    overflow: "visible",
  },
  flightLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 22,
    overflow: "visible",
  },
  seatOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    overflow: "visible",
  },
});
