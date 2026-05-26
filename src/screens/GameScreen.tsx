import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import {
  createGame,
  createGameFromLobby,
  GameState,
  playCards,
  passTurn,
  findValidSingleCard,
  rankIndex,
  findCPUPlay,
  setTenRuleDirection,
  isValidPlay,
  RANK_ORDER,
  isRun,
  hasPassedInCurrentTrick,
  effectivePile,
  consecutiveSequenceInfo,
  runFromCurrentTrick,
  runFromCurrentTrickInfo,
  isRunContextSequence,
  nextActivePlayerIndex,
  cardsNeededToPlay,
  TrickHistory,
} from "../game/core";
import { createDeck, shuffleDeck, dealCards } from "../game/ruleset";
import Card from "../components/Card";
import { ScrollView } from "react-native";
import { MockAdapter, type NetworkAdapter } from "../game/network";
import { isSocketAdapter, SocketAdapter } from "../game/socketAdapter";
import type { LobbyMember } from "../game/network";
import {
  isFullGameState,
  normalizeLobbyNames,
  resolveLocalHumanPlayer,
} from "../utils/localPlayer";
import { recordRoundResult } from "../services/playerStats";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import DebugViewer from "../components/DebugViewer";
import { Card as CardType } from "../game/ruleset";
import Header from "../components/Header";
import ScreenContainer from "../components/ScreenContainer";
import EndGamePanel from "../components/EndGamePanel";
import BottomBar, {
  BottomBarControls,
  BottomBarHand,
  localSeatBottomOffset,
  reservedBottomHeight,
} from "../components/BottomBar";
import PlayerHand, {
  HAND_FAN_HEIGHT,
  type PlayerHandHandle,
} from "../components/PlayerHand";
import ActionBar from "../components/ActionBar";
import RoundCompleteModal from "../components/RoundCompleteModal";
import TenRuleModal from "../components/TenRuleModal";
import GameTable from "../components/GameTable";
import GamePlayArea from "../components/GamePlayArea";
import OpponentSeat from "../components/OpponentSeat";
import { LOCAL_SEAT_BAND } from "../utils/tableLayout";
import {
  buildTrickPlayDisplays,
  buildPlaysFromTrick,
  passedIdsFromTrick,
  lastPlayPlayerId,
  type TrickPlayDisplay,
} from "../utils/trickDisplay";
import { styles } from "../styles/theme";
import { responsive, isLandscape, adaptiveScale } from "../utils/responsive";

// Helper: pick `take` same-rank indices including the card the player tapped
function selectSameRankNearTap(
  sameAll: number[],
  take: number,
  tapIndex: number,
): number[] {
  if (sameAll.length <= take) return sameAll;
  const pos = sameAll.indexOf(tapIndex);
  if (pos < 0) return sameAll.slice(0, take);
  let start = Math.max(0, pos - take + 1);
  if (start + take > sameAll.length) start = sameAll.length - take;
  return sameAll.slice(start, start + take);
}

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
  finishedOrder?: string[],
): boolean {
  const pileCount = pile.length;

  // Single joker beats a non-empty pile (one joker only — never match pile count)
  if (cardValue === 15) {
    const jokers = hand.filter((c) => c.value === 15);
    if (jokers.length === 0) return false;
    if (
      pileCount === 0 &&
      (!trickHistory || trickHistory.length === 0) &&
      (!currentTrick ||
        (currentTrick.actions && currentTrick.actions.length === 0)) &&
      (!pileHistory || pileHistory.length === 0)
    ) {
      return false;
    }
    if (pileCount === 0) {
      return isValidPlay(
        [jokers[0]],
        pile,
        tenRule,
        pileHistory,
        trickHistory,
        fourOfAKindChallenge,
        currentTrick,
        players,
        finishedOrder,
      );
    }
    return isValidPlay(
      [jokers[0]],
      pile,
      tenRule,
      pileHistory,
      trickHistory,
      fourOfAKindChallenge,
      currentTrick,
      players,
      finishedOrder,
    );
  }

  // Find all cards with this value
  const sameValue = hand.filter((c) => c.value === cardValue);
  if (sameValue.length === 0) return false;

  // If pile is empty, check for first play constraint
  if (pileCount === 0) {
    // The game's first-play rule applies only when there are no completed tricks
    // and the current trick has no actions recorded.
    if (
      (!trickHistory || trickHistory.length === 0) &&
      (!currentTrick ||
        (currentTrick.actions && currentTrick.actions.length === 0)) &&
      (!pileHistory || pileHistory.length === 0)
    ) {
      if (cardValue === 3) {
        // Check if we have 3 of clubs
        const hasThreeOfClubs = hand.some(
          (c) => c.value === 3 && c.suit === "clubs",
        );
        return hasThreeOfClubs;
      }
      return false; // First play must be 3s
    }
    // Not first play, any card is valid
    return true;
  }

  // Check if pile is in a run (or a 2-card sequence being extended)
  const trickRunInfo = runFromCurrentTrickInfo(currentTrick, players, finishedOrder || []);
  const seqInfo = consecutiveSequenceInfo(
    pile,
    pileHistory,
    currentTrick,
    players,
    finishedOrder || [],
  );
  let runMultiplicity = 1;
  if (trickRunInfo?.repCards && trickRunInfo.repCards.length >= 3) {
    runMultiplicity = trickRunInfo.multiplicity || 1;
  }
  const runSeq =
    seqInfo.repCards.length >= (trickRunInfo?.repCards?.length || 0)
      ? seqInfo.repCards
      : trickRunInfo?.repCards || [];
  if (runSeq.length >= 2) {
    runMultiplicity =
      seqInfo.repCards.length >= (trickRunInfo?.repCards?.length || 0)
        ? seqInfo.multiplicity
        : trickRunInfo?.multiplicity || 1;
  }
  const inRunContext = runSeq.length >= 2 && isRunContextSequence(runSeq);

  if (inRunContext && runMultiplicity === 1) {
    const lastRank = rankIndex(runSeq[runSeq.length - 1].value);
    if (Math.abs(rankIndex(cardValue) - lastRank) === 1) {
      const card = sameValue[0];
      return isValidPlay(
        [card],
        pile,
        tenRule,
        pileHistory,
        trickHistory,
        fourOfAKindChallenge,
        currentTrick,
        players,
        finishedOrder,
      );
    }
  }

  if (inRunContext && runMultiplicity > 1 && runSeq.length >= 3) {
    const requiredLength = runSeq.length;
    const multiplicity = runMultiplicity || 1;

    // Try to form runs that include this card value with required multiplicity
    for (let startOffset = 0; startOffset < requiredLength; startOffset++) {
      const targetStartRank = rankIndex(cardValue) - startOffset;
      if (targetStartRank < 0) continue;

      const runCards: CardType[] = [];
      let ok = true;
      for (let i = 0; i < requiredLength; i++) {
        const neededRankIdx = targetStartRank + i;
        if (neededRankIdx >= RANK_ORDER.length) { ok = false; break; }
        const neededValue = RANK_ORDER[neededRankIdx];
        const cardsOfValue = hand.filter((c) => c.value === neededValue);
        if (cardsOfValue.length < multiplicity) { ok = false; break; }
        // take multiplicity cards of this rank
        runCards.push(...cardsOfValue.slice(0, multiplicity));
      }
      if (!ok) continue;
      // Validate run structure and engine acceptance
      if (isRun(runCards)) {
        if (
          isValidPlay(
            runCards,
            pile,
            tenRule,
            pileHistory,
            trickHistory,
            fourOfAKindChallenge,
            currentTrick,
            players,
            finishedOrder,
          )
        ) return true;
      }
    }
    return false;
  }

  // Regular play: match pile count, or fewer when completing a quad across turns
  const requiredCount = cardsNeededToPlay(pile, cardValue);
  if (sameValue.length < requiredCount) return false;

  const cardsToPlay = sameValue.slice(0, requiredCount);
  return isValidPlay(
    cardsToPlay,
    pile,
    tenRule,
    pileHistory,
    trickHistory,
    fourOfAKindChallenge,
    currentTrick,
    players,
    finishedOrder,
  );
}

