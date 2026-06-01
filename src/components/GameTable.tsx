import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  Platform,
  Animated,
  Easing,
} from "react-native";
import Card from "./Card";
import { allSameValue, isRun } from "../game/core";
import type { PlayAreaLayout } from "../utils/tableLayout";
import { tableScaleLimits } from "../utils/tableLayout";
import type { TrickPlayDisplay } from "../utils/trickDisplay";
import { playDisplayKey } from "../utils/tablePlayFlight";
import {
  computePlayStackLayout,
  layoutPlayBundle,
  MAX_SPREAD_WIDTH_RATIO,
  stagePlayTypeBadgeTop,
  stageTurnHintTop,
} from "../utils/tablePlayLayout";

/** z-index stride per play group — cards within use 0..stride-1 by left-to-right order. */
const GROUP_Z_STRIDE = 100;
/** Approx. width for "Waiting for " + 24-char name + ellipsis (12px font). */
const TURN_HINT_PILL_MAX_WIDTH = 268;

function playKey(play: TrickPlayDisplay, index: number): string {
  return `${index}-${play.playerId}-${play.cards.map((c) => `${c.suit}${c.value}`).join("-")}`;
}

function bundleCapForTable(
  cards: TrickPlayDisplay["cards"],
  maxSpreadWidth: number | undefined,
): number | undefined {
  if (!maxSpreadWidth) return undefined;
  const ratio =
    cards.length >= 3 && isRun(cards)
      ? 0.95
      : cards.length > 1 && allSameValue(cards)
        ? 1
        : 0.68;
  return Math.round(maxSpreadWidth * ratio);
}

type Props = {
  plays: TrickPlayDisplay[];
  playCountLabel?: string | null;
  playModifierLabel?: string | null;
  /** Live run bonus XP — shown as "+N XP" beside the Runs! pill. */
  runXpPoolAmount?: number | null;
  layoutHint?: PlayAreaLayout | null;
  /** Slide all plays onto the first pile (trick-end collect). */
  collectToStack?: boolean;
  collectDurationMs?: number;
  /** Fade the whole table out (winner banner phase — keep cards stacked, don't reset). */
  fadeOut?: boolean;
  fadeOutDurationMs?: number;
  /** Hide plays until their seat-to-table flight finishes. */
  hiddenPlayKeys?: ReadonlySet<string>;
  /** "Your turn" / "Waiting for …" shown below the play-type badge. */
  turnHintText?: string | null;
  /** Pulse the turn hint like the Pass button when it's the local player's turn. */
  turnHintFlash?: boolean;
};

