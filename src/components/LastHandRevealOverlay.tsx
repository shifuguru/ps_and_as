import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from "react-native";
import Card from "./Card";
import BlurPanel from "./BlurPanel";
import type { Card as CardType } from "../game/ruleset";
import { useAppTheme } from "../context/ThemeContext";

const CARD_W = 64;
const CARD_H = Math.round(CARD_W * (124 / 86));
const CARD_STEP = 44;

type Props = {
  visible: boolean;
  playerName: string;
  cards: CardType[];
  onDismiss: () => void;
};

export default function LastHandRevealOverlay({
  visible,
  playerName,
  cards,
  onDismiss,
}: Props) {
  const { colors, ui, blur } = useAppTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 40, 420);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      rise.setValue(10);
      return;
    }
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, fade, rise]);

  const fanWidth = useMemo(() => {
    if (cards.length <= 1) return CARD_W;
    return CARD_W + (cards.length - 1) * CARD_STEP;
  }, [cards.length]);

  if (!visible || cards.length === 0) return null;

  return (
    <Animated.View
      style={[styles.backdrop, { opacity: fade }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss last hand reveal"
      />
      <Animated.View
        style={[
          styles.panelWrap,
          {
            transform: [{ translateY: rise }],
            opacity: fade,
          },
        ]}
      >
        <BlurPanel
          style={[
            ui.modalCard,
            {
              width: cardWidth,
              maxWidth: cardWidth,
              borderColor: colors.btnGoldBorder,
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 18,
            },
          ]}
          preset={blur.modal}
        >
          <Text style={[ui.modalTitle, styles.title]}>Last hand</Text>
          <Text style={[ui.modalBody, styles.subtitle]}>
            {playerName} finished with:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.fanRow,
              { width: Math.max(fanWidth, 1), minWidth: "100%" },
            ]}
            centerContent={fanWidth < 280}
          >
            {cards.map((card, index) => (
              <View
                key={`${card.suit}-${card.value}-${index}`}
                style={[
                  styles.cardSlot,
                  { left: index * CARD_STEP, zIndex: index },
                ]}
              >
                <Card
                  card={card}
                  selected={false}
                  style={{ width: CARD_W, height: CARD_H }}
                  onPress={() => {}}
                />
              </View>
            ))}
          </ScrollView>
        </BlurPanel>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 110,
    elevation: 110,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  panelWrap: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
  },
  title: {
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    marginBottom: 14,
    textAlign: "center",
    fontSize: 15,
  },
  fanRow: {
    position: "relative",
    height: CARD_H + 8,
    justifyContent: "center",
  },
  cardSlot: {
    position: "absolute",
    top: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
});
