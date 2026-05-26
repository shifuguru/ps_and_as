import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";
import Card from "./Card";
import { Card as CardType } from "../game/ruleset";

/** Must match Card.tsx */
const CARD_W = 86;
const CARD_H = 124;

/** Offset between consecutive plays in the trick (new play sits on top, shifted) */
const PLAY_OFFSET_X = 16;
const PLAY_OFFSET_Y = 12;
/** Overlap within a multi-card play (doubles / triples / quads) */
const BUNDLE_OVERLAP = 34;

type Props = {
  /** Chronological plays in the current trick — each entry is one player's play */
  plays: CardType[][];
  playTypeLabel: string | null;
};

export default function GameTable({ plays, playTypeLabel }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  const playCount = plays.length;
  const maxBundle = useMemo(
    () => Math.max(1, ...plays.map((p) => p.length)),
    [plays],
  );

  const stepX =
    playCount <= 1 ? 0 : Math.min(PLAY_OFFSET_X, 72 / (playCount - 1));
  const stepY =
    playCount <= 1 ? 0 : Math.min(PLAY_OFFSET_Y, 56 / (playCount - 1));

  const stackWidth =
    (playCount > 0 ? (playCount - 1) * stepX : 0) +
    CARD_W +
    (maxBundle - 1) * (CARD_W - BUNDLE_OVERLAP);
  const stackHeight =
    CARD_H + (playCount > 0 ? (playCount - 1) * stepY : 0);

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

  return (
    <Animated.View
      style={[styles.tableFrame, { opacity: fade, transform: [{ scale }] }]}
    >
      <View style={styles.pileArea}>
        {playCount === 0 ? (
          <Text style={styles.emptyText}>No cards on the table yet.</Text>
        ) : (
          <View
            style={[
              styles.playStack,
              { width: stackWidth, height: stackHeight },
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
        )}
      </View>
      {playTypeLabel ? (
        <View style={[styles.playBadge, isWide && { alignSelf: "flex-start" }]}>
          <Text style={styles.playBadgeText}>{playTypeLabel}</Text>
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
    minHeight: 180,
  },
  pileArea: {
    flex: 1,
    minHeight: 140,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
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
});
