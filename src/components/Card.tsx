import React, { useEffect, useRef } from "react";
import { Animated, TouchableWithoutFeedback, View, StyleSheet, Easing, Platform, Text } from "react-native";
import { Card as CardType, formatCardRank } from "../game/ruleset";
import { useDarkModeCards } from "../context/CardAppearanceContext";
import { getCardFaceColors, suitColorForCard } from "../utils/cardFaceTheme";

function backFaceRadii(
  style: { width?: number; height?: number } | undefined,
  cornerRadius?: number,
) {
  const w = typeof style?.width === "number" ? style.width : 86;
  const h = typeof style?.height === "number" ? style.height : 124;
  const base = Math.min(w, h);
  const outer =
    cornerRadius ?? (base >= 52 ? 14 : Math.max(3, Math.round(base * 0.1)));
  return {
    outer,
    inner: Math.max(2, outer - 1),
    frame: Math.max(2, Math.round(outer * 0.64)),
    frameInner: Math.max(1, Math.round(outer * 0.43)),
    padding: Math.max(2, Math.round(outer * 0.5)),
    ornament: Math.max(10, Math.round(base * 0.35)),
  };
}

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
  cornerRadius,
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
  /** hand = opaque face so overlapped fan cards don't bleed through */
  variant?: "hand" | "table";
  /** Override outer corner radius (mini face-down cards). */
  cornerRadius?: number;
  style?: any;
}) {
  const darkModeCards = useDarkModeCards();
  const faceColors = getCardFaceColors(darkModeCards, disabled);
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

  // Table cards: static, fully opaque, no motion — avoids blur from nested transforms.
  if (isTable) {
    if (faceDown) {
      const r = backFaceRadii(style, cornerRadius);
      return (
        <View
          style={[
            local.cardTableShell,
            local.cardTable,
            { borderRadius: r.outer },
            style,
          ]}
        >
          <View style={local.inner}>
            <View
              style={[
                local.backFace,
                { borderRadius: r.inner, padding: r.padding },
              ]}
            >
              <View
                style={[
                  local.backFaceFrame,
                  {
                    borderRadius: r.frame,
                    padding: Math.max(2, r.padding - 2),
                  },
                ]}
              >
                <View
                  style={[local.backFaceInner, { borderRadius: r.frameInner }]}
                >
                  <Text
                    style={[local.backFaceOrnament, { fontSize: r.ornament }]}
                  >
                    ♠
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      );
    }

    const labelColor = faceColors.label;
    const suitColor = suitColorForCard(faceColors, card.suit, disabled);

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

    const label = formatCardRank(card);

    return (
      <View
        style={[
          local.cardTableShell,
          local.cardTable,
          {
            backgroundColor: faceColors.faceBg,
            borderColor: darkModeCards
              ? "rgba(255,255,255,0.14)"
              : "rgba(0,0,0,0.14)",
          },
          style,
        ]}
      >
        <View style={local.inner}>
          <View
            style={[
              local.cardFace,
              local.cardFaceOpaque,
              { backgroundColor: faceColors.faceBg },
            ]}
            pointerEvents="none"
          />
          <View style={local.cornerTopLeft} pointerEvents="none">
            <Text style={[local.cornerText, { color: labelColor }]}>{label}</Text>
            <Text style={[local.cornerTextSmall, { color: suitColor }]}>{suitSymbol}</Text>
          </View>
          <Text style={[local.value, { color: labelColor }]}>{label}</Text>
          <Text style={[local.suit, { color: suitColor }]}>{suitSymbol}</Text>
          <View style={local.cornerBottomRight} pointerEvents="none">
            <Text style={[local.cornerText, { color: labelColor }]}>{label}</Text>
            <Text style={[local.cornerTextSmall, { color: suitColor }]}>{suitSymbol}</Text>
          </View>
        </View>
      </View>
    );
  }

  const elevation = glow.interpolate({ inputRange: [0, 1], outputRange: [2, 10] });
  const borderGlow = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0.1)", "rgba(212,175,55,0.75)"],
  });

  const cardBackground = flash
    ? flashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [faceColors.flashBgFrom, faceColors.flashBgTo],
      })
    : faceColors.faceBg;

  const cardBorder = flash
    ? flashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [faceColors.flashBorderFrom, faceColors.flashBorderTo],
      })
    : borderGlow;

  const defaultLabelColor = faceColors.label;
  const defaultSuitColor = suitColorForCard(faceColors, card.suit, disabled);

  const labelColor = disabled
    ? faceColors.label
    : flash
      ? flashAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [faceColors.flashLabelFrom, faceColors.flashLabelTo],
        })
      : defaultLabelColor;

  const suitColor = disabled
    ? defaultSuitColor
    : flash
      ? flashAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [
            defaultSuitColor,
            card.suit === "hearts" || card.suit === "diamonds"
              ? faceColors.flashRedSuitTo
              : faceColors.flashBlackSuitTo,
          ],
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

  const label = formatCardRank(card);

  return (
    <Animated.View
      style={[
        local.card,
        local.cardHand,
        style,
        {
          transform: [{ translateY }, { scale }],
          shadowRadius: elevation,
          borderColor: cardBorder,
          backgroundColor: cardBackground,
        } as any,
        disabled && local.cardDisabled,
        flash && local.cardFlash,
      ]}
    >
      <TouchableWithoutFeedback onPress={disabled ? undefined : onPress} accessibilityLabel={`card-${label}-${card.suit}`}>
        <View style={local.inner}>
          {!faceDown && (
            flash ? (
              <Animated.View
                style={[local.cardFace, { backgroundColor: cardBackground }]}
                pointerEvents="none"
              />
            ) : (
              <View style={[local.cardFace, local.cardFaceOpaque]} pointerEvents="none" />
            )
          )}
          {faceDown ? (
            <View style={local.backFace}>
              <View style={local.backFaceFrame}>
                <View style={local.backFaceInner}>
                  <Text style={local.backFaceOrnament}>♠</Text>
                </View>
              </View>
            </View>
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
          {disabled && !faceDown && (
            <View
              style={[
                local.disabledWash,
                { backgroundColor: faceColors.disabledWash },
              ]}
              pointerEvents="none"
            />
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
    borderColor: "rgba(0,0,0,0.1)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardDisabled: {
    opacity: 0.88,
    ...Platform.select({
      web: { filter: "saturate(0.35)" as any },
      default: {},
    }),
  },
  cardTableShell: {
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    opacity: 1,
  },
  cardTable: {},
  cardFlash: {
    ...Platform.select({
      ios: {
        shadowColor: "#fff",
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 5 },
      default: {
        shadowColor: "#fff",
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
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
  cardFaceOpaque: {},
  disabledWash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
    backgroundColor: "rgba(168, 166, 158, 0.38)",
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
  backFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
    backgroundColor: "#b71234",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 7,
  },
  backFaceFrame: {
    flex: 1,
    width: "100%",
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.42)",
    padding: 4,
    backgroundColor: "#a10f2d",
  },
  backFaceInner: {
    flex: 1,
    width: "100%",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "#c41e3a",
    alignItems: "center",
    justifyContent: "center",
  },
  backFaceOrnament: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 22,
    fontWeight: "800",
  },
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