type TrickPauseSnapshot = {
  plays: TrickPlayDisplay[];
  passedPlayerIds: string[];
  winnerName: string;
};

export default function GameScreen({
  initialPlayers,
  initialLobbyPlayers,
  localPlayerName,
  localPlayerId,
  adapter: networkAdapter,
  roomId,
  onBack,
}: {
  initialPlayers?: string[];
  initialLobbyPlayers?: LobbyMember[];
  localPlayerName?: string;
  localPlayerId?: string;
  adapter?: NetworkAdapter | MockAdapter | SocketAdapter;
  roomId?: string;
  onBack?: () => void;
} = {}) {
  const [state, setState] = useState<GameState | null>(null);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);
  const [showGameLog, setShowGameLog] = useState<boolean>(false);
  const [selected, setSelected] = useState<number[]>([]); // indices in hand
  const [focused, setFocused] = useState<number | null>(null);
  const handRef = useRef<PlayerHandHandle>(null);
  const [revealedHands, setRevealedHands] = useState<{
    [playerId: string]: boolean;
  }>({});
  const fallbackAdapterRef = useRef<MockAdapter | null>(null);
  if (!networkAdapter && !fallbackAdapterRef.current) {
    fallbackAdapterRef.current = new MockAdapter();
  }
  const adapter = networkAdapter ?? fallbackAdapterRef.current!;
  const onlineMultiplayer = isSocketAdapter(networkAdapter) && !!roomId;

  function broadcastGameAction(action: Record<string, unknown>) {
    if (!onlineMultiplayer || !isSocketAdapter(networkAdapter) || !roomId) return;
    networkAdapter.sendGameAction(roomId, action);
  }

  // UX pacing: centralized CPU turn delay for a more relaxed feel
  const CPU_DELAY_MS = 1100;
  const TRICK_PASS_HOLD_MS = 900;
  const TRICK_WINNER_SHOW_MS = 800;
  const TRICK_PAUSE_TOTAL_MS = TRICK_PASS_HOLD_MS + TRICK_WINNER_SHOW_MS;

  // End-game state: track round completion and player ready status
  const [roundOver, setRoundOver] = useState(false);
  const [playerReadyStates, setPlayerReadyStates] = useState<{
    [playerId: string]: boolean;
  }>({});
  const [lastTrickWinner, setLastTrickWinner] = useState<string | null>(null);
  const [showWinnerBanner, setShowWinnerBanner] = useState(false);
  const [trickPauseActive, setTrickPauseActive] = useState(false);
  const [trickPauseSnapshot, setTrickPauseSnapshot] =
    useState<TrickPauseSnapshot | null>(null);
  const lastTrickLenRef = React.useRef<number>(0);
  const roundStatsRecordedRef = React.useRef(false);
  const trickPauseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const trickBannerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const insets = useLayoutInsets();

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
      players: s.players.map((p) => ({
        id: p.id,
        name: p.name,
        handCount: p.hand.length,
      })),
    };
  }

  // Detect trick wins (pause briefly) and round completion
  useEffect(() => {
    if (!state) return;
    const len = state.trickHistory ? state.trickHistory.length : 0;
    if (len > (lastTrickLenRef.current || 0)) {
      const last =
        state.trickHistory && state.trickHistory[state.trickHistory.length - 1];
      if (last && last.winnerName) {
        setTrickPauseSnapshot({
          plays: buildPlaysFromTrick(last),
          passedPlayerIds: passedIdsFromTrick(last),
          winnerName: last.winnerName,
        });
        setLastTrickWinner(last.winnerName);
        setShowWinnerBanner(false);
        setTrickPauseActive(true);

        if (trickBannerTimerRef.current) {
          clearTimeout(trickBannerTimerRef.current);
        }
        if (trickPauseTimerRef.current) {
          clearTimeout(trickPauseTimerRef.current);
        }

        trickBannerTimerRef.current = setTimeout(() => {
          setShowWinnerBanner(true);
          trickBannerTimerRef.current = null;
        }, TRICK_PASS_HOLD_MS);

        trickPauseTimerRef.current = setTimeout(() => {
          setShowWinnerBanner(false);
          setTrickPauseActive(false);
          setTrickPauseSnapshot(null);
          setLastTrickWinner(null);
          trickPauseTimerRef.current = null;
        }, TRICK_PAUSE_TOTAL_MS);
      }
      lastTrickLenRef.current = len;
    }
    const allPlayersFinished = state.finishedOrder.length === state.players.length;
    if (allPlayersFinished && !roundOver) {
      setRoundOver(true);
      if (!roundStatsRecordedRef.current) {
        roundStatsRecordedRef.current = true;
        const human = resolveLocalHumanPlayer(
          state.players,
          localPlayerName,
          localPlayerId,
          networkAdapter,
        );
        if (human) {
          const placement = state.finishedOrder.indexOf(human.id);
          if (placement >= 0) {
            void recordRoundResult(placement, state.finishedOrder.length);
          }
        }
      }
      // Auto-ready all CPU players only (not human players)
      const newReady: { [playerId: string]: boolean } = {};
      state.players.forEach((p) => {
        const isLocalHuman =
          (humanPlayer && p.id === humanPlayer.id) ||
          (localPlayerId && p.id === localPlayerId);
        // Only auto-ready CPU players; human players start as not ready
        newReady[p.id] = !isLocalHuman; // CPU players: true, human players: false
      });
      setPlayerReadyStates(newReady);
    }
  }, [state, roundOver, localPlayerId, localPlayerName]);

  useEffect(() => {
    return () => {
      if (trickPauseTimerRef.current) {
        clearTimeout(trickPauseTimerRef.current);
      }
      if (trickBannerTimerRef.current) {
        clearTimeout(trickBannerTimerRef.current);
      }
    };
  }, []);

  // When all players are marked ready, start the next round: redeal, trade, and set starter
  useEffect(() => {
    if (!roundOver) return;
    if (!state) return;
    const readyIds = Object.keys(playerReadyStates);
    if (readyIds.length === 0) return;
    const allReady = state.players.every((p) => !!playerReadyStates[p.id]);
    if (!allReady) return;

    // all ready -> start next round
    startNextRound();
  }, [playerReadyStates, roundOver, state]);

  function startNextRound() {
    if (!state) return;
    // 1) Re-deal the cards to existing players
    const deck = shuffleDeck(createDeck());
    // mutate a shallow copy of players array to avoid surprising refs
    const playersCopy = state.players.map((p) => ({ ...p, hand: [] }));
    dealCards(deck, playersCopy as any);

    // 2) Assign roles according to previous finished order (state.finishedOrder)
    // Default everyone to Neutral first
    playersCopy.forEach((p) => (p.role = "Neutral"));
    const order = state.finishedOrder && state.finishedOrder.length === state.players.length
      ? state.finishedOrder
      : state.players.map((p) => p.id);

    // Helper to set role by player id
    const setRole = (id: string, role: string) => {
      const pl = playersCopy.find((x) => x.id === id);
      if (pl) pl.role = role as any;
    };
    
    // Role assignment based on player count
    if (order.length >= 1) setRole(order[0], "President");
    
    if (order.length >= 5) {
      // For 5+ players: President, Vice President, Neutral(s), Vice Asshole, Asshole
      setRole(order[1], "Vice President");
      setRole(order[order.length - 2], "Vice Asshole");
      setRole(order[order.length - 1], "Asshole");
    } else if (order.length >= 2) {
      // For 2-4 players: President, Neutral(s), Asshole (no Vice roles)
      setRole(order[order.length - 1], "Asshole");
    }

    // 3) Trading stage: losers give highest card(s) to winners
    // Determine trade counts
    const playerCount = playersCopy.length;
    const presTradeCount = playerCount >= 5 ? 2 : 1;
    const viceTradeCount = playerCount >= 5 ? 1 : 0;

    // Helper: get player by role
    const getByRole = (roleName: string) => playersCopy.find((p) => p.role === roleName);

    const president = getByRole("President");
    const vicePres = getByRole("Vice President");
    const asshole = getByRole("Asshole");
    const viceAss = getByRole("Vice Asshole");

    // Utility to pick highest N cards from a hand
    const pickHighest = (hand: any[], n: number) => {
      const sorted = [...hand].sort((a, b) => rankIndex(b.value) - rankIndex(a.value));
      return sorted.slice(0, n);
    };
    // Utility to remove specific cards from a hand (by suit+value)
    const removeCards = (hand: any[], cardsToRemove: any[]) => {
      for (const rc of cardsToRemove) {
        const idx = hand.findIndex((h) => h.suit === rc.suit && h.value === rc.value);
        if (idx >= 0) hand.splice(idx, 1);
      }
    };

    // Map to hold cards moved from loser->winner
    const transferred: { [toId: string]: any[] } = {};

    // Process Asshole <-> President
    if (asshole && president && presTradeCount > 0) {
      const given = pickHighest(asshole.hand, presTradeCount);
      removeCards(asshole.hand, given);
      transferred[president.id] = (transferred[president.id] || []).concat(given);
    }

    // Process Vice pairs if present
    if (viceAss && vicePres && viceTradeCount > 0) {
      const given = pickHighest(viceAss.hand, viceTradeCount);
      removeCards(viceAss.hand, given);
      transferred[vicePres.id] = (transferred[vicePres.id] || []).concat(given);
    }

    // 4) Winners return cards (winners choose any; CPUs return lowest by default)
    const doReturn = (winner: any, loserId: string, count: number) => {
      if (!winner) return;
      // If winner is local human, choose lowest as default (interactive UI TBD)
      const toReturn = [...winner.hand]
        .sort((a, b) => rankIndex(a.value) - rankIndex(b.value))
        .slice(0, count);
      removeCards(winner.hand, toReturn);
      // Add returned cards to loser
      const loser = playersCopy.find((p) => p.id === loserId);
      if (loser) loser.hand = loser.hand.concat(toReturn);
    };

    if (president && asshole && transferred[president.id]) {
      // president received transferred[president.id] from asshole
      president.hand = president.hand.concat(transferred[president.id]);
      // president returns same count to asshole (choose lowest)
      doReturn(president, asshole.id, transferred[president.id].length);
    }
    if (vicePres && viceAss && transferred[vicePres.id]) {
      vicePres.hand = vicePres.hand.concat(transferred[vicePres.id]);
      doReturn(vicePres, viceAss.id, transferred[vicePres.id].length);
    }

    // 5) Finalize state: reset piles/history and set starter as player with 3 of clubs
    const newState: GameState = {
      ...state,
      players: playersCopy,
      pile: [],
      pileHistory: [],
      pileOwners: [],
      tableStacks: [],
      tableStackOwners: [],
      passCount: 0,
      finishedOrder: [],
      started: true,
      lastPlayPlayerIndex: null,
      mustPlay: false,
      trickHistory: [],
      currentTrick: { trickNumber: 1, actions: [] },
      tenRule: { active: false, direction: null },
      tenRulePending: false,
      fourOfAKindChallenge: undefined,
      lastClear: undefined,
    } as GameState;

    // find player index with 3 of clubs
    const starterIdx = newState.players.findIndex((p) => p.hand.some((c) => c.suit === 'clubs' && c.value === 3));
    newState.currentPlayerIndex = starterIdx >= 0 ? starterIdx : 0;
    newState.mustPlay = starterIdx >= 0 ? true : false;

    setState(newState);
    setRoundOver(false);
    roundStatsRecordedRef.current = false;
    setPlayerReadyStates({});
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
      stateSnapshot: snapshotState(state),
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
    const g = initialLobbyPlayers?.length
      ? createGameFromLobby(initialLobbyPlayers)
      : createGame(normalizeLobbyNames(initialPlayers, localPlayerName));
    setState(g);
    void adapter.connect();
    adapter.on("message", (ev) => {
      // structured log for incoming adapter events
      emitDebug("adapter:event", {
        evType: ev.type,
        evStateType: ev.type === "state" ? ev.state?.type : undefined,
        roomId,
        raw: ev,
      });
      // Handle game actions from server (other players' moves)
      if (ev.type === "state" && ev.state && ev.state.type === "gameAction") {
        console.log(
          "[GameScreen] Received game action from",
          ev.state.playerName,
          ":",
          ev.state.action.type,
        );

        if (
          localPlayerId &&
          ev.state.action.playerId === localPlayerId
        ) {
          return;
        }

        // Apply the action to our local game state
        if (ev.state.action.type === "play") {
          setState((currentState) => {
            if (!currentState) return currentState;
            const expectedPlayerId =
              currentState.players[currentState.currentPlayerIndex]?.id;
            // Defensive: if the incoming action's playerId does not match our expected current player,
            // this may be an out-of-order or conflicting message. Prefer syncing to the server-provided
            // full state if present (ev.state.fullState), otherwise ignore the action and log for debugging.
            if (ev.state.fullState) {
              emitDebug("adapter:action:sync", {
                reason:
                  "incoming action contains fullState, applying fullState",
                playerId: ev.state.action.playerId,
                expectedPlayerId,
              });
              return ev.state.fullState;
            }
            if (
              expectedPlayerId &&
              expectedPlayerId !== ev.state.action.playerId
            ) {
              emitDebug("adapter:action:mismatch", {
                reason: "incoming action playerId != local expected turn",
                incomingPlayerId: ev.state.action.playerId,
                expectedPlayerId,
                action: ev.state.action,
              });
              // ignore the action to avoid letting out-of-turn plays slip in; rely on a subsequent authoritative state update
              return currentState;
            }

            const nextState = playCards(
              currentState,
              ev.state.action.playerId,
              ev.state.action.cards,
            );

            // Handle 10 rule direction if needed
            if (ev.state.action.tenRuleDirection && nextState.tenRulePending) {
              return setTenRuleDirection(
                nextState,
                ev.state.action.tenRuleDirection,
              );
            }

            return nextState;
          });
        } else if (ev.state.action.type === "pass") {
          setState((currentState) => {
            if (!currentState) return currentState;
            const next = passTurn(currentState, ev.state.action.playerId);
            emitDebug("action:pass:remote", {
              playerId: ev.state.action.playerId,
              playerName: ev.state.action.playerName,
              before: snapshotState(currentState),
            });
            return next;
          });
        }
      }
      // Legacy support for MockAdapter — only apply full game snapshots.
      else if (ev.type === "state" && isFullGameState(ev.state)) {
        emitDebug("adapter:state", {
          incomingStateSummary: summarizeState(ev.state),
        });
        setState(ev.state);
      }
    });

    return () => {
      if (!networkAdapter) {
        void fallbackAdapterRef.current?.disconnect();
      }
    };
  }, []);

  // Determine which players are controlled locally on this device (hotseat).
  // For mock/local games (MockAdapter or no network adapter provided) we treat
  // any non-CPU-named players as local humans. For multiplayer we only treat
  // the player matching `localPlayerId` or `localPlayerName` as the local human.
  const humanPlayer = state
    ? resolveLocalHumanPlayer(
        state.players,
        localPlayerName,
        localPlayerId,
        networkAdapter,
      )
    : null;

  const localControlledIds = humanPlayer ? [humanPlayer.id] : [];

  // CPU auto-play effect
  useEffect(() => {
    if (!state || trickPauseActive) return;

    const current = state.players[state.currentPlayerIndex];

    // If current player is out or has no cards, skip their turn.
    if (state.finishedOrder.includes(current.id) || current.hand.length === 0) {
      if (state.finishedOrder.length === state.players.length) return;
      const nextState = passTurn(state, current.id);
      if (
        nextState.currentPlayerIndex !== state.currentPlayerIndex ||
        nextState.finishedOrder.length !== state.finishedOrder.length
      ) {
        setState(nextState);
      }
      return;
    }

    // If current player has already passed in this trick, auto-advance to next player
    if (hasPassedInCurrentTrick(state, current.id)) {
      const nextState = passTurn(state, current.id);
      emitDebug("action:pass:auto:already-passed", {
        playerId: current.id,
        playerName: current.name,
        reason: "auto-pass (player already passed earlier in trick)",
        before: snapshotState(state),
      });
      setState(nextState);
      return;
    }

    // Check if current player is a CPU. Only auto-play explicit CPU-named
    // players (e.g. "CPU 1"). Do NOT auto-play remote human players in
    // multiplayer — the server/other clients should drive those turns.
    const isNamedCPU = !!(
      current.name && typeof current.name === "string" && current.name.startsWith("CPU")
    );
    const adapterIsMock = (adapter as any)?.constructor?.name === "MockAdapter";

    // Only treat as CPU when explicitly named as one. Also ensure we never
    // auto-play the local human player even in mock/local games.
    let isCPU = isNamedCPU;
    if (humanPlayer && current.id === humanPlayer.id) {
      isCPU = false;
    }

    if (!isCPU) return;

    // Check if game is over for this player
    if (state.finishedOrder.includes(current.id) || current.hand.length === 0) return;

    // Add a delay to make CPU play visible
    const timer = setTimeout(() => {
      const cpuPlay = findCPUPlay(
        current.hand,
        state.pile,
        state.tenRule,
        state.pileHistory,
        state.fourOfAKindChallenge,
        state.currentTrick,
        state.players,
        state.finishedOrder,
      );
      // append local device id when this is the local player's entry (if provided)
      const devSuffix =
        localPlayerId && localPlayerName && current.name === localPlayerName
          ? ` dev:${localPlayerId}`
          : "";

      if (cpuPlay && cpuPlay.length > 0) {
        // CPU has a valid play
        const cardStr = cpuPlay
          .map((c) => {
            const suit = {
              hearts: "♥",
              diamonds: "♦",
              clubs: "♣",
              spades: "♠",
              joker: "★",
            }[c.suit];
            const val =
              c.value === 11
                ? "J"
                : c.value === 12
                  ? "Q"
                  : c.value === 13
                    ? "K"
                    : c.value === 14
                      ? "A"
                      : c.value === 15
                        ? "JOKER"
                        : String(c.value);
            return `${val}${suit}`;
          })
          .join(", ");
        // append local device id when this is the local player's entry (if provided)
        const devSuffix =
          localPlayerId && localPlayerName && current.name === localPlayerName
            ? ` dev:${localPlayerId}`
            : "";
        console.log(
          `${current.name} (${current.id})${devSuffix} playing: ${cardStr}`,
        );
        emitDebug("action:play:cpu", {
          playerId: current.id,
          playerName: current.name,
          cards: cpuPlay.map((c) => ({ suit: c.suit, value: c.value })),
          before: snapshotState(state),
        });

        // Attempt to apply the play. If playCards returns the same state object,
        // the play was invalid (race or engine mismatch). In that case, fall back
        // to passing so the CPU doesn't deadlock (this can happen when the CPU's
        // selected play looks valid in heuristic but is rejected by engine rules).
        const nextState = playCards(state, current.id, cpuPlay);
        if (nextState === state) {
          console.warn(
            `[GameScreen] CPU ${current.name} suggested play was invalid; falling back to pass`,
          );
          emitDebug("action:play:cpu:invalid", {
            playerId: current.id,
            playerName: current.name,
            attempted: cpuPlay.map((c) => ({ suit: c.suit, value: c.value })),
            before: snapshotState(state),
          });
          const passed = passTurn(state, current.id);
          setState(passed);
          return;
        }

        // If 10 was played and tenRulePending, CPU randomly chooses direction
        if (nextState.tenRulePending) {
          const direction = Math.random() < 0.5 ? "higher" : "lower";
          console.log(
            `${current.name} (${current.id})${devSuffix} played a 10 and chose: ${direction}`,
          );
          const finalState = setTenRuleDirection(nextState, direction);
          emitDebug("action:10:cpu:choose", {
            playerId: current.id,
            playerName: current.name,
            direction,
            before: snapshotState(state),
          });
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
          console.log(
            `${current.name} (${current.id}) - no valid play, attempting to pass; reason:`,
            reasonDetails,
          );
          emitDebug("action:pass:cpu:reason", {
            playerId: current.id,
            playerName: current.name,
            reasonDetails,
            before: snapshotState(state),
          });
        } catch (e) {
          console.log(
            `${current.name} (${current.id}) - no valid play (debug gather failed)`,
          );
        }
        const nextState = passTurn(state, current.id);
        setState(nextState);
      }
    }, CPU_DELAY_MS); // Adjustable CPU delay for visibility

    return () => clearTimeout(timer);
  }, [state, trickPauseActive]);

  if (!state) return null;

  // const windowDimensions = useWindowDimensions();
  // const width = windowDimensions.width;
  // const height = windowDimensions.height;
  // const landscape = isLandscape(width, height);
  
  const current = state.players[state.currentPlayerIndex];

  const currentIsLocalHuman = localControlledIds.includes(current.id);
  const currentIsOut =
    state.finishedOrder.includes(current.id) || current.hand.length === 0;
  const isTenRuleChoice =
    currentIsLocalHuman && !!state.tenRulePending && !trickPauseActive;
  const isHumanTurn =
    currentIsLocalHuman && !trickPauseActive && !currentIsOut && !state.tenRulePending;

  let hand = [] as CardType[];
  if (currentIsLocalHuman) {
    hand = [...current.hand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value));
  } else {
    const fallbackPlayer =
      (localPlayerId && state.players.find((p) => p.id === localPlayerId)) ||
      (localPlayerName && state.players.find((p) => p.name === localPlayerName)) ||
      state.players.find((p) => p.name === "You" || p.name === "You (Host)");
    if (fallbackPlayer) {
      hand = [...fallbackPlayer.hand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value));
    }
  }

  const selectedCards = selected.map((index) => hand[index]).filter(Boolean);
  const selectedCanPlay =
    selectedCards.length > 0 &&
    isValidPlay(
      selectedCards,
      state.pile,
      state.tenRule,
      state.pileHistory,
      state.trickHistory,
      state.fourOfAKindChallenge,
      state.currentTrick,
      state.players,
      state.finishedOrder,
    );

  const playableIndices = hand.map((card) =>
    canCardBePlayedAtAll(
      card.value,
      hand,
      state.pile,
      state.tenRule,
      state.pileHistory,
      state.trickHistory,
      state.currentTrick,
      state.fourOfAKindChallenge,
      state.players,
      state.finishedOrder,
    ),
  );

  const hasAnyValidPlay = playableIndices.some(Boolean);
  const noValidPlays =
    isHumanTurn &&
    !roundOver &&
    !hasAnyValidPlay &&
    !hasPassedInCurrentTrick(state, current.id);

  const isOpeningLead =
    state.pile.length === 0 &&
    (!state.pileHistory || state.pileHistory.length === 0) &&
    (!state.trickHistory || state.trickHistory.length === 0) &&
    (!state.currentTrick || state.currentTrick.actions.length === 0);

  const startingCardIndex =
    isHumanTurn && !roundOver && !!state.mustPlay && isOpeningLead
      ? hand.findIndex((c) => c.suit === "clubs" && c.value === 3)
      : -1;

  const handleCardPress = (idx: number) => {
    if (trickPauseActive || roundOver) return;
    const card = hand[idx];
    const ownerIdForHand = currentIsLocalHuman ? current.id : humanPlayer?.id;
    if (ownerIdForHand && hasPassedInCurrentTrick(state, ownerIdForHand)) {
      emitDebug("ui:select:blocked:passed", { playerId: ownerIdForHand });
      return;
    }
    setFocused(idx);
    const tappedValue = card.value;
    const currentSelected = selected.slice();
    const pileCount = state.pile.length;
    const sameAll = hand
      .map((h, i) => (h.value === tappedValue ? i : -1))
      .filter((x) => x !== -1) as number[];

    if (pileCount === 0) {
      if (currentSelected.length === 0) {
        setSelected(sameAll);
      } else {
        const selectedRank = hand[currentSelected[0]]?.value;
        if (selectedRank === tappedValue) {
          setSelected((s) =>
            s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx],
          );
        } else {
          setSelected(sameAll);
        }
      }
      return;
    }

    // Jokers always beat as a single card — never match doubles/triples/quads count
    if (tappedValue === 15) {
      setSelected((s) => (s.includes(idx) ? [] : [idx]));
      return;
    }

    const take = Math.min(
      cardsNeededToPlay(state.pile, tappedValue),
      sameAll.length,
    );
    const selectedRank =
      currentSelected.length > 0 ? hand[currentSelected[0]]?.value : null;
    if (selectedRank === tappedValue) {
      if (currentSelected.includes(idx)) {
        setSelected((s) => s.filter((x) => x !== idx));
      } else {
        setSelected((s) => [...s, idx]);
      }
    } else {
      setSelected(selectSameRankNearTap(sameAll, take, idx));
    }
  };

  const handlePlayPress = () => {
    if (roundOver || !isHumanTurn || trickPauseActive) return;
    const actor = current;
    if (!actor) return;
    if (hasPassedInCurrentTrick(state, actor.id)) {
      emitDebug("action:play:blocked", { playerId: actor.id, reason: "already passed" });
      return;
    }
    const cards = selected.map((i) => hand[i]);
    emitDebug("action:play:human:attempt", {
      playerId: actor.id,
      playerName: actor.name,
      cards: cards.map((c) => ({ suit: c.suit, value: c.value })),
      before: snapshotState(state),
    });
    const cardStr = cards
      .map((c) => {
        const suit = {
          hearts: "♥",
          diamonds: "♦",
          clubs: "♣",
          spades: "♠",
          joker: "★",
        }[c.suit];
        const val =
          c.value === 11
            ? "J"
            : c.value === 12
              ? "Q"
              : c.value === 13
                ? "K"
                : c.value === 14
                  ? "A"
                  : c.value === 15
                    ? "JOKER"
                    : String(c.value);
        return `${val}${suit}`;
      })
      .join(", ");
    console.log(`You playing: ${cardStr}`);
    const next = playCards(state, actor.id, cards);
    if (next === state) {
      emitDebug("action:play:human:failed", {
        playerId: actor.id,
        playerName: actor.name,
        cards: cards.map((c) => ({ suit: c.suit, value: c.value })),
        reason: "invalid play",
        before: snapshotState(state),
      });
    } else {
      emitDebug("action:play:human:success", {
        playerId: actor.id,
        playerName: actor.name,
        cards: cards.map((c) => ({ suit: c.suit, value: c.value })),
        after: snapshotState(next),
      });
      setSelected([]);
      setState(next);
      broadcastGameAction({
        type: "play",
        playerId: actor.id,
        playerName: actor.name,
        cards: cards.map((c) => ({ suit: c.suit, value: c.value })),
      });
    }
  };

  const handlePassPress = () => {
    if (roundOver || !isHumanTurn || trickPauseActive) return;
    const actor = current;
    if (!actor) return;
    if (hasPassedInCurrentTrick(state, actor.id)) {
      emitDebug("action:pass:blocked", { playerId: actor.id, reason: "already passed" });
      return;
    }
    console.log(`You passed`);
    emitDebug("action:pass:human:attempt", {
      playerId: actor.id,
      playerName: actor.name,
      before: snapshotState(state),
    });
    const next = passTurn(state, actor.id);
    if (next === state) {
      emitDebug("action:pass:human:failed", {
        playerId: actor.id,
        playerName: actor.name,
        reason: "cannot pass (mustPlay or invalid)",
        before: snapshotState(state),
      });
    } else {
      emitDebug("action:pass:human:success", {
        playerId: actor.id,
        playerName: actor.name,
        after: snapshotState(next),
      });
      setState(next);
      broadcastGameAction({
        type: "pass",
        playerId: actor.id,
        playerName: actor.name,
      });
    }
  };

  const handVisible = hand.length > 0;
  const bottomBarHeight = reservedBottomHeight(insets.bottom || 0, handVisible);
  const localSeatBottom = localSeatBottomOffset(insets.bottom || 0, handVisible);
  const contentTopPadding = insets.top + 8;
  const trickPlays = buildTrickPlayDisplays(state);
  const activeLastPlayId = lastPlayPlayerId(state);

  const displayPlays: TrickPlayDisplay[] =
    trickPauseActive && trickPauseSnapshot
      ? showWinnerBanner
        ? []
        : trickPauseSnapshot.plays
      : trickPlays;

  const opponentPlayers = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    handCount: p.hand.length,
    role: p.role,
  }));

  const passedPlayerIds =
    state.currentTrick?.actions
      ?.filter((a) => a.type === "pass")
      .map((a) => a.playerId) ?? [];

  const displayPassedPlayerIds =
    trickPauseActive && trickPauseSnapshot
      ? trickPauseSnapshot.passedPlayerIds
      : passedPlayerIds;

  const winnerBannerName =
    showWinnerBanner && trickPauseSnapshot?.winnerName
      ? trickPauseSnapshot.winnerName
      : showWinnerBanner && lastTrickWinner
        ? lastTrickWinner
        : null;

  const localSeatPlayer = humanPlayer
    ? {
        id: humanPlayer.id,
        name: humanPlayer.name,
        handCount: humanPlayer.hand.length,
        role: humanPlayer.role,
      }
    : null;

  // Build log entries
  type LogEntry = { text: string; kind: "play" | "pass" | "win" | "info" };
  const fullGameLog: LogEntry[] = [];
  const currentTrickLog: LogEntry[] = [];
  const lastPlayInfo = currentTrickLog.length > 0 ? currentTrickLog[currentTrickLog.length - 1]?.text : null;

  // Helper to format cards
  const formatCards = (cards?: any[]) => {
    if (!cards) return "";
    return cards
      .map((c) => {
        const suit = {
          hearts: "♥",
          diamonds: "♦",
          clubs: "♣",
          spades: "♠",
          joker: "★",
        }[c.suit];
        const val =
          c.value === 11
            ? "J"
            : c.value === 12
              ? "Q"
              : c.value === 13
                ? "K"
                : c.value === 14
                  ? "A"
                  : c.value === 15
                    ? "JOKER"
                    : String(c.value);
        return `${val}${suit}`;
      })
      .join(", ");
  };

  // Add completed tricks (all) — keep full scrollable history (Full Game Log)
  if (state.trickHistory && state.trickHistory.length > 0) {
    state.trickHistory.forEach((trick) => {
      trick.actions.forEach((action) => {
        if (action.type === "play" && action.cards) {
          fullGameLog.push({
            text: `${action.playerName} played ${formatCards(action.cards)}`,
            kind: "play",
          });
        } else if (action.type === "pass") {
          fullGameLog.push({
            text: `${action.playerName} passed`,
            kind: "pass",
          });
        }
      });
      if (trick.winnerName) {
        fullGameLog.push({
          text: `→ ${trick.winnerName} won the trick`,
          kind: "win",
        });
      }
    });
  }

  // Add current trick actions (chronological)
  if (state.currentTrick && state.currentTrick.actions.length > 0) {
    state.currentTrick.actions.forEach((action) => {
      if (action.type === "play" && action.cards) {
        fullGameLog.push({
          text: `${action.playerName} played ${formatCards(action.cards)}`,
          kind: "play",
        });
        currentTrickLog.push({
          text: `${action.playerName} played ${formatCards(action.cards)}`,
          kind: "play",
        });
        if (action.tenRuleDirection) {
          fullGameLog.push({
            text: `  → Called ${action.tenRuleDirection.toUpperCase()}`,
            kind: "info",
          });
          currentTrickLog.push({
            text: `  → Called ${action.tenRuleDirection.toUpperCase()}`,
            kind: "info",
          });
        }
        if (action.fourOfAKind) {
          fullGameLog.push({
            text: `  → Four of a Kind! Pile cleared.`,
            kind: "info",
          });
          currentTrickLog.push({
            text: `  → Four of a Kind! Pile cleared.`,
            kind: "info",
          });
        }
        if (action.jokerPlayed) {
          fullGameLog.push({
            text: `  → JOKER played! Pile cleared.`,
            kind: "info",
          });
          currentTrickLog.push({
            text: `  → JOKER played! Pile cleared.`,
            kind: "info",
          });
        }
        if (action.runActive) {
          fullGameLog.push({
            text: `  → RUN active!`,
            kind: "info",
          });
          currentTrickLog.push({
            text: `  → RUN active!`,
            kind: "info",
          });
        }
      } else if (action.type === "pass") {
        fullGameLog.push({ text: `${action.playerName} passed`, kind: "pass" });
        currentTrickLog.push({
          text: `${action.playerName} passed`,
          kind: "pass",
        });
      }
    });
  }

  // Add active 10 rule status
  if (
    state.tenRule?.active &&
    state.tenRule.direction &&
    !state.tenRulePending
  ) {
    fullGameLog.push({
      text: `[10 Rule: ${state.tenRule.direction.toUpperCase()} active]`,
      kind: "info",
    });
    currentTrickLog.push({
      text: `[10 Rule: ${state.tenRule.direction.toUpperCase()} active]`,
      kind: "info",
    });
  }
  // Derived views
  const recentFullLog = fullGameLog;

  // Compute a short label describing the current play type
  function getPlayTypeLabel(): string | null {
    if (!state) return null;

    // If a 10 was just played and direction is pending
    if (state.tenRulePending) return "10 - Choose!";

    // If a ten-rule is active with a direction
    if (state.tenRule?.active && state.tenRule.direction) {
      const dir =
        state.tenRule.direction === "higher"
          ? "Higher"
          : state.tenRule.direction === "lower"
            ? "Lower"
            : state.tenRule.direction;
      return `10 - ${dir}!`;
    }

    // If pile is empty, nothing to show
    if (!state.pile || state.pile.length === 0) return null;

    // Joker detection: if the pile contains a joker, label as JOKER
    if (state.pile.some((c) => c.value === 15)) return "Joker!";

    // Determine if the active pile is a run. Use the engine helpers so we
    // recognize runs formed across recent single-card plays in the current
    // trick (runFromCurrentTrick) or via pileHistory (effectivePile).
    let eff = effectivePile(state.pile, state.pileHistory);
    const trickRunInfo = runFromCurrentTrickInfo(
      state.currentTrick,
      state.players,
      state.finishedOrder || [],
    );
    // If the trick-level run detector found a run, use its representative cards
    // for display and use the multiplicity it detected.
    let runMultiplicity = 1;
    if (trickRunInfo && trickRunInfo.repCards && trickRunInfo.repCards.length >= 3) {
      eff = trickRunInfo.repCards;
      runMultiplicity = trickRunInfo.multiplicity || 1;
    }
    if (eff && eff.length >= 3 && isRunContextSequence(eff)) {
      // Determine multiplicity m for the run and render as a modifier
      const m = runMultiplicity || (() => {
        const freq: Record<number, number> = {};
        eff.forEach((c) => {
          freq[c.value] = (freq[c.value] || 0) + 1;
        });
        const uniqLen = Object.keys(freq).length;
        return Math.max(1, Math.floor(eff.length / Math.max(1, uniqLen)));
      })();
      const kind =
        m === 1
          ? "Singles"
          : m === 2
            ? "Doubles"
            : m === 3
              ? "Triples"
              : m === 4
                ? "Quads"
                : `${m}x`;
      return `${kind} - Runs!`;
    }

    // Otherwise show by count (non-run)
    const count = state.pile.length;
    if (count === 1) return "Singles";
    if (count === 2) return "Doubles";
    if (count === 3) return "Triples";
    if (count === 4) return "Quads";

    return `${count} Of a Kind`;
  }

  const playTypeLabel = getPlayTypeLabel();

  // Compact structured debug log view (last 20 entries). Produce a concise one-line summary
  const recentStructured = debugLogs.slice(-20).map((d) => {
    const shortTs = d.ts ? d.ts.substr(11, 8) : "";
    const ev = d.event;
    const pid = d.details?.playerId || d.details?.player?.id || "-";
    const succ =
      ev && ev.includes(":success")
        ? "OK"
        : ev && ev.includes(":failed")
          ? "FAIL"
          : "..";
    const pile = d.stateSnapshot?.pileCount ?? "?";
    return `${shortTs} ${ev} ${pid} ${succ} pile=${pile}`;
  });

  // Note: no appear animation here to avoid flashing on re-renders
  return (
    <ScreenContainer ignoreHeaderOffset={true} style={{ flex: 1 }}>
      {/* Toggleable structured debug overlay (doesn't block bottom hand) */}
      {showDebugOverlay && (
        <View style={[local.debugOverlay, { top: contentTopPadding + 4 }]}>
          <View style={local.debugHeader}>
            <Text style={{ color: "#d4af37", fontWeight: "800" }}>
              Full Game Log
            </Text>
            <TouchableOpacity
              onPress={() => setShowDebugOverlay(false)}
              style={{ padding: 6 }}
            >
              <Text style={{ color: "#fff" }}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={local.debugScroll}>
            {recentFullLog && recentFullLog.length > 0 ? (
              recentFullLog
                .slice()
                .reverse()
                .map((log, idx) => {
                  const color =
                    log.kind === "win"
                      ? "#ffd700"
                      : log.kind === "pass"
                        ? "#8B4513"
                        : "#f0f0f0";
                  return (
                    <Text
                      key={idx}
                      style={{
                        color,
                        fontSize: 12,
                        marginBottom: 4,
                        lineHeight: 18,
                      }}
                    >
                      {log.text}
                    </Text>
                  );
                })
            ) : (
              <Text style={{ color: "#aaa", fontSize: 12 }}>
                No log entries yet.
              </Text>
            )}
          </ScrollView>
        </View>
      )}

      <TenRuleModal
        visible={isTenRuleChoice}
        onChoose={(direction) => {
          setState(setTenRuleDirection(state, direction));
        }}
      />

      {/* Game content — pad for bottom hand sheet */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 12,
          paddingTop: contentTopPadding,
          paddingBottom: bottomBarHeight,
        }}
      >
        <GamePlayArea
          players={opponentPlayers}
          localPlayerIds={localControlledIds}
          currentPlayerId={current.id}
          finishedOrder={state.finishedOrder}
          passedPlayerIds={displayPassedPlayerIds}
          lastPlayPlayerId={activeLastPlayId}
          playTypeLabel={
            playTypeLabel && !trickPauseActive ? playTypeLabel : null
          }
        >
          <GameTable
            plays={displayPlays}
            winnerMessage={winnerBannerName}
          />
        </GamePlayArea>
      </View>

      {localSeatPlayer ? (
        <View
          style={[
            local.localSeatOverlay,
            { bottom: localSeatBottom, height: LOCAL_SEAT_BAND },
          ]}
          pointerEvents="box-none"
        >
          <OpponentSeat
            player={localSeatPlayer}
            isActive={
              !state.finishedOrder.includes(localSeatPlayer.id) &&
              localSeatPlayer.id === current.id
            }
            isOut={state.finishedOrder.includes(localSeatPlayer.id)}
            hasPassed={displayPassedPlayerIds.includes(localSeatPlayer.id)}
            isLocal
            isLastPlay={
              !!activeLastPlayId && localSeatPlayer.id === activeLastPlayId
            }
          />
        </View>
      ) : null}

      {/* Player hand + actions — sticky bottom sheet */}
      <BottomBar>
        {handVisible ? (
          <BottomBarHand height={HAND_FAN_HEIGHT}>
            {!isHumanTurn && (
              <View style={local.waitingPill}>
                <Text style={local.waitingPillText}>
                  Waiting for {current.name}…
                </Text>
              </View>
            )}

            <PlayerHand
              ref={handRef}
              cards={hand}
              selectedIndices={selected}
              playableIndices={playableIndices}
              startingCardIndex={startingCardIndex}
              disabled={!isHumanTurn}
              onCardPress={handleCardPress}
            />
          </BottomBarHand>
        ) : null}

        <BottomBarControls>
          {!handVisible && !isHumanTurn ? (
            <View style={[local.waitingPill, local.waitingPillCollapsed]}>
              <Text style={local.waitingPillText}>
                Waiting for {current.name}…
              </Text>
            </View>
          ) : null}
          <ActionBar
            selectedCount={selected.length}
            onPlay={handlePlayPress}
            onPass={handlePassPress}
            onQuit={() => {
              if (onBack) onBack();
            }}
            playDisabled={!isHumanTurn || roundOver || hasPassedInCurrentTrick(state, current.id) || selected.length === 0}
            passDisabled={!isHumanTurn || roundOver}
            isPlayerTurn={isHumanTurn && !roundOver}
            noValidPlays={noValidPlays}
          />
        </BottomBarControls>

        {/* Game Log (toggleable) */}
        {showGameLog && (
          <BottomBarControls>
            <Text style={local.gameLogTitle}>Current Trick Log</Text>
            <ScrollView style={local.gameLogScroll} nestedScrollEnabled>
              {currentTrickLog && currentTrickLog.length > 0 ? (
                currentTrickLog
                  .slice()
                  .reverse()
                  .map((log, idx) => {
                    const color =
                      log.kind === "win"
                        ? "#ffd700"
                        : log.kind === "pass"
                          ? "#8B4513"
                          : "#f0f0f0";
                    return (
                      <Text key={idx} style={[local.gameLogText, { color }]}>
                        {log.text}
                      </Text>
                    );
                  })
              ) : (
                <Text style={[local.gameLogText, { color: "#aaa" }]}>
                  No game log entries yet.
                </Text>
              )}
            </ScrollView>
          </BottomBarControls>
        )}

      </BottomBar>

      <RoundCompleteModal
        visible={roundOver}
        finishedOrder={state.finishedOrder}
        players={state.players}
        readyStates={playerReadyStates}
        localPlayerId={humanPlayer?.id}
        onQuit={() => {
          if (onBack) onBack();
        }}
        onToggleReady={() => {
          const id = humanPlayer?.id;
          if (!id) return;
          setPlayerReadyStates((prev) => ({
            ...prev,
            [id]: !prev[id],
          }));
        }}
      />
      
    </ScreenContainer>
  );
}

