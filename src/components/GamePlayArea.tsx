import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import OpponentRing from "./OpponentRing";
import TableCardFlight, { type CardFlightSpec } from "./TableCardFlight";
import { computePlayAreaLayout, tableScaleLimits } from "../utils/tableLayout";
import type { PlayAreaLayout } from "../utils/tableLayout";
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

type Props = RingProps & {
  lastPlayPlayerId?: string | null;
  playTypeLabel?: string | null;
  plays?: TrickPlayDisplay[];
  /** Skip fly-in (trick-end pause snapshot, etc.) */
  skipPlayFlights?: boolean;
  flightDurationMs?: number;
  trickWinnerPlayerId?: string | null;
  /** Ring geometry seat count (local + visible opponents). Defaults to players + locals. */
  tableSeatCount?: number;
  deadHandId?: string | null;
  layoutSeatIds?: string[];
  deadHandGraveyard?: boolean;
  turnBellPlayerId?: string | null;
  onTurnBellPress?: (playerId: string) => void;
  /** Per-player dealt counts during deal ceremony. */
  dealtStackCounts?: Record<string, number>;
  /** Live play-area layout from onLayout (for overlay alignment). */
  onPlayAreaMetrics?: (metrics: {
    layout: PlayAreaLayout;
    width: number;
    height: number;
  }) => void;
};

export default function GamePlayArea({
  players,
  localPlayerIds,
  currentPlayerId,
  finishedOrder,
  passedPlayerIds,
  lastPlayPlayerId,
  playTypeLabel,
  plays = [],
  skipPlayFlights = false,
  flightDurationMs = 480,
  trickWinnerPlayerId = null,
  tableSeatCount,
  deadHandId = null,
  layoutSeatIds,
  deadHandGraveyard = false,
  disconnectedPlayerIds = [],
  turnBellPlayerId = null,
  onTurnBellPress,
  dealtStackCounts,
  onPlayAreaMetrics,
  children,
}: Props & { children: React.ReactNode }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [activeFlights, setActiveFlights] = useState<CardFlightSpec[]>([]);
  const [landedKeys, setLandedKeys] = useState<Set<string>>(() => new Set());
  const prevPlayKeysRef = useRef<Set<string>>(new Set());
  const flightsInitializedRef = useRef(false);

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
    return computePlayAreaLayout(size.width, size.height, seats);
  }, [size.width, size.height, players.length, localPlayerIds.length, tableSeatCount]);

  useEffect(() => {
    if (!layout || !onPlayAreaMetrics) return;
    onPlayAreaMetrics({
      layout,
      width: size.width,
      height: size.height,
    });
  }, [layout, size.width, size.height, onPlayAreaMetrics]);

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

  useEffect(() => {
    const currentKeys = new Set(plays.map(playDisplayKey));

    if (plays.length === 0) {
      prevPlayKeysRef.current = new Set();
      setLandedKeys(new Set());
      setActiveFlights([]);
      return;
    }

    if (!flightsInitializedRef.current) {
      flightsInitializedRef.current = true;
      prevPlayKeysRef.current = currentKeys;
      if (currentKeys.size > 0) {
        setLandedKeys(currentKeys);
      }
      return;
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
      prevPlayKeysRef.current = currentKeys;
      return;
    }

    const newPlays = plays.filter((p) => !prevPlayKeysRef.current.has(playDisplayKey(p)));
    prevPlayKeysRef.current = currentKeys;

    if (newPlays.length === 0) return;

    const scaleLimits = stackLayoutState.scaleLimits;
    const cardW = stackLayoutState.cardWidth;
    const cardH = stackLayoutState.cardHeight;
    const flightsToStart: CardFlightSpec[] = [];

    for (const play of newPlays) {
      const key = playDisplayKey(play);
      const playIndex = plays.findIndex((p) => playDisplayKey(p) === key);
      if (playIndex < 0) {
        setLandedKeys((prev) => new Set(prev).add(key));
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

      const origin = seatOriginInPlayArea(
        layout,
        size.height,
        play.playerId,
        seatIds,
        localPlayerIds,
        seatOptions,
      );
      if (!cardW || !cardH) {
        setLandedKeys((prev) => new Set(prev).add(key));
        continue;
      }
      const target = playGroupTargetFromSpot(spot, play, layout, cardW, cardH);

      if (!origin) {
        setLandedKeys((prev) => new Set(prev).add(key));
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
      });
    }

    if (flightsToStart.length > 0) {
      setActiveFlights((prev) => [...prev, ...flightsToStart]);
    }
  }, [
    plays,
    layout,
    size.height,
    seatIds,
    localPlayerIds,
    seatOptions,
    skipPlayFlights,
    stackLayoutState,
  ]);

  const handleFlightComplete = useCallback((id: string) => {
    setActiveFlights((prev) => prev.filter((f) => f.id !== id));
    setLandedKeys((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

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
            playTypeLabel?: string | null;
            hiddenPlayKeys?: Set<string>;
          }>,
          {
            layoutHint: layout,
            playTypeLabel,
            hiddenPlayKeys,
          },
        )
      : children;

  return (
    <View
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
            },
          ]}
          pointerEvents="box-none"
        >
          {tableChild}
        </View>
      )}

      <View style={styles.flightLayer} pointerEvents="none">
        {activeFlights.map((flight) => (
            <TableCardFlight
              key={flight.id}
              flight={flight}
              durationMs={flightDurationMs}
              onComplete={handleFlightComplete}
            />
        ))}
      </View>

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
            layoutSeatIds={seatIds}
            deadHandId={deadHandId}
            deadHandGraveyard={deadHandGraveyard}
            disconnectedPlayerIds={disconnectedPlayerIds}
            turnBellPlayerId={turnBellPlayerId}
            onTurnBellPress={onTurnBellPress}
            dealtStackCounts={dealtStackCounts}
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
  cardZone: {
    position: "absolute",
    zIndex: 8,
  },
  flightLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
    overflow: "visible",
  },
  seatOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    overflow: "visible",
  },
});
