import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, LayoutChangeEvent } from "react-native";
import {
  createGame,
  createGameFromLobby,
  GameState,
  playCards,
  passTurn,
  findValidSingleCard,
  rankIndex,
  findCPUPlay,
  applyCpuTurn,
  setTenRuleDirection,
  isValidPlay,
  hasPassedInCurrentTrick,
  effectivePile,
  consecutiveSequenceInfo,
  runFromCurrentTrick,
  runFromCurrentTrickInfo,
  resolveRunContext,
  isRunContextSequence,
  nextActivePlayerIndex,
  cardsNeededToPlay,
  TrickHistory,
  isJoker,
  isRoundCompleteForLiving,
  isDeadHandPlayer,
  livingPlayerIds,
  livingFinishedOrder,
  applyDeadHandAfterDeal,
  tenRuleChooserIndex,
  isTrickOpeningLead,
  isRoundOpeningLead,
} from "../game/core";
import {
  assignPlayerRoles,
  applyMandatoryTrades,
  advanceAssholeStreakAfterRound,
  shouldSkipPresidentAssholeTrade,
  allTradesCompleted,
  autoCompleteCpuWinnerTrades,
  applyServerPlayerHands,
  applyServerRolesToPlayers,
  buildFreshRoundState,
  clonePlayersForRound,
  completeWinnerReturn,
  dealFreshHands,
  type ClientPendingTrade,
} from "../game/roundPrep";
import {
  openingLeadCardIndex,
} from "../game/deadHand";
import { DEFAULT_FELT_COLOR, normalizeHexColor } from "../services/wallpaper";
import Card from "../components/Card";
import { ScrollView } from "react-native";
import { MockAdapter, type NetworkAdapter } from "../game/network";
import { isSocketAdapter, SocketAdapter } from "../game/socketAdapter";
import type { LobbyMember } from "../game/network";
import {
  isFullGameState,
  normalizeLobbyNames,
  parseServerGameState,
  resolveLocalHumanPlayer,
} from "../utils/localPlayer";
import {
  recordRoundResult,
  recordTrickWin,
  TRICK_WIN_XP,
  getPlayerStats,
} from "../services/playerStats";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { useGamePreferences } from "../hooks/useGamePreferences";
import DebugViewer from "../components/DebugViewer";
import { Card as CardType, FULL_DECK_SIZE } from "../game/ruleset";
import Header from "../components/Header";
import ScreenContainer from "../components/ScreenContainer";
import EndGamePanel from "../components/EndGamePanel";
import BottomBar, {
  BottomBarControls,
  BottomBarHand,
  BottomBarLeave,
  HAND_ZONE_TOP_CLEARANCE,
  localSeatBottomOffset,
  reservedBottomHeight,
} from "../components/BottomBar";
import PlayerHand, {
  HAND_FAN_HEIGHT,
  type PlayerHandHandle,
} from "../components/PlayerHand";
import ActionBar from "../components/ActionBar";
import MenuIcon from "../components/MenuIcon";
import RoundCompleteModal from "../components/RoundCompleteModal";
import LeaveGameConfirmModal from "../components/LeaveGameConfirmModal";
import TenRuleModal from "../components/TenRuleModal";
import GameTable from "../components/GameTable";
import GamePlayArea from "../components/GamePlayArea";
import DealCeremonyOverlay from "../components/DealCeremonyOverlay";
import RoleTradeModal from "../components/RoleTradeModal";
import RoleTradeStrip from "../components/RoleTradeStrip";
import { computePlayAreaLayout } from "../utils/tableLayout";
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
import { useAppTheme } from "../context/ThemeContext";
import {
  buildTableSeatConfig,
  buildDealerContext,
  resolveDealerId,
  resolveOpeningPlayerIndex,
} from "../utils/tableSeats";
import { useSlowTurnBell } from "../hooks/useSlowTurnBell";
import {
  IOS_BOTTOM_GAP_DEBUG,
  IOS_GAP_DEBUG_COLORS,
  debugBg,
  logIosBottomGapMetrics,
} from "../debug/iosBottomGapDebug";

type GameStateWithDealSeed = GameState & { dealSeed?: number };

/** Unique key per deal within a session (game id is reused across rounds). */
function roundCeremonyKey(state: GameStateWithDealSeed): string {
  const seed = state.dealSeed ?? "none";
  return `${state.id}:${seed}`;
}

/** Mid-game rejoin should apply server state directly — no deal animation. */
function shouldSkipDealCeremony(state: GameState): boolean {
  if ((state.currentTrick?.actions?.length ?? 0) > 0) return true;
  if (state.pile.length > 0) return true;
  if ((state.pileHistory?.length ?? 0) > 0) return true;
  if ((state.trickHistory?.length ?? 0) > 0) return true;
  const livingFinished = state.finishedOrder.filter((id) =>
    state.players.some((p) => p.id === id && !isDeadHandPlayer(p)),
  );
  return livingFinished.length > 0;
}

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
  lastRoundOrder?: string[],
  currentPlayerId?: string,
  runOnTop?: boolean,
): boolean {
  const matchesValid = (cards: CardType[]) =>
    isValidPlay(
      cards,
      pile,
      tenRule,
      pileHistory,
      trickHistory,
      fourOfAKindChallenge,
      currentTrick,
      players,
      finishedOrder,
      lastRoundOrder,
      currentPlayerId,
      runOnTop,
    );

  const pileCount = pile.length;

  // Single joker beats a non-empty pile (one joker only — never match pile count)
  if (cardValue === 16) {
    const jokers = hand.filter((c) => isJoker(c));
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
    return matchesValid([jokers[0]]);
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
        return sameValue.some((card) => matchesValid([card]));
      }
      return false; // First play must be 3s
    }
    // Not first play, any card is valid
    return true;
  }

  // Check if pile is in an active run — extend with the next adjacent rank only.
  const trickRunInfo = runFromCurrentTrickInfo(currentTrick, players, finishedOrder || []);
  const seqInfo = consecutiveSequenceInfo(
    pile,
    pileHistory,
    currentTrick,
    players,
    finishedOrder || [],
  );
  const runSeq =
    seqInfo.repCards.length >= (trickRunInfo?.repCards?.length || 0)
      ? seqInfo.repCards
      : trickRunInfo?.repCards || [];
  const runMultiplicity =
    runSeq.length >= 3
      ? seqInfo.repCards.length >= (trickRunInfo?.repCards?.length || 0)
        ? seqInfo.multiplicity
        : trickRunInfo?.multiplicity || 1
      : trickRunInfo?.multiplicity || 1;
  const inRunContext = isRunContextSequence(runSeq);

  if (inRunContext) {
    const lastRank = rankIndex(runSeq[runSeq.length - 1].value);
    if (Math.abs(rankIndex(cardValue) - lastRank) === 1) {
      if (sameValue.length < runMultiplicity) return false;
      return matchesValid(sameValue.slice(0, runMultiplicity));
    }
    return false;
  }

  // Regular play: match pile count, or fewer when completing a quad across turns
  const requiredCount = cardsNeededToPlay(pile, cardValue);
  if (sameValue.length < requiredCount) return false;

  const cardsToPlay = sameValue.slice(0, requiredCount);
  return matchesValid(cardsToPlay);
}

type AwayPlayer = {
  name: string;
  until: number;
  reason?: string;
};

type TrickPauseSnapshot = {
  plays: TrickPlayDisplay[];
  passedPlayerIds: string[];
  winnerName: string;
  winnerId: string;
};

/** Render-only board — separate component so hook count never changes when state loads. */
const GameScreenRuntimeContext = createContext<Record<string, unknown> | null>(
  null,
);

