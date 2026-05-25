import React from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import Card from "./Card";
import { Card as CardType } from "../game/ruleset";

type Props = {
  cards: CardType[];
  selectedIndices: number[];
  playableIndices: boolean[];
  disabled?: boolean;
  onCardPress: (index: number) => void;
};

export default function PlayerHand({
  cards,
  selectedIndices,
  playableIndices,
  disabled,
  onCardPress,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.handScroll}
      style={styles.handContainer}
    >
      <View style={{ width: 16 }} />
      {cards.map((card, index) => {
        const isSelected = selectedIndices.includes(index);
        const isPlayable = playableIndices[index] ?? true;
        return (
          <View
            key={`${card.suit}-${card.value}-${index}`}
            style={index === cards.length - 1 ? styles.cardLast : styles.cardOverlap}
          >
            <Card
              card={card}
              selected={isSelected}
              highlight={isPlayable ? (isSelected ? 1 : 0.45) : 0}
              disabled={disabled || !isPlayable}
              onPress={() => onCardPress(index)}
            />
          </View>
        );
      })}
      <View style={{ width: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  handContainer: {
    width: "100%",
  },
  handScroll: {
    alignItems: "flex-end",
    paddingVertical: 12,
  },
  cardOverlap: {
    marginRight: -56,
  },
  cardLast: {
    marginRight: 0,
  },
});