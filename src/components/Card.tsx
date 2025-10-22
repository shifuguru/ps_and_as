import React from "react";
import { Animated, TouchableWithoutFeedback, View, Text, StyleSheet } from "react-native";
import { Card as CardType } from "../game/ruleset";

export default function Card({ card, selected, onPress, highlight = 0 }: { card: CardType; selected: boolean; onPress: () => void; highlight?: number }) {
  const anim = React.useRef(new Animated.Value(selected ? 1 : 0)).current;
  const glow = React.useRef(new Animated.Value(highlight)).current;

  React.useEffect(() => {
    // Use JS-driven animation for this spring so it can be combined with the
    // `glow` JS-driven timing animation (avoids mixing native vs JS drivers).
    Animated.spring(anim, {
      toValue: selected ? 1 : 0,
      useNativeDriver: false,
      stiffness: 200,
      damping: 14,
    } as any).start();
  }, [selected]);

  React.useEffect(() => {
    // animate glow value toward highlight (0..1)
    Animated.timing(glow, { toValue: Math.max(0, Math.min(1, highlight)), duration: 220, useNativeDriver: false }).start();
  }, [highlight]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const scale = Animated.add(
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
    glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.04] })
  );

  const elevation = glow.interpolate({ inputRange: [0, 1], outputRange: [2, 10] });
  const borderGlow = glow.interpolate({ inputRange: [0, 1], outputRange: ["rgba(212,175,55,0.15)", "rgba(212,175,55,0.9)"] });

  const suitSymbol = (() => {
    switch (card.suit) {
      case "hearts":
        return "♥";
      case "diamonds":
        return "♦";
      case "clubs":
        return "♣";
      case "spades":
        return "♠";
      case "joker":
        return "★";
    }
  })();

  const label = (() => {
    if (card.suit === "joker") return "JOKER";
    if (card.value <= 10 && card.value >= 2) return String(card.value);
    if (card.value === 11) return "J";
    if (card.value === 12) return "Q";
    if (card.value === 13) return "K";
    return "A";
  })();

  return (
    <Animated.View style={[local.card, { transform: [{ translateY }, { scale }], shadowRadius: elevation } as any, { borderColor: borderGlow }]}>
      <TouchableWithoutFeedback onPress={onPress} accessibilityLabel={`card-${label}-${card.suit}`}>
        <View style={local.inner}>
          {/* corner rank/suit markers */}
          <View style={local.cornerTopLeft} pointerEvents="none">
            <Text style={local.cornerText}>{label}</Text>
            <Text style={local.cornerTextSmall}>{suitSymbol}</Text>
          </View>

          <Text style={local.value}>{label}</Text>
          <Text style={local.suit}>{suitSymbol}</Text>

          <View style={local.cornerBottomRight} pointerEvents="none">
            <Text style={local.cornerText}>{label}</Text>
            <Text style={local.cornerTextSmall}>{suitSymbol}</Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const local = StyleSheet.create({
  card: {
    width: 84,
    height: 120,
    backgroundColor: "#0f0f0f",
    borderRadius: 8,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.15)",
    shadowColor: "black",
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 2 },
    justifyContent: "center",
    alignItems: "center",
    // ensure cards can overlap in a horizontal stack
    position: "relative",
  },
  inner: {
    alignItems: "center",
    width: "100%",
    height: "100%",
    justifyContent: "center",
  },
  value: {
    color: "#f0f0f0",
    fontWeight: "700",
    fontSize: 18,
  },
  suit: {
    color: "#d4af37",
    fontSize: 20,
    marginTop: 6,
  },
  cornerTopLeft: {
    position: "absolute",
    top: 6,
    left: 8,
    alignItems: "flex-start",
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: 6,
    right: 8,
    alignItems: "flex-end",
    transform: [{ rotate: "180deg" }],
  },
  cornerText: {
    color: "#f0f0f0",
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 12,
  },
  cornerTextSmall: {
    color: "#d4af37",
    fontSize: 10,
    lineHeight: 12,
  },
});