function GameScreen({
  initialPlayers,
  initialLobbyPlayers,
  dealSeed: seedFromProps,
  localPlayerName,
  localPlayerId,
  adapter: networkAdapter,
  roomId,
  isSpectator = false,
  onBack,
  onNavigateToAchievements,
  onNavigateToSettings,
}: {
  initialPlayers?: string[];
  initialLobbyPlayers?: LobbyMember[];
  dealSeed?: number;
  localPlayerName?: string;
  localPlayerId?: string;
  adapter?: NetworkAdapter | MockAdapter | SocketAdapter;
  roomId?: string;
  isSpectator?: boolean;
  onBack?: () => void;
  onNavigateToAchievements?: () => void;
  onNavigateToSettings?: () => void;
} = {}) {
  const [state, setState] = useState<GameState | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [spectatorMode, setSpectatorMode] = useState(isSpectator);
  const [gameplayLocked, setGameplayLocked] = useState(false);
  const [playAreaSize, setPlayAreaSize] = useState({ width: 0, height: 0 });
  const [livePlayAreaMetrics, setLivePlayAreaMetrics] = useState<{
    layout: ReturnType<typeof computePlayAreaLayout>;
    width: number;
    height: number;
  } | null>(null);
  const [ceremonyPrep, setCeremonyPrep] = useState<{
    baseState: GameState;
    players: GameState["players"];
    trades: ClientPendingTrade[];
    dealSeed?: number;
    finishOrder: string[];
  } | null>(null);
  const { skipDealAnimations } = useGamePreferences();
  const skipDealAnimationsRef = useRef(skipDealAnimations);
  skipDealAnimationsRef.current = skipDealAnimations;
  const [tradePhase, setTradePhase] = useState<{
    baseState: GameState;
    players: GameState["players"];
    trades: ClientPendingTrade[];
  } | null>(null);
  const [activeTrade, setActiveTrade] = useState<ClientPendingTrade | null>(null);
  const [tradeReturnPick, setTradeReturnPick] = useState<CardType[]>([]);
  const [roundOver, setRoundOver] = useState(false);
  const [playerReadyStates, setPlayerReadyStates] = useState<{
    [playerId: string]: boolean;
  }>({});
  const [lastTrickWinner, setLastTrickWinner] = useState<string | null>(null);
  const [showWinnerBanner, setShowWinnerBanner] = useState(false);
  const [stackCollecting, setStackCollecting] = useState(false);
  const [trickPauseActive, setTrickPauseActive] = useState(false);
  const [trickPauseSnapshot, setTrickPauseSnapshot] =
    useState<TrickPauseSnapshot | null>(null);
  const [roomNotice, setRoomNotice] = useState<string | null>(null);
  const [awayPlayers, setAwayPlayers] = useState<Record<string, AwayPlayer>>({});
  const [playerFeltTints, setPlayerFeltTints] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialLobbyPlayers?.forEach((member) => {
      if (!member.feltTint) return;
      if (
        member.id !== localPlayerId &&
        normalizeHexColor(member.feltTint) ===
          normalizeHexColor(DEFAULT_FELT_COLOR)
      ) {
        return;
      }
      map[member.id] = member.feltTint;
    });
    return map;
  });
  /** Trick-win XP earned this game session (persists across rounds). */
  const [gameXpByPlayerId, setGameXpByPlayerId] = useState<Record<string, number>>({});
  const [localCareerXp, setLocalCareerXp] = useState<number | null>(null);
  const [awayTick, setAwayTick] = useState(0);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);
  const [showGameLog, setShowGameLog] = useState<boolean>(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [selected, setSelected] = useState<number[]>([]); // indices in hand
  const [focused, setFocused] = useState<number | null>(null);
  const [revealedHands, setRevealedHands] = useState<{
    [playerId: string]: boolean;
  }>({});
  const awaitingDealCeremonyRef = useRef(false);
  const ceremonyDoneForRoundRef = useRef<string | null>(null);
  const ceremonyStartedForRoundRef = useRef<string | null>(null);
  const ceremonyPrepRef = useRef(ceremonyPrep);
  ceremonyPrepRef.current = ceremonyPrep;
  const tradePhaseRef = useRef(tradePhase);
  tradePhaseRef.current = tradePhase;
  const pendingTradesCompleteRef = useRef<Record<string, CardType[]> | null>(null);
  const pendingDealSeedRef = useRef<number | undefined>(undefined);
  const myPlayerIdRef = useRef<string | null>(null);
  const explicitFeltThemesRef = useRef<Set<string>>(new Set());
  const roomNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handRef = useRef<PlayerHandHandle>(null);
  const fallbackAdapterRef = useRef<MockAdapter | null>(null);
  const lastTrickLenRef = React.useRef<number>(0);
  const lastRecordedTrickXpRef = React.useRef(0);
  const roundStatsRecordedRef = React.useRef(false);
  const trickPauseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const trickBannerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const trickCollectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const stateSyncedRef = useRef(false);
  const syncRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const gameplayLockedRef = useRef(gameplayLocked);
  gameplayLockedRef.current = gameplayLocked;
  const roundOverRef = useRef(roundOver);
  roundOverRef.current = roundOver;
  const trickPauseActiveRef = useRef(trickPauseActive);
  trickPauseActiveRef.current = trickPauseActive;
  const startNextRoundRef = useRef<(seed?: number) => void>(() => {});
  const finalizeCeremonyRoundRef = useRef<
    (
      players: GameState["players"],
      baseState: GameState,
      serverHands?: Record<string, CardType[]> | null,
    ) => void
  >(() => {});

  if (!networkAdapter && !fallbackAdapterRef.current) {
    fallbackAdapterRef.current = new MockAdapter();
  }
  const adapter = networkAdapter ?? fallbackAdapterRef.current!;
  const onlineMultiplayer = isSocketAdapter(networkAdapter) && !!roomId;
  const resolvedHostId =
    (isSocketAdapter(networkAdapter) ? networkAdapter.getHostId() : null) ??
    initialLobbyPlayers?.[0]?.id ??
    null;
  const readOnlyOnline = onlineMultiplayer && spectatorMode;
  const readOnlyGame = gameplayLocked || readOnlyOnline;

  const insets = useLayoutInsets();
  const { colors, feltTint: localFeltTint } = useAppTheme();

  const humanPlayer = state
    ? resolveLocalHumanPlayer(
        state.players,
        localPlayerName,
        localPlayerId,
        networkAdapter,
      )
    : null;
  const myPlayerId =
    humanPlayer?.id ??
    localPlayerId ??
    (isSocketAdapter(networkAdapter) ? networkAdapter.getProfileId() : null);
  myPlayerIdRef.current = myPlayerId;

  const resolveSeatFeltTint = useCallback(
    (player: { id: string; name: string }) => {
      if (myPlayerId && player.id === myPlayerId) return localFeltTint;
      return playerFeltTints[player.id];
    },
    [myPlayerId, localFeltTint, playerFeltTints],
  );

  const awayNotice = useMemo(() => {
    void awayTick;
    const entries = Object.entries(awayPlayers);
    if (entries.length === 0) return null;
    return entries
      .map(([, info]) => {
        const secs = Math.max(0, Math.ceil((info.until - Date.now()) / 1000));
        const verb = info.reason === "left" ? "left" : "disconnected";
        return `${info.name} ${verb} — seat held ${secs}s`;
      })
      .join(" · ");
  }, [awayPlayers, awayTick]);

  const disconnectedPlayerIds = useMemo(
    () => Object.keys(awayPlayers),
    [awayPlayers],
  );

  const scoreboardXpByPlayerId = useMemo(() => {
    const xp = { ...gameXpByPlayerId };
    if (myPlayerId && localCareerXp != null) {
      xp[myPlayerId] = localCareerXp;
    }
    return xp;
  }, [gameXpByPlayerId, myPlayerId, localCareerXp]);

  const turnPlayerId = state?.players[state.currentPlayerIndex]?.id ?? null;
  const turnPlayerName = state?.players[state.currentPlayerIndex]?.name;
  const turnPlayerIsCpu =
    typeof turnPlayerName === "string" && turnPlayerName.startsWith("CPU");
  const bellPaused =
    !state ||
    trickPauseActive ||
    gameplayLocked ||
    roundOver ||
    !!ceremonyPrep ||
    !!tradePhase ||
    !!state?.tenRulePending;

  const { slowTurnActive, canRingBell, registerBellRing } = useSlowTurnBell({
    currentPlayerId: turnPlayerId,
    paused: bellPaused,
    isCpuPlayer: turnPlayerIsCpu,
  });

  const turnBellPlayerId =
    slowTurnActive && turnPlayerId && turnPlayerId !== myPlayerId
      ? turnPlayerId
      : null;

  const requestLeaveGame = useCallback(() => {
    setLeaveConfirmVisible(true);
  }, []);

  const cancelLeaveGame = useCallback(() => {
    setLeaveConfirmVisible(false);
  }, []);

  const confirmLeaveGame = useCallback(() => {
    setLeaveConfirmVisible(false);
    onBack?.();
  }, [onBack]);

  const finalizeCeremonyRound = useCallback(
    (
      players: GameState["players"],
      baseState: GameState,
      serverHands?: Record<string, CardType[]> | null,
    ) => {
      const handsSource =
        serverHands ?? pendingTradesCompleteRef.current ?? null;
      const merged = handsSource
        ? applyServerPlayerHands(players, handsSource)
        : players;
      pendingTradesCompleteRef.current = null;
      const next = buildFreshRoundState(baseState, merged, {
        hostId: resolvedHostId,
        lastRoundOrder: baseState.lastRoundOrder,
        finishedOrder: ceremonyPrepRef.current?.finishOrder,
      });
      setState(next);
      setRoundOver(false);
      roundStatsRecordedRef.current = false;
      setPlayerReadyStates({});
      setCeremonyPrep(null);
      setTradePhase(null);
      setActiveTrade(null);
      setTradeReturnPick([]);
      setGameplayLocked(false);
      ceremonyDoneForRoundRef.current = roundCeremonyKey(next);
    },
    [resolvedHostId],
  );

  const beginTradePhase = useCallback(
    (
      baseState: GameState,
      players: GameState["players"],
      trades: ClientPendingTrade[],
    ) => {
      const playersCopy = clonePlayersForRound(players);
      const tradesCopy = trades.map((t) => ({ ...t, incoming: [...t.incoming] }));

      if (!onlineMultiplayer) {
        autoCompleteCpuWinnerTrades(playersCopy, tradesCopy);
      }

      if (tradesCopy.length === 0 || tradesCopy.every((t) => t.completed)) {
        finalizeCeremonyRound(playersCopy, baseState);
        return;
      }
      setTradePhase({ baseState, players: playersCopy, trades: tradesCopy });
      setCeremonyPrep(null);
      setTradeReturnPick([]);
      const first = tradesCopy.find((t) => !t.completed) ?? null;
      setActiveTrade(first);
    },
    [finalizeCeremonyRound, onlineMultiplayer],
  );

  type CeremonyPrepPayload = {
    baseState: GameState;
    players: GameState["players"];
    trades: ClientPendingTrade[];
    dealSeed?: number;
    finishOrder: string[];
  };

  const launchRoundAfterDeal = useCallback(
    (prep: CeremonyPrepPayload, hiddenState: GameState) => {
      setRoundOver(false);
      setPlayerReadyStates({});
      roundStatsRecordedRef.current = false;
      setGameplayLocked(true);

      if (skipDealAnimationsRef.current) {
        ceremonyPrepRef.current = prep;
        const tradesPending =
          prep.trades.length > 0 && !prep.trades.every((t) => t.completed);
        if (tradesPending) {
          setState(hiddenState);
        }
        beginTradePhase(prep.baseState, prep.players, prep.trades);
        return;
      }

      setCeremonyPrep(prep);
      setState(hiddenState);
    },
    [beginTradePhase],
  );

  const handleDealComplete = useCallback(() => {
    const prep = ceremonyPrepRef.current;
    if (prep) {
      beginTradePhase(prep.baseState, prep.players, prep.trades);
      return;
    }
    const pending = pendingTradesCompleteRef.current;
    const tp = tradePhaseRef.current;
    if (tp && pending) {
      for (const p of tp.players) {
        if (pending[p.id]) p.hand = pending[p.id];
      }
      finalizeCeremonyRound(tp.players, tp.baseState, pending);
      return;
    }
    if (pending && stateRef.current) {
      const players = clonePlayersForRound(stateRef.current.players);
      finalizeCeremonyRound(players, stateRef.current, pending);
    }
  }, [beginTradePhase, finalizeCeremonyRound]);

  const startRoundCeremony = useCallback(
    (baseState: GameState, finishedOrder: string[], nextDealSeed?: number) => {
      const streakAfterRound = advanceAssholeStreakAfterRound(
        {
          consecutiveAssholeId: baseState.consecutiveAssholeId ?? null,
          consecutiveAssholeCount: baseState.consecutiveAssholeCount ?? 0,
          freshRound: !!baseState.freshRound,
        },
        finishedOrder,
        baseState.players,
      );
      const skipPresidentTrade = shouldSkipPresidentAssholeTrade(streakAfterRound);

      let players = clonePlayersForRound(
        baseState.players.map((p) => ({ ...p, hand: [] })),
      );
      let trades: ClientPendingTrade[] = [];
      let openingPlayerIndex = -1;
      let dealerContext = buildDealerContext({
        hostId: resolvedHostId,
        finishOrder: finishedOrder,
        lastRoundOrder: baseState.lastRoundOrder,
        roles: {},
      });

      for (let attempt = 0; attempt < 64 && openingPlayerIndex < 0; attempt++) {
        players = clonePlayersForRound(
          baseState.players.map((p) => ({ ...p, hand: [] })),
        );
        const seed =
          nextDealSeed != null ? ((nextDealSeed + attempt) >>> 0) : undefined;
        dealFreshHands(players, seed);
        trades = [];
        const rolesById: Record<string, string> = {};
        if (finishedOrder.length >= 2) {
          assignPlayerRoles(players, finishedOrder);
          trades = applyMandatoryTrades(players, { skipPresidentTrade });
          for (const p of players) {
            if (!isDeadHandPlayer(p) && p.role !== "Neutral") {
              rolesById[p.id] = p.role;
            }
          }
        }
        dealerContext = buildDealerContext({
          hostId: resolvedHostId,
          finishOrder: finishedOrder,
          lastRoundOrder: baseState.lastRoundOrder,
          roles: rolesById,
        });
        if (players.some(isDeadHandPlayer)) {
          applyDeadHandAfterDeal(
            {
              players,
              finishedOrder: [],
              currentPlayerIndex: 0,
              mustPlay: false,
            },
            dealerContext,
          );
        }
        openingPlayerIndex = resolveOpeningPlayerIndex(players, dealerContext);
      }

      if (openingPlayerIndex < 0) {
        openingPlayerIndex = Math.max(
          0,
          players.findIndex((p) => !isDeadHandPlayer(p)),
        );
      }

      setRoundOver(false);
      setPlayerReadyStates({});
      roundStatsRecordedRef.current = false;
      const prep: CeremonyPrepPayload = {
        baseState: {
          ...baseState,
          consecutiveAssholeId: streakAfterRound.consecutiveAssholeId,
          consecutiveAssholeCount: streakAfterRound.consecutiveAssholeCount,
          freshRound: skipPresidentTrade,
          lastRoundOrder:
            finishedOrder.length >= 2 ? finishedOrder : baseState.lastRoundOrder,
        },
        players,
        trades,
        dealSeed: nextDealSeed,
        finishOrder: finishedOrder,
      };
      const hiddenPlayers = players.map((p) => ({ ...p, hand: [] }));
      const priorRound = finishedOrder.length >= 2;
      launchRoundAfterDeal(
        prep,
        buildFreshRoundState(
          baseState,
          hiddenPlayers,
          dealerContext,
          priorRound ? undefined : openingPlayerIndex,
        ),
      );
    },
    [resolvedHostId, launchRoundAfterDeal],
  );

  const handleTradeConfirm = useCallback(
    (selected: CardType[]) => {
      if (!tradePhase || !activeTrade) return;
      const ok = completeWinnerReturn(tradePhase.players, activeTrade, selected);
      if (!ok) return;
      if (onlineMultiplayer && isSocketAdapter(networkAdapter) && roomId) {
        networkAdapter.submitTradeSelection(roomId, selected);
      }
      const remaining = tradePhase.trades.filter((t) => !t.completed);
      if (remaining.length === 0) {
        if (!onlineMultiplayer) {
          finalizeCeremonyRound(tradePhase.players, tradePhase.baseState);
        }
      } else {
        setActiveTrade(remaining[0]);
      }
    },
    [
      tradePhase,
      activeTrade,
      onlineMultiplayer,
      networkAdapter,
      roomId,
      finalizeCeremonyRound,
    ],
  );

  function startNextRound(nextDealSeed?: number) {
    if (!state) return;
    const finishedOrder = livingFinishedOrder(state.players, state.finishedOrder);
    startRoundCeremony(state, finishedOrder, nextDealSeed);
  }

  startNextRoundRef.current = startNextRound;
  finalizeCeremonyRoundRef.current = finalizeCeremonyRound;

  const bannerNotice = awayNotice ?? roomNotice;

  function showRoomNotice(message: string) {
    setRoomNotice(message);
    if (roomNoticeTimerRef.current) {
      clearTimeout(roomNoticeTimerRef.current);
    }
    roomNoticeTimerRef.current = setTimeout(() => {
      setRoomNotice(null);
      roomNoticeTimerRef.current = null;
    }, 4500);
  }

  function roomEventMessage(
    playerName: string | undefined,
    eventType: string,
    reason?: string,
  ): string | null {
    const name = playerName?.trim();
    if (!name) return null;
    if (eventType === "playerDisconnected") {
      return `${name} disconnected — waiting to reconnect…`;
    }
    if (reason === "kicked") {
      return `${name} was removed from the room`;
    }
    if (eventType === "playerLeft" || reason === "left") {
      return `${name} left the game`;
    }
    if (reason === "disconnected") {
      return `${name} left the room`;
    }
    return `${name} left the room`;
  }

  function broadcastGameAction(action: Record<string, unknown>) {
    if (!onlineMultiplayer || !isSocketAdapter(networkAdapter) || !roomId) return;
    networkAdapter.sendGameAction(roomId, action);
  }

  const handleTurnBellPress = useCallback(
    (targetPlayerId: string) => {
      if (!canRingBell(targetPlayerId, myPlayerId)) return;
      registerBellRing();
      const targetName =
        state?.players.find((p) => p.id === targetPlayerId)?.name ?? "Player";
      showRoomNotice(`🔔 Hurry up, ${targetName}!`);
      broadcastGameAction({
        type: "turnNudge",
        targetPlayerId,
        fromPlayerId: myPlayerId,
      });
    },
    [canRingBell, myPlayerId, registerBellRing, state?.players],
  );

  // UX pacing: centralized CPU turn delay for a more relaxed feel
  const CPU_DELAY_MS = 1100;
  const TRICK_SPREAD_HOLD_MS = 380;
  const TRICK_STACK_COLLECT_MS = 520;
  const TRICK_WINNER_SHOW_MS = 800;
  const TRICK_PAUSE_TOTAL_MS =
    TRICK_SPREAD_HOLD_MS + TRICK_STACK_COLLECT_MS + TRICK_WINNER_SHOW_MS;

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
      return next.slice(-200);
    });
  }

  useEffect(() => {
    setSpectatorMode(isSpectator);
  }, [isSpectator]);

  useEffect(() => {
    if (Object.keys(awayPlayers).length === 0) return;
    const id = setInterval(() => {
      setAwayTick((t) => t + 1);
      setAwayPlayers((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, AwayPlayer> = { ...prev };
        for (const [pid, info] of Object.entries(prev)) {
          if (info.until <= now) {
            delete next[pid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [awayPlayers]);

  // Detect trick wins (pause briefly) and round completion — layout effect
  // commits the snapshot before paint so the table never freezes on stale plays.
  useLayoutEffect(() => {
    if (!state) return;
    const len = state.trickHistory ? state.trickHistory.length : 0;
    if (len <= (lastTrickLenRef.current || 0)) return;

    lastTrickLenRef.current = len;

    const last =
      state.trickHistory && state.trickHistory[state.trickHistory.length - 1];
    if (!last?.winnerName) return;

    setTrickPauseSnapshot({
      plays: buildPlaysFromTrick(last),
      passedPlayerIds: passedIdsFromTrick(last),
      winnerName: last.winnerName,
      winnerId: last.winnerId ?? "",
    });
    setLastTrickWinner(last.winnerName);
    const winnerId =
      last.winnerId ??
      state.players.find((p) => p.name === last.winnerName)?.id;
    if (winnerId) {
      setGameXpByPlayerId((prev) => ({
        ...prev,
        [winnerId]: (prev[winnerId] ?? 0) + TRICK_WIN_XP,
      }));
    }
    setShowWinnerBanner(false);
    setStackCollecting(false);
    setTrickPauseActive(true);
  }, [state]);

  // Trick-end animation timers (collect → banner → resume).
  useEffect(() => {
    if (!trickPauseActive) return;

    if (trickBannerTimerRef.current) {
      clearTimeout(trickBannerTimerRef.current);
    }
    if (trickPauseTimerRef.current) {
      clearTimeout(trickPauseTimerRef.current);
    }
    if (trickCollectTimerRef.current) {
      clearTimeout(trickCollectTimerRef.current);
    }

    trickCollectTimerRef.current = setTimeout(() => {
      setStackCollecting(true);
      trickCollectTimerRef.current = null;
    }, TRICK_SPREAD_HOLD_MS);

    trickBannerTimerRef.current = setTimeout(() => {
      setShowWinnerBanner(true);
      trickBannerTimerRef.current = null;
    }, TRICK_SPREAD_HOLD_MS + TRICK_STACK_COLLECT_MS);

    trickPauseTimerRef.current = setTimeout(() => {
      setShowWinnerBanner(false);
      setStackCollecting(false);
      setTrickPauseActive(false);
      setTrickPauseSnapshot(null);
      setLastTrickWinner(null);
      trickPauseTimerRef.current = null;
    }, TRICK_PAUSE_TOTAL_MS);

    return () => {
      if (trickCollectTimerRef.current) {
        clearTimeout(trickCollectTimerRef.current);
        trickCollectTimerRef.current = null;
      }
      if (trickBannerTimerRef.current) {
        clearTimeout(trickBannerTimerRef.current);
        trickBannerTimerRef.current = null;
      }
      if (trickPauseTimerRef.current) {
        clearTimeout(trickPauseTimerRef.current);
        trickPauseTimerRef.current = null;
      }
    };
  }, [trickPauseActive]);

  useEffect(() => {
    if (!state) return;
    const allPlayersFinished =
      isRoundCompleteForLiving(state) && !state.tenRulePending;
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
            void recordRoundResult(placement, livingPlayerIds(state.players).length);
          }
        }
      }
      const newReady: { [playerId: string]: boolean } = {};
      state.players.filter((p) => !isDeadHandPlayer(p)).forEach((p) => {
        const isLocalHuman =
          (humanPlayer && p.id === humanPlayer.id) ||
          (localPlayerId && p.id === localPlayerId);
        newReady[p.id] = !isLocalHuman;
      });
      setPlayerReadyStates(newReady);
    }
  }, [state, roundOver, localPlayerId, localPlayerName, humanPlayer]);

  useEffect(() => {
    return () => {
      if (trickPauseTimerRef.current) {
        clearTimeout(trickPauseTimerRef.current);
      }
      if (trickBannerTimerRef.current) {
        clearTimeout(trickBannerTimerRef.current);
      }
      if (trickCollectTimerRef.current) {
        clearTimeout(trickCollectTimerRef.current);
      }
      if (roomNoticeTimerRef.current) {
        clearTimeout(roomNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!roundOver || onlineMultiplayer) return;
    if (!state) return;
    const readyIds = Object.keys(playerReadyStates);
    if (readyIds.length === 0) return;
    const allReady = state.players
      .filter((p) => !isDeadHandPlayer(p))
      .every((p) => !!playerReadyStates[p.id]);
    if (!allReady) return;
    startNextRound();
  }, [playerReadyStates, roundOver, state, onlineMultiplayer]);

  const offlineInitRef = useRef(false);

  useEffect(() => {
    if (!onlineMultiplayer) {
      if (offlineInitRef.current) return;
      offlineInitRef.current = true;
      const g = initialLobbyPlayers?.length
        ? createGameFromLobby(initialLobbyPlayers, seedFromProps)
        : createGame(normalizeLobbyNames(initialPlayers, localPlayerName));
      startRoundCeremony(g, []);
    } else if (isSocketAdapter(networkAdapter)) {
      const cachedSeed = networkAdapter.getCachedDealSeed();
      if (seedFromProps != null) {
        pendingDealSeedRef.current = seedFromProps;
      } else if (cachedSeed != null) {
        pendingDealSeedRef.current = cachedSeed;
      }
      const cached = parseServerGameState(networkAdapter.getCachedGameState());
      const cachedHands = networkAdapter.getCachedTradesComplete() as
        | Record<string, CardType[]>
        | null;
      if (cachedHands) {
        pendingTradesCompleteRef.current = cachedHands;
      }
      // Defer applying cached state until the deal ceremony runs (applyServerSync).
    }

    const applyServerSync = (raw: unknown, spectator?: boolean) => {
      const parsed = parseServerGameState(raw);
      if (!parsed) {
        console.warn("[GameScreen] Ignored invalid gameStateSync payload", raw);
        return;
      }

      if (
        onlineMultiplayer &&
        !shouldSkipDealCeremony(parsed)
      ) {
        const roundKey = roundCeremonyKey(parsed);
        const needsCeremony =
          awaitingDealCeremonyRef.current ||
          (ceremonyDoneForRoundRef.current !== roundKey &&
            ceremonyStartedForRoundRef.current !== roundKey);

        if (needsCeremony) {
        ceremonyStartedForRoundRef.current = roundKey;
        awaitingDealCeremonyRef.current = false;
        const serverPending = (parsed as GameState & { pendingTrades?: Record<string, { fromId: string; count: number; incoming: CardType[]; selected?: CardType[] | null }> }).pendingTrades;
        const serverRoles = (parsed as GameState & { roles?: Record<string, string> }).roles;
        const roundDealSeed =
          (parsed as GameState & { dealSeed?: number }).dealSeed ??
          pendingDealSeedRef.current ??
          seedFromProps;
        pendingDealSeedRef.current = undefined;

        const finishOrder = livingFinishedOrder(
          parsed.players,
          parsed.lastRoundOrder ?? [],
        );
        const players = clonePlayersForRound(
          parsed.players.map((p) => ({ ...p, hand: [] })),
        );
        dealFreshHands(players, roundDealSeed);
        if (serverRoles) {
          applyServerRolesToPlayers(players, serverRoles);
        }
        const dealerContext = buildDealerContext({
          hostId: resolvedHostId,
          finishOrder,
          lastRoundOrder: parsed.lastRoundOrder,
          roles: serverRoles,
        });
        if (players.some(isDeadHandPlayer)) {
          applyDeadHandAfterDeal(
            {
              players,
              finishedOrder: [],
              currentPlayerIndex: 0,
              mustPlay: false,
            },
            dealerContext,
          );
        }
        let trades: ClientPendingTrade[] = [];
        if (serverPending && serverRoles) {
          const roleValues = Object.values(serverRoles);
          const hasPresident = roleValues.includes("president");
          const hasAsshole = roleValues.includes("asshole");
          if (hasPresident && hasAsshole) {
          if (serverPending.president) {
            const presId = Object.keys(serverRoles).find((k) => serverRoles[k] === "president");
            const trade = serverPending.president;
            if (presId) {
              trades.push({
                key: "president",
                winnerId: presId,
                loserId: trade.fromId,
                winnerName: players.find((p) => p.id === presId)?.name ?? "President",
                loserName: players.find((p) => p.id === trade.fromId)?.name ?? "Asshole",
                incoming: trade.incoming ?? [],
                returnCount: trade.count ?? trade.incoming?.length ?? 1,
                completed: !!trade.selected,
              });
            }
          }
          if (serverPending.vicePresident) {
            const vpId = Object.keys(serverRoles).find((k) => serverRoles[k] === "vice_president");
            const trade = serverPending.vicePresident;
            if (vpId) {
              trades.push({
                key: "vicePresident",
                winnerId: vpId,
                loserId: trade.fromId,
                winnerName: players.find((p) => p.id === vpId)?.name ?? "Vice President",
                loserName: players.find((p) => p.id === trade.fromId)?.name ?? "Vice Asshole",
                incoming: trade.incoming ?? [],
                returnCount: trade.count ?? trade.incoming?.length ?? 1,
                completed: !!trade.selected,
              });
            }
          }
          }
        }

        setRoundOver(false);
        setPlayerReadyStates({});
        const prep: CeremonyPrepPayload = {
          baseState: parsed,
          players,
          trades,
          dealSeed: roundDealSeed,
          finishOrder,
        };
        const hiddenPlayers = players.map((p) => ({ ...p, hand: [] }));
        const priorRound = finishOrder.length >= 2;
        launchRoundAfterDeal(
          prep,
          buildFreshRoundState(
            parsed,
            hiddenPlayers,
            dealerContext,
            priorRound ? undefined : resolveOpeningPlayerIndex(players, dealerContext),
          ),
        );
        stateSyncedRef.current = true;
        if (typeof spectator === "boolean") {
          setSpectatorMode(spectator);
        }
        return;
        }
      } else if (onlineMultiplayer && shouldSkipDealCeremony(parsed)) {
        ceremonyDoneForRoundRef.current = roundCeremonyKey(parsed);
        awaitingDealCeremonyRef.current = false;
      }

      stateSyncedRef.current = true;
      setState(parsed);
      if (typeof spectator === "boolean") {
        setSpectatorMode(spectator);
      } else if (
        localPlayerId &&
        parsed.players.some((p) => p.id === localPlayerId)
      ) {
        setSpectatorMode(false);
      }
    };

    const requestSync = () => {
      if (!onlineMultiplayer || !isSocketAdapter(networkAdapter) || !roomId) {
        return;
      }
      networkAdapter.requestGameState(roomId);
    };

    void adapter.connect().then(() => {
      requestSync();
      if (onlineMultiplayer && !stateSyncedRef.current) {
        let attempts = 0;
        syncRetryTimerRef.current = setInterval(() => {
          attempts += 1;
          if (stateSyncedRef.current || attempts >= 8) {
            if (syncRetryTimerRef.current) {
              clearInterval(syncRetryTimerRef.current);
              syncRetryTimerRef.current = null;
            }
            return;
          }
          requestSync();
        }, 1200);
      }
    });

    adapter.on("message", (ev) => {
      // structured log for incoming adapter events
      emitDebug("adapter:event", {
        evType: ev.type,
        evStateType: ev.type === "state" ? ev.state?.type : undefined,
        roomId,
        raw: ev,
      });
      if (
        ev.type === "state" &&
        ev.state?.type === "gameStateSync"
      ) {
        applyServerSync(ev.state.gameState, ev.state.spectator);
      } else if (
        ev.type === "state" &&
        ev.state?.type === "playerDisconnected"
      ) {
        const grace = ev.state.gracePeriod ?? 25000;
        const reconnectUntil =
          ev.state.reconnectUntil ?? Date.now() + grace;
        setAwayPlayers((prev) => ({
          ...prev,
          [ev.state.playerId]: {
            name: ev.state.playerName ?? "Player",
            until: reconnectUntil,
            reason: ev.state.reason,
          },
        }));
      } else if (
        ev.type === "state" &&
        ev.state?.type === "playerReconnected"
      ) {
        setAwayPlayers((prev) => {
          const next = { ...prev };
          delete next[ev.state.playerId];
          return next;
        });
        if (ev.state.playerName) {
          showRoomNotice(`${ev.state.playerName} rejoined`);
        }
        if (onlineMultiplayer && isSocketAdapter(networkAdapter) && roomId) {
          networkAdapter.requestGameState(roomId);
        }
      } else if (ev.type === "state" && ev.state?.type === "lobby") {
        const members = ev.state.players;
        if (Array.isArray(members)) {
          setPlayerFeltTints((prev) => {
            const next = { ...prev };
            for (const member of members as LobbyMember[]) {
              if (!member.feltTint) continue;
              const normalized = normalizeHexColor(member.feltTint);
              const previous = prev[member.id]
                ? normalizeHexColor(prev[member.id])
                : null;
              if (previous && normalized && previous !== normalized) {
                explicitFeltThemesRef.current.add(member.id);
              }
              if (
                member.id !== myPlayerIdRef.current &&
                normalized === normalizeHexColor(DEFAULT_FELT_COLOR) &&
                !explicitFeltThemesRef.current.has(member.id)
              ) {
                continue;
              }
              next[member.id] = member.feltTint;
            }
            return next;
          });
        }
      } else if (
        ev.type === "state" &&
        (ev.state?.type === "playerLeft" ||
          ev.state?.type === "playerRemoved")
      ) {
        const notice = roomEventMessage(
          ev.state.playerName,
          ev.state.type,
          ev.state.reason,
        );
        if (notice) {
          showRoomNotice(notice);
        }
        if (onlineMultiplayer && isSocketAdapter(networkAdapter) && roomId) {
          networkAdapter.requestGameState(roomId);
        }
      } else if (ev.type === "state" && ev.state?.type === "turnNudge") {
        const fromName = ev.state.fromPlayerName ?? "Someone";
        const targetName = ev.state.targetPlayerName ?? "Player";
        showRoomNotice(`🔔 ${fromName}: Hurry up, ${targetName}!`);
      } else if (ev.type === "state" && ev.state?.type === "error") {
        setSyncError(ev.state.message ?? "Could not sync with server");
      } else if (
        ev.type === "state" &&
        ev.state &&
        ev.state.type === "gameAction" &&
        !onlineMultiplayer
      ) {
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
      } else if (ev.type === "state" && ev.state?.type === "playerReadyUpdate") {
        const readyMap = ev.state.readyForNextRound;
        if (readyMap && typeof readyMap === "object") {
          setPlayerReadyStates({ ...readyMap });
        }
      } else if (ev.type === "state" && ev.state?.type === "roundEnded") {
        setRoundOver(true);
      } else if (ev.type === "state" && ev.state?.type === "nextRoundStarting") {
        if (onlineMultiplayer) {
          setRoundOver(false);
          roundStatsRecordedRef.current = false;
          setPlayerReadyStates({});
          const promotedId = ev.state.promotedPlayerId as string | null | undefined;
          const localId =
            localPlayerId ??
            (isSocketAdapter(networkAdapter)
              ? networkAdapter.getProfileId()
              : null);
          if (promotedId && localId && promotedId === localId) {
            setSpectatorMode(false);
          }
          awaitingDealCeremonyRef.current = true;
          ceremonyStartedForRoundRef.current = null;
          ceremonyDoneForRoundRef.current = null;
          if (typeof ev.state.dealSeed === "number") {
            pendingDealSeedRef.current = ev.state.dealSeed;
          }
          if (isSocketAdapter(networkAdapter) && roomId) {
            networkAdapter.requestGameState(roomId);
          }
        } else {
          const seed =
            typeof ev.state.dealSeed === "number" ? ev.state.dealSeed : undefined;
          startNextRoundRef.current(seed);
        }
      } else if (ev.type === "state" && ev.state?.type === "tradesComplete") {
        const hands = ev.state.playerHands as
          | Record<string, CardType[]>
          | undefined;
        if (hands) {
          pendingTradesCompleteRef.current = hands;
        }
        if (ceremonyPrepRef.current) {
          return;
        }
        const tp = tradePhaseRef.current;
        if (tp && hands) {
          for (const p of tp.players) {
            if (hands[p.id]) p.hand = hands[p.id];
          }
          finalizeCeremonyRoundRef.current(tp.players, tp.baseState, hands);
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
      if (syncRetryTimerRef.current) {
        clearInterval(syncRetryTimerRef.current);
        syncRetryTimerRef.current = null;
      }
      if (!networkAdapter) {
        void fallbackAdapterRef.current?.disconnect();
      }
    };
  }, [onlineMultiplayer, roomId, networkAdapter, localPlayerId]);

  useEffect(() => {
    if (!roundOver) {
      setLocalCareerXp(null);
      return;
    }
    void getPlayerStats().then((stats) => setLocalCareerXp(stats.xp));
  }, [roundOver]);

  useEffect(() => {
    if (!showWinnerBanner || !trickPauseSnapshot?.winnerId || !myPlayerId) return;
    if (trickPauseSnapshot.winnerId !== myPlayerId) return;
    const trickNum = state?.trickHistory?.length ?? 0;
    if (trickNum <= lastRecordedTrickXpRef.current) return;
    lastRecordedTrickXpRef.current = trickNum;
    void recordTrickWin();
  }, [
    showWinnerBanner,
    trickPauseSnapshot?.winnerId,
    myPlayerId,
    state?.trickHistory?.length,
  ]);

  useEffect(() => {
    if (!tradePhase || onlineMultiplayer) return;

    const players = tradePhase.players;
    const trades = tradePhase.trades;
    const changed = autoCompleteCpuWinnerTrades(players, trades);
    if (!changed) return;

    if (allTradesCompleted(trades)) {
      finalizeCeremonyRound(players, tradePhase.baseState);
      return;
    }

    const nextTrade = trades.find((t) => !t.completed) ?? null;
    setTradePhase({ ...tradePhase, players: [...players], trades: [...trades] });
    setActiveTrade(nextTrade);
  }, [tradePhase, onlineMultiplayer, finalizeCeremonyRound]);

  // CPU auto-play effect (offline only — online uses authoritative server state)
  useEffect(() => {
    if (!state || trickPauseActive || gameplayLocked || roundOver) return;
    if (onlineMultiplayer) return;

    if (state.tenRulePending) {
      const chooserIdx = tenRuleChooserIndex(state);
      if (chooserIdx == null) return;
      const chooser = state.players[chooserIdx];
      if (!chooser || isDeadHandPlayer(chooser)) return;

      const isNamedCPU = !!(
        chooser.name &&
        typeof chooser.name === "string" &&
        chooser.name.startsWith("CPU")
      );
      const isHumanChooser =
        !!(humanPlayer && chooser.id === humanPlayer.id);
      if (!isNamedCPU || isHumanChooser) return;

      const playerId = chooser.id;
      const timer = setTimeout(() => {
        const live = stateRef.current;
        if (!live?.tenRulePending) return;
        const liveChooserIdx = tenRuleChooserIndex(live);
        if (liveChooserIdx == null || live.players[liveChooserIdx]?.id !== playerId) {
          return;
        }
        const direction = Math.random() < 0.5 ? "higher" : "lower";
        const next = setTenRuleDirection(live, direction);
        emitDebug("action:10:cpu:choose", {
          playerId,
          playerName: chooser.name,
          direction,
          before: snapshotState(live),
          after: snapshotState(next),
        });
        setState(next);
      }, CPU_DELAY_MS);
      return () => clearTimeout(timer);
    }

    const current = state.players[state.currentPlayerIndex];

    // If current player is out or has no cards, skip their turn.
    if (state.finishedOrder.includes(current.id) || current.hand.length === 0 || isDeadHandPlayer(current)) {
      if (isRoundCompleteForLiving(state)) return;
      const nextState = passTurn(state, current.id);
      if (
        nextState.currentPlayerIndex !== state.currentPlayerIndex ||
        nextState.finishedOrder.length !== state.finishedOrder.length ||
        (nextState.trickHistory?.length ?? 0) !== (state.trickHistory?.length ?? 0)
      ) {
        setState(nextState);
      }
      return;
    }

    const isRunOnTopTurn =
      !!state.runOnTop?.active &&
      state.runOnTop.playerIndex === state.currentPlayerIndex;

    // If current player has already passed in this trick, auto-advance to next player
    // (never skip the run/10-rule on-top beat — that is a fresh must-play turn).
    if (hasPassedInCurrentTrick(state, current.id) && !isRunOnTopTurn) {
      const nextState = passTurn(state, current.id);
      emitDebug("action:pass:auto:already-passed", {
        playerId: current.id,
        playerName: current.name,
        reason: "auto-pass (player already passed earlier in trick)",
        before: snapshotState(state),
      });
      if (nextState !== state) {
        setState(nextState);
      } else if (
        nextState.currentPlayerIndex !== state.currentPlayerIndex ||
        (nextState.trickHistory?.length ?? 0) !== (state.trickHistory?.length ?? 0)
      ) {
        setState({ ...nextState });
      }
      return;
    }

    const isNamedCPU = !!(
      current.name && typeof current.name === "string" && current.name.startsWith("CPU")
    );
    let isCPU = isNamedCPU;
    if (humanPlayer && current.id === humanPlayer.id) {
      isCPU = false;
    }

    if (!isCPU) return;

    if (state.finishedOrder.includes(current.id) || current.hand.length === 0) return;

    const playerId = current.id;
    const playerName = current.name;
    const timer = setTimeout(() => {
      const live = stateRef.current;
      if (!live || trickPauseActiveRef.current || gameplayLockedRef.current || roundOverRef.current) return;
      const liveCurrent = live.players[live.currentPlayerIndex];
      if (!liveCurrent || liveCurrent.id !== playerId) return;

      const nextState = applyCpuTurn(live, playerId);
      if (nextState === live) {
        // Trick finalization used to mutate state in-place without a new reference,
        // leaving React (and this timer) on a stale turn. Force a refresh so the
        // winner's opening lead runs on the next effect pass.
        const currentPlayer = live.players[live.currentPlayerIndex];
        if (currentPlayer && currentPlayer.id !== playerId) {
          setState({ ...live });
          return;
        }
        emitDebug("action:cpu:stuck", {
          playerId,
          playerName,
          before: snapshotState(live),
        });
        return;
      }

      if (nextState.tenRulePending) {
        emitDebug("action:10:cpu:choose:pending", {
          playerId,
          playerName,
          before: snapshotState(live),
        });
      } else {
        emitDebug("action:cpu:applied", {
          playerId,
          playerName,
          before: snapshotState(live),
          after: snapshotState(nextState),
        });
      }
      setState(nextState);
    }, CPU_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    state,
    trickPauseActive,
    gameplayLocked,
    roundOver,
    humanPlayer?.id,
    onlineMultiplayer,
  ]);

  if (!state) {
    return (
      <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              color: colors.onFelt.textPrimary,
              fontSize: 16,
              textAlign: "center",
            }}
          >
            {onlineMultiplayer
              ? (syncError ?? "Waiting for game state from server…")
              : "Starting game…"}
          </Text>
          {onlineMultiplayer && syncError ? (
            <Text
              style={{
                color: colors.onFelt.textMuted,
                fontSize: 13,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              Restart the game server (`npm run server`) and start a new room.
            </Text>
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  const roleById: Record<string, GameState["players"][number]["role"]> = {};
  for (const p of tradePhase?.players ?? ceremonyPrep?.players ?? state.players) {
    roleById[p.id] = p.role;
  }
  const tableSeats = buildTableSeatConfig(state.players, myPlayerId);
  const contentTopPadding = insets.top + 8;
  const localPlayerOutForLayout =
    !!humanPlayer && state.finishedOrder.includes(humanPlayer.id);
  const handReserveForLayout =
    ((humanPlayer?.hand.length ?? 0) > 0 && !gameplayLocked) ||
    localPlayerOutForLayout;
  const playAreaGameHeight = Math.max(
    0,
    playAreaSize.height -
      contentTopPadding -
      reservedBottomHeight(insets.bottom || 0, handReserveForLayout),
  );
  const playAreaLayout =
    playAreaSize.width <= 0 || playAreaGameHeight <= 0
      ? null
      : computePlayAreaLayout(
          playAreaSize.width,
          playAreaGameHeight,
          tableSeats.layoutSeatCount,
        );
  const ceremonyPlayAreaLayout =
    livePlayAreaMetrics?.layout ?? playAreaLayout;
  const ceremonyPlayAreaHeight =
    livePlayAreaMetrics?.height ?? playAreaGameHeight;
  const localControlledIds = humanPlayer ? [humanPlayer.id] : [];
  const deadHandGraveyard =
    !gameplayLocked && !ceremonyPrep && !tradePhase;

  return (
    <GameScreenRuntimeContext.Provider
      value={{
        state,
        setState,
        tradePhase,
        ceremonyPrep,
        gameplayLocked,
        playAreaSize,
        humanPlayer,
        myPlayerId,
        insets,
        colors,
        selected,
        setSelected,
        focused,
        setFocused,
        roundOver,
        trickPauseActive,
        trickPauseSnapshot,
        showWinnerBanner,
        stackCollecting,
        playerReadyStates,
        setPlayerReadyStates,
        leaveConfirmVisible,
        showDebugOverlay,
        showGameLog,
        debugLogs,
        revealedHands,
        setRevealedHands,
        onlineMultiplayer,
        networkAdapter,
        roomId,
        localPlayerId,
        readOnlyGame,
        bannerNotice,
        disconnectedPlayerIds,
        resolvedHostId,
        handRef,
        handleDealComplete,
        handleTradeConfirm,
        requestLeaveGame,
        cancelLeaveGame,
        confirmLeaveGame,
        setTradeReturnPick,
        setShowDebugOverlay,
        setShowGameLog,
        setPlayAreaSize,
        activeTrade,
        spectatorMode,
        onNavigateToAchievements,
        onNavigateToSettings,
        emitDebug,
        roleById,
        tableSeats,
        playAreaLayout,
        playAreaGameHeight,
        ceremonyPlayAreaLayout,
        ceremonyPlayAreaHeight,
        setLivePlayAreaMetrics,
        localControlledIds,
        deadHandGraveyard,
        snapshotState,
        broadcastGameAction,
        trickStackCollectMs: TRICK_STACK_COLLECT_MS,
        tradeReturnPick,
        readOnlyOnline,
        onBack,
        turnBellPlayerId,
        handleTurnBellPress,
        resolveSeatFeltTint,
        scoreboardXpByPlayerId,
        lastTrickLenRef,
      }}
    >
      <GameScreenBoard />
    </GameScreenRuntimeContext.Provider>
  );
}

function GameScreenBoard() {
  const {
    state,
    setState,
    tradePhase,
    ceremonyPrep,
    gameplayLocked,
    playAreaSize,
    humanPlayer,
    myPlayerId,
    insets,
    colors,
    selected,
    setSelected,
    focused,
    setFocused,
    roundOver,
    trickPauseActive,
    trickPauseSnapshot,
    showWinnerBanner,
    stackCollecting,
    playerReadyStates,
    setPlayerReadyStates,
    leaveConfirmVisible,
    showDebugOverlay,
    showGameLog,
    debugLogs,
    revealedHands,
    setRevealedHands,
    onlineMultiplayer,
    networkAdapter,
    roomId,
    localPlayerId,
    readOnlyGame,
    bannerNotice,
    disconnectedPlayerIds,
    resolvedHostId,
    handRef,
    handleDealComplete,
    handleTradeConfirm,
    requestLeaveGame,
    cancelLeaveGame,
    confirmLeaveGame,
    setTradeReturnPick,
    setShowDebugOverlay,
    setShowGameLog,
    setPlayAreaSize,
    activeTrade,
    spectatorMode,
    onNavigateToAchievements,
    onNavigateToSettings,
    emitDebug,
    roleById,
    tableSeats,
    playAreaLayout,
    playAreaGameHeight,
    ceremonyPlayAreaLayout,
    ceremonyPlayAreaHeight,
    setLivePlayAreaMetrics,
    localControlledIds,
    deadHandGraveyard,
    snapshotState,
    broadcastGameAction,
    trickStackCollectMs,
    tradeReturnPick,
    readOnlyOnline,
    onBack,
    turnBellPlayerId,
    handleTurnBellPress,
    resolveSeatFeltTint,
    scoreboardXpByPlayerId,
    lastTrickLenRef,
  } = useContext(GameScreenRuntimeContext)! as {
    state: GameState;
    setState: React.Dispatch<React.SetStateAction<GameState | null>>;
    tradePhase: {
      baseState: GameState;
      players: GameState["players"];
      trades: ClientPendingTrade[];
    } | null;
    ceremonyPrep: {
      baseState: GameState;
      players: GameState["players"];
      trades: ClientPendingTrade[];
      dealSeed?: number;
      finishOrder: string[];
    } | null;
    gameplayLocked: boolean;
    playAreaSize: { width: number; height: number };
    humanPlayer: ReturnType<typeof resolveLocalHumanPlayer>;
    myPlayerId: string | null;
    insets: ReturnType<typeof useLayoutInsets>;
    colors: ReturnType<typeof useAppTheme>["colors"];
    selected: number[];
    setSelected: React.Dispatch<React.SetStateAction<number[]>>;
    focused: number | null;
    setFocused: React.Dispatch<React.SetStateAction<number | null>>;
    roundOver: boolean;
    trickPauseActive: boolean;
    trickPauseSnapshot: TrickPauseSnapshot | null;
    showWinnerBanner: boolean;
    stackCollecting: boolean;
    playerReadyStates: { [playerId: string]: boolean };
    setPlayerReadyStates: React.Dispatch<
      React.SetStateAction<{ [playerId: string]: boolean }>
    >;
    leaveConfirmVisible: boolean;
    showDebugOverlay: boolean;
    showGameLog: boolean;
    debugLogs: any[];
    revealedHands: { [playerId: string]: boolean };
    setRevealedHands: React.Dispatch<
      React.SetStateAction<{ [playerId: string]: boolean }>
    >;
    onlineMultiplayer: boolean;
    networkAdapter: NetworkAdapter | MockAdapter | SocketAdapter | undefined;
    roomId: string | undefined;
    localPlayerId: string | undefined;
    readOnlyGame: boolean;
    bannerNotice: string | null;
    disconnectedPlayerIds: string[];
    resolvedHostId: string | null;
    handRef: React.RefObject<PlayerHandHandle>;
    handleDealComplete: () => void;
    handleTradeConfirm: (selected: CardType[]) => void;
    requestLeaveGame: () => void;
    cancelLeaveGame: () => void;
    confirmLeaveGame: () => void;
    setTradeReturnPick: React.Dispatch<React.SetStateAction<CardType[]>>;
    setShowDebugOverlay: React.Dispatch<React.SetStateAction<boolean>>;
    setShowGameLog: React.Dispatch<React.SetStateAction<boolean>>;
    setPlayAreaSize: React.Dispatch<
      React.SetStateAction<{ width: number; height: number }>
    >;
    activeTrade: ClientPendingTrade | null;
    spectatorMode: boolean;
    onNavigateToAchievements: (() => void) | undefined;
    onNavigateToSettings: (() => void) | undefined;
    emitDebug: (event: string, details: any) => void;
    roleById: Record<string, GameState["players"][number]["role"]>;
    tableSeats: ReturnType<typeof buildTableSeatConfig>;
    playAreaLayout: ReturnType<typeof computePlayAreaLayout> | null;
    playAreaGameHeight: number;
    ceremonyPlayAreaLayout: ReturnType<typeof computePlayAreaLayout> | null;
    ceremonyPlayAreaHeight: number;
    setLivePlayAreaMetrics: React.Dispatch<
      React.SetStateAction<{
        layout: ReturnType<typeof computePlayAreaLayout>;
        width: number;
        height: number;
      } | null>
    >;
    localControlledIds: string[];
    deadHandGraveyard: boolean;
    snapshotState: (s: GameState | null) => Record<string, unknown> | null;
    broadcastGameAction: (action: Record<string, unknown>) => void;
    trickStackCollectMs: number;
    tradeReturnPick: CardType[];
    readOnlyOnline: boolean;
    onBack: (() => void) | undefined;
    turnBellPlayerId: string | null;
    handleTurnBellPress: (playerId: string) => void;
    resolveSeatFeltTint: (player: { id: string; name: string }) => string | undefined;
    scoreboardXpByPlayerId: Record<string, number>;
    lastTrickLenRef: React.MutableRefObject<number>;
  };

  const [ceremonyDealCounts, setCeremonyDealCounts] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    if (!ceremonyPrep) setCeremonyDealCounts({});
  }, [ceremonyPrep]);

  const ceremonyCountFor = (playerId: string) =>
    ceremonyPrep ? (ceremonyDealCounts[playerId] ?? 0) : null;

  // const windowDimensions = useWindowDimensions();
  // const width = windowDimensions.width;
  // const height = windowDimensions.height;
  // const landscape = isLandscape(width, height);
  
  const inCeremony = !!ceremonyPrep || !!tradePhase || gameplayLocked;
  let current = state.players[state.currentPlayerIndex];
  if (!current && inCeremony) {
    current =
      state.players.find((p) => !isDeadHandPlayer(p)) ?? state.players[0];
  }
  /** Hide who leads until deal + mandatory trades finish (state may still track opener). */
  const revealTurnHighlight = !inCeremony;
  const turnHighlightPlayerId = revealTurnHighlight ? current.id : "";
  if (!current) {
    return (
      <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              color: colors.onFelt.textPrimary,
              fontSize: 16,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            Could not set up the table. Try leaving and starting again.
          </Text>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 10,
                backgroundColor: "rgba(212, 175, 55, 0.2)",
              }}
            >
              <Text style={{ color: colors.onFelt.textPrimary, fontWeight: "700" }}>
                Back to menu
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  const currentIsLocalHuman = !!myPlayerId && current.id === myPlayerId;
  const currentIsOut =
    state.finishedOrder.includes(current.id) || current.hand.length === 0;
  const tenRuleChooserIdx = tenRuleChooserIndex(state);
  const tenRuleChooserId =
    tenRuleChooserIdx != null ? state.players[tenRuleChooserIdx]?.id : null;
  const isTenRuleChoice =
    !!state.tenRulePending &&
    !trickPauseActive &&
    !!myPlayerId &&
    tenRuleChooserId === myPlayerId;
  const isHumanTurn =
    !!myPlayerId &&
    current.id === myPlayerId &&
    !trickPauseActive &&
    !currentIsOut &&
    !state.tenRulePending;

  let hand = [] as CardType[];
  const handPlayer =
    (myPlayerId && state.players.find((p) => p.id === myPlayerId)) ??
    humanPlayer;
  if (handPlayer) {
    hand = [...handPlayer.hand].sort((a, b) => rankIndex(a.value) - rankIndex(b.value));
  }

  const selectedCards = selected.map((index) => hand[index]).filter(Boolean);
  const runOnTopActive =
    !!state.runOnTop?.active &&
    state.runOnTop.playerIndex === state.currentPlayerIndex;
  const humanRunOnTopTurn = runOnTopActive && currentIsLocalHuman;

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
      state.lastRoundOrder,
      current.id,
      runOnTopActive,
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
      state.lastRoundOrder,
      current.id,
      runOnTopActive,
    ),
  );

  const hasAnyValidPlay = playableIndices.some(Boolean);
  const noValidPlays =
    isHumanTurn &&
    !roundOver &&
    !hasAnyValidPlay &&
    !hasPassedInCurrentTrick(state, current.id);

  const isOpeningLead = isRoundOpeningLead(state);

  const startingCardIndex =
    revealTurnHighlight &&
    isHumanTurn &&
    !roundOver &&
    !!state.mustPlay &&
    isOpeningLead
      ? openingLeadCardIndex(hand, state.players)
      : -1;

  const mustLeadOpening =
    !!state.mustPlay &&
    isTrickOpeningLead(state) &&
    isHumanTurn &&
    !roundOver;

  const handleCardPress = (idx: number) => {
    if (trickPauseActive || roundOver || readOnlyGame) return;
    const card = hand[idx];
    const ownerIdForHand = currentIsLocalHuman ? current.id : humanPlayer?.id;
    if (ownerIdForHand && hasPassedInCurrentTrick(state, ownerIdForHand)) {
      emitDebug("ui:select:blocked:passed", { playerId: ownerIdForHand });
      return;
    }
    setFocused(idx);

    if (isJoker(card)) {
      setSelected((s) => (s.includes(idx) ? [] : [idx]));
      return;
    }

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
    if (roundOver || !isHumanTurn || trickPauseActive || readOnlyGame) return;
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
      if (onlineMultiplayer) {
        broadcastGameAction({
          type: "play",
          playerId: actor.id,
          cards: cards.map((c) => ({ suit: c.suit, value: c.value })),
        });
      } else {
        broadcastGameAction({
          type: "play",
          playerId: actor.id,
          playerName: actor.name,
          cards: cards.map((c) => ({ suit: c.suit, value: c.value })),
        });
      }
    }
  };

  const handlePassPress = () => {
    if (roundOver || !isHumanTurn || trickPauseActive || readOnlyGame) return;
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
      if (onlineMultiplayer) {
        broadcastGameAction({
          type: "pass",
          playerId: actor.id,
        });
      } else {
        broadcastGameAction({
          type: "pass",
          playerId: actor.id,
          playerName: actor.name,
        });
      }
    }
  };

  const handVisible = hand.length > 0;
  const handInBottomBar = handVisible && !gameplayLocked;
  const localPlayerOut =
    !!humanPlayer && state.finishedOrder.includes(humanPlayer.id);
  /** Keep bottom chrome height stable when the local player is out (hand hidden). */
  const handReserveActive = handInBottomBar || localPlayerOut;
  const bottomBarHeight = reservedBottomHeight(
    insets.bottom || 0,
    handReserveActive,
  );
  const localSeatBottom = localSeatBottomOffset(
    insets.bottom || 0,
    handReserveActive,
  );
  const contentTopPadding = insets.top + 8;
  const trickPlays = buildTrickPlayDisplays(state);
  const activeLastPlayId = lastPlayPlayerId(state);

  const displayPlays: TrickPlayDisplay[] =
    trickPauseActive && trickPauseSnapshot
      ? trickPauseSnapshot.plays
      : trickPlays;

  const trickPauseFrozen = trickPauseActive;

  const opponentPlayers = state.players
    .filter((p) => p.id !== humanPlayer?.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      handCount: ceremonyCountFor(p.id) ?? p.hand.length,
      role: roleById[p.id] ?? p.role,
      isDeadHand: isDeadHandPlayer(p),
      sidelinedCount: isDeadHandPlayer(p)
        ? ceremonyPrep
          ? 0
          : (p.sidelinedHand?.length ?? 0)
        : 0,
      feltTint: resolveSeatFeltTint(p),
    }));

  const passedPlayerIds =
    state.currentTrick?.actions
      ?.filter((a) => a.type === "pass")
      .map((a) => a.playerId) ?? [];

  const displayPassedPlayerIds =
    trickPauseFrozen && trickPauseSnapshot
      ? trickPauseSnapshot.passedPlayerIds
      : passedPlayerIds;

  const trickWinnerPlayerId =
    showWinnerBanner && trickPauseSnapshot?.winnerId
      ? trickPauseSnapshot.winnerId
      : null;

  const localSeatPlayer = humanPlayer
    ? {
        id: humanPlayer.id,
        name: humanPlayer.name,
        handCount:
          ceremonyCountFor(humanPlayer.id) ?? humanPlayer.hand.length,
        role: roleById[humanPlayer.id] ?? humanPlayer.role,
        feltTint: resolveSeatFeltTint(humanPlayer),
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

  // Add active 10 rule status (never while a run is active — tens don't govern runs)
  const runContextForLog = resolveRunContext(
    state.pile,
    state.pileHistory,
    state.currentTrick,
    state.players,
    state.finishedOrder || [],
  );
  if (
    state.tenRule?.active &&
    state.tenRule.direction &&
    !state.tenRulePending &&
    !runContextForLog.inRunContext
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

    if (state.runOnTop?.active) return "On top!";

    if (state.fourOfAKindChallenge?.active) {
      if (state.fourOfAKindChallenge.completedAcrossTurns) return "Quads — Pass!";
      return "Quads!";
    }

    // If a 10 was just played and direction is pending
    if (state.tenRulePending) return "10 - Choose!";

    // If pile is empty, nothing to show
    if (!state.pile || state.pile.length === 0) return null;

    // Joker detection
    if (state.pile.some((c) => isJoker(c))) return "Joker!";

    // Runs take precedence over the 10 rule — tens never govern active runs.
    const { inRunContext, runMultiplicity } = resolveRunContext(
      state.pile,
      state.pileHistory,
      state.currentTrick,
      state.players,
      state.finishedOrder || [],
    );
    if (inRunContext) {
      const m = runMultiplicity;
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

    // If a ten-rule is active with a direction (only when not in a run)
    if (state.tenRule?.active && state.tenRule.direction) {
      const dir =
        state.tenRule.direction === "higher"
          ? "Higher"
          : state.tenRule.direction === "lower"
            ? "Lower"
            : state.tenRule.direction;
      return `10 - ${dir}!`;
    }

    if (state.pile.some((c) => c.value === 15 || c.value === 2)) return "2!";

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
    <ScreenContainer
      ignoreHeaderOffset={true}
      style={[{ flex: 1 }, debugBg(IOS_GAP_DEBUG_COLORS.gameScreen)]}
      onLayout={(event) => {
        if (!IOS_BOTTOM_GAP_DEBUG) return;
        const { width, height } = event.nativeEvent.layout;
        logIosBottomGapMetrics([{ label: "gameScreen", width, height }], insets);
      }}
    >
      {bannerNotice ? (
        <View
          style={[
            local.roomNoticeBanner,
            { top: contentTopPadding + 4 },
          ]}
          pointerEvents="none"
        >
          <Text style={local.roomNoticeText}>{bannerNotice}</Text>
        </View>
      ) : null}
      {onNavigateToSettings || onNavigateToAchievements ? (
        <View
          style={[local.topFabRow, { top: contentTopPadding + 4 }]}
          pointerEvents="box-none"
        >
          {onNavigateToSettings ? (
            <TouchableOpacity
              style={[
                local.statsFab,
                {
                  backgroundColor:
                    colors.mode === "light"
                      ? "rgba(255,255,255,0.72)"
                      : "rgba(255,255,255,0.1)",
                  borderColor: colors.btnGoldBorder,
                },
              ]}
              onPress={onNavigateToSettings}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MenuIcon name="gear" size={18} color={colors.gold} />
            </TouchableOpacity>
          ) : null}
          {onNavigateToAchievements ? (
            <TouchableOpacity
              style={[
                local.statsFab,
                {
                  backgroundColor:
                    colors.mode === "light"
                      ? "rgba(255,255,255,0.72)"
                      : "rgba(255,255,255,0.1)",
                  borderColor: colors.btnGoldBorder,
                },
              ]}
              onPress={onNavigateToAchievements}
              accessibilityRole="button"
              accessibilityLabel="View player stats"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MenuIcon name="trophy" size={18} color={colors.gold} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
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
          if (onlineMultiplayer) {
            broadcastGameAction({ type: "tenRule", direction });
            setState(setTenRuleDirection(state, direction));
            return;
          }
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
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setPlayAreaSize((prev) =>
            prev.width === width && prev.height === height ? prev : { width, height },
          );
        }}
      >
        <GamePlayArea
          players={opponentPlayers}
          localPlayerIds={localControlledIds}
          currentPlayerId={turnHighlightPlayerId}
          finishedOrder={state.finishedOrder}
          passedPlayerIds={displayPassedPlayerIds}
          lastPlayPlayerId={activeLastPlayId}
          plays={displayPlays}
          skipPlayFlights={trickPauseFrozen}
          trickWinnerPlayerId={trickWinnerPlayerId}
          playTypeLabel={
            playTypeLabel && !trickPauseFrozen ? playTypeLabel : null
          }
          tableSeatCount={tableSeats.layoutSeatCount}
          deadHandId={tableSeats.deadHandId}
          layoutSeatIds={tableSeats.layoutSeatIds}
          deadHandGraveyard={deadHandGraveyard}
          disconnectedPlayerIds={disconnectedPlayerIds}
          turnBellPlayerId={turnBellPlayerId}
          onTurnBellPress={handleTurnBellPress}
          dealtStackCounts={ceremonyPrep ? ceremonyDealCounts : undefined}
          onPlayAreaMetrics={setLivePlayAreaMetrics}
        >
          <GameTable
            plays={displayPlays}
            collectToStack={trickPauseActive && stackCollecting}
            collectDurationMs={trickStackCollectMs}
            fadeOut={trickPauseActive && showWinnerBanner}
          />
        </GamePlayArea>
      </View>

      {localSeatPlayer ? (
        <View
          style={[
            local.localSeatOverlay,
            { bottom: localSeatBottom, minHeight: LOCAL_SEAT_BAND },
          ]}
          pointerEvents="box-none"
        >
          <OpponentSeat
            player={localSeatPlayer}
            isActive={
              revealTurnHighlight &&
              !state.finishedOrder.includes(localSeatPlayer.id) &&
              localSeatPlayer.id === current.id
            }
            isOut={state.finishedOrder.includes(localSeatPlayer.id)}
            hasPassed={displayPassedPlayerIds.includes(localSeatPlayer.id)}
            isLocal
            isLastPlay={
              !!activeLastPlayId && localSeatPlayer.id === activeLastPlayId
            }
            celebrateTrickWin={
              !!trickWinnerPlayerId &&
              localSeatPlayer.id === trickWinnerPlayerId
            }
            showTrickXp={
              !!trickWinnerPlayerId &&
              localSeatPlayer.id === trickWinnerPlayerId
            }
            dealtStackCount={
              ceremonyPrep
                ? (ceremonyDealCounts[localSeatPlayer.id] ?? 0)
                : 0
            }
          />
        </View>
      ) : null}

      {/* Player hand + actions — sticky bottom sheet */}
      <BottomBar>
        {handInBottomBar ? (
          <BottomBarHand height={HAND_FAN_HEIGHT + HAND_ZONE_TOP_CLEARANCE}>
            {!isHumanTurn && revealTurnHighlight ? (
              <View style={local.waitingPill}>
                <Text style={local.waitingPillText}>
                  Waiting for {current.name}…
                </Text>
              </View>
            ) : null}

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
          {tradePhase && activeTrade ? (
            <>
              <RoleTradeStrip
                trade={activeTrade}
                localPlayerId={myPlayerId}
                selectedReturn={tradeReturnPick}
              />
              {activeTrade.winnerId !== myPlayerId ? (
                <View style={[local.waitingPill, local.waitingPillCollapsed]}>
                  <Text style={local.waitingPillText}>
                    Waiting for {activeTrade.winnerName} to pick return cards…
                  </Text>
                </View>
              ) : null}
            </>
          ) : readOnlyOnline ? (
            <>
              <View style={[local.waitingPill, local.waitingPillCollapsed]}>
                <Text style={local.waitingPillText}>
                  Spectating — you can play the next round
                </Text>
              </View>
              {onBack ? (
                <BottomBarLeave live onPress={requestLeaveGame} label="Leave" />
              ) : null}
            </>
          ) : gameplayLocked ? (
            <View style={[local.waitingPill, local.waitingPillCollapsed]}>
              <Text style={local.waitingPillText}>Dealing cards…</Text>
            </View>
          ) : !handVisible && !isHumanTurn && revealTurnHighlight ? (
            <View style={[local.waitingPill, local.waitingPillCollapsed]}>
              <Text style={local.waitingPillText}>
                Waiting for {current.name}…
              </Text>
            </View>
          ) : null}
          {!readOnlyOnline && !tradePhase ? (
          <ActionBar
            leaveOnly={gameplayLocked}
            selectedCount={selected.length}
            onPlay={handlePlayPress}
            onPass={handlePassPress}
            onQuit={requestLeaveGame}
            playDisabled={gameplayLocked || !isHumanTurn || roundOver || (hasPassedInCurrentTrick(state, current.id) && !humanRunOnTopTurn) || selected.length === 0 || !selectedCanPlay}
            passDisabled={gameplayLocked || !isHumanTurn || roundOver || mustLeadOpening}
            isPlayerTurn={isHumanTurn && !roundOver && !gameplayLocked}
            noValidPlays={noValidPlays}
          />
          ) : null}
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

      <DealCeremonyOverlay
        visible={!!ceremonyPrep}
        playerIds={(ceremonyPrep?.players ?? state.players).map((p) => p.id)}
        layoutSeatIds={tableSeats.layoutSeatIds}
        localPlayerIds={localControlledIds}
        dealerId={resolveDealerId(
          ceremonyPrep?.players ?? state.players,
          buildDealerContext({
            hostId: resolvedHostId,
            finishOrder: ceremonyPrep?.finishOrder,
            lastRoundOrder:
              ceremonyPrep?.finishOrder ??
              ceremonyPrep?.baseState.lastRoundOrder,
            roles: Object.fromEntries(
              (ceremonyPrep?.players ?? state.players)
                .filter((p) => !isDeadHandPlayer(p) && p.role !== "Neutral")
                .map((p) => [p.id, p.role]),
            ),
          }),
        )}
        deadHandId={tableSeats.deadHandId}
        layout={ceremonyPlayAreaLayout}
        playAreaHeight={ceremonyPlayAreaHeight}
        playAreaOffsetTop={contentTopPadding}
        playAreaOffsetLeft={12}
        cardsPerPlayer={
          ceremonyPrep
            ? Math.max(
                ...ceremonyPrep.players.map((p) =>
                  isDeadHandPlayer(p)
                    ? (p.sidelinedHand?.length ?? p.hand.length)
                    : p.hand.length,
                ),
                1,
              )
            : 13
        }
        totalCards={
          ceremonyPrep
            ? ceremonyPrep.players.reduce(
                (sum, p) =>
                  sum +
                  (isDeadHandPlayer(p)
                    ? (p.sidelinedHand?.length ?? p.hand.length)
                    : p.hand.length),
                0,
              )
            : FULL_DECK_SIZE
        }
        pendingTrades={ceremonyPrep?.trades.filter((t) => !t.completed) ?? []}
        freshRound={!!ceremonyPrep?.baseState.freshRound}
        onDealComplete={handleDealComplete}
        onDealtCountsChange={setCeremonyDealCounts}
      />

      <RoleTradeModal
        visible={!!tradePhase && !!activeTrade}
        trade={activeTrade}
        hand={
          tradePhase?.players.find((p) => p.id === activeTrade?.winnerId)
            ?.hand ?? []
        }
        isWinner={!!myPlayerId && activeTrade?.winnerId === myPlayerId}
        onSelectionChange={setTradeReturnPick}
        onConfirm={handleTradeConfirm}
      />

      <RoundCompleteModal
        visible={roundOver && !ceremonyPrep && !tradePhase}
        finishedOrder={state.finishedOrder.filter((id) =>
          state.players.some(
            (p) => p.id === id && !isDeadHandPlayer(p),
          ),
        )}
        players={state.players.filter((p) => !isDeadHandPlayer(p))}
        readyStates={playerReadyStates}
        playerXp={scoreboardXpByPlayerId}
        localPlayerId={humanPlayer?.id ?? myPlayerId ?? undefined}
        spectatorMode={spectatorMode}
        deadHandSeatOpen={state.players.some(isDeadHandPlayer)}
        onQuit={requestLeaveGame}
        onToggleReady={() => {
          const id =
            humanPlayer?.id ??
            myPlayerId ??
            (isSocketAdapter(networkAdapter)
              ? networkAdapter.getProfileId()
              : undefined);
          if (!id) return;
          if (playerReadyStates[id]) {
            setPlayerReadyStates((prev) => ({ ...prev, [id]: false }));
            return;
          }
          if (onlineMultiplayer && isSocketAdapter(networkAdapter) && roomId) {
            networkAdapter.playerReadyForNextRound(roomId);
            setPlayerReadyStates((prev) => ({ ...prev, [id]: true }));
            return;
          }
          setPlayerReadyStates((prev) => ({ ...prev, [id]: true }));
        }}
      />

      <LeaveGameConfirmModal
        visible={leaveConfirmVisible}
        onCancel={cancelLeaveGame}
        onConfirm={confirmLeaveGame}
      />
      
    </ScreenContainer>
  );
}

export default GameScreen;

const local = StyleSheet.create({
  container: { flex: 1 },
  topFabRow: {
    position: "absolute",
    right: 14,
    zIndex: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statsFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  roomNoticeBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 70,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212, 175, 55, 0.45)",
  },
  roomNoticeText: {
    color: "#f5e6b8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  localSeatOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 55,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "visible",
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
    top: 12,
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
    marginTop: 6,
    marginBottom: 4,
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
