import React, { useEffect, useRef } from "react";
import { Animated, TouchableWithoutFeedback, View, StyleSheet, Easing } from "react-native";
import { Card as CardType } from "../game/ruleset";

export default function Card({
  card,
  selected,
  onPress,
  highlight = 0,
  faceDown = false,
  disabled = false,
  compact = false,
  flash = false,
  variant = "hand",
  style,
}: {
  card: CardType;
  selected: boolean;
  onPress: () => void;
  highlight?: number;
  faceDown?: boolean;
  disabled?: boolean;
  /** Hand view: only top-left rank/suit visible when overlapped */
  compact?: boolean;
  /** Opening-lead pulse (same rhythm as the Pass button flash) */
  flash?: boolean;
  /** hand = semi-transparent table face on blur; table = opaque face for stacking */
  variant?: "hand" | "table";
  style?: any;
}) {
  const anim = React.useRef(new Animated.Value(selected ? 1 : 0)).current;
  const glow = React.useRef(new Animated.Value(highlight)).current;
  const float = React.useRef(new Animated.Value(6)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (!flash) {
      flashAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flash, flashAnim]);

  const selectTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const translateY = Animated.add(selectTranslateY, float);
  const scale = Animated.add(
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
    glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.04] })
  );

  const isTable = variant === "table";

  const elevation = glow.interpolate({ inputRange: [0, 1], outputRange: [2, 10] });
  const borderGlow = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0.1)", "rgba(212,175,55,0.75)"],
  });

  const cardBackground = flash
    ? flashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: isTable
          ? ["#f5f4ef", "#ffffff"]
          : ["rgba(245, 244, 239, 0.82)", "rgba(255, 255, 255, 0.96)"],
      })
    : isTable
      ? "#f5f4ef"
      : "rgba(245, 244, 239, 0.82)";

  const cardBorder = flash
    ? flashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(0,0,0,0.12)", "rgba(212,175,55,0.85)"],
      })
    : borderGlow;

  const suitIsRed = card.suit === "hearts" || card.suit === "diamonds";
  const defaultLabelColor = "#1a1a1a";
  const defaultSuitColor = suitIsRed ? "#b71c1c" : "#1a1a1a";

  const labelColor = flash
    ? flashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["#1a1a1a", "#111111"],
      })
    : defaultLabelColor;

  const suitColor = flash
    ? flashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [defaultSuitColor, suitIsRed ? "#8b0000" : "#333333"],
      })
    : defaultSuitColor;

  const AnimatedText = Animated.Text;

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
    <Animated.View
      style={[
        local.card,
        isTable ? local.cardTable : local.cardHand,
        style,
        {
          transform: [{ translateY }, { scale }],
          shadowRadius: elevation,
          borderColor: cardBorder,
          backgroundColor: cardBackground,
        } as any,
        disabled && { opacity: 0.35 },
        flash && local.cardFlash,
      ]}
    >
      <TouchableWithoutFeedback onPress={disabled ? undefined : onPress} accessibilityLabel={`card-${label}-${card.suit}`}>
        <View style={local.inner}>
          {!faceDown && (
            <View
              style={[
                local.cardFace,
                isTable ? local.cardFaceOpaque : local.cardFaceTranslucent,
              ]}
              pointerEvents="none"
            />
          )}
          {faceDown ? (
            <View style={local.backFace} />
          ) : compact ? (
            <>
              <View style={local.cornerTopLeft} pointerEvents="none">
                <AnimatedText style={[local.cornerTextCompact, { color: labelColor }]}>{label}</AnimatedText>
                <AnimatedText style={[local.cornerSuitInline, { color: suitColor }]}>{suitSymbol}</AnimatedText>
              </View>
              <View style={local.cornerBottomRight} pointerEvents="none">
                <AnimatedText style={[local.cornerTextCompact, { color: labelColor }]}>{label}</AnimatedText>
                <AnimatedText style={[local.cornerSuitInline, { color: suitColor }]}>{suitSymbol}</AnimatedText>
              </View>
            </>
          ) : (
            <>
              <View style={local.cornerTopLeft} pointerEvents="none">
                <AnimatedText style={[local.cornerText, { color: labelColor }]}>{label}</AnimatedText>
                <AnimatedText style={[local.cornerTextSmall, { color: suitColor }]}>{suitSymbol}</AnimatedText>
              </View>

              <AnimatedText style={[local.value, { color: labelColor }]}>{label}</AnimatedText>
              <AnimatedText style={[local.suit, { color: suitColor }]}>{suitSymbol}</AnimatedText>

              <View style={local.cornerBottomRight} pointerEvents="none">
                <AnimatedText style={[local.cornerText, { color: labelColor }]}>{label}</AnimatedText>
                <AnimatedText style={[local.cornerTextSmall, { color: suitColor }]}>{suitSymbol}</AnimatedText>
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
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  cardHand: {
    backgroundColor: "rgba(245, 244, 239, 0.82)",
    borderColor: "rgba(0,0,0,0.1)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTable: {
    backgroundColor: "#f5f4ef",
    borderColor: "rgba(0,0,0,0.1)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 3 },
  },
  cardFlash: {
    shadowColor: "#fff",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  inner: {
    alignItems: "center",
    width: "100%",
    height: "100%",
    justifyContent: "center",
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
  },
  cardFaceOpaque: {
    backgroundColor: "#f5f4ef",
  },
  cardFaceTranslucent: {
    backgroundColor: "rgba(245, 244, 239, 0.82)",
  },
  value: {
    color: "#1a1a1a",
    fontWeight: "700",
    fontSize: 18,
  },
  suit: {
    color: "#1a1a1a",
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
    color: "#1a1a1a",
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 12,
  },
  cornerTextCompact: {
    color: "#1a1a1a",
    fontSize: 13,
    lineHeight: 15,
    fontWeight: "800",
  },
  cornerSuitInline: {
    color: "#1a1a1a",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
  },
  cornerTextSmall: {
    color: "#1a1a1a",
    fontSize: 10,
    lineHeight: 12,
  },
});
