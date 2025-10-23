import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { createGame, GameState, playCards, passTurn, findValidSingleCard, rankIndex, findCPUPlay, setTenRuleDirection, isValidPlay, RANK_ORDER, isRun } from "../game/core";
import Card from "../components/Card";
import { ScrollView, Dimensions } from "react-native";
import { MockAdapter } from "../game/network";
import DebugViewer from "../components/DebugViewer";
import { Card as CardType } from "../game/ruleset";

// Helper: check if a card value can be part of any valid play
function canCardBePlayedAtAll(cardValue: number, hand: CardType[], pile: CardType[], tenRule?: { active: boolean; direction: "higher" | "lower" | null }, pileHistory?: CardType[][]): boolean {
  const pileCount = pile.length;
  
  // Single joker can always beat non-empty pile
  if (cardValue === 15) {
    const jokers = hand.filter(c => c.value === 15);
    if (jokers.length >= 1) {
      // Check if single joker is valid
      if (pileCount > 0 && isValidPlay([jokers[0]], pile, tenRule)) return true;
      // If pile is empty and no history, this is first play - can't start with joker
      if (pileCount === 0 && (!pileHistory || pileHistory.length === 0)) return false;
      // If pile is empty but has history, joker is valid
      if (pileCount === 0) return true;
    }
  }
  
  // Find all cards with this value
  const sameValue = hand.filter(c => c.value === cardValue);
  if (sameValue.length === 0) return false;
  
  // If pile is empty, check for first play constraint
  if (pileCount === 0) {
    // If this is the very first play of the game, must have 3 of clubs
    if (!pileHistory || pileHistory.length === 0) {
      if (cardValue === 3) {
        // Check if we have 3 of clubs
        const hasThreeOfClubs = hand.some(c => c.value === 3 && c.suit === "clubs");
        return hasThreeOfClubs;
      }
      return false; // First play must be 3s
    }
    // Not first play, any card is valid
    return true;
  }
  
  // Check if pile is a run
  const isPileRun = pile.length >= 3 && isRun(pile);
  
  if (isPileRun) {
    // To beat a run, we need a run of the same length with higher starting value
    // Check if this card could be part of such a run
    const requiredLength = pile.length;
    
    // Try to form runs that include this card value
    for (let startOffset = 0; startOffset < requiredLength; startOffset++) {
      const targetStartRank = rankIndex(cardValue) - startOffset;
      if (targetStartRank < 0) continue;
      
      // Check if we can form a consecutive run starting from targetStartRank
      let runCards: CardType[] = [];
      for (let i = 0; i < requiredLength; i++) {
        const neededRankIdx = targetStartRank + i;
        if (neededRankIdx >= RANK_ORDER.length) break;
        const neededValue = RANK_ORDER[neededRankIdx];
        const cardWithValue = hand.find(c => c.value === neededValue);
        if (!cardWithValue) break;
        runCards.push(cardWithValue);
      }
      
      if (runCards.length === requiredLength && isRun(runCards)) {
        // Check if this run beats the pile
        if (isValidPlay(runCards, pile, tenRule)) return true;
      }
    }
    return false;
  }
  
  // Regular play: check if we can play the required count
  const requiredCount = pileCount;
  if (sameValue.length < requiredCount) return false;
  
  // Check if playing this card (with required count) would be valid
  const cardsToPlay = sameValue.slice(0, requiredCount);
  return isValidPlay(cardsToPlay, pile, tenRule);
}

