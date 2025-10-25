import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { createGame, GameState, playCards, passTurn, findValidSingleCard, rankIndex, findCPUPlay, setTenRuleDirection, isValidPlay, RANK_ORDER, isRun, hasPassedInCurrentTrick, effectivePile, runFromCurrentTrick } from "../game/core";
import Card from "../components/Card";
import { ScrollView, Dimensions } from "react-native";
import { MockAdapter } from "../game/network";
import DebugViewer from "../components/DebugViewer";
import { Card as CardType } from "../game/ruleset";

// Helper: check if a card value can be part of any valid play
function canCardBePlayedAtAll(
  cardValue: number,
  hand: CardType[],
  pile: CardType[],
  tenRule?: { active: boolean; direction: "higher" | "lower" | null },
  pileHistory?: CardType[][],
  trickHistory?: any[],
  currentTrick?: any,
  fourOfAKindChallenge?: any,
  players?: any[],
  finishedOrder?: string[]
): boolean {
  const pileCount = pile.length;

  // Single joker can always beat non-empty pile
  if (cardValue === 15) {
    const jokers = hand.filter(c => c.value === 15);
    if (jokers.length >= 1) {
      // Check if single joker is valid
  if (pileCount > 0 && isValidPlay([jokers[0]], pile, tenRule, pileHistory, fourOfAKindChallenge, currentTrick, players, finishedOrder)) return true;
      // If pile is empty and this is the very first play of the game, can't start with joker
      if (pileCount === 0 && (!trickHistory || trickHistory.length === 0) && (!currentTrick || (currentTrick.actions && currentTrick.actions.length === 0)) && (!pileHistory || pileHistory.length === 0)) return false;
      // Otherwise a joker can be played on an empty pile
      if (pileCount === 0) return true;
    }
  }

  // Find all cards with this value
  const sameValue = hand.filter(c => c.value === cardValue);
  if (sameValue.length === 0) return false;

  // If pile is empty, check for first play constraint
  if (pileCount === 0) {
    // The game's first-play rule applies only when there are no completed tricks
    // and the current trick has no actions recorded.
    if ((!trickHistory || trickHistory.length === 0) && (!currentTrick || (currentTrick.actions && currentTrick.actions.length === 0)) && (!pileHistory || pileHistory.length === 0)) {
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
          if (isValidPlay(runCards, pile, tenRule, pileHistory, fourOfAKindChallenge, currentTrick, players, finishedOrder)) return true;
      }
    }
    return false;
  }
  
  // Regular play: check if we can play the required count
  const requiredCount = pileCount;
  if (sameValue.length < requiredCount) return false;
  
  // Check if playing this card (with required count) would be valid
  const cardsToPlay = sameValue.slice(0, requiredCount);
  return isValidPlay(cardsToPlay, pile, tenRule, pileHistory, fourOfAKindChallenge, currentTrick, players, finishedOrder);
}