export default function GameTable({
  plays,
  playCountLabel,
  playModifierLabel,
  runXpPoolAmount = null,
  layoutHint,
  collectToStack = false,
  collectDurationMs = 520,
  fadeOut = false,
  fadeOutDurationMs = 200,
  hiddenPlayKeys,
  turnHintText = null,
  turnHintFlash = false,
}: Props) {
  const [zoneSize, setZoneSize] = useState({ width: 0, height: 0 });
  const collectAnim = useRef(new Animated.Value(0)).current;
  const tableFadeAnim = useRef(new Animated.Value(1)).current;
  const turnHintFlashAnim = useRef(new Animated.Value(0)).current;
  const collectHeldRef = useRef(false);
  const [stackFaceDown, setStackFaceDown] = useState(false);

  const scaleLimits = useMemo(
    () =>
      layoutHint
        ? tableScaleLimits(layoutHint)
        : { displayScale: 1, maxFillScale: 1.48 },
    [layoutHint],
  );

  const stageWidth =
    zoneSize.width > 0 ? zoneSize.width : layoutHint?.cardZoneWidth ?? 0;
  const stageHeight =
    zoneSize.height > 0 ? zoneSize.height : layoutHint?.cardZoneHeight ?? 0;

  const layout = useMemo(() => {
    return computePlayStackLayout({
      plays,
      zoneWidth: stageWidth,
      zoneHeight: stageHeight,
      maxFillScale: scaleLimits.maxFillScale,
      displayScale: scaleLimits.displayScale,
      hiddenPlayKeys,
    });
  }, [plays, stageWidth, stageHeight, scaleLimits, hiddenPlayKeys]);

  const maxSpreadWidth =
    stageWidth > 0 ? stageWidth * MAX_SPREAD_WIDTH_RATIO : undefined;

  useEffect(() => {
    if (!collectToStack) {
      // Trick pause ended — always reset so the next trick spreads normally.
      collectHeldRef.current = false;
      collectAnim.setValue(0);
      setStackFaceDown(false);
      return;
    }
    collectHeldRef.current = false;
    setStackFaceDown(false);
    collectAnim.setValue(0);
    Animated.timing(collectAnim, {
      toValue: 1,
      duration: collectDurationMs,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        collectHeldRef.current = true;
        setStackFaceDown(true);
      }
    });
  }, [collectToStack, collectAnim, collectDurationMs]);

  useLayoutEffect(() => {
    if (plays.length === 0) {
      collectHeldRef.current = false;
      collectAnim.stopAnimation();
      collectAnim.setValue(0);
      setStackFaceDown(false);
      tableFadeAnim.stopAnimation();
      tableFadeAnim.setValue(1);
      return;
    }
    if (!fadeOut && !collectToStack) {
      tableFadeAnim.setValue(1);
    }
  }, [plays.length, fadeOut, collectToStack, collectAnim, tableFadeAnim]);

  useEffect(() => {
    if (plays.length === 0) return;

    if (fadeOut) {
      tableFadeAnim.setValue(1);
      const anim = Animated.timing(tableFadeAnim, {
        toValue: 0,
        duration: fadeOutDurationMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }

    tableFadeAnim.setValue(1);
    return undefined;
  }, [fadeOut, fadeOutDurationMs, plays.length, tableFadeAnim]);

  const onZoneLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setZoneSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const cardW = layout.cardWidth;
  const cardH = layout.cardHeight;
  const stackTarget = layout.positions[0] ?? { left: 0, top: 0, opacity: 1, scale: 1 };

  const tableRows = useMemo(() => {
    const rows = plays.map((play, playIndex) => {
      const bundle = layoutPlayBundle(
        play.cards,
        cardW,
        bundleCapForTable(play.cards, maxSpreadWidth),
        cardH,
      );
      const pos = layout.positions[playIndex] ?? {
        left: 0,
        top: 0,
        opacity: 1,
        scale: 1,
        rotation: 0,
      };
      const layoutOffsets = layout.playCardOffsets?.[playIndex];
      const layoutGroupSize = layout.playGroupSizes?.[playIndex];
      const cardOffsets = layoutOffsets ?? bundle.cardOffsets;
      const groupWidth = layoutGroupSize?.width ?? bundle.width;
      const groupHeight = layoutGroupSize?.height ?? bundle.height;
      return {
        play,
        playIndex,
        bundle,
        pos,
        groupWidth,
        groupHeight,
        cardOffsets,
      };
    });

    const cardStackRanks: Array<{ playIndex: number; cardIndex: number; x: number }> =
      [];
    for (const row of rows) {
      const groupLeft = row.pos.left;
      for (let cardIndex = 0; cardIndex < row.play.cards.length; cardIndex++) {
        cardStackRanks.push({
          playIndex: row.playIndex,
          cardIndex,
          x: groupLeft + (row.cardOffsets[cardIndex] ?? 0),
        });
      }
    }
    cardStackRanks.sort((a, b) => a.x - b.x);
    const cardZ = new Map<string, number>();
    cardStackRanks.forEach((entry, order) => {
      cardZ.set(`${entry.playIndex}-${entry.cardIndex}`, order);
    });

    return rows.map((row) => ({
      ...row,
      groupZ: row.playIndex * GROUP_Z_STRIDE,
      cardStackOrder: [...row.play.cards.keys()].sort(
        (a, b) =>
          (cardZ.get(`${row.playIndex}-${a}`) ?? 0) -
          (cardZ.get(`${row.playIndex}-${b}`) ?? 0),
      ),
      cardZ,
    }));
  }, [plays, layout, cardW, cardH, maxSpreadWidth]);

  const playCount = plays.length;

  const emptyMessage = useMemo(() => {
    const narrow =
      stageWidth > 0
        ? stageWidth < 168
        : layoutHint?.isVeryCompact || layoutHint?.isCompact;
    return narrow ? "No plays yet" : "No cards played yet";
  }, [stageWidth, layoutHint?.isCompact, layoutHint?.isVeryCompact]);

  const emptyTextMaxWidth = useMemo(() => {
    if (stageWidth <= 0) return undefined;
    return Math.max(72, stageWidth - 28);
  }, [stageWidth]);

  const refCardHeight = cardH || layout.cardHeight;

  const playTypeBadgeTop = useMemo(
    () => stagePlayTypeBadgeTop(stageHeight, refCardHeight),
    [stageHeight, refCardHeight],
  );

  const showRunXpPool =
    runXpPoolAmount != null && runXpPoolAmount > 0;
  const showPlayTypePills = !!(
    playCountLabel ||
    playModifierLabel ||
    showRunXpPool
  );

  const turnHintTop = useMemo(
    () => stageTurnHintTop(stageHeight, refCardHeight, showPlayTypePills),
    [stageHeight, refCardHeight, showPlayTypePills],
  );

  const turnHintMaxWidth = useMemo(() => {
    if (stageWidth <= 0) return TURN_HINT_PILL_MAX_WIDTH;
    return Math.min(TURN_HINT_PILL_MAX_WIDTH, stageWidth - 8);
  }, [stageWidth]);

  const showBadgeColumn =
    stageHeight > 0 && (showPlayTypePills || !!turnHintText);

  const badgeOpacity = collectAnim.interpolate({
    inputRange: [0, 0.35],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    if (!turnHintFlash) {
      turnHintFlashAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(turnHintFlashAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(turnHintFlashAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [turnHintFlash, turnHintFlashAnim]);

  const turnHintBackground = turnHintFlash
    ? turnHintFlashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.92)"],
      })
    : undefined;

  const turnHintBorder = turnHintFlash
    ? turnHintFlashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(255, 255, 255, 0.18)", "rgba(255, 255, 255, 0.95)"],
      })
    : undefined;

  const turnHintTextColor = turnHintFlash
    ? turnHintFlashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(255, 255, 255, 0.85)", "#111111"],
      })
    : undefined;

  const stageStyle =
    stageWidth > 0 && stageHeight > 0
      ? { width: stageWidth, height: stageHeight }
      : null;

  return (
    <View style={styles.tableFrame} onLayout={onZoneLayout}>
      <View
        style={[styles.gameplayStage, stageStyle]}
        pointerEvents="box-none"
      >
        <View style={styles.cardLayer} pointerEvents="box-none">
          {playCount > 0 ? (
            <Animated.View style={[styles.playCluster, { opacity: tableFadeAnim }]}>
              <View
                style={[
                  styles.playStack,
                  stageStyle,
                  { overflow: "visible" },
                ]}
              >
                {tableRows.map((row) => {
                  const {
                    play,
                    playIndex,
                    pos,
                    groupZ,
                    cardStackOrder,
                    cardOffsets,
                    groupWidth,
                    groupHeight,
                    cardZ,
                  } = row;

                  const isNewest = playIndex === playCount - 1;
                  const isBuried = pos.tier === "buried";
                  const isBeaten = pos.tier === "beaten";
                  const isHidden = hiddenPlayKeys?.has(playDisplayKey(play)) ?? false;
                  if (isHidden) return null;

                  const deltaX = stackTarget.left - pos.left;
                  const deltaY = stackTarget.top - pos.top;
                  const translateX = collectAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, deltaX],
                  });
                  const translateY = collectAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, deltaY],
                  });
                  const groupScale = collectAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, playIndex === 0 ? 1 : 0.94],
                  });
                  /** Keep full opacity while stacking — fade the whole pile after flip. */
                  const showFaceDown = stackFaceDown || fadeOut;
                  const stackZIndex =
                    collectToStack || stackFaceDown || fadeOut
                      ? (playIndex + 1) * GROUP_Z_STRIDE
                      : groupZ;

                  return (
                    <Animated.View
                      key={playKey(play, playIndex)}
                      style={[
                        styles.playGroup,
                        isNewest
                          ? styles.playGroupActive
                          : isBuried
                            ? styles.playGroupBuriedStack
                            : isBeaten
                              ? styles.playGroupBeaten
                              : styles.playGroupBuried,
                        {
                          left: pos.left,
                          top: pos.top,
                          width: groupWidth,
                          height: groupHeight,
                          zIndex: stackZIndex,
                          transform: [
                            { translateX },
                            { translateY },
                            { scale: groupScale },
                            ...(pos.tier === "buried" && pos.rotation && !collectToStack
                              ? [{ rotate: `${pos.rotation}deg` }]
                              : []),
                          ],
                        },
                      ]}
                    >
                      {(cardStackOrder.map((cardIndex) => ({
                        play,
                        playIndex,
                        cardIndex,
                        left: cardOffsets[cardIndex] ?? 0,
                        z: cardZ.get(`${playIndex}-${cardIndex}`) ?? 0,
                      }))).map((entry) => {
                        const card = entry.play.cards[entry.cardIndex];
                        return (
                          <View
                            key={`${entry.play.playerId}-${card.suit}-${card.value}-${entry.cardIndex}`}
                            style={[
                              styles.bundleCard,
                              {
                                left: entry.left,
                                width: cardW,
                                height: cardH,
                                zIndex: entry.z,
                              },
                            ]}
                          >
                            <Card
                              card={card}
                              selected={false}
                              variant="table"
                              faceDown={showFaceDown}
                              style={{
                                width: cardW,
                                height: cardH,
                              }}
                              onPress={() => {}}
                            />
                          </View>
                        );
                      })}
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}
        </View>

        {playCount === 0 ? (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Text
              style={[
                styles.emptyText,
                emptyTextMaxWidth != null && { maxWidth: emptyTextMaxWidth },
                (layoutHint?.isVeryCompact || (emptyTextMaxWidth ?? 999) < 140) &&
                  styles.emptyTextCompact,
              ]}
            >
              {emptyMessage}
            </Text>
          </View>
        ) : null}

        {showBadgeColumn ? (
          <Animated.View
            style={[
              styles.chromeLayer,
              playCount > 0 ? { opacity: tableFadeAnim } : null,
            ]}
            pointerEvents="none"
          >
            {showPlayTypePills ? (
              <Animated.View
                style={[
                  styles.playTypeBadge,
                  {
                    top: playTypeBadgeTop,
                    opacity: collectToStack ? badgeOpacity : 1,
                  },
                ]}
                pointerEvents="none"
              >
                <View style={styles.playTypeBadgeRow}>
                  {playCountLabel ? (
                    <View
                      style={[
                        styles.playTypeBadgeBody,
                        styles.playTypeBadgeBodyHighlighted,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.playTypeBadgeText,
                          styles.playTypeBadgeTextHighlighted,
                        ]}
                      >
                        {playCountLabel}
                      </Text>
                    </View>
                  ) : null}
                  {playModifierLabel ? (
                    <View
                      style={[
                        styles.playTypeBadgeBody,
                        styles.playTypeBadgeBodyHighlighted,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.playTypeBadgeText,
                          styles.playTypeBadgeTextHighlighted,
                        ]}
                      >
                        {playModifierLabel}
                      </Text>
                    </View>
                  ) : null}
                  {showRunXpPool ? (
                    <View
                      style={[
                        styles.playTypeBadgeBody,
                        styles.playTypeBadgeBodyHighlighted,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.playTypeBadgeText,
                          styles.playTypeBadgeTextHighlighted,
                        ]}
                      >
                        +{runXpPoolAmount} XP
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}
            {turnHintText ? (
              <Animated.View
                style={[
                  styles.turnHintPill,
                  {
                    top: turnHintTop,
                    opacity: collectToStack ? badgeOpacity : 1,
                  },
                ]}
                pointerEvents="none"
              >
                {turnHintFlash ? (
                  <Animated.View
                    style={[
                      styles.turnHintPillBody,
                      styles.turnHintPillFlash,
                      { maxWidth: turnHintMaxWidth },
                      {
                        backgroundColor: turnHintBackground,
                        borderColor: turnHintBorder,
                      },
                    ]}
                  >
                    <Animated.Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[
                        styles.turnHintTextLabel,
                        { color: turnHintTextColor },
                      ]}
                    >
                      {turnHintText}
                    </Animated.Text>
                  </Animated.View>
                ) : (
                  <View
                    style={[
                      styles.turnHintPillBody,
                      { maxWidth: turnHintMaxWidth },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={styles.turnHintText}
                    >
                      {turnHintText}
                    </Text>
                  </View>
                )}
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tableFrame: {
    flex: 1,
    minHeight: 0,
    overflow: "visible",
  },
  /** Fixed-size gameplay stage — dimensions come from GamePlayArea card zone. */
  gameplayStage: {
    flex: 1,
    minHeight: 0,
    position: "relative",
    overflow: "visible",
  },
  cardLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: "visible",
  },
  playCluster: {
    ...StyleSheet.absoluteFillObject,
  },
  playStack: {
    position: "relative",
  },
  chromeLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: GROUP_Z_STRIDE * 4,
  },
  playGroup: {
    position: "absolute",
    overflow: "visible",
  },
  playGroupActive: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 6,
    },
    default: {},
  }),
  playGroupBuried: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
    },
    default: {},
  }),
  playGroupBuriedStack: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 1,
    },
    default: {},
  }),
  playGroupBeaten: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 1,
    },
    default: {},
  }),
  bundleCard: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
  playTypeBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  playTypeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    maxWidth: "100%",
    flexWrap: "nowrap",
  },
  playTypeBadgeBody: {
    backgroundColor: "rgba(212, 175, 55, 0.14)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.38)",
    alignSelf: "center",
    flexShrink: 0,
    maxWidth: "100%",
  },
  playTypeBadgeBodyHighlighted: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.95)",
    ...Platform.select({
      ios: {
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  playTypeBadgeText: {
    color: "#d4af37",
    fontWeight: "800",
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.4,
    flexShrink: 0,
    ...(Platform.OS === "web"
      ? ({ whiteSpace: "nowrap" } as object)
      : null),
  },
  playTypeBadgeTextHighlighted: {
    color: "#111111",
  },
  turnHintPill: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  turnHintPillBody: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.18)",
    alignSelf: "center",
    flexShrink: 0,
    maxWidth: TURN_HINT_PILL_MAX_WIDTH,
  },
  turnHintPillFlash: Platform.select({
    ios: {
      shadowColor: "#fff",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
    },
    android: { elevation: 5 },
    default: {},
  }),
  turnHintText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 0,
    ...(Platform.OS === "web"
      ? ({ whiteSpace: "nowrap" } as object)
      : null),
  },
  turnHintTextLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 0,
    ...(Platform.OS === "web"
      ? ({ whiteSpace: "nowrap" } as object)
      : null),
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  emptyText: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
    ...(Platform.OS === "web"
      ? ({ userSelect: "none" } as object)
      : null),
  },
  emptyTextCompact: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
});
