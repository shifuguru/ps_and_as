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
import { responsive } from "../utils/responsive";

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

<<<<<<< Updated upstream
  const windowWidth = Dimensions.get("window").width;
  const isWide = windowWidth >= 900;
=======
  const visiblePile = pileCards;
  const cardCount = visiblePile.length;
  const cardSpacing = cardCount > 10 ? 14 : 18;
  const centerOffset = ((cardCount - 1) * cardSpacing) / 2;
>>>>>>> Stashed changes

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
        <View style={styles.playBadge}>
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
<<<<<<< Updated upstream
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
=======
    padding: responsive.spacing.lg,
    borderRadius: responsive.borderRadius.xl,
    backgroundColor: "rgba(24, 40, 28, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: responsive.shadowRadius,
    marginVertical: responsive.spacing.md,
    minHeight: responsive.cardHeight * 1.2,
  },
  tableHeader: {
    marginBottom: responsive.spacing.md,
  },
  tableTitle: {
    color: "#d4af37",
    fontSize: responsive.fontSize.lg,
    fontWeight: "800",
    marginBottom: 4,
  },
  tableSubtitle: {
    color: "#bbb",
    fontSize: responsive.fontSize.sm,
    marginTop: responsive.spacing.xs,
  },
  pileArea: {
    flex: 1,
    minHeight: responsive.cardHeight * 0.9,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.14)",
    borderRadius: responsive.borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
>>>>>>> Stashed changes
  },
  emptyText: {
    color: "#ccc",
    fontSize: responsive.fontSize.base,
    textAlign: "center",
<<<<<<< Updated upstream
    paddingHorizontal: 24,
=======
  },
  pileStack: {
    width: responsive.cardHeight,
    height: responsive.cardHeight * 0.75,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  pileCardWrapper: {
    position: "absolute",
>>>>>>> Stashed changes
  },
  playBadge: {
    marginTop: responsive.spacing.md,
    alignSelf: "center",
<<<<<<< Updated upstream
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
=======
    backgroundColor: "rgba(212,175,55,0.12)",
    borderRadius: responsive.borderRadius.lg,
    paddingHorizontal: responsive.spacing.lg,
    paddingVertical: responsive.spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.24)",
  },
  playBadgeText: {
    color: "#d4af37",
    fontWeight: "800",
    fontSize: responsive.fontSize.sm,
  },
  pileCountBadge: {
    position: "absolute",
    right: responsive.spacing.md,
    bottom: responsive.spacing.md,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: responsive.spacing.xs,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
  },
  pileCountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
>>>>>>> Stashed changes
