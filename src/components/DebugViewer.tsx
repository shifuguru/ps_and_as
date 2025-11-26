import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { GameState, TrickHistory } from "../game/core";

interface DebugViewerProps {
  state: GameState;
}

export default function DebugViewer({ state }: DebugViewerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <TouchableOpacity 
        style={styles.collapsedButton} 
        onPress={() => setExpanded(true)}
      >
        <Text style={styles.collapsedText}>📊 Game Info</Text>
      </TouchableOpacity>
    );
  }

  const cardToString = (card: any) => {
    const suitSymbol = {
      hearts: "♥",
      diamonds: "♦",
      clubs: "♣",
      spades: "♠",
      joker: "★",
    }[card.suit] || "?";
    
    let value = "";
    if (card.value === 11) value = "J";
    else if (card.value === 12) value = "Q";
    else if (card.value === 13) value = "K";
    else if (card.value === 14) value = "A";
    else value = String(card.value);
    
    return `${value}${suitSymbol}`;
  };

  const allTricks = [...(state.trickHistory || [])];
  if (state.currentTrick && state.currentTrick.actions.length > 0) {
    allTricks.push(state.currentTrick);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Game Information</Text>
        <TouchableOpacity onPress={() => setExpanded(false)}>
          <Text style={styles.closeButton}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Current Round Placements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Current Placements</Text>
          {state.finishedOrder.map((playerId, index) => {
            const player = state.players.find(p => p.id === playerId);
            return (
              <Text key={playerId} style={styles.placement}>
                {index + 1}. {player?.name || "Unknown"}
              </Text>
            );
          })}
          {state.finishedOrder.length === 0 && (
            <Text style={styles.noData}>No one has finished yet</Text>
          )}
        </View>

        {/* Trick History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Trick History ({allTricks.length} tricks)</Text>
          {allTricks.slice().reverse().map((trick, trickIndex) => (
            <View key={trickIndex} style={styles.trick}>
              <Text style={styles.trickTitle}>
                Trick #{trick.trickNumber}
                {trick.winnerId && ` - Winner: ${trick.winnerName}`}
              </Text>
              {trick.actions.map((action, actionIndex) => (
                <View key={actionIndex} style={styles.action}>
                  {action.type === "play" ? (
                    <Text style={styles.actionText}>
                      ▶ {action.playerName}: {action.cards?.map(cardToString).join(", ")}
                    </Text>
                  ) : (
                    <Text style={styles.passText}>
                      ⊘ {action.playerName}: Pass
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))}
          {allTricks.length === 0 && (
            <Text style={styles.noData}>No tricks played yet</Text>
          )}
        </View>

        {/* Player Hands Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Player Hand Sizes</Text>
          {state.players.map((player) => (
            <Text key={player.id} style={styles.playerInfo}>
              {player.name}: {player.hand.length} cards
              {state.finishedOrder.includes(player.id) && " (Finished)"}
              {state.currentPlayerIndex === state.players.indexOf(player) && " ⬅ Current"}
            </Text>
          ))}
        </View>

        {/* Game State Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Game State</Text>
          <Text style={styles.stateText}>Game ID: {state.id}</Text>
          <Text style={styles.stateText}>Pass Count: {state.passCount}</Text>
          <Text style={styles.stateText}>Must Play: {state.mustPlay ? "Yes" : "No"}</Text>
          <Text style={styles.stateText}>Current Pile: {state.pile.map(cardToString).join(", ") || "Empty"}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedButton: {
    position: "absolute",
    top: 100,
    right: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 100,
  },
  collapsedText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  container: {
    position: "absolute",
    top: 100,
    right: 16,
    width: 320,
    maxHeight: "80%",
    backgroundColor: "rgba(15, 15, 15, 0.98)",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(212, 175, 55, 0.5)",
    zIndex: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212, 175, 55, 0.3)",
  },
  title: {
    color: "#d4af37",
    fontWeight: "700",
    fontSize: 16,
  },
  closeButton: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  scrollView: {
    maxHeight: 600,
  },
  section: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: {
    color: "#d4af37",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 8,
  },
  trick: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
  },
  trickTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 6,
  },
  action: {
    marginLeft: 8,
    marginBottom: 4,
  },
  actionText: {
    color: "#aaa",
    fontSize: 12,
  },
  passText: {
    color: "#888",
    fontSize: 12,
    fontStyle: "italic",
  },
  placement: {
    color: "#fff",
    fontSize: 13,
    marginBottom: 4,
  },
  noData: {
    color: "#666",
    fontSize: 12,
    fontStyle: "italic",
  },
  playerInfo: {
    color: "#ccc",
    fontSize: 12,
    marginBottom: 4,
  },
  stateText: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 4,
  },
});