const local = StyleSheet.create({
  container: { flex: 1 },
  localSeatOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 55,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  playTypeOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 56,
    alignItems: "center",
  },
  playTypeBadge: {
    backgroundColor: "rgba(212, 175, 55, 0.12)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.35)",
  },
  playTypeBadgeText: {
    color: "#d4af37",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  scrollableContent: { flex: 1, paddingHorizontal: 12, paddingTop: 0 },
  header: { marginBottom: 6 },
  gameId: { color: "#ddd", fontSize: 10 },
  finished: { color: "#ddd", fontSize: 10 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    marginTop: 48,
  },
  navBack: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  navBackText: { color: "#d4af37", fontWeight: "800", fontSize: 14 },
  navTitle: { color: "#d4af37", fontWeight: "800", fontSize: 16 },
  pileArea: { marginTop: 6, marginBottom: 8 },
  tableBorder: {
    borderWidth: 2,
    borderColor: "rgba(212,175,55,0.06)",
    borderStyle: "dashed",
    padding: 8,
    borderRadius: 8,
    minHeight: 100,
    justifyContent: "center",
    alignItems: 'center',
  },
  sectionTitle: {
    color: "#d4af37",
    fontWeight: "700",
    marginBottom: 4,
    fontSize: 12,
  },
  pileCards: { flexDirection: "row", alignItems: "center" },
  pileCardWrapper: { marginRight: 6 },
  playersArea: { marginVertical: 6 },
  playersGrid: { flexDirection: "row", flexWrap: "wrap" },
  playerCell: { width: "50%", paddingHorizontal: 4, marginBottom: 6 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.02)",
    marginBottom: 3,
  },
  playerRowCurrent: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
  },
  playerName: { color: "#fff", fontWeight: "600", fontSize: 13 },
  playerNameCurrent: { color: "#ffd" },
  playerCount: { color: "#ccc", fontSize: 11 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  turnBadge: {
    backgroundColor: "#d4af37",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  turnBadgeText: { color: "#111", fontWeight: "700", fontSize: 11 },
  actions: { flexDirection: "row", marginTop: 12, alignItems: "center" },
  actionButton: {
    backgroundColor: "#222",
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  actionButtonPrimary: { marginRight: 4 },
  actionButtonSecondary: { marginHorizontal: 4 },
  actionButtonTertiary: { marginLeft: 4, backgroundColor: "rgba(212, 175, 55, 0.15)" },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 16 },
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
  waitingPill: {
    position: "absolute",
    top: 4,
    alignSelf: "center",
    zIndex: 2000,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  waitingPillCollapsed: {
    position: "relative",
    top: 0,
    alignSelf: "center",
    marginBottom: 8,
    zIndex: 0,
  },
  waitingPillText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  debugRow: {
    flexDirection: "row",
    marginTop: 6,
    gap: 8,
  },
  debugBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
  },
  debugBtnText: {
    color: "#d4af37",
    fontWeight: "700",
    fontSize: 11,
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
  actionsSecondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  debugOverlay: {
    position: "absolute",
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
    alignItems: "flex-start",
  },
  logToggleButton: {
    backgroundColor: "transparent",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  logToggleText: {
    color: "#d4af37",
    fontWeight: "700",
  },
  smallToggle: {
    backgroundColor: "transparent",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  smallToggleText: {
    color: "#d4af37",
    fontWeight: "700",
    fontSize: 12,
  },
  passedBadge: {
    marginLeft: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  passedBadgeText: {
    color: "#ddd",
    fontSize: 11,
    fontWeight: "700",
  },
  placementBadge: {
    marginLeft: 8,
    backgroundColor: "rgba(212,175,55,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  placementBadgeText: {
    color: "#d4af37",
    fontSize: 11,
    fontWeight: "800",
  },
});
