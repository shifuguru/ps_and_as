import React, { useEffect, useMemo, useRef, useState } from "react";
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
import type { PlayAreaLayout } from "../utils/tableLayout";
import { tableScaleLimits } from "../utils/tableLayout";
import type { TrickPlayDisplay } from "../utils/trickDisplay";
import {
  computePlayStackLayout,
  layoutPlayBundle,
  MAX_SPREAD_WIDTH_RATIO,
} from "../utils/tablePlayLayout";
import { GOLD } from "../styles/uiStandards";

type Props = {
  plays: TrickPlayDisplay[];
  playTypeLabel?: string | null;
  winnerMessage?: string | null;
  layoutHint?: PlayAreaLayout | null;
};

function playKey(play: TrickPlayDisplay, index: number): string {
  return `${index}-${play.playerId}-${play.cards.map((c) => `${c.suit}${c.value}`).join("-")}`;
}

export default function GameTable({
  plays,
  playTypeLabel,
  winnerMessage,
  layoutHint,
}: Props) {
  const [zoneSize, setZoneSize] = useState({ width: 0, height: 0 });
  const enterAnim = useRef(new Animated.Value(0)).current;
  const prevPlayCount = useRef(plays.length);

  const scaleLimits = useMemo(
    () =>
      layoutHint
        ? tableScaleLimits(layoutHint)
        : { displayScale: 0.96, maxFillScale: 1.4 },
    [layoutHint],
  );

  const layout = useMemo(() => {
    return computePlayStackLayout({
      plays,
      zoneWidth: zoneSize.width,
      zoneHeight: zoneSize.height,
      maxFillScale: scaleLimits.maxFillScale,
      displayScale: scaleLimits.displayScale,
    });
  }, [plays, zoneSize, scaleLimits]);

  const maxSpreadWidth =
    zoneSize.width > 0 ? zoneSize.width * MAX_SPREAD_WIDTH_RATIO : undefined;

  useEffect(() => {
    if (plays.length > prevPlayCount.current) {
      enterAnim.setValue(0);
      Animated.timing(enterAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    prevPlayCount.current = plays.length;
  }, [plays.length, enterAnim]);

  const onZoneLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setZoneSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const enterTranslateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  const totalScale = layout.fillScale * layout.displayScale;
  const playCount = plays.length;
  const cardW = Math.round(layout.cardWidth * totalScale);
  const cardH = Math.round(layout.cardHeight * totalScale);
  const stackW = Math.round(layout.stackWidth * totalScale);
  const stackH = Math.round(layout.stackHeight * totalScale);
  const scalePos = (value: number) => Math.round(value * totalScale);

  return (
    <View style={styles.tableFrame} onLayout={onZoneLayout}>
      <View style={styles.anchorHost} pointerEvents="box-none">
        {winnerMessage && playCount === 0 ? (
          <View style={styles.tableMessageCenter} pointerEvents="none">
            <View style={styles.trickResultPill}>
              <Text style={styles.trickResultEyebrow}>Trick Won</Text>
              <Text style={styles.trickResultName} numberOfLines={1}>
                {winnerMessage}
              </Text>
            </View>
          </View>
        ) : playCount === 0 ? (
          <View style={styles.tableMessageCenter} pointerEvents="none">
            <Text style={styles.emptyText}>No cards on the table yet.</Text>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.playCluster,
              {
                position: "absolute",
                left: layout.centerOffsetX,
                top: layout.centerOffsetY,
                transform: [{ translateY: enterTranslateY }],
              },
            ]}
          >
            <View
              style={[
                styles.playStack,
                {
                  width: stackW,
                  height: stackH,
                },
              ]}
            >
                {plays.map((play, playIndex) => {
                  const bundle = layoutPlayBundle(
                    play.cards.length,
                    cardW,
                    maxSpreadWidth
                      ? Math.round(maxSpreadWidth * 0.55 * totalScale)
                      : undefined,
                    cardH,
                  );
                  const pos = layout.positions[playIndex] ?? {
                    left: 0,
                    top: 0,
                    opacity: 1,
                    scale: 1,
                  };
                  const isNewest = playIndex === playCount - 1;

                  return (
                    <View
                      key={playKey(play, playIndex)}
                      style={[
                        styles.playGroup,
                        isNewest ? styles.playGroupActive : styles.playGroupBuried,
                        {
                          left: scalePos(pos.left),
                          top: scalePos(pos.top),
                          width: bundle.width,
                          height: bundle.height,
                          zIndex: playIndex,
                        },
                      ]}
                    >
                      {play.cards.map((card, cardIndex) => (
                        <View
                          key={`${card.suit}-${card.value}-${cardIndex}`}
                          style={[
                            styles.bundleCard,
                            {
                              left: bundle.cardOffsets[cardIndex] ?? 0,
                              width: cardW,
                              height: cardH,
                              zIndex: cardIndex,
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
                      ))}
                    </View>
                  );
                })}
              </View>

              {playTypeLabel ? (
                <View style={styles.playTypeBadge}>
                  <Text style={styles.playTypeBadgeText}>{playTypeLabel}</Text>
                </View>
              ) : null}
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
    alignItems: "center",
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
    android: { elevation: 4 },
    default: {},
  }),
  playGroupBuried: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: {},
  }),
  bundleCard: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
  playTypeBadge: {
    marginTop: 8,
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
  emptyText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
    maxWidth: 280,
  },
  tableMessageCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  trickResultPill: {
    alignSelf: "center",
    maxWidth: 240,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(212, 175, 55, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.38)",
    alignItems: "center",
  },
  trickResultEyebrow: {
    color: GOLD,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  trickResultName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
});
