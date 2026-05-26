import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import Card from "./Card";
import { Card as CardType } from "../game/ruleset";

type Props = {
  pileCards: CardType[];
  playTypeLabel: string | null;
};

export default function TableCenter({ pileCards, playTypeLabel }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.spring(scale, { toValue: 1, stiffness: 200, damping: 18, useNativeDriver: false } as any),
    ]).start();
  }, [pileCards.length, playTypeLabel]);

  const cardCount = pileCards.length;
  const cardSpacing = cardCount > 10 ? 14 : 18;
  const centerOffset = ((cardCount - 1) * cardSpacing) / 2;

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.table, { opacity: fade, transform: [{ scale }] }]}>
        <View style={styles.pileArea}>
          {cardCount === 0 ? (
            <Text style={styles.emptyText}>Table is empty</Text>
          ) : (
            <View style={styles.pileStack}>
              {pileCards.map((card, index) => {
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
      </Animated.View>
      {playTypeLabel ? (
        <Text style={styles.playTypeText}>{playTypeLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  table: {
    width: "100%",
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  pileArea: {
    minHeight: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 14,
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
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
  },
  playTypeText: {
    color: "#7aacd6",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 12,
    textAlign: "center",
  },
});
