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
} from "../utils/tablePlayLayout";

/** z-index stride per play group — cards within use 0..stride-1 by left-to-right order. */
const GROUP_Z_STRIDE = 100;
/** Gap between the card row and the play-type pill. */
const PLAY_TYPE_BADGE_GAP = 16;

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
  playTypeLabel?: string | null;
  layoutHint?: PlayAreaLayout | null;
  /** Slide all plays onto the first pile (trick-end collect). */
  collectToStack?: boolean;
  collectDurationMs?: number;
  /** Fade the whole table out (winner banner phase — keep cards stacked, don't reset). */
  fadeOut?: boolean;
  fadeOutDurationMs?: number;
  /** Hide plays until their seat-to-table flight finishes. */
  hiddenPlayKeys?: ReadonlySet<string>;
  /** Accumulated run bonus XP on the table (trick winner takes all at trick end). */
  runXpPoolAmount?: number;
  /** Short hint under the pool, e.g. who wins it. */
  runXpPoolHint?: string | null;
};

export default function GameTable({
  plays,
  playTypeLabel,
  layoutHint,
  collectToStack = false,
  collectDurationMs = 520,
  fadeOut = false,
  fadeOutDurationMs = 200,
  hiddenPlayKeys,
  runXpPoolAmount = 0,
  runXpPoolHint = null,
}: Props) {
  const [zoneSize, setZoneSize] = useState({ width: 0, height: 0 });
  const collectAnim = useRef(new Animated.Value(0)).current;
  const tableFadeAnim = useRef(new Animated.Value(1)).current;
  const collectHeldRef = useRef(false);
  const [tableCardsVisible, setTableCardsVisible] = useState(true);

  const scaleLimits = useMemo(
    () =>
      layoutHint
        ? tableScaleLimits(layoutHint)
        : { displayScale: 1, maxFillScale: 1.48 },
    [layoutHint],
  );

  const layout = useMemo(() => {
    return computePlayStackLayout({
      plays,
      zoneWidth: zoneSize.width,
      zoneHeight: zoneSize.height,
      maxFillScale: scaleLimits.maxFillScale,
      displayScale: scaleLimits.displayScale,
      hiddenPlayKeys,
    });
  }, [plays, zoneSize, scaleLimits, hiddenPlayKeys]);

  const maxSpreadWidth =
    zoneSize.width > 0 ? zoneSize.width * MAX_SPREAD_WIDTH_RATIO : undefined;

  useEffect(() => {
    if (!collectToStack) {
      // Trick pause ended — always reset so the next trick spreads normally.
      collectHeldRef.current = false;
      collectAnim.setValue(0);
      return;
    }
    collectHeldRef.current = false;
    collectAnim.setValue(0);
    Animated.timing(collectAnim, {
      toValue: 1,
      duration: collectDurationMs,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        collectHeldRef.current = true;
      }
    });
  }, [collectToStack, collectAnim, collectDurationMs]);

  useLayoutEffect(() => {
    if (plays.length === 0) {
      collectHeldRef.current = false;
      collectAnim.stopAnimation();
      collectAnim.setValue(0);
      tableFadeAnim.stopAnimation();
      tableFadeAnim.setValue(1);
      return;
    }
    if (!fadeOut && !collectToStack) {
      setTableCardsVisible(true);
      tableFadeAnim.setValue(1);
    }
  }, [plays.length, fadeOut, collectToStack, collectAnim, tableFadeAnim]);

  useEffect(() => {
    if (plays.length === 0) return;

    if (fadeOut) {
      setTableCardsVisible(true);
      tableFadeAnim.setValue(1);
      const anim = Animated.timing(tableFadeAnim, {
        toValue: 0,
        duration: fadeOutDurationMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      anim.start(({ finished }) => {
        if (finished) setTableCardsVisible(false);
      });
      return () => anim.stop();
    }

    setTableCardsVisible(true);
    const anim = Animated.timing(tableFadeAnim, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
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
      zoneSize.width > 0
        ? zoneSize.width < 168
        : layoutHint?.isVeryCompact || layoutHint?.isCompact;
    return narrow ? "No plays yet" : "No cards played yet";
  }, [zoneSize.width, layoutHint?.isCompact, layoutHint?.isVeryCompact]);

  const emptyTextMaxWidth = useMemo(() => {
    if (zoneSize.width <= 0) return undefined;
    return Math.max(72, zoneSize.width - 28);
  }, [zoneSize.width]);

  const playTypeBadgeTop = useMemo(() => {
    if (tableRows.length === 0) return 0;
    let rowBottom = 0;
    for (const row of tableRows) {
      rowBottom = Math.max(rowBottom, row.pos.top + row.groupHeight);
    }
    return rowBottom + PLAY_TYPE_BADGE_GAP;
  }, [tableRows]);

  const runXpPoolTop = useMemo(() => {
    if (tableRows.length === 0) return 8;
    let rowTop = tableRows[0]?.pos.top ?? 8;
    for (const row of tableRows) {
      rowTop = Math.min(rowTop, row.pos.top);
    }
    return Math.max(8, rowTop - 52);
  }, [tableRows]);

  const showRunXpPool = (runXpPoolAmount ?? 0) > 0;

  const badgeOpacity = collectAnim.interpolate({
    inputRange: [0, 0.35],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.tableFrame} onLayout={onZoneLayout}>
      <View style={styles.anchorHost} pointerEvents="box-none">
        {playCount === 0 ? (
          <View style={styles.emptyHost} pointerEvents="none">
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
        ) : !tableCardsVisible ? (
          <View style={styles.emptyHost} pointerEvents="none" />
        ) : (
          <Animated.View style={[styles.playCluster, { opacity: tableFadeAnim }]}>
            <View
              style={[
                styles.playStack,
                {
                  width: zoneSize.width,
                  height: zoneSize.height,
                  overflow: collectToStack ? "hidden" : "visible",
                },
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
                  const groupOpacity = collectAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, playIndex === 0 ? 1 : 0.88],
                  });

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
                          zIndex: groupZ,
                          opacity: collectToStack ? groupOpacity : 1,
                          transform: [
                            { translateX },
                            { translateY },
                            { scale: groupScale },
                            ...(pos.tier === "buried" && pos.rotation
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
              {showRunXpPool ? (
                <Animated.View
                  style={[
                    styles.runXpPoolBadge,
                    { top: runXpPoolTop, opacity: badgeOpacity },
                  ]}
                  pointerEvents="none"
                >
                  <View style={styles.runXpChipStack} pointerEvents="none">
                    {[0, 1, 2].map((layer) => (
                      <View
                        key={layer}
                        style={[
                          styles.runXpChip,
                          {
                            top: layer * 4,
                            left: layer * 5,
                            zIndex: layer,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.runXpPoolCopy}>
                    <Text style={styles.runXpPoolAmount}>
                      +{runXpPoolAmount} XP
                    </Text>
                    <Text style={styles.runXpPoolLabel}>Run pool</Text>
                    {runXpPoolHint ? (
                      <Text style={styles.runXpPoolHint}>{runXpPoolHint}</Text>
                    ) : null}
                  </View>
                </Animated.View>
              ) : null}
              {playTypeLabel ? (
                <Animated.View
                  style={[
                    styles.playTypeBadge,
                    { top: playTypeBadgeTop, opacity: badgeOpacity },
                  ]}
                  pointerEvents="none"
                >
                  <Text style={styles.playTypeBadgeText}>{playTypeLabel}</Text>
                </Animated.View>
              ) : null}
              </View>

          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tableFrame: {
    flex: 1,
    minHeight: 0,
  },
  anchorHost: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  playCluster: {
    ...StyleSheet.absoluteFillObject,
  },
  playStack: {
    position: "relative",
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
    backgroundColor: "rgba(212, 175, 55, 0.14)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.38)",
  },
  playTypeBadgeText: {
    color: "#d4af37",
    fontWeight: "800",
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  runXpPoolBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  runXpChipStack: {
    width: 34,
    height: 28,
    position: "relative",
  },
  runXpChip: {
    position: "absolute",
    width: 26,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(212, 175, 55, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
  },
  runXpPoolCopy: {
    alignItems: "flex-start",
    maxWidth: "72%",
  },
  runXpPoolAmount: {
    color: "#f5e6a8",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  runXpPoolLabel: {
    color: "rgba(212, 175, 55, 0.95)",
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 1,
  },
  runXpPoolHint: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "600",
    fontSize: 10,
    marginTop: 2,
  },
  emptyHost: {
    flex: 1,
    minHeight: 0,
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