export default function GameScreen({ 
  initialPlayers, 
  localPlayerName,
  localPlayerId,
  adapter: networkAdapter,
  roomId,
  onBack 
}: { 
  initialPlayers?: string[]; 
  localPlayerName?: string;
  localPlayerId?: string;
  adapter?: any;
  roomId?: string;
  onBack?: () => void;
} = {}) {
  const [state, setState] = useState<GameState | null>(null);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);
  const [showGameLog, setShowGameLog] = useState<boolean>(true);
  const [selected, setSelected] = useState<number[]>([]); // indices in hand
  const [focused, setFocused] = useState<number | null>(null);
  const [revealedHands, setRevealedHands] = useState<{ [playerId: string]: boolean }>({});
  const adapter = networkAdapter || new MockAdapter();

  // Utility: create a compact snapshot of relevant game state for debug logs
  function snapshotState(s: GameState | null) {
    if (!s) return null;
    return {
      id: s.id,
      currentPlayerIndex: s.currentPlayerIndex,
      currentPlayerId: s.players[s.currentPlayerIndex]?.id,
      pileCount: s.pile.length,
      pileTop: s.pile[0]?.value ?? null,
      passCount: s.passCount,
      mustPlay: !!s.mustPlay,
      lastPlayPlayerIndex: s.lastPlayPlayerIndex,
      players: s.players.map(p => ({ id: p.id, name: p.name, handCount: p.hand.length }))
    };
  }

  function summarizeState(s: any) {
    if (!s) return null;
    return {
      id: s.id,
      currentPlayerIndex: s.currentPlayerIndex,
      pileCount: Array.isArray(s.pile) ? s.pile.length : null,
      passCount: s.passCount,
      mustPlay: !!s.mustPlay,
    };
  }

  // Emit a structured debug log: console JSON + keep recent in memory for on-screen view
  function emitDebug(event: string, details: any) {
    const entry = {
      ts: new Date().toISOString(),
      event,
      details,
      stateSnapshot: snapshotState(state)
    };
    try {
      console.log("[GAME_LOG]", JSON.stringify(entry));
    } catch (e) {
      console.log("[GAME_LOG]", entry);
    }
    setDebugLogs((d) => {
      const next = d.concat([entry]);
      // keep last 200 entries to avoid memory blowup
      return next.slice(-200);
    });
  }

  useEffect(() => {
  const names = initialPlayers && initialPlayers.length >= 2 ? initialPlayers : ["Alice", "Bob", "Charlie", "Dana"];
  const g = createGame(names);
    setState(g);
    adapter.connect();
    adapter.on("message", (ev) => {
      // structured log for incoming adapter events
      emitDebug("adapter:event", { evType: ev.type, evStateType: ev.state?.type, roomId, raw: ev });
      // Handle game actions from server (other players' moves)
        if (ev.type === "state" && ev.state && ev.state.type === "gameAction") {
        console.log("[GameScreen] Received game action from", ev.state.playerName, ":", ev.state.action.type);
        
        // Apply the action to our local game state
        if (ev.state.action.type === "play") {
            setState((currentState) => {
              if (!currentState) return currentState;
              const expectedPlayerId = currentState.players[currentState.currentPlayerIndex]?.id;
              // Defensive: if the incoming action's playerId does not match our expected current player,
              // this may be an out-of-order or conflicting message. Prefer syncing to the server-provided
              // full state if present (ev.state.fullState), otherwise ignore the action and log for debugging.
              if (ev.state.fullState) {
                emitDebug('adapter:action:sync', { reason: 'incoming action contains fullState, applying fullState', playerId: ev.state.action.playerId, expectedPlayerId });
                return ev.state.fullState;
              }
              if (expectedPlayerId && expectedPlayerId !== ev.state.action.playerId) {
                emitDebug('adapter:action:mismatch', { reason: 'incoming action playerId != local expected turn', incomingPlayerId: ev.state.action.playerId, expectedPlayerId, action: ev.state.action });
                // ignore the action to avoid letting out-of-turn plays slip in; rely on a subsequent authoritative state update
                return currentState;
              }

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
            const next = passTurn(currentState, ev.state.action.playerId);
            emitDebug("action:pass:remote", { playerId: ev.state.action.playerId, playerName: ev.state.action.playerName, before: snapshotState(currentState) });
            return next;
          });
        }
      }
      // Legacy support for MockAdapter
      else if (ev.type === "state") {
        // Log the incoming state snapshot from the adapter
        emitDebug("adapter:state", { incomingStateSummary: summarizeState(ev.state) });
        setState(ev.state);
      }
    });

    return () => {
      adapter.disconnect();
    };
  }, []);

  // Find the human player. Try device-local id first, but fall back to matching by name
  // because mocked/local games use numeric player ids ("1","2",...) that won't
  // equal device ids. This avoids treating the human as a CPU when the id doesn't match.
  let humanPlayer = null as any;
  if (localPlayerId) {
    humanPlayer = state?.players.find(p => p.id === localPlayerId);
  }
  if (!humanPlayer && localPlayerName && state) {
    humanPlayer = state.players.find(p => p.name === localPlayerName);
  }
  if (!humanPlayer && state) {
    humanPlayer = state.players.find(p => p.name === "You" || p.name === "You (Host)");
  }

  // CPU auto-play effect
  useEffect(() => {
    if (!state) return;

  const current = state.players[state.currentPlayerIndex];
    
    // Check if current player is a CPU
    // In multiplayer: CPU is anyone who's not the local player
    // In local/hotseat: CPU is anyone starting with "CPU" or not named "You"
    // Determine CPU status based on player id when possible (more reliable), fallback to name heuristic
    const isCPU = humanPlayer
      ? current.id !== humanPlayer.id
      : (current.name.startsWith("CPU") || (current.name !== "You" && current.name !== "You (Host)")); // Local game fallback
    
    if (!isCPU) return;
    // If this player already passed earlier in the trick, auto-pass them to keep turns moving
    if (hasPassedInCurrentTrick(state, current.id)) {
      const nextState = passTurn(state, current.id);
      emitDebug("action:pass:auto", { playerId: current.id, playerName: current.name, reason: 'auto-pass (already passed earlier in trick)', before: snapshotState(state) });
      setState(nextState);
      return;
    }
    
    // Check if game is over for this player
    if (state.finishedOrder.includes(current.id)) return;

    // Add a delay to make CPU play visible
      const timer = setTimeout(() => {
    const cpuPlay = findCPUPlay(current.hand, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder);
      // append local device id when this is the local player's entry (if provided)
      const devSuffix = (localPlayerId && localPlayerName && current.name === localPlayerName) ? ` dev:${localPlayerId}` : "";

      if (cpuPlay && cpuPlay.length > 0) {
        // CPU has a valid play
        const cardStr = cpuPlay.map(c => {
          const suit = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠", joker: "★" }[c.suit];
          const val = c.value === 11 ? "J" : c.value === 12 ? "Q" : c.value === 13 ? "K" : c.value === 14 ? "A" : c.value === 15 ? "JOKER" : String(c.value);
          return `${val}${suit}`;
        }).join(", ");
      // append local device id when this is the local player's entry (if provided)
      const devSuffix = (localPlayerId && localPlayerName && current.name === localPlayerName) ? ` dev:${localPlayerId}` : "";
      console.log(`${current.name} (${current.id})${devSuffix} playing: ${cardStr}`);
      emitDebug("action:play:cpu", { playerId: current.id, playerName: current.name, cards: cpuPlay.map(c=>({suit:c.suit,value:c.value})), before: snapshotState(state) });

      // Attempt to apply the play. If playCards returns the same state object,
      // the play was invalid (race or engine mismatch). In that case, fall back
      // to passing so the CPU doesn't deadlock (this can happen when the CPU's
      // selected play looks valid in heuristic but is rejected by engine rules).
      const nextState = playCards(state, current.id, cpuPlay);
      if (nextState === state) {
        console.warn(`[GameScreen] CPU ${current.name} suggested play was invalid; falling back to pass`);
        emitDebug("action:play:cpu:invalid", { playerId: current.id, playerName: current.name, attempted: cpuPlay.map(c=>({suit:c.suit,value:c.value})), before: snapshotState(state) });
        const passed = passTurn(state, current.id);
        setState(passed);
        return;
      }

      // If 10 was played and tenRulePending, CPU randomly chooses direction
      if (nextState.tenRulePending) {
        const direction = Math.random() < 0.5 ? "higher" : "lower";
        console.log(`${current.name} (${current.id})${devSuffix} played a 10 and chose: ${direction}`);
        const finalState = setTenRuleDirection(nextState, direction);
        emitDebug("action:10:cpu:choose", { playerId: current.id, playerName: current.name, direction, before: snapshotState(state) });
        setState(finalState);
      } else {
        setState(nextState);
      }
      } else {
        // CPU must pass (or cannot play). Even if mustPlay is true, passTurn will
        // allow the pass when the player truly has no valid play (prevents deadlock).
        // Detailed debug: why the CPU didn't play
        try {
          const reasonDetails = {
            isCPU: isCPU,
            hasPassedInCurrentTrick: hasPassedInCurrentTrick(state, current.id),
            isFinished: state.finishedOrder.includes(current.id),
            pileCount: state.pile.length,
            pileTop: state.pile[0]?.value ?? null,
            pileHistoryLen: state.pileHistory?.length ?? 0,
            cpuPlayFound: !!cpuPlay,
            handCount: current.hand.length,
            currentPlayerIndex: state.currentPlayerIndex,
          };
          console.log(`${current.name} (${current.id}) - no valid play, attempting to pass; reason:`, reasonDetails);
          emitDebug("action:pass:cpu:reason", { playerId: current.id, playerName: current.name, reasonDetails, before: snapshotState(state) });
        } catch (e) {
          console.log(`${current.name} (${current.id}) - no valid play (debug gather failed)`);
        }
        const nextState = passTurn(state, current.id);
        setState(nextState);
      }
    }, 800); // 800ms delay for visibility

    return () => clearTimeout(timer);
  }, [state]);

  if (!state) return null;

  const width = Dimensions.get("window").width;
  const current = state.players[state.currentPlayerIndex];
  
  
  const isHumanTurn = humanPlayer && current.id === humanPlayer.id;
  
  // Always show the human player's hand, not the current player's hand
  const hand = humanPlayer ? [...humanPlayer.hand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value)) : [];

  // We'll display the hand as a straight row (no grouped stacks). For selection
  // behavior we still allow selecting all cards of the same rank when tapping a card.

  // compute dynamic heights so stacked duplicates aren't clipped
  const CARD_H = 120;
  const bottomBarMinHeight = Math.max(160, CARD_H + 120);

  // Build structured game log entries (now full history, scrollable)
  type LogEntry = { text: string; kind: "play" | "pass" | "win" | "info" };
  const gameLog: LogEntry[] = [];

  // Helper to format cards
  const formatCards = (cards?: any[]) => {
    if (!cards) return "";
    return cards.map(c => {
      const suit = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠", joker: "★" }[c.suit];
      const val = c.value === 11 ? "J" : c.value === 12 ? "Q" : c.value === 13 ? "K" : c.value === 14 ? "A" : c.value === 15 ? "JOKER" : String(c.value);
      return `${val}${suit}`;
    }).join(", ");
  };

  // Add completed tricks (all) — keep full scrollable history
  if (state.trickHistory && state.trickHistory.length > 0) {
    state.trickHistory.forEach(trick => {
      trick.actions.forEach(action => {
        if (action.type === "play" && action.cards) {
          gameLog.push({ text: `${action.playerName} played ${formatCards(action.cards)}`, kind: "play" });
        } else if (action.type === "pass") {
          gameLog.push({ text: `${action.playerName} passed`, kind: "pass" });
        }
      });
      if (trick.winnerName) {
        gameLog.push({ text: `→ ${trick.winnerName} won the trick`, kind: "win" });
      }
    });
  }

  // Add current trick actions (chronological)
  if (state.currentTrick && state.currentTrick.actions.length > 0) {
    state.currentTrick.actions.forEach(action => {
      if (action.type === "play" && action.cards) {
        gameLog.push({ text: `${action.playerName} played ${formatCards(action.cards)}`, kind: "play" });
        if (action.tenRuleDirection) {
          gameLog.push({ text: `  → Called ${action.tenRuleDirection.toUpperCase()}`, kind: "info" });
        }
      } else if (action.type === "pass") {
        gameLog.push({ text: `${action.playerName} passed`, kind: "pass" });
      }
    });
  }

  // Add active 10 rule status
  if (state.tenRule?.active && state.tenRule.direction && !state.tenRulePending) {
    gameLog.push({ text: `[10 Rule: ${state.tenRule.direction.toUpperCase()} active]`, kind: "info" });
  }

  // Show the full log (scrollable)
  const recentLog = gameLog;

  // Compute a short label describing the current play type
  function getPlayTypeLabel(): string | null {
    if (!state) return null;

    // If a 10 was just played and direction is pending
    if (state.tenRulePending) return "10 - CHOOSE!";

    // If a ten-rule is active with a direction
    if (state.tenRule?.active && state.tenRule.direction) {
      return `10 - ${state.tenRule.direction.toUpperCase()}!`;
    }

    // If pile is empty, nothing to show
    if (!state.pile || state.pile.length === 0) return null;

    // Joker detection: if the pile contains a joker, label as JOKER
    if (state.pile.some((c) => c.value === 15)) return "JOKER!";

    // Determine if the active pile is a run. Use the engine helpers so we
    // recognize runs formed across recent single-card plays in the current
    // trick (runFromCurrentTrick) or via pileHistory (effectivePile).
    let eff = effectivePile(state.pile, state.pileHistory);
    const trickRun = runFromCurrentTrick(state.currentTrick, state.players, state.finishedOrder || []);
    if (trickRun && trickRun.length >= 3) eff = trickRun;
    if (eff && eff.length >= 3 && isRun(eff)) {
      try {
        console.log("[GameScreen] Detected RUN from UI helpers", { eff: eff.map(c => ({s: c.suit, v: c.value})), fromTrick: !!(trickRun && trickRun.length >= 3) });
      } catch (e) {}
      return "RUNS!";
    }

    // Otherwise show by count
    const count = state.pile.length;
    if (count === 1) return "SINGLES!";
    if (count === 2) return "DOUBLES!!";
    if (count === 3) return "TRIPLES!!!";
    if (count === 4) return "QUADS!!!!";

    return `${count}-OF-A-KIND!`;
  }

  const playTypeLabel = getPlayTypeLabel();

  // Compact structured debug log view (last 20 entries). Produce a concise one-line summary
  const recentStructured = debugLogs.slice(-20).map((d) => {
    const shortTs = d.ts ? d.ts.substr(11, 8) : "";
    const ev = d.event;
    const pid = d.details?.playerId || d.details?.player?.id || "-";
    const succ = ev && ev.includes(":success") ? "OK" : (ev && ev.includes(":failed") ? "FAIL" : "..");
    const pile = d.stateSnapshot?.pileCount ?? "?";
    return `${shortTs} ${ev} ${pid} ${succ} pile=${pile}`;
  });


  return (
    <View style={local.container}>
      {/* Debug Viewer */}
      <DebugViewer state={state} />

      {/* Toggleable structured debug overlay (doesn't block bottom hand) */}
      {showDebugOverlay && (
        <View style={local.debugOverlay}>
          <View style={local.debugHeader}>
            <Text style={{ color: "#d4af37", fontWeight: "800" }}>Structured Logs</Text>
            <TouchableOpacity onPress={() => setShowDebugOverlay(false)} style={{ padding: 6 }}>
              <Text style={{ color: "#fff" }}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={local.debugScroll}>
            {recentStructured.map((line, i) => (
              <Text key={i} style={{ color: "#eee", fontSize: 11, marginBottom: 4 }}>{line}</Text>
            ))}

            {/* Live state dump for easier reproduction */}
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: '#d4af37', fontWeight: '800', marginBottom: 6 }}>State Debug</Text>
              <ScrollView style={{ maxHeight: 140, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6 }}>
                <Text style={{ color: '#ddd', fontSize: 11 }}>{JSON.stringify({ currentTrick: state.currentTrick, pileHistory: state.pileHistory }, null, 2)}</Text>
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}

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
          <View style={{ width: 40 }} />
        </View>
        <Text style={local.gameId}>Game ID: {state.id}</Text>
        <Text style={local.finished}>Finished: {state.finishedOrder.join(",")}</Text>
      </View>

      <View style={local.playersArea}>
        <Text style={local.sectionTitle}>Players</Text>
        {state.players.map((p, idx) => {
          const isCurrent = idx === state.currentPlayerIndex;
          const hasPassed = !!(state.currentTrick && state.currentTrick.actions && state.currentTrick.actions.some(a => a.type === 'pass' && a.playerId === p.id));
          const roleEmojiMap: { [k: string]: string } = { "President": "👑", "Vice President": "⭐", "Neutral": "", "Vice Asshole": "💩", "Asshole": "💩" };
          const roleEmoji = roleEmojiMap[p.role] || "";
          const initials = p.name ? p.name.split(" ").map((s) => s[0]).slice(0,2).join("") : "?";
          const revealed = !!revealedHands[p.id];
          return (
            <View key={p.id}>
              <TouchableOpacity onPress={() => setRevealedHands(r => ({ ...r, [p.id]: !r[p.id] }))} activeOpacity={0.8}>
                <View style={[local.playerRow, isCurrent ? local.playerRowCurrent : null]}>
                  <View style={local.avatar}>
                    <Text style={local.avatarText}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[local.playerName, isCurrent ? local.playerNameCurrent : null]}>{roleEmoji ? `${roleEmoji} ${p.name}` : p.name}</Text>
                      {hasPassed && (
                        <View style={local.passedBadge}><Text style={local.passedBadgeText}>Passed</Text></View>
                      )}
                    </View>
                    <Text style={local.playerCount}>{p.hand.length} cards</Text>
                  </View>
                  {isCurrent && <View style={local.turnBadge}><Text style={local.turnBadgeText}>Turn</Text></View>}
                </View>
              </TouchableOpacity>

              {revealed && (
                <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                  {[...p.hand].sort((a,b)=>rankIndex(a.value)-rankIndex(b.value)).map((c, ci) => (
                    <View key={`revealed-${p.id}-${ci}`} style={{ marginRight: 6 }}>
                      <Card card={c} selected={false} onPress={() => {}} />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })}
      </View>

      <View style={local.pileArea}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={local.sectionTitle}>Table (Current Pile):</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowDebugOverlay((s) => !s)} style={[local.smallToggle, { marginRight: 8 }]}>
              <Text style={local.smallToggleText}>{showDebugOverlay ? 'Logs ▴' : 'Logs ▾'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowGameLog((s) => !s)} style={local.smallToggle}>
              <Text style={local.smallToggleText}>{showGameLog ? 'Game Log ▴' : 'Game Log ▾'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={local.tableBorder}>
          <View style={{ minHeight: 90, justifyContent: "center", alignItems: "center" }}>
            {(!state.pileHistory || state.pileHistory.length === 0) ? (
              <Text style={{ color: "#ccc" }}>No cards on the table</Text>
            ) : (
              (() => {
                // The engine now moves completed tricks into `tableStacks`.
                // `pileHistory` should represent the current trick (visible plays).
                const history = state.pileHistory || [];
                const owners = state.pileOwners || [];
                const lastPlays = history.slice(-3); // last up to 3 plays (current trick)
                // Older, completed tricks are stored as collapsed stacks in tableStacks
                const tableStacks = state.tableStacks || [];
                const tableStackOwners = state.tableStackOwners || [];
                const earlierStacks = tableStacks.slice(-3); // show up to 3 collapsed stacks
                return (
                  <View style={{ width: 260, height: 160, position: "relative" }}>
                    {/* earlier completed tricks collapsed as face-down stacks */}
                    {earlierStacks.length > 0 && (
                      <View style={{ position: "absolute", left: 8, top: 8, flexDirection: 'row' }}>
                        {earlierStacks.map((stk, si) => (
                          <View key={`stack-${si}`} style={{ marginRight: 8, position: 'relative' }}>
                            <Card card={{ suit: "spades", value: 0 }} selected={false} onPress={() => {}} faceDown />
                            <View style={{ position: "absolute", left: 6, top: 6 }}>
                              <Card card={{ suit: "spades", value: 0 }} selected={false} onPress={() => {}} faceDown />
                            </View>
                            <View style={{ position: "absolute", left: 12, top: 12 }}>
                              <Card card={{ suit: "spades", value: 0 }} selected={false} onPress={() => {}} faceDown />
                            </View>
                            <View style={{ position: 'absolute', left: 6, bottom: -6 }}>
                              <Text style={{ color: '#ddd', fontSize: 11 }}>{stk.length} cards</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* render last plays spaced out; offset each play slightly toward the player who played it */}
                    {lastPlays.map((play, pi) => {
                      // Compute absolute index in history
                      const historyIndex = history.length - lastPlays.length + pi;
                      const ownerId = owners[historyIndex] || null;
                      const ownerIdx = ownerId ? state.players.findIndex(p => p.id === ownerId) : -1;

                      // base offsets
                      const baseLeft = 48 + pi * 34;
                      const baseTop = 16 + (lastPlays.length - pi - 1) * 6;

                      // if we know the owner, nudge the card cluster slightly in the owner's direction
                      let nudgeX = 0;
                      let nudgeY = 0;
                      if (ownerIdx >= 0 && state.players.length > 0) {
                        const angle = (ownerIdx / state.players.length) * Math.PI * 2; // circular layout
                        nudgeX = Math.round(Math.cos(angle) * 10);
                        nudgeY = Math.round(Math.sin(angle) * 6);
                      }

                      return (
                        <View key={`play-${pi}`} style={{ position: "absolute", left: baseLeft + nudgeX, top: baseTop + nudgeY }}>
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
        {playTypeLabel && (
          <View style={local.playTypeBadge}>
            <Text style={local.playTypeText}>{playTypeLabel}</Text>
          </View>
        )}
        </View>
      </ScrollView>

      {/* Player hand and actions - sticky at bottom */}
      <View style={[local.bottomBar, { minHeight: bottomBarMinHeight }] }>
        {/* Game Log (toggleable) */}
        {showGameLog && (
          <View style={local.gameLogContainer}>
            <Text style={local.gameLogTitle}>Game Log</Text>
            <ScrollView style={local.gameLogScroll} nestedScrollEnabled>
              {recentLog && recentLog.length > 0 ? (
                recentLog.slice().reverse().map((log, idx) => {
                  const color = log.kind === 'win' ? '#ffd700' : (log.kind === 'pass' ? '#8B4513' : '#f0f0f0');
                  return (
                    <Text key={idx} style={[local.gameLogText, { color }]}>{log.text}</Text>
                  );
                })
              ) : (
                <Text style={[local.gameLogText, { color: '#aaa' }]}>No game log entries yet.</Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* Logs toggle placed above the Game Log view */}
        {/* moved log toggles to the table header */}

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
            const isPlayable = !isHumanTurn || canCardBePlayedAtAll(
              card.value,
              hand,
              state.pile,
              state.tenRule,
              state.pileHistory,
              state.trickHistory,
              state.currentTrick,
              state.fourOfAKindChallenge,
              state.players,
              state.finishedOrder
            );
            
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
                      // when the pile has N cards, by default select exactly N of the same rank
                      // but allow the user to toggle additional same-rank cards (e.g., close to a quad)
                      const take = Math.min(pileCount, sameAll.length);

                      // if user already has selection of this rank, toggle this index
                      const selectedRank = currentSelected.length > 0 ? hand[currentSelected[0]]?.value : null;
                      if (selectedRank === tappedValue) {
                        // toggle this tapped index in selection
                        if (currentSelected.includes(idx)) {
                          setSelected((s) => s.filter((x) => x !== idx));
                        } else {
                          setSelected((s) => [...s, idx]);
                        }
                      } else {
                        // initial selection for this rank: pick the first `take` indices
                        const selection = sameAll.slice(0, take);
                        setSelected(selection);
                      }
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
            emitDebug("action:play:human:attempt", { playerId: humanPlayer.id, playerName: humanPlayer.name, cards: cards.map(c=>({suit:c.suit,value:c.value})), before: snapshotState(state) });
            const cardStr = cards.map(c => {
              const suit = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠", joker: "★" }[c.suit];
              const val = c.value === 11 ? "J" : c.value === 12 ? "Q" : c.value === 13 ? "K" : c.value === 14 ? "A" : c.value === 15 ? "JOKER" : String(c.value);
              return `${val}${suit}`;
            }).join(", ");
            console.log(`You playing: ${cardStr}`);
            const next = playCards(state, humanPlayer.id, cards);
            // playCards returns the same `state` object when validation fails
            if (next === state) {
              emitDebug("action:play:human:failed", { playerId: humanPlayer.id, playerName: humanPlayer.name, cards: cards.map(c=>({suit:c.suit,value:c.value})), reason: "invalid play", before: snapshotState(state) });
            } else {
              emitDebug("action:play:human:success", { playerId: humanPlayer.id, playerName: humanPlayer.name, cards: cards.map(c=>({suit:c.suit,value:c.value})), after: snapshotState(next) });
              setSelected([]);
              setState(next);
            }
          }}
          style={[local.actionButton, !isHumanTurn ? { opacity: 0.4 } : null]}
          disabled={!isHumanTurn}
        >
          <Text style={local.actionText}>Play Selected ({selected.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            // Let the engine validate passes even when mustPlay is set.
            // The engine will allow the pass when no valid play exists.
            if (!isHumanTurn || !humanPlayer) return; // only human can manually pass on their turn
            console.log(`You passed`);
            emitDebug("action:pass:human:attempt", { playerId: humanPlayer.id, playerName: humanPlayer.name, before: snapshotState(state) });
            const next = passTurn(state, humanPlayer.id);
            if (next === state) {
              emitDebug("action:pass:human:failed", { playerId: humanPlayer.id, playerName: humanPlayer.name, reason: "cannot pass (mustPlay or invalid)", before: snapshotState(state) });
            } else {
              emitDebug("action:pass:human:success", { playerId: humanPlayer.id, playerName: humanPlayer.name, after: snapshotState(next) });
              setState(next);
            }
          }}
          style={[
            local.actionButton,
            { marginLeft: 12 },
            !isHumanTurn ? { opacity: 0.4 } : (state.mustPlay ? { opacity: 0.9 } : null)
          ]}
          disabled={!isHumanTurn}
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
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, marginTop: 48 },
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
    maxHeight: 240,
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
  playTypeBadge: {
    marginTop: 36,
    alignSelf: "center",
    backgroundColor: 'rgba(212,175,55,0.12)',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)'
  },
  playTypeText: {
    color: '#d4af37',
    fontWeight: '800',
    fontSize: 12
  },
  debugOverlay: {
    position: "absolute",
    top: 90,
    right: 12,
    width: 320,
    height: 220,
    backgroundColor: "rgba(12,12,12,0.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    borderRadius: 10,
    padding: 8,
    zIndex: 120,
    elevation: 120,
  },
  debugHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  debugScroll: {
    maxHeight: 180,
  },
  gameLogControls: {
    paddingHorizontal: 8,
    paddingTop: 8,
    alignItems: 'flex-start'
  },
  logToggleButton: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  logToggleText: {
    color: '#d4af37',
    fontWeight: '700'
  },
  smallToggle: {
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  smallToggleText: {
    color: '#d4af37',
    fontWeight: '700',
    fontSize: 12,
  },
  passedBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  passedBadgeText: {
    color: '#ddd',
    fontSize: 11,
    fontWeight: '700'
  },
});
