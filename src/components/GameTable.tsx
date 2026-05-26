import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  Platform,
} from "react-native";
import Card from "./Card";
import { Card as CardType } from "../game/ruleset";
import type { PlayAreaLayout } from "../utils/tableLayout";
import { tableScaleLimits } from "../utils/tableLayout";

/** Table pile display scale (hand cards stay full size) — overridden by layoutHint */
const DEFAULT_TABLE_DISPLAY_SCALE = Platform.OS === "web" ? 0.88 : 0.92;

/** Must match Card.tsx layout footprint */
const CARD_W = 86;
const CARD_H = 124;

const IDEAL_STEP_X = 28;
const IDEAL_STEP_Y = 18;
const MIN_STEP_X = 20;
const MIN_STEP_Y = 12;
const MAX_STEP_X = 40;
const MAX_STEP_Y = 22;
const BUNDLE_OVERLAP = 26;

/** Newest plays keep full diagonal spacing; older plays pack into a tight tail. */
const FULL_SPREAD_LAYERS = 5;
const CONDENSED_STEP_X = 10;
const CONDENSED_STEP_Y = 7;

const MAX_FILL_SCALE_DEFAULT = Platform.OS === "web" ? 0.96 : 1.0;

function buriedPlayCount(playCount: number): number {
  return Math.max(0, playCount - FULL_SPREAD_LAYERS);
}

function playPosition(
  playIndex: number,
  buriedCount: number,
  stepX: number,
  stepY: number,
): { left: number; top: number } {
  if (playIndex < buriedCount) {
    return {
      left: playIndex * CONDENSED_STEP_X,
      top: playIndex * CONDENSED_STEP_Y,
    };
  }
  const spreadIndex = playIndex - buriedCount;
  const baseX = buriedCount * CONDENSED_STEP_X;
  const baseY = buriedCount * CONDENSED_STEP_Y;
  return {
    left: baseX + spreadIndex * stepX,
    top: baseY + spreadIndex * stepY,
  };
}

type Props = {
  plays: CardType[][];
  winnerMessage?: string | null;
  layoutHint?: PlayAreaLayout | null;
};

export default function GameTable({
  plays,
  winnerMessage,
  layoutHint,
}: Props) {
  const [pileSize, setPileSize] = useState({ width: 0, height: 0 });

  const playCount = plays.length;
  const maxBundle = useMemo(
    () => Math.max(1, ...plays.map((p) => p.length)),
    [plays],
  );

  const bundleExtra = (maxBundle - 1) * (CARD_W - BUNDLE_OVERLAP);

  const scaleLimits = useMemo(
    () =>
      layoutHint
        ? tableScaleLimits(layoutHint)
        : {
            displayScale:
              Platform.OS === "web"
                ? DEFAULT_TABLE_DISPLAY_SCALE
                : DEFAULT_TABLE_DISPLAY_SCALE + 0.06,
            maxFillScale: MAX_FILL_SCALE_DEFAULT,
          },
    [layoutHint],
  );

  const { stackWidth, stackHeight, fillScale, positions } = useMemo(() => {
    const buriedCount = buriedPlayCount(playCount);
    const spreadCount = playCount - buriedCount;
    const spreadSlots = Math.max(spreadCount - 1, 0);
    const pileW = pileSize.width;
    const pileH = Math.max(80, pileSize.height);

    const usableW =
      pileW > 0
        ? Math.max(72, pileW * 0.9 - CARD_W - bundleExtra)
        : spreadSlots * IDEAL_STEP_X;
    const usableH =
      pileH > 0
        ? Math.max(64, pileH * 0.78 - CARD_H)
        : spreadSlots * IDEAL_STEP_Y;

    const computedStepX =
      spreadSlots === 0
        ? 0
        : Math.min(MAX_STEP_X, Math.max(MIN_STEP_X, usableW / spreadSlots));
    const computedStepY =
      spreadSlots === 0
        ? 0
        : Math.min(MAX_STEP_Y, Math.max(MIN_STEP_Y, usableH / spreadSlots));

    const condensedExtentX = buriedCount * CONDENSED_STEP_X;
    const condensedExtentY = buriedCount * CONDENSED_STEP_Y;
    const width =
      condensedExtentX + spreadSlots * computedStepX + CARD_W + bundleExtra;
    const height =
      CARD_H + condensedExtentY + spreadSlots * computedStepY;

    const displayScale = scaleLimits.displayScale;
    const scaledW = width * displayScale;
    const scaledH = height * displayScale;

    let fit = 1;
    if (pileW > 0 && pileH > 0 && scaledW > 0 && scaledH > 0) {
      fit = Math.min(
        scaleLimits.maxFillScale,
        (pileW * 0.9) / scaledW,
        (pileH * 0.88) / scaledH,
      );
    }

    const positions = Array.from({ length: playCount }, (_, i) =>
      playPosition(i, buriedCount, computedStepX, computedStepY),
    );

    return {
      stepX: computedStepX,
      stepY: computedStepY,
      stackWidth: width,
      stackHeight: height,
      fillScale: fit,
      positions,
    };
  }, [playCount, pileSize, bundleExtra, scaleLimits]);

  const onPileLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPileSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const totalScale = fillScale * scaleLimits.displayScale;

  return (
    <View style={styles.tableFrame} onLayout={onPileLayout}>
      <View style={styles.pileHost} pointerEvents="box-none">
        {winnerMessage && playCount === 0 ? (
          <View style={styles.winnerBannerCenter}>
            <Text style={styles.winnerBannerText}>
              {winnerMessage} won the trick
            </Text>
          </View>
        ) : playCount === 0 ? (
          <Text style={styles.emptyText}>No cards on the table yet.</Text>
        ) : (
          <View style={styles.pileColumn}>
            <View
              style={[
                styles.playStack,
                {
                  width: stackWidth,
                  height: stackHeight,
                  transform: [{ scale: totalScale }],
                },
              ]}
            >
              {plays.map((play, playIndex) => {
                const bundleWidth =
                  CARD_W + (play.length - 1) * (CARD_W - BUNDLE_OVERLAP);
                const pos = positions[playIndex] ?? { left: 0, top: 0 };
                return (
                  <View
                    key={`play-${playIndex}-${play.map((c) => `${c.suit}${c.value}`).join("-")}`}
                    style={[
                      styles.playGroup,
                      {
                        left: pos.left,
                        top: pos.top,
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
    </View>
  );
}

const styles = StyleSheet.create({
  tableFrame: {
    flex: 1,
    minHeight: 0,
  },
  pileHost: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  pileColumn: {
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
  winnerBannerCenter: {
    backgroundColor: "rgba(212,175,55,0.96)",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxWidth: "88%",
  },
  winnerBannerText: {
    color: "#111",
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
  },
});
