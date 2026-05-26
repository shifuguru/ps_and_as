import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  LayoutChangeEvent,
} from "react-native";
import Card from "./Card";
import { Card as CardType } from "../game/ruleset";

/** Must match Card.tsx */
const CARD_W = 86;
const CARD_H = 124;

/** Preferred offset between consecutive plays when space allows */
const IDEAL_STEP_X = 32;
const IDEAL_STEP_Y = 22;
/** Minimum peek of the previous play */
const MIN_STEP_X = 24;
const MIN_STEP_Y = 16;
/** Cap so a short trick does not spread off-screen */
const MAX_STEP_X = 48;
const MAX_STEP_Y = 34;
/** Overlap within a multi-card play (doubles / triples / quads) */
const BUNDLE_OVERLAP = 26;

type Props = {
  /** Chronological plays in the current trick — each entry is one player's play */
  plays: CardType[][];
  playTypeLabel: string | null;
  /** Shown below the play-type badge when a trick is won */
  winnerMessage?: string | null;
};

export default function GameTable({ plays, playTypeLabel, winnerMessage }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
  const [pileSize, setPileSize] = useState({ width: 0, height: 0 });

  const playCount = plays.length;
  const maxBundle = useMemo(
    () => Math.max(1, ...plays.map((p) => p.length)),
    [plays],
  );

  const bundleExtra = (maxBundle - 1) * (CARD_W - BUNDLE_OVERLAP);

  const { stepX, stepY, stackWidth, stackHeight, fillScale } = useMemo(() => {
    const spreadSlots = Math.max(playCount - 1, 0);
    const usableW =
      pileSize.width > 0
        ? Math.max(80, pileSize.width * 0.94 - CARD_W - bundleExtra)
        : spreadSlots * IDEAL_STEP_X;
    const usableH =
      pileSize.height > 0
        ? Math.max(72, pileSize.height * 0.88 - CARD_H)
        : spreadSlots * IDEAL_STEP_Y;

    const computedStepX =
      spreadSlots === 0
        ? 0
        : Math.min(MAX_STEP_X, Math.max(MIN_STEP_X, usableW / spreadSlots));
    const computedStepY =
      spreadSlots === 0
        ? 0
        : Math.min(MAX_STEP_Y, Math.max(MIN_STEP_Y, usableH / spreadSlots));

    const sx = computedStepX;
    const sy = computedStepY;

    const width = spreadSlots * sx + CARD_W + bundleExtra;
    const height = CARD_H + spreadSlots * sy;

    let fit = 1;
    if (pileSize.width > 0 && pileSize.height > 0 && width > 0 && height > 0) {
      fit = Math.min(
        1.18,
        (pileSize.width * 0.98) / width,
        (pileSize.height * 0.92) / height,
      );
    }

    return {
      stepX: sx,
      stepY: sy,
      stackWidth: width,
      stackHeight: height,
      fillScale: fit,
    };
  }, [playCount, pileSize, bundleExtra]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        useNativeDriver: false,
      }),
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 220,
        damping: 18,
        useNativeDriver: false,
      } as any),
    ]).start();
  }, [playCount, playTypeLabel]);

  const windowWidth = Dimensions.get("window").width;
  const isWide = windowWidth >= 900;

  const onPileLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPileSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  return (
    <Animated.View
      style={[styles.tableFrame, { opacity: fade, transform: [{ scale }] }]}
    >
      <View style={styles.pileArea} onLayout={onPileLayout}>
        {playCount === 0 ? (
          <Text style={styles.emptyText}>No cards on the table yet.</Text>
        ) : (
          <View
            style={[
              styles.playStackOuter,
              {
                width: stackWidth * fillScale,
                height: stackHeight * fillScale,
              },
            ]}
          >
            <View
              style={[
                styles.playStack,
                {
                  width: stackWidth,
                  height: stackHeight,
                  transform: [{ scale: fillScale }],
                },
              ]}
            >
              {plays.map((play, playIndex) => {
                const bundleWidth =
                  CARD_W + (play.length - 1) * (CARD_W - BUNDLE_OVERLAP);
                return (
                  <View
                    key={`play-${playIndex}-${play.map((c) => `${c.suit}${c.value}`).join("-")}`}
                    style={[
                      styles.playGroup,
                      {
                        left: playIndex * stepX,
                        top: playIndex * stepY,
                        width: bundleWidth,
                        height: CARD_H,
                        zIndex: playIndex,
                      },
                    ]}
                  >
                    {play.map((card, cardIndex) => (
                      <View
                        key={`${card.suit}-${card.value}-${cardIndex}`}
                        style={[
                          styles.bundleCard,
                          {
                            left: cardIndex * (CARD_W - BUNDLE_OVERLAP),
                            zIndex: cardIndex,
                          },
                        ]}
                      >
                        <Card
                          card={card}
                          selected={false}
                          variant="table"
                          onPress={() => {}}
                        />
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
      {playTypeLabel ? (
        <View style={[styles.playBadge, isWide && { alignSelf: "flex-start" }]}>
          <Text style={styles.playBadgeText}>{playTypeLabel}</Text>
        </View>
      ) : null}
      {winnerMessage ? (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerBannerText}>{winnerMessage} won the trick</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tableFrame: {
    flex: 1,
    width: "100%",
    padding: 12,
    marginVertical: 8,
    minHeight: 220,
  },
  pileArea: {
    flex: 1,
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  playStackOuter: {
    alignItems: "center",
    justifyContent: "center",
  },
  playStack: {
    position: "relative",
  },
  playGroup: {
    position: "absolute",
  },
  bundleCard: {
    position: "absolute",
    top: 0,
  },
  emptyText: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  playBadge: {
    marginTop: 14,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  playBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  winnerBanner: {
    marginTop: 10,
    alignSelf: "center",
    backgroundColor: "rgba(212,175,55,0.96)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  winnerBannerText: {
    color: "#111",
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
  },
});
