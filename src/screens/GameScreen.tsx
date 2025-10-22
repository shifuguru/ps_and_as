import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { createGame, GameState, playCards, passTurn, findValidSingleCard, rankIndex } from "../game/core";
import Card from "../components/Card";
import { ScrollView, Dimensions } from "react-native";
import { MockAdapter } from "../game/network";

export default function GameScreen({ initialPlayers, onBack }: { initialPlayers?: string[]; onBack?: () => void } = {}) {
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<number[]>([]); // indices in hand
  const [focused, setFocused] = useState<number | null>(null);
  const adapter = new MockAdapter();

  useEffect(() => {
  const names = initialPlayers && initialPlayers.length >= 2 ? initialPlayers : ["Alice", "Bob", "Charlie", "Dana"];
  const g = createGame(names);
    setState(g);
    adapter.connect();
    adapter.on("message", (ev) => {
      if (ev.type === "state") setState(ev.state);
    });

    return () => {
      adapter.disconnect();
    };
  }, []);

  if (!state) return null;

  const width = Dimensions.get("window").width;
  const current = state.players[state.currentPlayerIndex];
  // show player's hand sorted by game rank order (ascending)
  const hand = [...current.hand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value));

  // We'll display the hand as a straight row (no grouped stacks). For selection
  // behavior we still allow selecting all cards of the same rank when tapping a card.

  // compute dynamic heights so stacked duplicates aren't clipped
  const CARD_H = 120;
  const bottomBarMinHeight = Math.max(160, CARD_H + 120);


  return (
    <View style={local.container}>
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
              <View style={{ flex: 1, marginLeft: 12 }}>
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
          <View style={{ minHeight: 120, justifyContent: "center", alignItems: "center" }}>
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
                          {play.map((c, ci) => (
                            <View key={`${c.suit}-${c.value}-${ci}`} style={{ position: "absolute", left: ci * 18, top: -ci * 6 }}>
                              <Card card={c} selected={false} onPress={() => {}} />
                            </View>
                          ))}
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

      {/* Player hand and actions live at the bottom */}
      <View style={{ flex: 1 }} />
      <View style={[local.bottomBar, { minHeight: bottomBarMinHeight }] }>
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
            return (
              <View key={`${card.suit}-${card.value}-${idx}`} style={{ marginRight: idx === hand.length - 1 ? 8 : -56 }}>
                <Card
                  card={card}
                  selected={selected.includes(idx)}
                  highlight={highlight}
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

        <View style={local.actions}>
        <TouchableOpacity
          onPress={() => {
            // play selected cards
            const cards = selected.map((i) => hand[i]);
            const next = playCards(state, current.id, cards);
            setSelected([]);
            setState(next);
          }}
          style={local.actionButton}
        >
          <Text style={local.actionText}>Play Selected ({selected.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (state.mustPlay) return; // cannot pass when required to play
            const current = state.players[state.currentPlayerIndex];
            const next = passTurn(state, current.id);
            setState(next);
          }}
          style={[local.actionButton, { marginLeft: 12 }, state.mustPlay ? { opacity: 0.4 } : null]}
        >
          <Text style={local.actionText}>Pass</Text>
        </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  header: { marginBottom: 8 },
  gameId: { color: "#ddd", fontSize: 12 },
  finished: { color: "#ddd", fontSize: 12 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 40 },
  navBack: { padding: 6 },
  navBackText: { color: "#fff", fontWeight: "700" },
  navTitle: { color: "#d4af37", fontWeight: "800", fontSize: 18 },
  pileArea: { marginTop: 8, marginBottom: 12 },
  tableBorder: { borderWidth: 2, borderColor: "rgba(212,175,55,0.18)", borderStyle: "dashed", padding: 12, borderRadius: 8, minHeight: 140, justifyContent: "center" },
  sectionTitle: { color: "#d4af37", fontWeight: "700", marginBottom: 6 },
  pileCards: { flexDirection: "row", alignItems: "center" },
  pileCardWrapper: { marginRight: 6 },
  playersArea: { marginVertical: 12 },
  playerRow: { flexDirection: "row", alignItems: "center", padding: 8, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.02)", marginBottom: 6 },
  playerRowCurrent: { backgroundColor: "rgba(212,175,55,0.08)", borderColor: "rgba(212,175,55,0.12)", borderWidth: 1 },
  playerName: { color: "#fff", fontWeight: "600" },
  playerNameCurrent: { color: "#ffd" },
  playerCount: { color: "#ccc", fontSize: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700" },
  turnBadge: { backgroundColor: "#d4af37", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  turnBadgeText: { color: "#111", fontWeight: "700" },
  actions: { flexDirection: "row", marginTop: 12, alignItems: "center" },
  actionButton: { backgroundColor: "#222", padding: 12, borderRadius: 8 },
  actionText: { color: "#fff", fontWeight: "700" },
  bottomBar: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.04)", paddingTop: 8, paddingBottom: 18, backgroundColor: "transparent" },
});
