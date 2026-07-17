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
  computeFlightLandDiagnostic,
  ENABLE_FLIGHT_LAND_DIAGNOSTICS,
  logFlightLandDiagnostic,
  logMeasuredPileCentre,
} from "../utils/playFlightDiagnostics";
import {
  playDisplayKey,
  playFlightMaxBundleWidth,
  playGroupTargetFromSpot,
  seatOriginInPlayArea,
} from "../utils/tablePlayFlight";
import { PLAY_CARD_FLIGHT_MS } from "../utils/playAnimationTiming";
export { LOCAL_SEAT_BAND as LOCAL_SEAT_HEIGHT } from "../utils/tableLayout";
export { PLAY_CARD_FLIGHT_MS };

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
  playModifierFlash?: boolean;
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
    /** Inner play-area root in window coords — matches flight target space. */
    screenOrigin: { x: number; y: number };
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
  /** True while any opponent/table play flight has not landed on the pile. */
  onPendingPlayFlightsChange?: (pending: boolean) => void;
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
  playModifierFlash = false,
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
  onPendingPlayFlightsChange,
  children,
}: Props & { children: React.ReactNode }) {
  const rootRef = useRef<View>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { height: shellHeight } = useVisualViewportSize();
  /**
   * Play flight registry — one lifecycle for local human, remote human, and CPU.
   *
   * Shared: plays effect → activeFlights → hiddenPlayKeys → settlePlayFlight
   * → landedKeys + onPlayFlightLanded; trick-empty resets flights/landedKeys.
   *
   * Justified local-only differences:
   * - Render host: fromLocalHand entries sync to GameScreen ScreenFlightPortal (above
   *   the hand bar); CPU/opponent copies render in the arena / web arena portal here.
   * - Origin: LocalHandFlightCapture at Play vs seatOriginInPlayArea for others.
   * - GameScreen: handPlayInFlight + localPlayPresentationLatch (optimistic online UI).
   * - Late-capture effect re-flights if hand measure arrives after an early land-skip.
   */
  const [activeFlights, setActiveFlights] = useState<CardFlightSpec[]>([]);
  const activeFlightsRef = useRef<CardFlightSpec[]>([]);
  const [playAreaScreenOrigin, setPlayAreaScreenOrigin] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [landedKeys, setLandedKeys] = useState<Set<string>>(() => new Set());
  const prevPlayKeysRef = useRef<Set<string>>(new Set());
  const flightsInProgressRef = useRef<Set<string>>(new Set());
  const flightsInitializedRef = useRef(false);
  const playGroupMeasureRefs = useRef(
    new Map<string, import("../utils/playFlightDiagnostics").MeasurableNode>(),
  );
  const measuredZoneRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    activeFlightsRef.current = activeFlights;
  }, [activeFlights]);

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
    if (!layout || size.height <= 0) return;
    void measureViewInWindow(rootRef.current).then((win) => {
      if (win) setPlayAreaScreenOrigin(win);
    });
  }, [layout, size.width, size.height]);

  useEffect(() => {
    if (!layout || !onPlayAreaMetrics) return;
    onPlayAreaMetrics({
      layout,
      width: size.width,
      height: size.height,
      screenOrigin: playAreaScreenOrigin,
    });
  }, [layout, size.width, size.height, playAreaScreenOrigin, onPlayAreaMetrics]);

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

  const playKeysSig = useMemo(
    () => plays.map(playDisplayKey).join("|"),
    [plays],
  );

  useLayoutEffect(() => {
    if (plays.length !== 0) return;
    flightsInitializedRef.current = false;
    prevPlayKeysRef.current = new Set();
    flightsInProgressRef.current = new Set();
    // Bail out when already clear — avoid max-update-depth on identity churn.
    setLandedKeys((prev) => (prev.size === 0 ? prev : new Set()));
    setActiveFlights((prev) => (prev.length === 0 ? prev : []));
  }, [plays.length]);

  /**
   * Trick-pause / between-rounds: force-land plays that were already on the table.
   * Brand-new keys and in-flight closing cards (On Top) keep animating.
   */
  useLayoutEffect(() => {
    if (!skipPlayFlights) return;
    const currentKeys = new Set(plays.map(playDisplayKey));
    const animatingKeys = new Set<string>([
      ...flightsInProgressRef.current,
      ...activeFlightsRef.current.map((f) => f.id),
    ]);
    const closingKeys = new Set<string>();
    for (const play of plays) {
      const key = playDisplayKey(play);
      if (
        !prevPlayKeysRef.current.has(key) ||
        resolveLocalHandCapture(key) != null ||
        animatingKeys.has(key)
      ) {
        closingKeys.add(key);
      }
    }
    if (closingKeys.size === 0) {
      prevPlayKeysRef.current = currentKeys;
      setLandedKeys((prev) => {
        if (
          prev.size === currentKeys.size &&
          [...currentKeys].every((k) => prev.has(k))
        ) {
          return prev;
        }
        return currentKeys;
      });
      setActiveFlights((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    // Land already-seen keys; leave closing / in-flight keys free to animate.
    setLandedKeys((prev) => {
      const next = new Set(currentKeys);
      for (const k of closingKeys) next.delete(k);
      if (
        prev.size === next.size &&
        [...next].every((k) => prev.has(k))
      ) {
        return prev;
      }
      return next;
    });
    for (const k of currentKeys) {
      if (!closingKeys.has(k)) prevPlayKeysRef.current.add(k);
    }
    setActiveFlights((prev) =>
      prev.filter((f) => closingKeys.has(f.id) || currentKeys.has(f.id)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playKeysSig fingerprints plays
  }, [skipPlayFlights, playKeysSig, localHandFlight, resolveLocalHandCapture]);

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
      const closingPlays = plays.filter((p) => {
        const key = playDisplayKey(p);
        return (
          !prevPlayKeysRef.current.has(key) ||
          resolveLocalHandCapture(key) != null ||
          flightsInProgressRef.current.has(key) ||
          activeFlightsRef.current.some((f) => f.id === key)
        );
      });
      if (closingPlays.length === 0) {
        prevPlayKeysRef.current = currentKeys;
        setLandedKeys(currentKeys);
        setActiveFlights((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      // Fall through: flight builder runs for closing keys still missing from prev.
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
      // Trick-pause: only brand-new / hand-capture / in-flight closing plays may fly.
      if (
        skipPlayFlights &&
        prevPlayKeysRef.current.has(key) &&
        resolveLocalHandCapture(key) == null &&
        !flightsInProgressRef.current.has(key) &&
        !activeFlightsRef.current.some((f) => f.id === key)
      ) {
        return false;
      }
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
      const maxSpreadWidth = layout.cardZoneWidth * MAX_SPREAD_WIDTH_RATIO;

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
          maxBundleWidth: playFlightMaxBundleWidth(play.cards, maxSpreadWidth),
          fromCardW,
          fromCardH,
          fromLocalHand: !!handCapture,
        });
      }

      if (cancelled) return;
      if (flightsToStart.length > 0) {
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
  ]);

  /** Hand capture can arrive after plays sync landed early — fly from the hand. */
  useEffect(() => {
    if (!layout || size.height <= 0) return;
    const cap = localHandFlight ?? localHandFlightRef?.current ?? null;
    if (!cap) return;
    // Allow during trick-pause skip when this is the closing On Top hand capture.
    if (
      skipPlayFlights &&
      resolveLocalHandCapture(cap.playKey) == null &&
      prevPlayKeysRef.current.has(cap.playKey)
    ) {
      return;
    }
    const key = cap.playKey;
    if (!plays.some((p) => playDisplayKey(p) === key)) return;
    if (activeFlights.some((f) => f.id === key)) return;
    if (!landedKeys.has(key) && !skipPlayFlights) return;

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
      const maxSpreadWidth = layout.cardZoneWidth * MAX_SPREAD_WIDTH_RATIO;
      const flightSpec = {
        id: key,
        cards: play.cards,
        fromX: origin.x,
        fromY: origin.y,
        toX: target.x,
        toY: target.y,
        cardW: target.cardW,
        cardH: target.cardH,
        maxBundleWidth: playFlightMaxBundleWidth(play.cards, maxSpreadWidth),
        fromCardW: cap.fromCardW,
        fromCardH: cap.fromCardH,
        fromLocalHand: true,
      };
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
    resolveLocalHandCapture,
    stackLayoutState,
    activeFlights,
    landedKeys,
    onLocalHandFlightConsumed,
  ]);

  const settlePlayFlight = useCallback(
    (id: string) => {
      const completing = activeFlightsRef.current.find((f) => f.id === id);

      if (ENABLE_FLIGHT_LAND_DIAGNOSTICS && layout && completing) {
        const diag = computeFlightLandDiagnostic(
          completing,
          plays,
          layout,
          measuredZoneRef.current.width,
          measuredZoneRef.current.height,
        );
        if (diag) {
          logFlightLandDiagnostic(diag);
          const flightCentreScreen = {
            x: playAreaScreenOrigin.x + completing.toX,
            y: playAreaScreenOrigin.y + completing.toY,
          };
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              logMeasuredPileCentre(
                id,
                playGroupMeasureRefs.current.get(id),
                flightCentreScreen,
              );
            });
          });
        }
      }

      setLandedKeys((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setActiveFlights((prev) => prev.filter((f) => f.id !== id));
      onPlayFlightLanded?.(id);
    },
    [
      layout,
      plays,
      playAreaScreenOrigin.x,
      playAreaScreenOrigin.y,
      onPlayFlightLanded,
    ],
  );

  useEffect(() => {
    if (elevatedFlightCompleteRef) {
      elevatedFlightCompleteRef.current = settlePlayFlight;
      return () => {
        elevatedFlightCompleteRef.current = null;
      };
    }
  }, [elevatedFlightCompleteRef, settlePlayFlight]);

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

  useLayoutEffect(() => {
    if (!onElevatedHandFlightsChange) return;
    const { x, y } = playAreaScreenOrigin;
    const elevated = activeFlights
      .filter((f) => f.fromLocalHand)
      .map((f) => ({
        ...f,
        fromX: x + f.fromX,
        fromY: y + f.fromY,
        toX: x + f.toX,
        toY: y + f.toY,
      }));
    onElevatedHandFlightsChange(elevated);
  }, [activeFlights, playAreaScreenOrigin, onElevatedHandFlightsChange]);

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

  const hasPendingPlayFlights = useMemo(() => {
    if (plays.length === 0) return false;
    return plays.some((p) => {
      const key = playDisplayKey(p);
      if (landedKeys.has(key)) return false;
      // Closing On Top under skip still counts as pending until it lands.
      if (
        skipPlayFlights &&
        prevPlayKeysRef.current.has(key) &&
        resolveLocalHandCapture(key) == null
      ) {
        return false;
      }
      return true;
    });
  }, [plays, landedKeys, skipPlayFlights, resolveLocalHandCapture]);

  useEffect(() => {
    onPendingPlayFlightsChange?.(hasPendingPlayFlights);
  }, [hasPendingPlayFlights, onPendingPlayFlightsChange]);

  const tableChild =
    layout && React.isValidElement(children)
      ? React.cloneElement(
          children as React.ReactElement<{
            layoutHint?: typeof layout;
            playCountLabel?: string | null;
            playModifierLabel?: string | null;
            runXpPoolAmount?: number | null;
            playModifierFlash?: boolean;
            hiddenPlayKeys?: Set<string>;
            playGroupMeasureRefs?: typeof playGroupMeasureRefs;
            measuredZoneRef?: typeof measuredZoneRef;
          }>,
          {
            layoutHint: layout,
            playCountLabel,
            playModifierLabel,
            runXpPoolAmount,
            playModifierFlash,
            hiddenPlayKeys,
            playGroupMeasureRefs: ENABLE_FLIGHT_LAND_DIAGNOSTICS
              ? playGroupMeasureRefs
              : undefined,
            measuredZoneRef: ENABLE_FLIGHT_LAND_DIAGNOSTICS
              ? measuredZoneRef
              : undefined,
          },
        )
      : children;

  return (
    <View
      ref={rootRef}
      style={styles.root}
      pointerEvents="box-none"
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
                onComplete={settlePlayFlight}
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
              onComplete={settlePlayFlight}
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