export default function GameScreen({ 
  initialPlayers, 
  localPlayerName,
  adapter: networkAdapter,
  roomId,
  onBack 
}: { 
  initialPlayers?: string[]; 
  localPlayerName?: string;
  adapter?: any;
  roomId?: string;
  onBack?: () => void;
} = {}) {
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<number[]>([]); // indices in hand
  const [focused, setFocused] = useState<number | null>(null);
  const adapter = networkAdapter || new MockAdapter();

  useEffect(() => {
  const names = initialPlayers && initialPlayers.length >= 2 ? initialPlayers : ["Alice", "Bob", "Charlie", "Dana"];
  const g = createGame(names);
    setState(g);
    adapter.connect();
    adapter.on("message", (ev) => {
      // Handle game actions from server (other players' moves)
      if (ev.type === "state" && ev.state && ev.state.type === "gameAction") {
        console.log("[GameScreen] Received game action from", ev.state.playerName, ":", ev.state.action.type);
        
        // Apply the action to our local game state
        if (ev.state.action.type === "play") {
          setState((currentState) => {
            if (!currentState) return currentState;
            const nextState = playCards(currentState, ev.state.action.playerId, ev.state.action.cards);
            
            // Handle 10 rule direction if needed
            if (ev.state.action.tenRuleDirection && nextState.tenRulePending) {
              return setTenRuleDirection(nextState, ev.state.action.tenRuleDirection);
            }
            
            return nextState;
          });
        } else if (ev.state.action.type === "pass") {
          setState((currentState) => {
            if (!currentState) return currentState;
            return passTurn(currentState, ev.state.action.playerId);
          });
        }
      }
      // Legacy support for MockAdapter
      else if (ev.type === "state") {
        setState(ev.state);
      }
    });

    return () => {
      adapter.disconnect();
    };
  }, []);

  // CPU auto-play effect
  useEffect(() => {
    if (!state) return;

    const current = state.players[state.currentPlayerIndex];
    
    // Check if current player is a CPU
    // In multiplayer: CPU is anyone who's not the local player
    // In local/hotseat: CPU is anyone starting with "CPU" or not named "You"
    const isCPU = localPlayerName 
      ? current.name !== localPlayerName  // Multiplayer: only local player is human
      : (current.name.startsWith("CPU") || (current.name !== "You" && current.name !== "You (Host)")); // Local game
    
    if (!isCPU) return;
    
    // Check if game is over for this player
    if (state.finishedOrder.includes(current.id)) return;

    // Add a delay to make CPU play visible
    const timer = setTimeout(() => {
      const cpuPlay = findCPUPlay(current.hand, state.pile, state.tenRule);
      
      if (cpuPlay && cpuPlay.length > 0) {
        // CPU has a valid play
        const cardStr = cpuPlay.map(c => {
          const suit = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠", joker: "★" }[c.suit];
          const val = c.value === 11 ? "J" : c.value === 12 ? "Q" : c.value === 13 ? "K" : c.value === 14 ? "A" : c.value === 15 ? "JOKER" : String(c.value);
          return `${val}${suit}`;
        }).join(", ");
        console.log(`${current.name} playing: ${cardStr}`);
        
        const nextState = playCards(state, current.id, cpuPlay);
        
        // If 10 was played and tenRulePending, CPU randomly chooses direction
        if (nextState.tenRulePending) {
          const direction = Math.random() < 0.5 ? "higher" : "lower";
          console.log(`${current.name} played a 10 and chose: ${direction}`);
          const finalState = setTenRuleDirection(nextState, direction);
          setState(finalState);
        } else {
          setState(nextState);
        }
      } else {
        // CPU must pass (or cannot play)
        if (!state.mustPlay) {
          console.log(`${current.name} passed`);
          const nextState = passTurn(state, current.id);
          setState(nextState);
        } else {
          console.log(`${current.name} cannot play but mustPlay is true - STUCK!`);
        }
      }
    }, 800); // 800ms delay for visibility

    return () => clearTimeout(timer);
  }, [state]);

  if (!state) return null;

  const width = Dimensions.get("window").width;
  const current = state.players[state.currentPlayerIndex];
  
  // Find the human player
  // In multiplayer: use localPlayerName
  // In local/hotseat: use "You" or "You (Host)"
  const humanPlayer = localPlayerName 
    ? state.players.find(p => p.name === localPlayerName)
    : state.players.find(p => p.name === "You" || p.name === "You (Host)");
  const isHumanTurn = humanPlayer && current.id === humanPlayer.id;
  
  // Always show the human player's hand, not the current player's hand
  const hand = humanPlayer ? [...humanPlayer.hand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value)) : [];

  // We'll display the hand as a straight row (no grouped stacks). For selection
  // behavior we still allow selecting all cards of the same rank when tapping a card.

  // compute dynamic heights so stacked duplicates aren't clipped
  const CARD_H = 120;
  const bottomBarMinHeight = Math.max(160, CARD_H + 120);

  // Build game log from current trick and recent trick history
  const gameLog: string[] = [];
  
  // Add completed tricks (last 3)
  if (state.trickHistory && state.trickHistory.length > 0) {
    const recentTricks = state.trickHistory.slice(-3);
    recentTricks.forEach(trick => {
      trick.actions.forEach(action => {
        if (action.type === "play" && action.cards) {
          const cardStr = action.cards.map(c => {
            const suit = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠", joker: "★" }[c.suit];
            const val = c.value === 11 ? "J" : c.value === 12 ? "Q" : c.value === 13 ? "K" : c.value === 14 ? "A" : c.value === 15 ? "JOKER" : String(c.value);
            return `${val}${suit}`;
          }).join(", ");
          gameLog.push(`${action.playerName} played ${cardStr}`);
        } else if (action.type === "pass") {
          gameLog.push(`${action.playerName} passed`);
        }
      });
      if (trick.winnerName) {
        gameLog.push(`→ ${trick.winnerName} won the trick`);
      }
    });
  }
  
  // Add current trick actions
  if (state.currentTrick && state.currentTrick.actions.length > 0) {
    state.currentTrick.actions.forEach(action => {
      if (action.type === "play" && action.cards) {
        const cardStr = action.cards.map(c => {
          const suit = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠", joker: "★" }[c.suit];
          const val = c.value === 11 ? "J" : c.value === 12 ? "Q" : c.value === 13 ? "K" : c.value === 14 ? "A" : c.value === 15 ? "JOKER" : String(c.value);
          return `${val}${suit}`;
        }).join(", ");
        gameLog.push(`${action.playerName} played ${cardStr}`);
        
        // Check if this play has a 10 rule direction set
        if (action.tenRuleDirection) {
          gameLog.push(`  → Called ${action.tenRuleDirection.toUpperCase()}`);
        }
      } else if (action.type === "pass") {
        gameLog.push(`${action.playerName} passed`);
      }
    });
  }
  
  // Add active 10 rule status
  if (state.tenRule?.active && state.tenRule.direction && !state.tenRulePending) {
    gameLog.push(`[10 Rule: ${state.tenRule.direction.toUpperCase()} active]`);
  }
  
  // Keep only last 8 log entries
  const recentLog = gameLog.slice(-8);


  return (
    <View style={local.container}>
      {/* Debug Viewer */}
      <DebugViewer state={state} />

      {/* 10 Rule Modal */}
      {state.tenRulePending && isHumanTurn && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
        >
          <View style={local.modalOverlay}>
            <View style={local.modalContent}>
              <Text style={local.modalTitle}>You played a 10!</Text>
              <Text style={local.modalText}>Choose direction for next player:</Text>
              <View style={local.modalButtons}>
                <TouchableOpacity
                  style={[local.modalButton, { marginRight: 12 }]}
                  onPress={() => {
                    const newState = setTenRuleDirection(state, "higher");
                    setState(newState);
                  }}
                >
                  <Text style={local.modalButtonText}>⬆️ Higher</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={local.modalButton}
                  onPress={() => {
                    const newState = setTenRuleDirection(state, "lower");
                    setState(newState);
                  }}
                >
                  <Text style={local.modalButtonText}>⬇️ Lower</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Scrollable game content */}
      <ScrollView 
        style={local.scrollableContent} 
        contentContainerStyle={{ paddingBottom: bottomBarMinHeight + 20 }}
      >
        <View style={local.header}>
        <View style={local.navBar}>
          <TouchableOpacity onPress={() => onBack && onBack()} style={local.navBack}>
            <Text style={local.navBackText}>{"← Back"}</Text>
          </TouchableOpacity>
          <Text style={local.navTitle}>Game</Text>
          <View style={{ width: 64 }} />
        </View>
        <Text style={local.gameId}>Game ID: {state.id}</Text>
        <Text style={local.finished}>Finished: {state.finishedOrder.join(",")}</Text>
      </View>

      <View style={local.playersArea}>
        <Text style={local.sectionTitle}>Players</Text>
        {state.players.map((p, idx) => {
          const isCurrent = idx === state.currentPlayerIndex;
          const initials = p.name ? p.name.split(" ").map((s) => s[0]).slice(0,2).join("") : "?";
          return (
            <View key={p.id} style={[local.playerRow, isCurrent ? local.playerRowCurrent : null]}>
              <View style={local.avatar}>
                <Text style={local.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[local.playerName, isCurrent ? local.playerNameCurrent : null]}>{p.name}</Text>
                <Text style={local.playerCount}>{p.hand.length} cards</Text>
              </View>
              {isCurrent && <View style={local.turnBadge}><Text style={local.turnBadgeText}>Turn</Text></View>}
            </View>
          );
        })}
      </View>

      <View style={local.pileArea}>
        <Text style={local.sectionTitle}>Trick (Pile)</Text>
        <View style={local.tableBorder}>
          <View style={{ minHeight: 90, justifyContent: "center", alignItems: "center" }}>
            {(!state.pileHistory || state.pileHistory.length === 0) ? (
              <Text style={{ color: "#ccc" }}>No cards on the table</Text>
            ) : (
              (() => {
                const history = state.pileHistory || [];
                const lastPlays = history.slice(-3); // last up to 3 plays
                const earlier = history.slice(0, Math.max(0, history.length - 3));
                return (
                  <View style={{ width: 220, height: 140, position: "relative" }}>
                    {/* earlier plays collapsed as a face-down stack */}
                    {earlier.length > 0 && (
                      <View style={{ position: "absolute", left: 8, top: 8 }}>
                        <Card card={{ suit: "spades", value: 0 }} selected={false} onPress={() => {}} faceDown />
                        <View style={{ position: "absolute", left: 6, top: 6 }}>
                          <Card card={{ suit: "spades", value: 0 }} selected={false} onPress={() => {}} faceDown />
                        </View>
                        <View style={{ position: "absolute", left: 12, top: 12 }}>
                          <Card card={{ suit: "spades", value: 0 }} selected={false} onPress={() => {}} faceDown />
                        </View>
                      </View>
                    )}

                    {/* render last plays stacked, newest on top and offset to the right */}
                    {lastPlays.map((play, pi) => {
                      const baseLeft = 40 + pi * 24;
                      const baseTop = 12 + (lastPlays.length - pi - 1) * 6;
                      return (
                        <View key={`play-${pi}`} style={{ position: "absolute", left: baseLeft, top: baseTop }}>
                          {play.map((c, ci) => {
                            // Tightly bundle cards of same rank (doubles, triples, quads)
                            // Offset enough to show top-left corner rank/suit
                            const cardOffset = ci * 12; // Horizontal spacing to show corner
                            const verticalOffset = -ci * 4; // Slight vertical offset
                            return (
                              <View key={`${c.suit}-${c.value}-${ci}`} style={{ position: "absolute", left: cardOffset, top: verticalOffset }}>
                                <Card card={c} selected={false} onPress={() => {}} />
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                );
              })()
            )}
          </View>
        </View>
        </View>
      </ScrollView>

      {/* Player hand and actions - sticky at bottom */}
      <View style={[local.bottomBar, { minHeight: bottomBarMinHeight }] }>
        {/* Game Log */}
        {recentLog.length > 0 && (
          <View style={local.gameLogContainer}>
            <Text style={local.gameLogTitle}>Game Log</Text>
            <ScrollView style={local.gameLogScroll} nestedScrollEnabled>
              {recentLog.map((log, idx) => (
                <Text key={idx} style={local.gameLogText}>{log}</Text>
              ))}
            </ScrollView>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 8, alignItems: "flex-end" }}
        >
          {hand.map((card, idx) => {
            const CARD_W = 84;
            const spacing = 12;
            // highlight strongest at index 0, fade to the right
            const highlight = 1 - Math.min(1, idx / Math.max(1, hand.length - 1));
            
            // Check if this card can be part of a valid play - only dim during human's turn
            const isPlayable = !isHumanTurn || canCardBePlayedAtAll(card.value, hand, state.pile, state.tenRule, state.pileHistory);
            
            return (
              <View key={`${card.suit}-${card.value}-${idx}`} style={{ marginRight: idx === hand.length - 1 ? 8 : -56 }}>
                <Card
                  card={card}
                  selected={selected.includes(idx)}
                  highlight={highlight}
                  disabled={!isPlayable}
                  onPress={() => {
                    setFocused(idx);
                    const tappedValue = card.value;
                    const currentSelected = selected.slice();
                    const pileCount = state.pile.length;
                    const sameAll = hand.map((h, i) => (h.value === tappedValue ? i : -1)).filter((x) => x !== -1) as number[];

                    if (pileCount === 0) {
                      // if nothing on table, select all of same rank (original behavior)
                      if (currentSelected.length === 0) {
                        setSelected(sameAll);
                      } else {
                        const selectedRank = hand[currentSelected[0]]?.value;
                        if (selectedRank === tappedValue) {
                          setSelected((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]));
                        } else {
                          setSelected(sameAll);
                        }
                      }
                    } else {
                      // when the pile has N cards, play type is fixed to N; select exactly N of the same rank
                      const take = Math.min(pileCount, sameAll.length);
                      const selection = sameAll.slice(0, take);
                      setSelected(selection);
                    }
                  }}
                />
              </View>
            );
          })}
        </ScrollView>

        {/* Turn indicator */}
        {!isHumanTurn && (
          <View style={local.turnIndicator}>
            <Text style={local.turnIndicatorText}>
              Waiting for {current.name}...
            </Text>
          </View>
        )}

        <View style={local.actions}>
        <TouchableOpacity
          onPress={() => {
            if (!isHumanTurn || !humanPlayer) return; // only human can manually play on their turn
            // play selected cards
            const cards = selected.map((i) => hand[i]);
            const cardStr = cards.map(c => {
              const suit = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠", joker: "★" }[c.suit];
              const val = c.value === 11 ? "J" : c.value === 12 ? "Q" : c.value === 13 ? "K" : c.value === 14 ? "A" : c.value === 15 ? "JOKER" : String(c.value);
              return `${val}${suit}`;
            }).join(", ");
            console.log(`You playing: ${cardStr}`);
            const next = playCards(state, humanPlayer.id, cards);
            setSelected([]);
            setState(next);
          }}
          style={[local.actionButton, !isHumanTurn ? { opacity: 0.4 } : null]}
          disabled={!isHumanTurn}
        >
          <Text style={local.actionText}>Play Selected ({selected.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (state.mustPlay) return; // cannot pass when required to play
            if (!isHumanTurn || !humanPlayer) return; // only human can manually pass on their turn
            console.log(`You passed`);
            const next = passTurn(state, humanPlayer.id);
            setState(next);
          }}
          style={[
            local.actionButton, 
            { marginLeft: 12 }, 
            (state.mustPlay || !isHumanTurn) ? { opacity: 0.4 } : null
          ]}
          disabled={state.mustPlay || !isHumanTurn}
        >
          <Text style={local.actionText}>Pass</Text>
        </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  container: { flex: 1 },
  scrollableContent: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  header: { marginBottom: 6 },
  gameId: { color: "#ddd", fontSize: 10 },
  finished: { color: "#ddd", fontSize: 10 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, marginTop: 30 },
  navBack: { padding: 4 },
  navBackText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  navTitle: { color: "#d4af37", fontWeight: "800", fontSize: 16 },
  pileArea: { marginTop: 6, marginBottom: 8 },
  tableBorder: { borderWidth: 2, borderColor: "rgba(212,175,55,0.18)", borderStyle: "dashed", padding: 8, borderRadius: 8, minHeight: 100, justifyContent: "center" },
  sectionTitle: { color: "#d4af37", fontWeight: "700", marginBottom: 4, fontSize: 12 },
  pileCards: { flexDirection: "row", alignItems: "center" },
  pileCardWrapper: { marginRight: 6 },
  playersArea: { marginVertical: 6 },
  playerRow: { flexDirection: "row", alignItems: "center", padding: 6, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.02)", marginBottom: 3 },
  playerRowCurrent: { backgroundColor: "rgba(212,175,55,0.08)", borderColor: "rgba(212,175,55,0.12)", borderWidth: 1 },
  playerName: { color: "#fff", fontWeight: "600", fontSize: 13 },
  playerNameCurrent: { color: "#ffd" },
  playerCount: { color: "#ccc", fontSize: 11 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  turnBadge: { backgroundColor: "#d4af37", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  turnBadgeText: { color: "#111", fontWeight: "700", fontSize: 11 },
  actions: { flexDirection: "row", marginTop: 12, alignItems: "center" },
  actionButton: { backgroundColor: "#222", padding: 12, borderRadius: 8 },
  actionText: { color: "#fff", fontWeight: "700" },
  bottomBar: { 
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 2, 
    borderTopColor: "rgba(212,175,55,0.4)", 
    paddingTop: 8, 
    paddingBottom: 18,
    paddingHorizontal: 8,
    backgroundColor: "rgba(15, 15, 15, 0.98)",
    zIndex: 50,
    elevation: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "rgba(15, 15, 15, 0.98)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(212, 175, 55, 0.6)",
    padding: 24,
    minWidth: 280,
    alignItems: "center",
  },
  modalTitle: {
    color: "#d4af37",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  modalText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "center",
  },
  modalButton: {
    backgroundColor: "#d4af37",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "700",
  },
  turnIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(212, 175, 55, 0.15)",
    borderRadius: 6,
    marginTop: 8,
    marginHorizontal: 8,
    alignItems: "center",
  },
  turnIndicatorText: {
    color: "#d4af37",
    fontSize: 14,
    fontWeight: "600",
    fontStyle: "italic",
  },
  gameLogContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.3)",
  },
  gameLogTitle: {
    color: "#d4af37",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  gameLogScroll: {
    maxHeight: 100,
  },
  gameLogText: {
    color: "#f0f0f0",
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 18,
  },
});
