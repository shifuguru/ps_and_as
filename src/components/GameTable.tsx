import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet, Dimensions } from "react-native";
import Card from "./Card";
import { Card as CardType } from "../game/ruleset";

type Props = {
  pileCards: CardType[];
  playTypeLabel: string | null;
  lastPlayInfo?: string;
};

export default function GameTable({ pileCards, playTypeLabel, lastPlayInfo }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: false }),
      Animated.spring(scale, { toValue: 1, stiffness: 220, damping: 18, useNativeDriver: false } as any),
    ]).start();
  }, [pileCards.length, playTypeLabel]);

  const windowWidth = Dimensions.get("window").width;
  const isWide = windowWidth >= 900;

  const visiblePile = pileCards;
  const cardCount = visiblePile.length;
  const cardSpacing = cardCount > 10 ? 14 : 18;
  const centerOffset = ((cardCount - 1) * cardSpacing) / 2;

  return (
    <Animated.View style={[styles.tableFrame, { opacity: fade, transform: [{ scale }] }]}>
      {lastPlayInfo ? (
        <Text style={styles.tableSubtitle}>{lastPlayInfo}</Text>
      ) : null}
      <View style={styles.pileArea}>
        {pileCards.length === 0 ? (
          <Text style={styles.emptyText}>No cards on the table yet.</Text>
        ) : (
          <View style={styles.pileStack}>
            {visiblePile.map((card, index) => {
              const offset = Math.min(index, 12);
              const rotation = ((index % 5) - 2) * 2.5;
              return (
                <View
                  key={`${card.suit}-${card.value}-${index}`}
                  style={[
                    styles.pileCardWrapper,
                    {
                      left: offset * cardSpacing - centerOffset,
                      top: offset * -4,
                      zIndex: index,
                      transform: [{ rotate: `${rotation}deg` }],
                    },
                  ]}
                >
                  <Card card={card} selected={false} onPress={() => {}} />
                </View>
              );
            })}
            {cardCount > 1 && (
              <View style={styles.pileCountBadge}>
                <Text style={styles.pileCountText}>{cardCount}</Text>
              </View>
            )}
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
    width: "100%",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginVertical: 10,
    minHeight: 220,
  },
  tableSubtitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginBottom: 10,
  },
  pileArea: {
    flex: 1,
    minHeight: 160,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 12,
  },
  emptyText: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 14,
    textAlign: "center",
  },
  pileStack: {
    width: 260,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  pileCardWrapper: {
    position: "absolute",
  },
  playBadge: {
    marginTop: 12,
    alignSelf: "center",
    backgroundColor: "rgba(122, 172, 214, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(122, 172, 214, 0.2)",
  },
  playBadgeText: {
    color: "#7aacd6",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  pileCountBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pileCountText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600",
  },
});
