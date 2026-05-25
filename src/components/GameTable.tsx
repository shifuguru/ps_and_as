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
      <View style={styles.tableHeader}>
        <Text style={styles.tableTitle}>Central Play Area</Text>
        {lastPlayInfo ? <Text style={styles.tableSubtitle}>{lastPlayInfo}</Text> : null}
      </View>
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
                <Text style={styles.pileCountText}>{cardCount} cards</Text>
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
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(24, 40, 28, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    marginVertical: 12,
    minHeight: 240,
  },
  tableHeader: {
    marginBottom: 14,
  },
  tableTitle: {
    color: "#d4af37",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  tableSubtitle: {
    color: "#bbb",
    fontSize: 12,
  },
  pileArea: {
    flex: 1,
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.14)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  emptyText: {
    color: "#ccc",
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
    marginTop: 14,
    alignSelf: "center",
    backgroundColor: "rgba(212,175,55,0.12)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.24)",
  },
  playBadgeText: {
    color: "#d4af37",
    fontWeight: "800",
    fontSize: 12,
  },
  pileCountBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 6,
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