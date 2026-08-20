import React, { useEffect, useMemo, useRef } from "react";
import { Animated, TouchableWithoutFeedback, View, StyleSheet, Easing, Platform, Text } from "react-native";
import { Card as CardType, formatCardRank } from "../game/ruleset";
import {
  HAND_CARD_HEIGHT,
  HAND_CARD_WIDTH,
  HAND_SELECT_LIFT,
  HAND_SELECT_SCALE,
  resolveCardFaceMetrics,
} from "./cardDimensions";
import { useDarkModeCards } from "../context/CardAppearanceContext";
import { getCardFaceColors, suitColorForCard } from "../utils/cardFaceTheme";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

function backFaceRadii(
  style: { width?: number; height?: number } | undefined,
  cornerRadius?: number,
) {
  const w = typeof style?.width === "number" ? style.width : HAND_CARD_WIDTH;
  const h = typeof style?.height === "number" ? style.height : HAND_CARD_HEIGHT;
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

function readCardBox(
  style: unknown,
): { width: number; height: number } {
  const flat = StyleSheet.flatten(style) as
    | { width?: number | string; height?: number | string }
    | undefined;
  const width =
    typeof flat?.width === "number" ? flat.width : HAND_CARD_WIDTH;
  const height =
    typeof flat?.height === "number" ? flat.height : HAND_CARD_HEIGHT;
  return { width, height };
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
  const { colors } = useAppTheme();
  const faceColors = getCardFaceColors(darkModeCards, disabled, colors.accent);
  const cardBox = useMemo(() => readCardBox(style), [style]);
  const face = useMemo(
    () => resolveCardFaceMetrics(cardBox.width, cardBox.height),
    [cardBox.width, cardBox.height],
  );
  /** Felt-theme accent — selection / highlight rim follows the table, not fixed colour. */
  const accentBorder = useMemo(
    () => hexToRgba(colors.accent, 0.88),
    [colors.accent],
  );
  const idleBorder = darkModeCards
    ? "rgba(255,255,255,0.14)"
    : "rgba(0,0,0,0.12)";
  const anim = React.useRef(new Animated.Value(selected ? 1 : 0)).current;
  const glow = React.useRef(new Animated.Value(highlight)).current;
  const float = React.useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: selected ? 1 : 0,
      useNativeDriver: false,
      stiffness: 320,
      damping: 22,
      mass: 0.88,
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

  const selectTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -HAND_SELECT_LIFT],
  });
  const selectScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, HAND_SELECT_SCALE],
  });
  const translateY = Animated.add(selectTranslateY, float);

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
            borderRadius: face.outerRadius,
          },
          style,
        ]}
      >
        <View style={local.inner}>
          <View
            style={[
              local.cardFace,
              local.cardFaceOpaque,
              {
                backgroundColor: faceColors.faceBg,
                borderRadius: face.faceRadius,
              },
            ]}
            pointerEvents="none"
          />
          <View
            style={[
              local.cornerTopLeft,
              {
                top: face.cornerInsetTop,
                left: face.cornerInsetSide,
              },
            ]}
            pointerEvents="none"
          >
            <Text
              style={[
                local.cornerRank,
                {
                  color: labelColor,
                  fontSize: face.cornerRank,
                  lineHeight: face.cornerRankLine,
                },
              ]}
            >
              {label}
            </Text>
            <Text
              style={[
                local.cornerSuit,
                {
                  color: suitColor,
                  fontSize: face.cornerSuit,
                  lineHeight: face.cornerSuitLine,
                },
              ]}
            >
              {suitSymbol}
            </Text>
          </View>
          <Text
            style={[
              local.value,
              { color: labelColor, fontSize: face.value },
            ]}
          >
            {label}
          </Text>
          <Text
            style={[
              local.suit,
              {
                color: suitColor,
                fontSize: face.suit,
                marginTop: face.suitMarginTop,
              },
            ]}
          >
            {suitSymbol}
          </Text>
          <View
            style={[
              local.cornerBottomRight,
              {
                bottom: face.cornerInsetTop,
                right: face.cornerInsetSide,
              },
            ]}
            pointerEvents="none"
          >
            <Text
              style={[
                local.cornerRank,
                {
                  color: labelColor,
                  fontSize: face.cornerRank,
                  lineHeight: face.cornerRankLine,
                },
              ]}
            >
              {label}
            </Text>
            <Text
              style={[
                local.cornerSuit,
                {
                  color: suitColor,
                  fontSize: face.cornerSuit,
                  lineHeight: face.cornerSuitLine,
                },
              ]}
            >
              {suitSymbol}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const elevation = glow.interpolate({ inputRange: [0, 1], outputRange: [2, 10] });
  const borderGlow = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [idleBorder, accentBorder],
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
        {
          width: face.width,
          height: face.height,
          borderRadius: face.outerRadius,
        },
        style,
        { transform: [{ translateY }, { scale: selectScale }] },
        flash && local.cardFlash,
      ]}
    >
      <TouchableWithoutFeedback onPress={disabled ? undefined : onPress} accessibilityLabel={`card-${label}-${card.suit}`}>
        <View style={local.inner}>
          <Animated.View
            pointerEvents="none"
            style={[
              local.cardHandShell,
              disabled && local.cardHandDisabled,
              {
                borderRadius: face.outerRadius,
                shadowRadius: elevation,
                borderColor: cardBorder,
                backgroundColor: cardBackground,
              } as any,
            ]}
          >
            {!faceDown &&
              (flash ? (
                <Animated.View
                  style={[
                    local.cardFace,
                    {
                      backgroundColor: cardBackground,
                      borderRadius: face.faceRadius,
                    },
                  ]}
                  pointerEvents="none"
                />
              ) : (
                <View
                  style={[
                    local.cardFace,
                    local.cardFaceOpaque,
                    { borderRadius: face.faceRadius },
                  ]}
                  pointerEvents="none"
                />
              ))}
            {faceDown ? (
              <View
                style={[
                  local.backFace,
                  { borderRadius: face.faceRadius },
                ]}
              >
                <View style={local.backFaceFrame}>
                  <View style={local.backFaceInner}>
                    <Text
                      style={[
                        local.backFaceOrnament,
                        { fontSize: Math.max(12, Math.round(22 * face.scale)) },
                      ]}
                    >
                      ♠
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
            {disabled && !faceDown ? (
              <View
                style={[
                  local.disabledWash,
                  {
                    backgroundColor: faceColors.disabledWash,
                    borderRadius: face.faceRadius,
                  },
                ]}
                pointerEvents="none"
              />
            ) : null}
          </Animated.View>
          {!faceDown ? (
          <Animated.View
            style={[
              local.handTextLayer,
              disabled && local.cardHandTextDisabled,
            ]}
            pointerEvents="none"
          >
            <>
              <View
                style={[
                  local.cornerTopLeft,
                  {
                    top: face.cornerInsetTop,
                    left: face.cornerInsetSide,
                  },
                ]}
                pointerEvents="none"
              >
                <AnimatedText
                  style={[
                    local.cornerRank,
                    {
                      color: labelColor,
                      fontSize: face.cornerRank,
                      lineHeight: face.cornerRankLine,
                    },
                  ]}
                >
                  {label}
                </AnimatedText>
                <AnimatedText
                  style={[
                    local.cornerSuit,
                    {
                      color: suitColor,
                      fontSize: face.cornerSuit,
                      lineHeight: face.cornerSuitLine,
                    },
                  ]}
                >
                  {suitSymbol}
                </AnimatedText>
              </View>
              <View
                style={[
                  local.cornerBottomRight,
                  {
                    bottom: face.cornerInsetTop,
                    right: face.cornerInsetSide,
                  },
                ]}
                pointerEvents="none"
              >
                <AnimatedText
                  style={[
                    local.cornerRank,
                    {
                      color: labelColor,
                      fontSize: face.cornerRank,
                      lineHeight: face.cornerRankLine,
                    },
                  ]}
                >
                  {label}
                </AnimatedText>
                <AnimatedText
                  style={[
                    local.cornerSuit,
                    {
                      color: suitColor,
                      fontSize: face.cornerSuit,
                      lineHeight: face.cornerSuitLine,
                    },
                  ]}
                >
                  {suitSymbol}
                </AnimatedText>
              </View>
              {!compact ? (
                <>
                  <AnimatedText
                    style={[
                      local.value,
                      { color: labelColor, fontSize: face.value },
                    ]}
                  >
                    {label}
                  </AnimatedText>
                  <AnimatedText
                    style={[
                      local.suit,
                      {
                        color: suitColor,
                        fontSize: face.suit,
                        marginTop: face.suitMarginTop,
                      },
                    ]}
                  >
                    {suitSymbol}
                  </AnimatedText>
                </>
              ) : null}
            </>
          </Animated.View>
          ) : null}
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
    overflow: "visible",
    borderWidth: 0,
    backgroundColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  cardHandShell: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    ...Platform.select({
      web: {
        backfaceVisibility: "hidden" as const,
      },
      default: {},
    }),
  },
  cardDisabled: {
    opacity: 0.88,
    ...Platform.select({
      web: { filter: "saturate(0.35)" as any },
      default: {},
    }),
  },
  /** Dim unplayable hand cards on the scaled shell only (avoids ghost overlay). */
  cardHandDisabled: {
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
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 11,
      },
      android: { elevation: 6 },
      web: {
        boxShadow:
          "0 1px 2px rgba(0,0,0,0.12), 0 5px 10px rgba(0,0,0,0.14)",
      } as object,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 11,
      },
    }),
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
    position: "relative",
    alignItems: "center",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    overflow: "visible",
  },
  handTextLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  cardHandTextDisabled: {
    opacity: 0.88,
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
    zIndex: 3,
  },
  value: {
    color: "#1a1a1a",
    fontWeight: "800",
  },
  suit: {
    color: "#1a1a1a",
    fontWeight: "800",
  },
  cornerTopLeft: {
    position: "absolute",
    alignItems: "flex-start",
  },
  cornerBottomRight: {
    position: "absolute",
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
    fontWeight: "800",
  },
  cornerRank: {
    color: "#1a1a1a",
    fontWeight: "800",
  },
  cornerSuit: {
    color: "#1a1a1a",
    fontWeight: "700",
  },
});
