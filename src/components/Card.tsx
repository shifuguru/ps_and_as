import React from "react";
import { Animated, TouchableWithoutFeedback, View, Text, StyleSheet } from "react-native";
import { Card as CardType } from "../game/ruleset";

export default function Card({ card, selected, onPress, highlight = 0, faceDown = false, disabled = false, style, }: { card: CardType; selected: boolean; onPress: () => void; highlight?: number; faceDown?: boolean; disabled?: boolean; style?: any; }) {
  const anim = React.useRef(new Animated.Value(selected ? 1 : 0)).current;
  const glow = React.useRef(new Animated.Value(highlight)).current;
  const float = React.useRef(new Animated.Value(6)).current;

  // Subtle vertical float on mount
  React.useEffect(() => {
    Animated.spring(float, {
      toValue: 0,
      useNativeDriver: false,
      stiffness: 120,
      damping: 10,
    } as any).start();
  }, []);

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: selected ? 1 : 0,
      useNativeDriver: false,
      stiffness: 200,
      damping: 14,
    } as any).start();
  }, [selected]);

  React.useEffect(() => {
    Animated.timing(glow, { toValue: Math.max(0, Math.min(1, highlight)), duration: 220, useNativeDriver: false }).start();
  }, [highlight]);

  const selectTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const translateY = Animated.add(selectTranslateY, float);
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
    <Animated.View style={[local.card, style, { transform: [{ translateY }, { scale }], shadowRadius: elevation } as any, { borderColor: borderGlow }, disabled && { opacity: 0.35 }]}>
      <TouchableWithoutFeedback onPress={disabled ? undefined : onPress} accessibilityLabel={`card-${label}-${card.suit}`}>
        <View style={local.inner}>
          {faceDown ? (
            <View style={local.backFace} />
          ) : (
            <>
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
            </>
          )}
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const local = StyleSheet.create({
  card: {
    width: 86,
    height: 124,
    backgroundColor: "#101712",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.15)",
    shadowColor: "black",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    justifyContent: "center",
    alignItems: "center",
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
  backFace: { width: "80%", height: "60%", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 6 },
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
