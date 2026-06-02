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
import { View, Text, TouchableOpacity, StyleSheet, Platform, LayoutChangeEvent, useWindowDimensions } from "react-native";
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
  canAcknowledgmentPass,
  isTrickAcknowledgmentPassPhase,
  resolveRunContext,
  isAdjacentToPileTop,
  nextActivePlayerIndex,
  cardsNeededToPlay,
  TrickHistory,
  isJoker,
  isRoundCompleteForLiving,
  isDeadHandPlayer,
  livingPlayerIds,
  livingFinishedOrder,
  tenRuleChooserIndex,
  isTrickOpeningLead,
  isRoundOpeningLead,
  runLengthFromCompletedTrick,
  runTrickBonusXpAmount,
  activeRunXpPoolInfo,
  resolveEffectiveTenRule,
} from "../game/core";
import {
  allTradesCompleted,
  autoCompleteCpuWinnerTrades,
  applyServerPlayerHands,
  applyServerRolesToPlayers,
  buildFreshRoundState,
  clonePlayersForRound,
  completeWinnerReturn,
  executeCeremonyDeal,
  resolveCeremonyTrades,
  buildTradePhaseFromServerState,
  mergeTradesFromServerPending,
  shouldSyncMidTradeFromServer,
  serverPendingTradesComplete,
  type ClientPendingTrade,
  type ServerPendingTrades,
} from "../game/roundPrep";
import {
  openingLeadCardIndex,
} from "../game/deadHand";
import { DEFAULT_FELT_COLOR, normalizeHexColor } from "../services/wallpaper";
import Card from "../components/Card";
import { ScrollView } from "react-native";
import { MockAdapter, type NetworkAdapter, type NetworkEvent } from "../game/network";
import { isSocketAdapter, SocketAdapter } from "../game/socketAdapter";
import type { LobbyMember } from "../game/network";
import {
  isFullGameState,
  isCpuPlayer,
  normalizeLobbyNames,
  parseServerGameState,
  resolveLocalHumanPlayer,
} from "../utils/localPlayer";
import { pickTrickShout } from "../rewards/trickShouts";
import {
  resolveAvatarBorder,
  type AvatarBorderDesign,
} from "../rewards/avatarBorders";
import {
  getCpuAvatarBorder,
  getCpuCareerXp,
} from "../rewards/cpuProfiles";
import {
  recordRoundResult,
  commitRoundXpEarned,
  TRICK_WIN_XP,
  RUN_CARD_XP,
  getPlayerStats,
} from "../services/playerStats";
import { fetchCloudPlayerStats, pushCloudPlayerStats } from "../services/playerStatsCloud";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import { resolveHandMetrics, localHandShuffleScreenCenter } from "../utils/compactGameLayout";
import { useGamePreferences } from "../hooks/useGamePreferences";
import { getSkipDealAnimationsSync } from "../services/gamePreferences";
import DebugViewer from "../components/DebugViewer";
import { Card as CardType, FULL_DECK_SIZE } from "../game/ruleset";
import Header from "../components/Header";
import ScreenContainer from "../components/ScreenContainer";
import EndGamePanel from "../components/EndGamePanel";
import BottomBar, {
  BottomBarControls,
  BottomBarHand,
  BottomBarLeave,
  bottomOuterPad,
  reservedBottomHeight,
} from "../components/BottomBar";
import PlayerHand, {
  type PlayerHandHandle,
} from "../components/PlayerHand";
import ActionBar from "../components/ActionBar";
import MenuIcon from "../components/MenuIcon";
import RoundCompleteModal from "../components/RoundCompleteModal";
import LastHandRevealOverlay from "../components/LastHandRevealOverlay";
import LeaveGameConfirmModal from "../components/LeaveGameConfirmModal";
import TenRuleModal from "../components/TenRuleModal";
import GameTable from "../components/GameTable";
import GamePlayArea from "../components/GamePlayArea";
import DealCeremonyOverlay, {
  DEAL_CEREMONY_SHUFFLE_MS,
} from "../components/DealCeremonyOverlay";
import DealHandStack from "../components/DealHandStack";
import DealShuffleAnimation from "../components/DealShuffleAnimation";
import DealerReshuffleButton from "../components/DealerReshuffleButton";
import RoleTradeModal from "../components/RoleTradeModal";
import RoleTradeStrip from "../components/RoleTradeStrip";
import TableCardFlight, { type CardFlightSpec } from "../components/TableCardFlight";
import { seatOriginInPlayArea } from "../utils/tablePlayFlight";
import { computePlayAreaLayout } from "../utils/tableLayout";
import LobbyPlayerModal, {
  type LobbyProfilePlayer,
} from "../components/LobbyPlayerModal";
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
} from "../utils/tableSeats";
import { useSlowTurnBell, TURN_NUDGE_HIGHLIGHT_MS } from "../hooks/useSlowTurnBell";
import { formatWaitingForTurnHint } from "../utils/playerDisplay";
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

const LAST_HAND_REVEAL_MS = 4000;
const TRADE_RETURN_FLIGHT_MS = 520;
const TRADE_RETURN_HOLD_MS = 650;

type LastHandRevealPayload = {
  playerId: string;
  playerName: string;
  cards: CardType[];
};

function visibleHandCards(cards: CardType[]): CardType[] {
  return cards.filter((c) => !c.hidden && c.value !== 0);
}

function lastPlayerHandFromState(state: GameState): LastHandRevealPayload | null {
  const order = livingFinishedOrder(state.players, state.finishedOrder);
  const lastId = order[order.length - 1];
  if (!lastId) return null;
  const lastPlayer = state.players.find((p) => p.id === lastId);
  if (!lastPlayer) return null;
  const cards = visibleHandCards(lastPlayer.hand);
  if (cards.length === 0) return null;
  return { playerId: lastId, playerName: lastPlayer.name, cards };
}

type ServerAugmentedState = GameState & {
  pendingTrades?: ServerPendingTrades;
  roles?: Record<string, string>;
  playerHands?: Record<string, CardType[]>;
};

function serverStateHasPendingTrades(
  state: ServerAugmentedState,
): boolean {
  const pending = state.pendingTrades;
  return !!pending && Object.keys(pending).length > 0;
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

  // Check if pile is in an active run — extend with a rank adjacent to pile top.
  // During a 10-rule on-top beat, higher/lower still governs (not run adjacency).
  const { runMultiplicity, inRunContext } = resolveRunContext(
    pile,
    pileHistory,
    currentTrick,
    players,
    finishedOrder || [],
  );
  const pileIsUniform = pile.length > 0 && pile.every((c) => c.value === pile[0].value);
  const tenRuleOnTopBeat =
    !!runOnTop &&
    !!tenRule?.active &&
    !!tenRule.direction &&
    pileIsUniform &&
    pile[0].value === 10;

  if (inRunContext && !tenRuleOnTopBeat) {
    if (!isAdjacentToPileTop(pile, cardValue)) return false;
    if (sameValue.length < runMultiplicity) return false;
    return matchesValid(sameValue.slice(0, runMultiplicity));
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
  /** Trick index (1-based count in trickHistory) when the trick was won. */
  trickIndex: number;
  /** Run bonus XP awarded to the trick winner (0 for a 3-card run). */
  runBonusXp: number;
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
    needsDealerReshuffle?: boolean;
    dealAttempt?: number;
    skipDealPhases?: boolean;
  } | null>(null);
  const [awaitingDealerReshuffle, setAwaitingDealerReshuffle] = useState(false);
  const { skipDealAnimations, loaded: preferencesLoaded } = useGamePreferences();
  const skipDealAnimationsRef = useRef(skipDealAnimations);
  skipDealAnimationsRef.current = skipDealAnimations;
  const [tradePhase, setTradePhase] = useState<{
    baseState: GameState;
    players: GameState["players"];
    trades: ClientPendingTrade[];
  } | null>(null);
  const [activeTrade, setActiveTrade] = useState<ClientPendingTrade | null>(null);
  const [tradeReturnPick, setTradeReturnPick] = useState<CardType[]>([]);
  const [tradeReturnFlight, setTradeReturnFlight] = useState<CardFlightSpec | null>(
    null,
  );
  const [tradeReturnReceiveLanded, setTradeReturnReceiveLanded] = useState(false);
  const [tradeReturnRevealActive, setTradeReturnRevealActive] = useState(false);
  const [tradeReturnLayoutTick, setTradeReturnLayoutTick] = useState(0);
  const receiveSlotRectRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const playAreaScreenRectRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const tradeReturnRevealPendingRef = useRef<{
    cards: CardType[];
    trade: ClientPendingTrade;
    onDone: () => void;
  } | null>(null);
  const tradeReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [roundOver, setRoundOver] = useState(false);
  const [lastHandReveal, setLastHandReveal] = useState<LastHandRevealPayload | null>(
    null,
  );
  const [playerReadyStates, setPlayerReadyStates] = useState<{
    [playerId: string]: boolean;
  }>({});
  const [localAvatarBorder, setLocalAvatarBorder] = useState<AvatarBorderDesign | null>(
    null,
  );
  const [lastTrickWinner, setLastTrickWinner] = useState<string | null>(null);
  const [showWinnerBanner, setShowWinnerBanner] = useState(false);
  const [stackCollecting, setStackCollecting] = useState(false);
  const [trickPauseActive, setTrickPauseActive] = useState(false);
  const [trickPauseSnapshot, setTrickPauseSnapshot] =
    useState<TrickPauseSnapshot | null>(null);
  const [tableRenderKey, setTableRenderKey] = useState(0);
  const prevTrickPauseRef = useRef(trickPauseActive);
  const [roomNotice, setRoomNotice] = useState<string | null>(null);
  const [nudgeHighlightPlayerId, setNudgeHighlightPlayerId] = useState<
    string | null
  >(null);
  const [awayPlayers, setAwayPlayers] = useState<Record<string, AwayPlayer>>({});
  const [openSeatAvailable, setOpenSeatAvailable] = useState(false);
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
  /** Trick-win XP earned in the current round only (resets each round). */
  const [roundXpByPlayerId, setRoundXpByPlayerId] = useState<Record<string, number>>({});
  /** Players who left or timed out — forfeit in-round XP for this round. */
  const [forfeitedXpPlayerIds, setForfeitedXpPlayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [localCareerXp, setLocalCareerXp] = useState<number | null>(null);
  /** Career XP baseline for opponents (cloud stats, pre-round). */
  const [careerXpByPlayerId, setCareerXpByPlayerId] = useState<
    Record<string, number>
  >({});
  const [scoreboardCareerXpLoading, setScoreboardCareerXpLoading] =
    useState(false);
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
  const nudgeHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handRef = useRef<PlayerHandHandle>(null);
  const fallbackAdapterRef = useRef<MockAdapter | null>(null);
  const lastTrickLenRef = React.useRef<number>(0);
  const lastRecordedTrickXpRef = React.useRef(0);
  const lastRecordedTrickRunBonusTrickRef = React.useRef(0);
  const roundStatsRecordedRef = React.useRef(false);
  const xpCommittedForRoundRef = React.useRef(false);
  const trickPauseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const trickBannerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const trickCollectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastHandRevealTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastHandRevealRef = useRef<LastHandRevealPayload | null>(null);
  lastHandRevealRef.current = lastHandReveal;
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
  const scheduleTradeReturnRevealRef = useRef<
    (
      returnedCards: CardType[],
      trade: ClientPendingTrade,
      onDone: () => void,
    ) => void
  >(() => {});

  if (!networkAdapter && !fallbackAdapterRef.current) {
    fallbackAdapterRef.current = new MockAdapter();
  }
  const adapter = networkAdapter ?? fallbackAdapterRef.current!;
  const effectiveRoomId =
    roomId ??
    (isSocketAdapter(networkAdapter)
      ? networkAdapter.getActiveRoomId() ?? undefined
      : undefined);
  const onlineMultiplayer = isSocketAdapter(networkAdapter) && !!effectiveRoomId;
  const resolvedHostId =
    (isSocketAdapter(networkAdapter) ? networkAdapter.getHostId() : null) ??
    initialLobbyPlayers?.[0]?.id ??
    null;

  const shouldSkipDealAnimations = useCallback(() => {
    if (onlineMultiplayer && isSocketAdapter(networkAdapter)) {
      return networkAdapter.getSkipDealAnimations();
    }
    return skipDealAnimationsRef.current || getSkipDealAnimationsSync();
  }, [onlineMultiplayer, networkAdapter]);
  const readOnlyOnline = onlineMultiplayer && spectatorMode;
  const isBotOpenTable =
    effectiveRoomId?.trim().toUpperCase() === "BOTOPN";
  const seatedPlayerIds = useMemo(() => {
    if (!state?.players) return new Set<string>();
    return new Set(
      state.players.filter((p) => !isDeadHandPlayer(p)).map((p) => p.id),
    );
  }, [state?.players]);
  const gamePausedForAway =
    onlineMultiplayer &&
    Object.keys(awayPlayers).some((id) => seatedPlayerIds.has(id));
  const readOnlyGame = gameplayLocked || readOnlyOnline || gamePausedForAway;

  const insets = useLayoutInsets();
  const { height: shellHeight } = useVisualViewportSize();
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
    const names = entries.map(([, info]) => info.name).join(", ");
    const minUntil = Math.min(...entries.map(([, info]) => info.until));
    const secs = Math.max(0, Math.ceil((minUntil - Date.now()) / 1000));
    return `Game paused — waiting for ${names} to return (${secs}s)`;
  }, [awayPlayers, awayTick]);

  const disconnectedPlayerIds = useMemo(
    () => Object.keys(awayPlayers),
    [awayPlayers],
  );

  const forfeitPlayerXp = useCallback((playerId: string) => {
    if (!playerId) return;
    setForfeitedXpPlayerIds((prev) => {
      if (prev.has(playerId)) return prev;
      const next = new Set(prev);
      next.add(playerId);
      return next;
    });
    setRoundXpByPlayerId((prev) => ({ ...prev, [playerId]: 0 }));
    setGameXpByPlayerId((prev) => ({ ...prev, [playerId]: 0 }));
  }, []);

  const scoreboardRoundXpByPlayerId = useMemo(() => {
    const out: Record<string, number> = {};
    const living =
      state?.players.filter((p) => !isDeadHandPlayer(p)) ?? [];
    for (const player of living) {
      if (forfeitedXpPlayerIds.has(player.id)) {
        out[player.id] = 0;
        continue;
      }
      out[player.id] = roundXpByPlayerId[player.id] ?? 0;
    }
    return out;
  }, [state?.players, roundXpByPlayerId, forfeitedXpPlayerIds]);

  const scoreboardXpByPlayerId = useMemo(() => {
    const xp: Record<string, number> = {};
    const living =
      state?.players.filter((p) => !isDeadHandPlayer(p)) ?? [];
    for (const player of living) {
      const roundEarned = scoreboardRoundXpByPlayerId[player.id] ?? 0;
      if (player.id === myPlayerId && localCareerXp != null) {
        xp[player.id] = localCareerXp + roundEarned;
        continue;
      }
      const careerBaseline = careerXpByPlayerId[player.id];
      if (careerBaseline != null) {
        xp[player.id] = careerBaseline + roundEarned;
        continue;
      }
      if (!onlineMultiplayer && isCpuPlayer(player)) {
        const base = getCpuCareerXp(player) ?? 0;
        xp[player.id] = base + roundEarned;
      } else if (roundEarned > 0) {
        xp[player.id] = roundEarned;
      }
    }
    return xp;
  }, [
    state?.players,
    scoreboardRoundXpByPlayerId,
    myPlayerId,
    localCareerXp,
    careerXpByPlayerId,
    onlineMultiplayer,
  ]);

  const xpAnimationReady =
    !roundOver ||
    ((!humanPlayer?.id ||
      humanPlayer.id !== myPlayerId ||
      localCareerXp != null) &&
      (!onlineMultiplayer || !scoreboardCareerXpLoading));

  const turnPlayer = state?.players[state.currentPlayerIndex];
  const turnPlayerId = turnPlayer?.id ?? null;
  const turnPlayerIsCpu = isCpuPlayer(turnPlayer);
  const bellPaused =
    !state ||
    trickPauseActive ||
    gameplayLocked ||
    gamePausedForAway ||
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
    if (myPlayerIdRef.current) {
      forfeitPlayerXp(myPlayerIdRef.current);
    }
    onBack?.();
  }, [onBack, forfeitPlayerXp]);

  const clearLastHandReveal = useCallback(() => {
    if (lastHandRevealTimerRef.current) {
      clearTimeout(lastHandRevealTimerRef.current);
      lastHandRevealTimerRef.current = null;
    }
    setLastHandReveal(null);
  }, []);

  const startLastHandReveal = useCallback(
    (payload: LastHandRevealPayload) => {
      if (!payload.cards?.length) {
        clearLastHandReveal();
        return;
      }
      clearLastHandReveal();
      setLastHandReveal(payload);
      lastHandRevealTimerRef.current = setTimeout(() => {
        lastHandRevealTimerRef.current = null;
        setLastHandReveal(null);
      }, LAST_HAND_REVEAL_MS);
    },
    [clearLastHandReveal],
  );

  /** Fallback — web timers can stall; scoreboard must not stay behind the reveal overlay. */
  useEffect(() => {
    if (!roundOver || !lastHandReveal) return;
    const timer = setTimeout(() => {
      setLastHandReveal(null);
    }, LAST_HAND_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [roundOver, lastHandReveal]);

  const clearTradeReturnReveal = useCallback(() => {
    if (tradeReturnTimerRef.current) {
      clearTimeout(tradeReturnTimerRef.current);
      tradeReturnTimerRef.current = null;
    }
    tradeReturnRevealPendingRef.current = null;
    receiveSlotRectRef.current = null;
    setTradeReturnFlight(null);
    setTradeReturnReceiveLanded(false);
    setTradeReturnRevealActive(false);
  }, []);

  const finishTradeReturnReveal = useCallback(() => {
    const pending = tradeReturnRevealPendingRef.current;
    if (!pending) return;
    tradeReturnRevealPendingRef.current = null;
    setTradeReturnFlight(null);
    setTradeReturnReceiveLanded(true);
    if (tradeReturnTimerRef.current) {
      clearTimeout(tradeReturnTimerRef.current);
    }
    tradeReturnTimerRef.current = setTimeout(() => {
      tradeReturnTimerRef.current = null;
      setTradeReturnReceiveLanded(false);
      setTradeReturnRevealActive(false);
      pending.onDone();
    }, TRADE_RETURN_HOLD_MS);
  }, []);

  const scheduleTradeReturnReveal = useCallback(
    (
      returnedCards: CardType[],
      trade: ClientPendingTrade,
      onDone: () => void,
    ) => {
      setTradeReturnPick(returnedCards);
      const localId = myPlayerIdRef.current;
      const isLocalLoser = !!localId && trade.loserId === localId;

      if (!isLocalLoser || returnedCards.length === 0) {
        const delay = isLocalLoser && returnedCards.length > 0 ? 450 : 200;
        if (tradeReturnTimerRef.current) {
          clearTimeout(tradeReturnTimerRef.current);
        }
        tradeReturnTimerRef.current = setTimeout(() => {
          tradeReturnTimerRef.current = null;
          onDone();
        }, delay);
        return;
      }

      clearTradeReturnReveal();
      tradeReturnRevealPendingRef.current = { cards: returnedCards, trade, onDone };
      setTradeReturnRevealActive(true);
      setTradeReturnReceiveLanded(false);
    },
    [clearTradeReturnReveal],
  );

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
      clearLastHandReveal();
      clearTradeReturnReveal();
      const next = buildFreshRoundState(baseState, merged, {
        hostId: resolvedHostId,
        lastRoundOrder: baseState.lastRoundOrder,
        finishedOrder: ceremonyPrepRef.current?.finishOrder,
      });
      setState(next);
      setRoundOver(false);
      roundStatsRecordedRef.current = false;
      xpCommittedForRoundRef.current = false;
      setForfeitedXpPlayerIds(new Set());
      setPlayerReadyStates({});
      setCeremonyPrep(null);
      setTradePhase(null);
      setActiveTrade(null);
      setTradeReturnPick([]);
      setGameplayLocked(false);
      setRoundXpByPlayerId({});
      setForfeitedXpPlayerIds(new Set());
      xpCommittedForRoundRef.current = false;
      ceremonyDoneForRoundRef.current = roundCeremonyKey(next);
    },
    [resolvedHostId, clearLastHandReveal, clearTradeReturnReveal],
  );

  const beginTradePhase = useCallback(
    (
      baseState: GameState,
      players: GameState["players"],
      trades: ClientPendingTrade[],
    ) => {
      const pendingHands = pendingTradesCompleteRef.current;
      if (onlineMultiplayer && pendingHands) {
        finalizeCeremonyRound(players, baseState, pendingHands);
        return;
      }

      const playersCopy = clonePlayersForRound(players);
      const tradesCopy = trades.map((t) => ({ ...t, incoming: [...t.incoming] }));

      if (!onlineMultiplayer) {
        autoCompleteCpuWinnerTrades(playersCopy, tradesCopy);
      }

      if (tradesCopy.length === 0 || tradesCopy.every((t) => t.completed)) {
        const localId = myPlayerIdRef.current;
        const revealTrade = tradesCopy.find(
          (t) =>
            t.completed &&
            t.loserId === localId &&
            (t.returnedCards?.length ?? 0) > 0,
        );
        if (revealTrade?.returnedCards?.length) {
          setTradePhase({
            baseState,
            players: playersCopy,
            trades: tradesCopy,
          });
          setCeremonyPrep(null);
          setActiveTrade(revealTrade);
          scheduleTradeReturnReveal(
            revealTrade.returnedCards,
            revealTrade,
            () => finalizeCeremonyRound(playersCopy, baseState),
          );
          return;
        }
        finalizeCeremonyRound(playersCopy, baseState);
        return;
      }
      setTradePhase({ baseState, players: playersCopy, trades: tradesCopy });
      setCeremonyPrep(null);
      setTradeReturnPick([]);
      const first = tradesCopy.find((t) => !t.completed) ?? null;
      setActiveTrade(first);
    },
    [finalizeCeremonyRound, onlineMultiplayer, scheduleTradeReturnReveal],
  );

  type CeremonyPrepPayload = {
    baseState: GameState;
    players: GameState["players"];
    trades: ClientPendingTrade[];
    dealSeed?: number;
    finishOrder: string[];
    needsDealerReshuffle?: boolean;
    dealAttempt?: number;
    /** Skip shuffle/deal animation only — role trades still run. */
    skipDealPhases?: boolean;
  };

  const launchRoundAfterDeal = useCallback(
    (prep: CeremonyPrepPayload, hiddenState: GameState) => {
      clearLastHandReveal();
      setRoundOver(false);
      setPlayerReadyStates({});
      roundStatsRecordedRef.current = false;
      xpCommittedForRoundRef.current = false;
      setForfeitedXpPlayerIds(new Set());
      setGameplayLocked(true);

      if (shouldSkipDealAnimations()) {
        ceremonyPrepRef.current = prep;
        if (prep.needsDealerReshuffle) {
          setCeremonyPrep(prep);
          setState(hiddenState);
          setAwaitingDealerReshuffle(true);
          return;
        }
        if (pendingTradesCompleteRef.current) {
          finalizeCeremonyRound(
            prep.players,
            prep.baseState,
            pendingTradesCompleteRef.current,
          );
          return;
        }
        const tradesPending =
          prep.trades.length > 0 && !prep.trades.every((t) => t.completed);
        if (tradesPending) {
          setCeremonyPrep({ ...prep, skipDealPhases: true });
          setState(hiddenState);
          return;
        }
        beginTradePhase(prep.baseState, prep.players, prep.trades);
        return;
      }

      setCeremonyPrep(prep);
      setState(hiddenState);
    },
    [beginTradePhase, finalizeCeremonyRound, shouldSkipDealAnimations, clearLastHandReveal],
  );

  const launchCeremonyFromDeal = useCallback(
    (
      prep: CeremonyPrepPayload,
      dealerContext: ReturnType<typeof buildDealerContext>,
      openingPlayerIndex: number,
    ) => {
      const hiddenPlayers = prep.players.map((p) => ({ ...p, hand: [] }));
      const priorRound = prep.finishOrder.length >= 2;
      launchRoundAfterDeal(
        prep,
        buildFreshRoundState(
          prep.baseState,
          hiddenPlayers,
          dealerContext,
          priorRound ? undefined : openingPlayerIndex,
        ),
      );
    },
    [launchRoundAfterDeal],
  );

  const handleDealComplete = useCallback(() => {
    const prep = ceremonyPrepRef.current;
    if (prep?.needsDealerReshuffle) {
      setAwaitingDealerReshuffle(true);
      return;
    }
    if (prep) {
      if (pendingTradesCompleteRef.current) {
        finalizeCeremonyRound(
          prep.players,
          prep.baseState,
          pendingTradesCompleteRef.current,
        );
        return;
      }
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
      setAwaitingDealerReshuffle(false);
      clearLastHandReveal();
      const deal = executeCeremonyDeal(baseState, finishedOrder, {
        dealSeed: nextDealSeed,
        hostId: resolvedHostId,
      });

      setRoundOver(false);
      setPlayerReadyStates({});
      roundStatsRecordedRef.current = false;
      const prep: CeremonyPrepPayload = {
        baseState: {
          ...baseState,
          consecutiveAssholeId: deal.streakAfterRound.consecutiveAssholeId,
          consecutiveAssholeCount: deal.streakAfterRound.consecutiveAssholeCount,
          freshRound: deal.skipPresidentTrade,
          lastRoundOrder:
            finishedOrder.length >= 2 ? finishedOrder : baseState.lastRoundOrder,
        },
        players: deal.players,
        trades: deal.trades,
        dealSeed: nextDealSeed,
        finishOrder: finishedOrder,
        needsDealerReshuffle: deal.needsDealerReshuffle,
        dealAttempt: 0,
      };
      launchCeremonyFromDeal(
        prep,
        deal.dealerContext,
        deal.openingPlayerIndex,
      );
    },
    [resolvedHostId, launchCeremonyFromDeal, clearLastHandReveal],
  );

  const handleTradeConfirm = useCallback(
    (selected: CardType[]) => {
      if (!tradePhase || !activeTrade) return;
      const ok = completeWinnerReturn(tradePhase.players, activeTrade, selected);
      if (!ok) return;
      if (onlineMultiplayer && isSocketAdapter(networkAdapter) && roomId) {
        networkAdapter.submitTradeSelection(roomId, selected);
      }
      const completedTrade = activeTrade;
      const remaining = tradePhase.trades.filter((t) => !t.completed);
      const proceed = () => {
        setTradeReturnPick([]);
        if (remaining.length === 0) {
          if (!onlineMultiplayer) {
            finalizeCeremonyRound(tradePhase.players, tradePhase.baseState);
          }
        } else {
          setActiveTrade(remaining[0]);
        }
      };
      scheduleTradeReturnReveal(selected, completedTrade, proceed);
    },
    [
      tradePhase,
      activeTrade,
      onlineMultiplayer,
      networkAdapter,
      roomId,
      finalizeCeremonyRound,
      scheduleTradeReturnReveal,
    ],
  );

  function startNextRound(nextDealSeed?: number) {
    if (!state) return;
    const finishedOrder = livingFinishedOrder(state.players, state.finishedOrder);
    startRoundCeremony(state, finishedOrder, nextDealSeed);
  }

  const maybeStartNextOfflineRound = useCallback(
    (readyMap: Record<string, boolean>) => {
      if (onlineMultiplayer || lastHandReveal || !roundOver || !state) return;
      const living = state.players.filter((p) => !isDeadHandPlayer(p));
      if (living.length === 0) return;
      if (living.every((p) => !!readyMap[p.id])) {
        startNextRoundRef.current();
      }
    },
    [onlineMultiplayer, lastHandReveal, roundOver, state],
  );

  startNextRoundRef.current = startNextRound;
  finalizeCeremonyRoundRef.current = finalizeCeremonyRound;
  scheduleTradeReturnRevealRef.current = scheduleTradeReturnReveal;

  const onReceiveSlotMeasure = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      receiveSlotRectRef.current = rect;
      setTradeReturnLayoutTick((n) => n + 1);
    },
    [],
  );

  const onPlayAreaScreenMeasure = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      playAreaScreenRectRef.current = rect;
      setTradeReturnLayoutTick((n) => n + 1);
    },
    [],
  );

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

  const resetForBotTableRefresh = useCallback(() => {
    clearLastHandReveal();
    clearTradeReturnReveal();
    pendingTradesCompleteRef.current = null;
    pendingDealSeedRef.current = undefined;
    setCeremonyPrep(null);
    setTradePhase(null);
    setActiveTrade(null);
    setTradeReturnPick([]);
    setGameplayLocked(false);
    setRoundOver(false);
    setPlayerReadyStates({});
    setTrickPauseActive(false);
    setTrickPauseSnapshot(null);
    setShowWinnerBanner(false);
    setStackCollecting(false);
    roundStatsRecordedRef.current = false;
    xpCommittedForRoundRef.current = false;
    setForfeitedXpPlayerIds(new Set());
    setState(null);
    setSyncError(null);
    stateSyncedRef.current = false;
    awaitingDealCeremonyRef.current = true;
    ceremonyStartedForRoundRef.current = null;
    ceremonyDoneForRoundRef.current = null;
    lastTrickLenRef.current = 0;
  }, [clearLastHandReveal, clearTradeReturnReveal]);

  const handleRefreshBotTable = useCallback(() => {
    if (!isSocketAdapter(networkAdapter) || !effectiveRoomId) return;
    resetForBotTableRefresh();
    networkAdapter.refreshBotTable(effectiveRoomId);
    showRoomNotice("Restarting bot table…");
  }, [networkAdapter, effectiveRoomId, resetForBotTableRefresh]);

  const triggerNudgeHighlight = useCallback((targetPlayerId: string) => {
    if (!targetPlayerId) return;
    setNudgeHighlightPlayerId(targetPlayerId);
    if (nudgeHighlightTimerRef.current) {
      clearTimeout(nudgeHighlightTimerRef.current);
    }
    nudgeHighlightTimerRef.current = setTimeout(() => {
      setNudgeHighlightPlayerId((current) =>
        current === targetPlayerId ? null : current,
      );
      nudgeHighlightTimerRef.current = null;
    }, TURN_NUDGE_HIGHLIGHT_MS);
  }, []);

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

  const handleDealerReshuffle = useCallback(() => {
    const prep = ceremonyPrepRef.current;
    if (!prep?.needsDealerReshuffle) return;

    const newSeed =
      prep.dealSeed != null
        ? ((prep.dealSeed + 1 + Math.floor(Math.random() * 997)) >>> 0)
        : Math.floor(Math.random() * 2147483647);

    if (onlineMultiplayer && isSocketAdapter(networkAdapter) && roomId) {
      broadcastGameAction({ type: "dealerReshuffle", dealSeed: newSeed });
      return;
    }

    setAwaitingDealerReshuffle(false);

    const deal = executeCeremonyDeal(prep.baseState, prep.finishOrder, {
      dealSeed: newSeed,
      hostId: resolvedHostId,
    });

    const nextPrep: CeremonyPrepPayload = {
      baseState: {
        ...prep.baseState,
        consecutiveAssholeId: deal.streakAfterRound.consecutiveAssholeId,
        consecutiveAssholeCount: deal.streakAfterRound.consecutiveAssholeCount,
        freshRound: deal.skipPresidentTrade,
        lastRoundOrder:
          prep.finishOrder.length >= 2
            ? prep.finishOrder
            : prep.baseState.lastRoundOrder,
      },
      players: deal.players,
      trades: deal.trades,
      dealSeed: newSeed,
      finishOrder: prep.finishOrder,
      needsDealerReshuffle: deal.needsDealerReshuffle,
      dealAttempt: (prep.dealAttempt ?? 0) + 1,
    };
    ceremonyPrepRef.current = nextPrep;
    setCeremonyPrep(nextPrep);
    launchCeremonyFromDeal(
      nextPrep,
      deal.dealerContext,
      deal.openingPlayerIndex,
    );
  }, [
    resolvedHostId,
    launchCeremonyFromDeal,
    onlineMultiplayer,
    networkAdapter,
    roomId,
  ]);

  const handleTurnBellPress = useCallback(
    (targetPlayerId: string) => {
      if (!canRingBell(targetPlayerId, myPlayerId)) return;
      registerBellRing();
      triggerNudgeHighlight(targetPlayerId);
      broadcastGameAction({
        type: "turnNudge",
        targetPlayerId,
        fromPlayerId: myPlayerId,
      });
    },
    [canRingBell, myPlayerId, registerBellRing, triggerNudgeHighlight],
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

  useEffect(() => {
    void getPlayerStats().then((stats) => {
      setLocalAvatarBorder(resolveAvatarBorder(stats));
    });
  }, []);

  useEffect(() => {
    if (!onlineMultiplayer || !myPlayerId) return;
    void getPlayerStats().then((stats) => {
      void pushCloudPlayerStats(myPlayerId, stats);
    });
  }, [onlineMultiplayer, myPlayerId]);

  useEffect(() => {
    if (!showWinnerBanner || !myPlayerId || trickPauseSnapshot?.winnerId !== myPlayerId) {
      return;
    }
    void getPlayerStats().then((stats) => {
      setLocalAvatarBorder(resolveAvatarBorder(stats));
    });
  }, [showWinnerBanner, myPlayerId, trickPauseSnapshot?.winnerId]);

  // Detect trick wins (pause briefly) and round completion — layout effect
  // commits the snapshot before paint so the table never freezes on stale plays.
  useLayoutEffect(() => {
    if (!state) return;
    const len = state.trickHistory ? state.trickHistory.length : 0;
    if (len < lastTrickLenRef.current) {
      lastTrickLenRef.current = len;
    }
    if (len <= lastTrickLenRef.current) return;

    lastTrickLenRef.current = len;

    const last =
      state.trickHistory && state.trickHistory[state.trickHistory.length - 1];
    if (!last?.winnerName) return;

    setLastTrickWinner(last.winnerName);
    const winnerId =
      last.winnerId ??
      state.players.find((p) => p.name === last.winnerName)?.id;
    const runLength = runLengthFromCompletedTrick(
      last,
      state.players,
      state.finishedOrder ?? [],
    );
    const runBonusXp = runTrickBonusXpAmount(runLength, RUN_CARD_XP);
    if (winnerId) {
      const trickXp = TRICK_WIN_XP + runBonusXp;
      setGameXpByPlayerId((prev) => ({
        ...prev,
        [winnerId]: (prev[winnerId] ?? 0) + trickXp,
      }));
      setRoundXpByPlayerId((prev) => ({
        ...prev,
        [winnerId]: (prev[winnerId] ?? 0) + trickXp,
      }));
    }
    setTrickPauseSnapshot({
      plays: buildPlaysFromTrick(last),
      passedPlayerIds: passedIdsFromTrick(last),
      winnerName: last.winnerName,
      winnerId: winnerId ?? "",
      trickIndex: len,
      runBonusXp,
    });
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
    if (prevTrickPauseRef.current && !trickPauseActive) {
      setTableRenderKey((key) => key + 1);
    }
    prevTrickPauseRef.current = trickPauseActive;
  }, [trickPauseActive]);

  useEffect(() => {
    if (!state) return;
    const allPlayersFinished =
      isRoundCompleteForLiving(state) && !state.tenRulePending;
    if (allPlayersFinished && !roundOver) {
      const reveal = lastPlayerHandFromState(state);
      if (reveal) {
        startLastHandReveal(reveal);
      }

      setRoundOver(true);
      if (!onlineMultiplayer && !roundStatsRecordedRef.current) {
        roundStatsRecordedRef.current = true;
        const human = resolveLocalHumanPlayer(
          state.players,
          localPlayerName,
          localPlayerId,
          networkAdapter,
        );
        if (human) {
          const placement = state.finishedOrder.indexOf(human.id);
          if (
            placement >= 0 &&
            !forfeitedXpPlayerIds.has(human.id)
          ) {
            void recordRoundResult(placement, livingPlayerIds(state.players).length);
          }
        }
      }
      if (!onlineMultiplayer) {
        const newReady: { [playerId: string]: boolean } = {};
        const localHuman = resolveLocalHumanPlayer(
          state.players,
          localPlayerName,
          localPlayerId,
          networkAdapter,
        );
        state.players.filter((p) => !isDeadHandPlayer(p)).forEach((p) => {
          newReady[p.id] = !(localHuman && p.id === localHuman.id);
        });
        setPlayerReadyStates(newReady);
      }
    }
  }, [
    state,
    roundOver,
    localPlayerId,
    localPlayerName,
    onlineMultiplayer,
    startLastHandReveal,
    networkAdapter,
    forfeitedXpPlayerIds,
  ]);

  /** Record placement stats when an online round ends via server broadcast. */
  useEffect(() => {
    if (!roundOver || !state || !onlineMultiplayer || roundStatsRecordedRef.current) {
      return;
    }
    roundStatsRecordedRef.current = true;
    const human = resolveLocalHumanPlayer(
      state.players,
      localPlayerName,
      localPlayerId,
      networkAdapter,
    );
    if (!human || forfeitedXpPlayerIds.has(human.id)) return;
    const placement = state.finishedOrder.indexOf(human.id);
    if (placement >= 0) {
      void recordRoundResult(placement, livingPlayerIds(state.players).length);
    }
  }, [
    roundOver,
    state,
    onlineMultiplayer,
    localPlayerName,
    localPlayerId,
    networkAdapter,
    forfeitedXpPlayerIds,
  ]);

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
      if (nudgeHighlightTimerRef.current) {
        clearTimeout(nudgeHighlightTimerRef.current);
      }
      if (lastHandRevealTimerRef.current) {
        clearTimeout(lastHandRevealTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!roundOver || onlineMultiplayer || lastHandReveal) return;
    if (!state) return;
    const readyIds = Object.keys(playerReadyStates);
    if (readyIds.length === 0) return;
    const allReady = state.players
      .filter((p) => !isDeadHandPlayer(p))
      .every((p) => !!playerReadyStates[p.id]);
    if (!allReady) return;
    startNextRound();
  }, [playerReadyStates, roundOver, lastHandReveal, state, onlineMultiplayer]);

  const offlineInitRef = useRef(false);

  useEffect(() => {
    if (onlineMultiplayer || !preferencesLoaded) return;
    if (offlineInitRef.current) return;
    offlineInitRef.current = true;
    try {
      const g = initialLobbyPlayers?.length
        ? createGameFromLobby(initialLobbyPlayers, seedFromProps)
        : createGame(normalizeLobbyNames(initialPlayers, localPlayerName));
      startRoundCeremony(g, []);
    } catch (err) {
      offlineInitRef.current = false;
      console.error("[GameScreen] Offline game init failed", err);
      setSyncError(
        err instanceof Error
          ? err.message
          : "Could not start the game. Try again from the menu.",
      );
    }
  }, [
    onlineMultiplayer,
    preferencesLoaded,
    initialLobbyPlayers,
    initialPlayers,
    localPlayerName,
    seedFromProps,
    startRoundCeremony,
  ]);

  useEffect(() => {
    if (isSocketAdapter(networkAdapter)) {
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
      const parsed = parseServerGameState(raw) as ServerAugmentedState | null;
      if (!parsed) {
        console.warn("[GameScreen] Ignored invalid gameStateSync payload", raw);
        return;
      }

      const roundKey = roundCeremonyKey(parsed);
      const localCeremonyUi =
        !!ceremonyPrepRef.current ||
        !!tradePhaseRef.current ||
        gameplayLockedRef.current;

      const finishSpectator = () => {
        stateSyncedRef.current = true;
        if (typeof spectator === "boolean") {
          setSpectatorMode(spectator);
        } else if (
          localPlayerId &&
          parsed.players.some((p) => p.id === localPlayerId)
        ) {
          setSpectatorMode(false);
        }
      };

      // Mid-trade sync for the current deal only — not a fresh round before ceremony runs.
      if (
        shouldSyncMidTradeFromServer({
          onlineMultiplayer,
          hasPendingTrades: serverStateHasPendingTrades(parsed),
          awaitingDealCeremony: awaitingDealCeremonyRef.current,
          roundOver: roundOverRef.current,
          roundKey,
          ceremonyStartedForRound: ceremonyStartedForRoundRef.current,
          ceremonyDoneForRound: ceremonyDoneForRoundRef.current,
          hasLocalTradePhase: !!tradePhaseRef.current,
        })
      ) {
        const serverHands = parsed.playerHands ?? null;
        if (serverPendingTradesComplete(parsed.pendingTrades)) {
          if (serverHands) {
            pendingTradesCompleteRef.current = serverHands;
          }
          const built = buildTradePhaseFromServerState(parsed, {
            pendingTrades: parsed.pendingTrades,
            roles: parsed.roles,
            playerHands: serverHands,
          });
          const players =
            built?.players ??
            (serverHands
              ? applyServerPlayerHands(parsed.players, serverHands)
              : parsed.players);
          setCeremonyPrep(null);
          setTradePhase(null);
          setActiveTrade(null);
          finalizeCeremonyRound(players, parsed, serverHands);
          ceremonyDoneForRoundRef.current = roundKey;
          ceremonyStartedForRoundRef.current = roundKey;
          finishSpectator();
          return;
        }

        const built = buildTradePhaseFromServerState(parsed, {
          pendingTrades: parsed.pendingTrades,
          roles: parsed.roles,
          playerHands: serverHands,
        });
        if (built) {
          setCeremonyPrep(null);
          setTradePhase(built);
          setActiveTrade(built.trades.find((t) => !t.completed) ?? null);
          setGameplayLocked(true);
          setRoundOver(false);
          setState(parsed);
          ceremonyStartedForRoundRef.current = roundKey;
          finishSpectator();
          return;
        }
      }

      // While local deal/trade animation runs, stash server progress — do not apply live play state.
      if (onlineMultiplayer && localCeremonyUi) {
        if (
          serverPendingTradesComplete(parsed.pendingTrades) &&
          parsed.playerHands
        ) {
          pendingTradesCompleteRef.current = parsed.playerHands;
        }
        const prep = ceremonyPrepRef.current;
        if (prep && parsed.pendingTrades) {
          const merged = mergeTradesFromServerPending(
            prep.trades,
            parsed.pendingTrades,
          );
          if (merged.some((t, i) => t.completed !== prep.trades[i]?.completed)) {
            setCeremonyPrep({ ...prep, trades: merged });
          }
        }
        finishSpectator();
        return;
      }

      if (onlineMultiplayer && !shouldSkipDealCeremony(parsed)) {
        const needsCeremony =
          awaitingDealCeremonyRef.current ||
          (ceremonyDoneForRoundRef.current !== roundKey &&
            ceremonyStartedForRoundRef.current !== roundKey);

        if (needsCeremony) {
          ceremonyStartedForRoundRef.current = roundKey;
          awaitingDealCeremonyRef.current = false;
          const serverPending = parsed.pendingTrades;
          const serverRoles = parsed.roles;
          const serverPlayerHands = parsed.playerHands;
          const roundDealSeed =
            (parsed as GameStateWithDealSeed).dealSeed ??
            pendingDealSeedRef.current ??
            seedFromProps;
          pendingDealSeedRef.current = undefined;

          const finishOrder = livingFinishedOrder(
            parsed.players,
            parsed.lastRoundOrder ?? [],
          );
          const deal = executeCeremonyDeal(parsed, finishOrder, {
            dealSeed: roundDealSeed,
            hostId: resolvedHostId,
          });
          const ceremonyPlayers = serverPlayerHands
            ? applyServerPlayerHands(deal.players, serverPlayerHands)
            : deal.players;
          const trades = resolveCeremonyTrades(
            deal.trades,
            serverPending,
            serverRoles,
            ceremonyPlayers,
          );

          setRoundOver(false);
          setPlayerReadyStates({});
          setAwaitingDealerReshuffle(false);
          const prep: CeremonyPrepPayload = {
            baseState: parsed,
            players: ceremonyPlayers,
            trades,
            dealSeed: roundDealSeed,
            finishOrder,
            needsDealerReshuffle: deal.needsDealerReshuffle,
            dealAttempt: 0,
          };
          launchCeremonyFromDeal(
            prep,
            deal.dealerContext,
            deal.openingPlayerIndex,
          );
          finishSpectator();
          return;
        }
      } else if (onlineMultiplayer && shouldSkipDealCeremony(parsed)) {
        ceremonyDoneForRoundRef.current = roundKey;
        awaitingDealCeremonyRef.current = false;
      }

      const roundCompleteOnServer =
        isRoundCompleteForLiving(parsed) && !parsed.tenRulePending;
      if (onlineMultiplayer && roundCompleteOnServer && !roundOverRef.current) {
        setRoundOver(true);
      }
      if (
        onlineMultiplayer &&
        roundOverRef.current &&
        !roundCompleteOnServer &&
        !ceremonyPrepRef.current &&
        !tradePhaseRef.current &&
        !awaitingDealCeremonyRef.current
      ) {
        clearLastHandReveal();
        setRoundOver(false);
      }

      setState(parsed);
      finishSpectator();
    };

    const requestSync = () => {
      if (!onlineMultiplayer || !isSocketAdapter(networkAdapter) || !roomId) {
        return;
      }
      networkAdapter.requestGameState(roomId);
    };

    void adapter.connect().then(() => {
      requestSync();
      const cachedOnConnect = parseServerGameState(
        isSocketAdapter(networkAdapter)
          ? networkAdapter.getCachedGameState()
          : null,
      );
      if (cachedOnConnect) {
        applyServerSync(cachedOnConnect);
      }
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

    const seatedIds = () => {
      const live = stateRef.current;
      if (!live?.players) return new Set<string>();
      return new Set(
        live.players.filter((p) => !isDeadHandPlayer(p)).map((p) => p.id),
      );
    };

    const onMessage = (ev: NetworkEvent) => {
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
        const playerId = ev.state.playerId as string | undefined;
        if (!playerId || (stateRef.current && !seatedIds().has(playerId))) return;
        if (playerId && ev.state.reason === "left") {
          forfeitPlayerXp(playerId);
        }
        setAwayPlayers((prev) => ({
          ...prev,
          [playerId ?? ""]: {
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
          showRoomNotice(`${ev.state.playerName} rejoined — game resumed`);
        }
        if (onlineMultiplayer && isSocketAdapter(networkAdapter) && roomId) {
          networkAdapter.requestGameState(roomId);
        }
      } else if (ev.type === "state" && ev.state?.type === "lobby") {
        if (typeof ev.state.deadHandSeatOpen === "boolean") {
          setOpenSeatAvailable(ev.state.deadHandSeatOpen);
        }
        const members = ev.state.players;
        if (Array.isArray(members)) {
          if (onlineMultiplayer) {
            setAwayPlayers((prev) => {
              const next: Record<string, AwayPlayer> = {};
              for (const member of members as LobbyMember[]) {
                if (!member.disconnected || member.isSpectator) continue;
                if (stateRef.current && !seatedIds().has(member.id)) continue;
                if (member.awayReason === "left") {
                  forfeitPlayerXp(member.id);
                }
                next[member.id] = {
                  name: member.name,
                  until:
                    typeof member.reconnectUntil === "number"
                      ? member.reconnectUntil
                      : (prev[member.id]?.until ?? Date.now() + 25000),
                  reason:
                    member.awayReason === "left" ? "left" : member.awayReason,
                };
              }
              return next;
            });
          }
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
        const removedId = ev.state.playerId as string | undefined;
        if (removedId) {
          forfeitPlayerXp(removedId);
          setAwayPlayers((prev) => {
            if (!prev[removedId]) return prev;
            const next = { ...prev };
            delete next[removedId];
            return next;
          });
        }
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
        const targetId = ev.state.targetPlayerId;
        if (targetId) {
          triggerNudgeHighlight(targetId);
        }
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
      } else if (ev.type === "state" && ev.state?.type === "botTableRefreshed") {
        resetForBotTableRefresh();
        const note =
          typeof ev.state.message === "string"
            ? ev.state.message
            : "Bot table restarted.";
        showRoomNotice(note);
        if (onlineMultiplayer && isSocketAdapter(networkAdapter) && effectiveRoomId) {
          networkAdapter.requestGameState(effectiveRoomId);
        }
      } else if (ev.type === "state" && ev.state?.type === "roundEnded") {
        const finishOrder = ev.state.finishOrder as string[] | undefined;
        if (finishOrder?.length) {
          setState((current) =>
            current ? { ...current, finishedOrder: finishOrder } : current,
          );
        }
        const lph = ev.state.lastPlayerHand as LastHandRevealPayload | null | undefined;
        if (lph?.playerId && lph.cards?.length) {
          const sameReveal =
            lastHandRevealRef.current?.playerId === lph.playerId &&
            (lastHandRevealRef.current?.cards?.length ?? 0) === lph.cards.length;
          if (!sameReveal) {
            startLastHandReveal({
              playerId: lph.playerId,
              playerName: lph.playerName || "Player",
              cards: lph.cards,
            });
          }
        } else {
          clearLastHandReveal();
        }
        setRoundOver(true);
      } else if (ev.type === "state" && ev.state?.type === "nextRoundStarting") {
        clearLastHandReveal();
        if (onlineMultiplayer) {
          pendingTradesCompleteRef.current = null;
          setCeremonyPrep(null);
          setTradePhase(null);
          setActiveTrade(null);
          setTradeReturnPick([]);
          setGameplayLocked(false);
          setRoundOver(false);
          roundStatsRecordedRef.current = false;
          xpCommittedForRoundRef.current = false;
          setForfeitedXpPlayerIds(new Set());
          setPlayerReadyStates({});
          const promotedIds = Array.isArray(ev.state.promotedPlayerIds)
            ? (ev.state.promotedPlayerIds as string[])
            : ev.state.promotedPlayerId
              ? [ev.state.promotedPlayerId as string]
              : [];
          const localId =
            localPlayerId ??
            (isSocketAdapter(networkAdapter)
              ? networkAdapter.getProfileId()
              : null);
          if (localId && promotedIds.includes(localId)) {
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
      } else if (ev.type === "state" && ev.state?.type === "playerHandsUpdate") {
        const hands = ev.state.playerHands as
          | Record<string, CardType[]>
          | undefined;
        if (!hands) return;
        const tp = tradePhaseRef.current;
        if (tp) {
          const players = applyServerPlayerHands(tp.players, hands);
          const gs = stateRef.current as ServerAugmentedState | null;
          const trades = gs?.pendingTrades
            ? mergeTradesFromServerPending(tp.trades, gs.pendingTrades)
            : tp.trades;
          setTradePhase({ ...tp, players, trades });
          setActiveTrade(trades.find((t) => !t.completed) ?? null);
        }
        if (stateRef.current) {
          setState({
            ...stateRef.current,
            players: applyServerPlayerHands(stateRef.current.players, hands),
          });
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
          const localId = myPlayerIdRef.current;
          const loserTrade = tp.trades.find((t) => t.loserId === localId);
          let returned = loserTrade?.returnedCards;
          if (loserTrade && !returned?.length) {
            const loser = tp.players.find((p) => p.id === loserTrade.loserId);
            const oldHand = loser?.hand ?? [];
            const newHand = hands[loserTrade.loserId] ?? [];
            returned = newHand.filter(
              (c) =>
                !oldHand.some((h) => h.suit === c.suit && h.value === c.value),
            );
            loserTrade.returnedCards = returned;
          }
          for (const t of tp.trades) {
            t.completed = true;
          }
          for (const p of tp.players) {
            if (hands[p.id]) p.hand = hands[p.id];
          }
          if (loserTrade && returned?.length) {
            setTradePhase({ ...tp, players: [...tp.players], trades: [...tp.trades] });
            setActiveTrade(loserTrade);
            scheduleTradeReturnRevealRef.current(returned, loserTrade, () =>
              finalizeCeremonyRoundRef.current(tp.players, tp.baseState, hands),
            );
          } else {
            finalizeCeremonyRoundRef.current(tp.players, tp.baseState, hands);
          }
        }
      }
      // Legacy support for MockAdapter — only apply full game snapshots.
      else if (ev.type === "state" && isFullGameState(ev.state)) {
        emitDebug("adapter:state", {
          incomingStateSummary: summarizeState(ev.state),
        });
        setState(ev.state);
      }
    };

    adapter.on("message", onMessage);

    return () => {
      if (typeof adapter.off === "function") {
        adapter.off("message", onMessage);
      }
      if (syncRetryTimerRef.current) {
        clearInterval(syncRetryTimerRef.current);
        syncRetryTimerRef.current = null;
      }
      if (!networkAdapter) {
        void fallbackAdapterRef.current?.disconnect();
      }
    };
  }, [
    onlineMultiplayer,
    roomId,
    networkAdapter,
    localPlayerId,
    preferencesLoaded,
    startLastHandReveal,
    clearLastHandReveal,
    resetForBotTableRefresh,
    forfeitPlayerXp,
    triggerNudgeHighlight,
    resolvedHostId,
    launchCeremonyFromDeal,
    seedFromProps,
    effectiveRoomId,
    onlineMultiplayer,
  ]);

  useEffect(() => {
    if (!roundOver) {
      setLocalCareerXp(null);
      setCareerXpByPlayerId({});
      setScoreboardCareerXpLoading(false);
      return;
    }
    if (!state) return;

    let cancelled = false;
    setScoreboardCareerXpLoading(true);

    void (async () => {
      const living = state.players.filter((p) => !isDeadHandPlayer(p));
      const baselines: Record<string, number> = {};

      const localStats = await getPlayerStats();
      if (!cancelled && myPlayerId) {
        setLocalCareerXp(localStats.xp);
      }

      await Promise.all(
        living.map(async (player) => {
          if (player.id === myPlayerId) return;
          if (isCpuPlayer(player)) return;
          const cloud = await fetchCloudPlayerStats(player.id);
          if (cloud) {
            baselines[player.id] = cloud.xp;
          }
        }),
      );

      if (!cancelled) {
        setCareerXpByPlayerId(baselines);
        setScoreboardCareerXpLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roundOver, state, myPlayerId]);

  /** Persist tallied round XP when the scoreboard opens (not during play). */
  useEffect(() => {
    if (!roundOver || !state || xpCommittedForRoundRef.current) return;
    const id = myPlayerId;
    if (!id || forfeitedXpPlayerIds.has(id)) {
      xpCommittedForRoundRef.current = true;
      return;
    }
    if (localCareerXp === null) return;

    const earned = roundXpByPlayerId[id] ?? 0;
    xpCommittedForRoundRef.current = true;
    if (earned <= 0) return;

    const tricksWon = (state.trickHistory ?? []).filter((t) => {
      const winnerId =
        t.winnerId ??
        state.players.find((p) => p.name === t.winnerName)?.id;
      return winnerId === id;
    }).length;

    void commitRoundXpEarned(earned, tricksWon);
  }, [
    roundOver,
    state,
    myPlayerId,
    localCareerXp,
    roundXpByPlayerId,
    forfeitedXpPlayerIds,
  ]);

  useEffect(() => {
    if (!tradePhase || onlineMultiplayer) return;

    const players = tradePhase.players;
    const trades = tradePhase.trades;
    const changed = autoCompleteCpuWinnerTrades(players, trades);
    if (!changed) return;

    if (allTradesCompleted(trades)) {
      const localId = myPlayerIdRef.current;
      const revealTrade = trades.find(
        (t) =>
          t.loserId === localId && (t.returnedCards?.length ?? 0) > 0,
      );
      if (revealTrade?.returnedCards?.length) {
        scheduleTradeReturnReveal(
          revealTrade.returnedCards,
          revealTrade,
          () => finalizeCeremonyRound(players, tradePhase.baseState),
        );
      } else {
        finalizeCeremonyRound(players, tradePhase.baseState);
      }
      return;
    }

    const nextTrade = trades.find((t) => !t.completed) ?? null;
    setTradePhase({ ...tradePhase, players: [...players], trades: [...trades] });
    setActiveTrade(nextTrade);
  }, [tradePhase, onlineMultiplayer, finalizeCeremonyRound, scheduleTradeReturnReveal]);

  // CPU auto-play effect (offline only — online uses authoritative server state)
  useEffect(() => {
    if (!state || trickPauseActive || gameplayLocked || roundOver) return;
    if (onlineMultiplayer) return;

    if (state.tenRulePending) {
      const chooserIdx = tenRuleChooserIndex(state);
      if (chooserIdx == null) return;
      const chooser = state.players[chooserIdx];
      if (!chooser || isDeadHandPlayer(chooser)) return;

      const isNamedCPU = isCpuPlayer(chooser) && !(humanPlayer && chooser.id === humanPlayer.id);
      if (!isNamedCPU) return;

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

    if (isTrickAcknowledgmentPassPhase(state)) {
      const ackCpus = state.players
        .map((p, index) => ({ p, index }))
        .filter(({ p }) => {
          if (!isCpuPlayer(p)) return false;
          if (humanPlayer && p.id === humanPlayer.id) return false;
          return canAcknowledgmentPass(state, p.id);
        })
        .sort((a, b) => a.index - b.index)
        .map(({ p }) => p);
      if (ackCpus.length === 0) return;

      const timers = ackCpus.map((cpu, i) =>
        setTimeout(() => {
          const live = stateRef.current;
          if (!live || trickPauseActiveRef.current || gameplayLockedRef.current || roundOverRef.current) {
            return;
          }
          if (!canAcknowledgmentPass(live, cpu.id)) return;
          const nextState = passTurn(live, cpu.id);
          if (nextState !== live) {
            emitDebug("action:pass:cpu:ack", {
              playerId: cpu.id,
              playerName: cpu.name,
              before: snapshotState(live),
              after: snapshotState(nextState),
            });
            setState(nextState);
          }
        }, CPU_DELAY_MS + i * 40),
      );
      return () => timers.forEach(clearTimeout);
    }

    const current = state.players[state.currentPlayerIndex];
    if (!current) return;

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

    let isCPU = isCpuPlayer(current);
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

  useEffect(() => {
    if (!state) return;
    if (!tradeReturnRevealActive || tradeReturnFlight) return;
    const pending = tradeReturnRevealPendingRef.current;
    if (!pending) return;

    const fallback = setTimeout(() => {
      if (tradeReturnRevealPendingRef.current) {
        finishTradeReturnReveal();
      }
    }, 1400);

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
        reservedBottomHeight(insets.bottom || 0, handReserveForLayout, shellHeight),
    );
    const playAreaLayout =
      playAreaSize.width <= 0 || playAreaGameHeight <= 0
        ? null
        : computePlayAreaLayout(
            playAreaSize.width,
            playAreaGameHeight,
            tableSeats.layoutSeatCount,
            shellHeight,
          );
    const ceremonyPlayAreaLayout =
      livePlayAreaMetrics?.layout ?? playAreaLayout;
    const ceremonyPlayAreaHeight =
      livePlayAreaMetrics?.height ?? playAreaGameHeight;
    const localControlledIds = humanPlayer ? [humanPlayer.id] : [];

    const receive = receiveSlotRectRef.current;
    const playArea = playAreaScreenRectRef.current;
    const layout = ceremonyPlayAreaLayout ?? playAreaLayout;
    const height = ceremonyPlayAreaHeight || playAreaGameHeight;
    if (!receive || !playArea || !layout || height <= 0) {
      return () => clearTimeout(fallback);
    }

    const from = seatOriginInPlayArea(
      layout,
      height,
      pending.trade.winnerId,
      tableSeats.layoutSeatIds,
      localControlledIds,
      { deadHandId: tableSeats.deadHandId },
    );
    if (!from) {
      clearTimeout(fallback);
      finishTradeReturnReveal();
      return;
    }

    clearTimeout(fallback);
    setTradeReturnFlight({
      id: `trade-return-${pending.trade.key}`,
      cards: pending.cards,
      fromX: playArea.x + from.x,
      fromY: playArea.y + from.y,
      toX: receive.x + receive.width / 2,
      toY: receive.y + receive.height / 2,
      cardW: 52,
      cardH: 74,
    });

    return () => clearTimeout(fallback);
  }, [
    state,
    tradeReturnRevealActive,
    tradeReturnFlight,
    livePlayAreaMetrics,
    playAreaSize,
    insets.top,
    insets.bottom,
    humanPlayer,
    myPlayerId,
    gameplayLocked,
    finishTradeReturnReveal,
    tradeReturnLayoutTick,
    shellHeight,
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
      reservedBottomHeight(insets.bottom || 0, handReserveForLayout, shellHeight),
  );
  const playAreaLayout =
    playAreaSize.width <= 0 || playAreaGameHeight <= 0
      ? null
      : computePlayAreaLayout(
          playAreaSize.width,
          playAreaGameHeight,
          tableSeats.layoutSeatCount,
          shellHeight,
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
        awaitingDealerReshuffle,
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
        lastHandReveal,
        clearLastHandReveal,
        trickPauseActive,
        trickPauseSnapshot,
        showWinnerBanner,
        stackCollecting,
        tableRenderKey,
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
        effectiveRoomId,
        localPlayerId,
        readOnlyGame,
        bannerNotice,
        disconnectedPlayerIds,
        resolvedHostId,
        handRef,
        handleDealComplete,
        handleDealerReshuffle,
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
        tradeReturnFlight,
        tradeReturnReceiveLanded,
        tradeReturnRevealActive,
        onReceiveSlotMeasure,
        onPlayAreaScreenMeasure,
        finishTradeReturnReveal,
        scoreboardRoundXpByPlayerId,
        readOnlyOnline,
        onBack,
        turnBellPlayerId,
        handleTurnBellPress,
        nudgeHighlightPlayerId,
        resolveSeatFeltTint,
        scoreboardXpByPlayerId,
        roundXpByPlayerId,
        xpAnimationReady,
        maybeStartNextOfflineRound,
        lastTrickLenRef,
        localAvatarBorder,
        openSeatAvailable,
        isBotOpenTable,
        handleRefreshBotTable,
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
    awaitingDealerReshuffle,
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
    lastHandReveal,
    clearLastHandReveal,
    trickPauseActive,
    trickPauseSnapshot,
    showWinnerBanner,
    stackCollecting,
    tableRenderKey,
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
    effectiveRoomId,
    localPlayerId,
    readOnlyGame,
    bannerNotice,
    disconnectedPlayerIds,
    resolvedHostId,
    handRef,
    handleDealComplete,
    handleDealerReshuffle,
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
    tradeReturnFlight,
    tradeReturnReceiveLanded,
    tradeReturnRevealActive,
    onReceiveSlotMeasure,
    onPlayAreaScreenMeasure,
    finishTradeReturnReveal,
    readOnlyOnline,
    onBack,
    turnBellPlayerId,
    handleTurnBellPress,
    nudgeHighlightPlayerId,
    resolveSeatFeltTint,
    scoreboardXpByPlayerId,
    scoreboardRoundXpByPlayerId,
    roundXpByPlayerId,
    xpAnimationReady,
    maybeStartNextOfflineRound,
    lastTrickLenRef,
    localAvatarBorder,
    openSeatAvailable,
    isBotOpenTable,
    handleRefreshBotTable,
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
      needsDealerReshuffle?: boolean;
      dealAttempt?: number;
      skipDealPhases?: boolean;
    } | null;
    awaitingDealerReshuffle: boolean;
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
    lastHandReveal: LastHandRevealPayload | null;
    clearLastHandReveal: () => void;
    trickPauseActive: boolean;
    trickPauseSnapshot: TrickPauseSnapshot | null;
    showWinnerBanner: boolean;
    stackCollecting: boolean;
    tableRenderKey: number;
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
    effectiveRoomId: string | undefined;
    localPlayerId: string | undefined;
    readOnlyGame: boolean;
    bannerNotice: string | null;
    disconnectedPlayerIds: string[];
    resolvedHostId: string | null;
    handRef: React.RefObject<PlayerHandHandle>;
    handleDealComplete: () => void;
    handleDealerReshuffle: () => void;
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
    tradeReturnFlight: CardFlightSpec | null;
    tradeReturnReceiveLanded: boolean;
    tradeReturnRevealActive: boolean;
    onReceiveSlotMeasure: (rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => void;
    onPlayAreaScreenMeasure: (rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => void;
    finishTradeReturnReveal: () => void;
    readOnlyOnline: boolean;
    onBack: (() => void) | undefined;
    turnBellPlayerId: string | null;
    handleTurnBellPress: (playerId: string) => void;
    nudgeHighlightPlayerId: string | null;
    resolveSeatFeltTint: (player: { id: string; name: string }) => string | undefined;
    scoreboardXpByPlayerId: Record<string, number>;
    scoreboardRoundXpByPlayerId: Record<string, number>;
    roundXpByPlayerId: Record<string, number>;
    xpAnimationReady: boolean;
    maybeStartNextOfflineRound: (readyMap: Record<string, boolean>) => void;
    lastTrickLenRef: React.MutableRefObject<number>;
    localAvatarBorder: AvatarBorderDesign | null;
    openSeatAvailable: boolean;
    isBotOpenTable: boolean;
    handleRefreshBotTable: () => void;
  };

  const [ceremonyDealCounts, setCeremonyDealCounts] = useState<
    Record<string, number>
  >({});
  const [ceremonyDealProgress, setCeremonyDealProgress] = useState<{
    phase: "shuffle" | "deal" | "trade" | "done";
    dealRound: number;
    flightActive: boolean;
  }>({ phase: "done", dealRound: 0, flightActive: false });
  const [ceremonyStatusText, setCeremonyStatusText] = useState<string | null>(
    null,
  );
  const ceremonyControlsRef = useRef<{ completeShuffle: () => void } | null>(
    null,
  );
  const handleCeremonyControls = useCallback(
    (controls: { completeShuffle: () => void }) => {
      ceremonyControlsRef.current = controls;
    },
    [],
  );
  const { ui, blur } = useAppTheme();
  const playAreaHostRef = useRef<View>(null);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [showPlayerProfile, setShowPlayerProfile] = useState(false);
  const [remoteAvatarBordersByPlayerId, setRemoteAvatarBordersByPlayerId] =
    useState<Record<string, AvatarBorderDesign>>({});

  const onlineHumanPlayerKey = useMemo(() => {
    if (!onlineMultiplayer) return "";
    return state.players
      .filter((p) => !isDeadHandPlayer(p) && !isCpuPlayer(p))
      .map((p) => p.id)
      .sort()
      .join("\0");
  }, [onlineMultiplayer, state.players]);

  useEffect(() => {
    if (!onlineMultiplayer || !onlineHumanPlayerKey) {
      setRemoteAvatarBordersByPlayerId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const borders: Record<string, AvatarBorderDesign> = {};
      const humans = state.players.filter(
        (p) => !isDeadHandPlayer(p) && !isCpuPlayer(p),
      );
      await Promise.all(
        humans.map(async (player) => {
          if (player.id === myPlayerId) return;
          const cloud = await fetchCloudPlayerStats(player.id);
          if (!cloud) return;
          const border = resolveAvatarBorder(cloud);
          if (border) borders[player.id] = border;
        }),
      );
      if (!cancelled) setRemoteAvatarBordersByPlayerId(borders);
    })();
    return () => {
      cancelled = true;
    };
  }, [onlineMultiplayer, onlineHumanPlayerKey, myPlayerId, state.players]);

  const handlePlayerProfilePress = useCallback(
    (playerId: string) => {
      const player = state.players.find((p) => p.id === playerId);
      if (!player || isDeadHandPlayer(player)) return;
      setProfilePlayerId(playerId);
      setShowPlayerProfile(true);
    },
    [state.players],
  );

  const profilePlayer = useMemo((): LobbyProfilePlayer | null => {
    if (!profilePlayerId) return null;
    const player = state.players.find((p) => p.id === profilePlayerId);
    if (!player || isDeadHandPlayer(player)) return null;
    const isLocal =
      profilePlayerId === myPlayerId || profilePlayerId === humanPlayer?.id;
    return {
      id: player.id,
      name: player.name,
      isCPU: isCpuPlayer(player),
      isLocalPlayer: isLocal,
      isHostSeat: resolvedHostId === player.id,
    };
  }, [
    profilePlayerId,
    state.players,
    myPlayerId,
    humanPlayer?.id,
    resolvedHostId,
  ]);

  useEffect(() => {
    if (!ceremonyPrep) {
      setCeremonyStatusText(null);
    }
  }, [ceremonyPrep]);

  useEffect(() => {
    if (!ceremonyPrep) {
      setCeremonyDealCounts({});
      return;
    }
    setCeremonyDealCounts({});
  }, [ceremonyPrep?.dealAttempt, ceremonyPrep?.dealSeed]);

  const avatarBordersByPlayerId = useMemo(() => {
    const borders: Record<string, AvatarBorderDesign> = {};
    if (localAvatarBorder && myPlayerId) {
      borders[myPlayerId] = localAvatarBorder;
    }
    if (!onlineMultiplayer) {
      for (const player of state.players) {
        if (!isCpuPlayer(player)) continue;
        const border = getCpuAvatarBorder(player);
        if (border) borders[player.id] = border;
      }
      return borders;
    }
    Object.assign(borders, remoteAvatarBordersByPlayerId);
    return borders;
  }, [
    localAvatarBorder,
    myPlayerId,
    state.players,
    onlineMultiplayer,
    remoteAvatarBordersByPlayerId,
  ]);

  const runXpPoolAmount = useMemo(() => {
    if (
      !state ||
      trickPauseActive ||
      ceremonyPrep ||
      tradePhase ||
      gameplayLocked
    ) {
      return null;
    }
    const info = activeRunXpPoolInfo(state, RUN_CARD_XP);
    return info.poolXp > 0 ? info.poolXp : null;
  }, [
    state,
    trickPauseActive,
    ceremonyPrep,
    tradePhase,
    gameplayLocked,
  ]);

  const ceremonyCountFor = (playerId: string) =>
    ceremonyPrep ? (ceremonyDealCounts[playerId] ?? 0) : null;

  // const windowDimensions = useWindowDimensions();
  // const width = windowDimensions.width;
  // const height = windowDimensions.height;
  // const landscape = isLandscape(width, height);
  
  const inCeremony = !!ceremonyPrep || !!tradePhase || gameplayLocked;
  const ceremonyDealerContext = buildDealerContext({
    hostId: resolvedHostId,
    finishOrder: ceremonyPrep?.finishOrder,
    lastRoundOrder:
      ceremonyPrep?.finishOrder ?? ceremonyPrep?.baseState.lastRoundOrder,
    roles: Object.fromEntries(
      (ceremonyPrep?.players ?? state.players)
        .filter((p) => !isDeadHandPlayer(p) && p.role !== "Neutral")
        .map((p) => [p.id, p.role]),
    ),
  });
  const ceremonyDealerId = resolveDealerId(
    ceremonyPrep?.players ?? state.players,
    ceremonyDealerContext,
  );
  const isCeremonyDealer = !!(myPlayerId && ceremonyDealerId === myPlayerId);
  const ceremonyTotalCards = useMemo(() => {
    if (!ceremonyPrep) return FULL_DECK_SIZE;
    return ceremonyPrep.players.reduce(
      (sum, p) =>
        sum +
        (isDeadHandPlayer(p)
          ? (p.sidelinedHand?.length ?? p.hand.length)
          : p.hand.length),
      0,
    );
  }, [ceremonyPrep]);
  const showLocalDealerHandZone =
    !!ceremonyPrep &&
    isCeremonyDealer &&
    (ceremonyDealProgress.phase === "shuffle" ||
      ceremonyDealProgress.phase === "deal");
  const localDealStackCount = useMemo(() => {
    if (!showLocalDealerHandZone) return 0;
    const { phase, dealRound, flightActive } = ceremonyDealProgress;
    if (phase === "shuffle") return ceremonyTotalCards;
    if (phase !== "deal") return 0;
    return Math.max(
      0,
      ceremonyTotalCards - dealRound - (flightActive ? 1 : 0),
    );
  }, [showLocalDealerHandZone, ceremonyDealProgress, ceremonyTotalCards]);
  const playCenterLayout = ceremonyPlayAreaLayout ?? playAreaLayout;
  let current = state.players[state.currentPlayerIndex];
  if (!current && inCeremony) {
    current =
      state.players.find((p) => !isDeadHandPlayer(p)) ?? state.players[0];
  }
  /** Hide who leads until deal + mandatory trades finish (state may still track opener). */
  const revealTurnHighlight = !inCeremony;
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
  const turnHighlightPlayerId = revealTurnHighlight ? current.id : "";

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

  const humanCanAckPass =
    !!myPlayerId &&
    canAcknowledgmentPass(state, myPlayerId) &&
    !trickPauseActive &&
    !currentIsOut &&
    !state.tenRulePending;
  const isHumanPassEligible = isHumanTurn || humanCanAckPass;
  const localHumanId = myPlayerId ?? humanPlayer?.id;

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
  const effectiveTenRule = resolveEffectiveTenRule(state);

  const selectedCanPlay =
    selectedCards.length > 0 &&
    isValidPlay(
      selectedCards,
      state.pile,
      effectiveTenRule,
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
      effectiveTenRule,
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
    isHumanPassEligible &&
    !roundOver &&
    !hasAnyValidPlay &&
    !!(localHumanId && !hasPassedInCurrentTrick(state, localHumanId));

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
    if (roundOver || trickPauseActive || readOnlyGame) return;
    if (!isHumanPassEligible) return;
    const actor =
      (myPlayerId && state.players.find((p) => p.id === myPlayerId)) ?? current;
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
  const localCeremonyDeal = !!(ceremonyPrep && humanPlayer);
  const localPlayerOut =
    !!humanPlayer && state.finishedOrder.includes(humanPlayer.id);
  const handInBottomBar = handVisible && !gameplayLocked;
  /** Keep bottom chrome height stable when the local player is out (hand hidden). */
  const handReserveActive =
    handInBottomBar || localPlayerOut || showLocalDealerHandZone;
  const { height: viewportHeight, width: shellWidth } = useVisualViewportSize();
  const windowWidth = useWindowDimensions().width;
  const handMetrics = useMemo(
    () => resolveHandMetrics(viewportHeight),
    [viewportHeight],
  );
  const localHandDealTarget = useMemo(() => {
    if (!localCeremonyDeal || !isCeremonyDealer) return null;
    return localHandShuffleScreenCenter(
      shellWidth || windowWidth,
      viewportHeight,
      bottomOuterPad(insets.bottom),
    );
  }, [
    localCeremonyDeal,
    isCeremonyDealer,
    shellWidth,
    windowWidth,
    viewportHeight,
    insets.bottom,
  ]);
  const localHandDealCardSize = useMemo(
    () =>
      localCeremonyDeal && isCeremonyDealer
        ? {
            width: handMetrics.cardWidth,
            height: handMetrics.cardHeight,
          }
        : null,
    [localCeremonyDeal, isCeremonyDealer, handMetrics.cardWidth, handMetrics.cardHeight],
  );
  const bottomBarHeight = reservedBottomHeight(
    insets.bottom || 0,
    handReserveActive,
    viewportHeight,
  );
  const contentTopPadding = insets.top + 8;
  const trickPlays = buildTrickPlayDisplays(state);
  const activeLastPlayId = lastPlayPlayerId(state);

  const displayPlays: TrickPlayDisplay[] =
    trickPauseActive && trickPauseSnapshot
      ? trickPauseSnapshot.plays
      : trickPlays;

  const trickPauseFrozen = trickPauseActive;

  const opponentPlayers = state.players.map((p) => ({
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
    trickPauseActive && trickPauseSnapshot?.winnerId
      ? trickPauseSnapshot.winnerId
      : null;
  const trickWinnerXpAmount =
    trickWinnerPlayerId && trickPauseSnapshot
      ? TRICK_WIN_XP + trickPauseSnapshot.runBonusXp
      : undefined;
  const trickWinnerShout =
    trickWinnerPlayerId && trickPauseSnapshot
      ? pickTrickShout(
          trickWinnerPlayerId,
          trickPauseSnapshot.trickIndex,
          trickPauseSnapshot.runBonusXp > 0,
        )
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

  // Compute labels for the play-type pills (count + modifier on one row).
  function getPlayTypePills(): {
    countLabel: string | null;
    modifierLabel: string | null;
  } {
    if (!state) return { countLabel: null, modifierLabel: null };

    let modifierLabel: string | null = null;

    if (state.runOnTop?.active) modifierLabel = "On top!";

    if (state.fourOfAKindChallenge?.active) {
      modifierLabel = state.fourOfAKindChallenge.completedAcrossTurns
        ? "Rank Closed!"
        : "Quads!";
    }

    const hasPile = !!state.pile && state.pile.length > 0;
    if (!hasPile) {
      return { countLabel: null, modifierLabel };
    }

    const { inRunContext, runMultiplicity } = resolveRunContext(
      state.pile,
      state.pileHistory,
      state.currentTrick,
      state.players,
      state.finishedOrder || [],
    );

    if (!modifierLabel) {
      if (inRunContext) {
        modifierLabel = "Runs!";
      } else if (state.tenRulePending) {
        modifierLabel = "10 - Choose!";
      } else if (state.pile.some((c) => isJoker(c))) {
        modifierLabel = "Joker!";
      } else if (state.tenRule?.active && state.tenRule.direction) {
        const dir =
          state.tenRule.direction === "higher"
            ? "Higher"
            : state.tenRule.direction === "lower"
              ? "Lower"
              : state.tenRule.direction;
        modifierLabel = `10 - ${dir}!`;
      }
    }

    const playCount = inRunContext ? runMultiplicity : state.pile.length;
    const countLabel =
      playCount === 1
        ? null
        : playCount === 2
          ? "Doubles"
          : playCount === 3
            ? "Triples"
            : playCount === 4
              ? "Quads"
              : inRunContext
                ? `${playCount}x`
                : `${playCount} Of a Kind`;

    return { countLabel, modifierLabel };
  }

  const playTypePills = getPlayTypePills();
  const playCountLabel =
    playTypePills.countLabel && !trickPauseFrozen
      ? playTypePills.countLabel
      : null;
  const playModifierLabel =
    playTypePills.modifierLabel && !trickPauseFrozen
      ? playTypePills.modifierLabel
      : null;

  const turnHintText =
    ceremonyPrep && ceremonyStatusText
      ? ceremonyStatusText
      : gameplayLocked && !tradePhase
        ? ceremonyStatusText ?? "Dealing cards…"
        : revealTurnHighlight &&
            !tradePhase &&
            !readOnlyOnline &&
            !awaitingDealerReshuffle &&
            !trickPauseActive &&
            !roundOver
          ? isHumanTurn
            ? "Your turn"
            : formatWaitingForTurnHint(current.name)
          : null;

  const turnHintFlash = turnHintText === "Your turn";

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
          style={[local.topHeaderRow, { top: contentTopPadding + 4 }]}
          pointerEvents="box-none"
        >
          <View style={local.topHeaderSpacer} />
          {onNavigateToSettings || onNavigateToAchievements ? (
            <View style={local.topFabRow}>
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
          ) : (
            <View style={local.topHeaderSpacer} />
          )}
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
        ref={playAreaHostRef}
        style={{
          flex: 1,
          position: "relative",
          paddingHorizontal: 12,
          paddingTop: contentTopPadding,
          paddingBottom: bottomBarHeight,
        }}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setPlayAreaSize((prev) =>
            prev.width === width && prev.height === height ? prev : { width, height },
          );
          playAreaHostRef.current?.measureInWindow((x, y, w, h) => {
            onPlayAreaScreenMeasure({ x, y, width: w, height: h });
          });
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
          trickWinnerXpAmount={trickWinnerXpAmount}
          trickWinnerShout={trickWinnerShout}
          avatarBordersByPlayerId={avatarBordersByPlayerId}
          playCountLabel={playCountLabel}
          playModifierLabel={playModifierLabel}
          runXpPoolAmount={runXpPoolAmount}
          turnHintText={turnHintText}
          turnHintFlash={turnHintFlash}
          tableSeatCount={tableSeats.layoutSeatCount}
          deadHandId={tableSeats.deadHandId}
          layoutSeatIds={tableSeats.layoutSeatIds}
          deadHandGraveyard={deadHandGraveyard}
          disconnectedPlayerIds={disconnectedPlayerIds}
          turnBellPlayerId={turnBellPlayerId}
          onTurnBellPress={handleTurnBellPress}
          nudgeHighlightPlayerId={nudgeHighlightPlayerId}
          dealtStackCounts={ceremonyPrep ? ceremonyDealCounts : undefined}
          onPlayerPress={handlePlayerProfilePress}
          onPlayAreaMetrics={setLivePlayAreaMetrics}
        >
          <GameTable
            key={tableRenderKey}
            plays={displayPlays}
            collectToStack={trickPauseActive && stackCollecting}
            collectDurationMs={trickStackCollectMs}
            fadeOut={trickPauseActive && showWinnerBanner}
          />
        </GamePlayArea>
        {awaitingDealerReshuffle &&
        playCenterLayout &&
        playCenterLayout.playAnchorX > 0 &&
        playCenterLayout.playAnchorY > 0 ? (
          <View
            style={[
              local.dealerReshuffleOverlay,
              {
                left: playCenterLayout.playAnchorX - 36,
                top: playCenterLayout.playAnchorY - 36,
              },
            ]}
            pointerEvents="box-none"
          >
            <DealerReshuffleButton
              visible={isCeremonyDealer}
              onPress={handleDealerReshuffle}
            />
          </View>
        ) : null}
      </View>

      {/* Player hand + actions — sticky bottom sheet */}
      <BottomBar>
        {handInBottomBar ? (
          <BottomBarHand
            height={handMetrics.fanHeight + handMetrics.handZoneTopClearance}
            controlsGap={handMetrics.handControlsGap}
          >
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
        ) : showLocalDealerHandZone ? (
          <BottomBarHand
            height={handMetrics.fanHeight + handMetrics.handZoneTopClearance}
            controlsGap={handMetrics.handControlsGap}
          >
            <View style={local.ceremonyHandDeck} pointerEvents="none">
              {ceremonyDealProgress.phase === "shuffle" ? (
                <DealShuffleAnimation
                  embedded
                  cardW={handMetrics.cardWidth}
                  cardH={handMetrics.cardHeight}
                  left={0}
                  top={0}
                  deckCount={ceremonyTotalCards}
                  running
                  durationMs={DEAL_CEREMONY_SHUFFLE_MS}
                  onComplete={() => ceremonyControlsRef.current?.completeShuffle()}
                />
              ) : localDealStackCount > 0 ? (
                <DealHandStack
                  count={localDealStackCount}
                  cardWidth={handMetrics.cardWidth}
                  cardHeight={handMetrics.cardHeight}
                  deckSize={ceremonyTotalCards}
                />
              ) : null}
            </View>
          </BottomBarHand>
        ) : null}

        <BottomBarControls>
          {tradePhase && activeTrade ? (
            <>
              <RoleTradeStrip
                trade={activeTrade}
                localPlayerId={myPlayerId}
                selectedReturn={tradeReturnPick}
                hideReceiveCard={tradeReturnRevealActive && !tradeReturnReceiveLanded}
                receiveLanded={tradeReturnReceiveLanded}
                onReceiveSlotMeasure={onReceiveSlotMeasure}
              />
              {activeTrade.winnerId !== myPlayerId && !activeTrade.completed ? (
                <View style={[local.waitingPill, local.waitingPillCollapsed]}>
                  <Text style={local.waitingPillText}>
                    Waiting for {activeTrade.winnerName} to pick return cards…
                  </Text>
                </View>
              ) : null}
              {activeTrade.loserId === myPlayerId &&
              activeTrade.completed &&
              tradeReturnRevealActive &&
              !tradeReturnReceiveLanded ? (
                <View style={[local.waitingPill, local.waitingPillCollapsed]}>
                  <Text style={local.waitingPillText}>Receiving return card…</Text>
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
              <View style={local.spectatorActionRow}>
                {isBotOpenTable ? (
                  <TouchableOpacity
                    style={[ui.btnSecondary, local.spectatorSecondaryBtn]}
                    onPress={handleRefreshBotTable}
                    accessibilityRole="button"
                    accessibilityLabel="Restart bot table"
                  >
                    <Text style={ui.btnSecondaryText}>Restart bots</Text>
                  </TouchableOpacity>
                ) : null}
                {onBack ? (
                  <BottomBarLeave
                    live
                    onPress={requestLeaveGame}
                    label="Leave"
                  />
                ) : null}
              </View>
            </>
          ) : awaitingDealerReshuffle ? (
            <View style={[local.waitingPill, local.waitingPillCollapsed]}>
              <Text style={local.waitingPillText}>
                {isCeremonyDealer
                  ? "All four 3s on the dead hand — tap Reshuffle in the center"
                  : "All four 3s on the dead hand — waiting for dealer to reshuffle…"}
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
            passDisabled={
              gameplayLocked ||
              !isHumanPassEligible ||
              roundOver ||
              mustLeadOpening ||
              !!(localHumanId && hasPassedInCurrentTrick(state, localHumanId))
            }
            isPlayerTurn={isHumanPassEligible && !roundOver && !gameplayLocked}
            noValidPlays={noValidPlays}
            onTopTurn={humanRunOnTopTurn}
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
        key={`deal-${ceremonyPrep?.dealSeed ?? 0}-${ceremonyPrep?.dealAttempt ?? 0}`}
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
            ? (() => {
                const counts = ceremonyPrep.players.map((p) =>
                  isDeadHandPlayer(p)
                    ? (p.sidelinedHand?.length ?? p.hand.length)
                    : p.hand.length,
                );
                return counts.length > 0 ? Math.max(...counts, 1) : 13;
              })()
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
        skipDealPhases={!!ceremonyPrep?.skipDealPhases}
        onDealComplete={handleDealComplete}
        onDealtCountsChange={setCeremonyDealCounts}
        onDealProgressChange={setCeremonyDealProgress}
        onStatusTextChange={setCeremonyStatusText}
        localHandShuffleCenter={localHandDealTarget}
        localHandShuffleCardSize={localHandDealCardSize}
        localHandDealTarget={localHandDealTarget}
        localHandDealCardSize={localHandDealCardSize}
        localDealerDeckInHandZone
        onCeremonyControls={handleCeremonyControls}
      />

      <RoleTradeModal
        visible={
          !!tradePhase &&
          !!activeTrade &&
          !activeTrade.completed &&
          !tradeReturnRevealActive
        }
        trade={activeTrade}
        hand={
          tradePhase?.players.find((p) => p.id === activeTrade?.winnerId)
            ?.hand ?? []
        }
        isWinner={!!myPlayerId && activeTrade?.winnerId === myPlayerId}
        onSelectionChange={setTradeReturnPick}
        onConfirm={handleTradeConfirm}
      />

      {tradeReturnFlight ? (
        <View style={local.tradeReturnFlightLayer} pointerEvents="none">
          <TableCardFlight
            flight={tradeReturnFlight}
            durationMs={TRADE_RETURN_FLIGHT_MS}
            onComplete={() => finishTradeReturnReveal()}
          />
        </View>
      ) : null}

      <LastHandRevealOverlay
        visible={!!lastHandReveal}
        playerName={lastHandReveal?.playerName ?? ""}
        cards={lastHandReveal?.cards ?? []}
        onDismiss={clearLastHandReveal}
      />

      <RoundCompleteModal
        visible={roundOver && !lastHandReveal && !ceremonyPrep && !tradePhase}
        finishedOrder={state.finishedOrder.filter((id) =>
          state.players.some(
            (p) => p.id === id && !isDeadHandPlayer(p),
          ),
        )}
        players={state.players.filter((p) => !isDeadHandPlayer(p))}
        readyStates={playerReadyStates}
        playerXp={scoreboardXpByPlayerId}
        playerRoundXp={scoreboardRoundXpByPlayerId}
        xpAnimationReady={xpAnimationReady}
        localPlayerId={myPlayerId ?? undefined}
        spectatorMode={spectatorMode}
        deadHandSeatOpen={
          state.players.some(isDeadHandPlayer) || openSeatAvailable
        }
        onQuit={requestLeaveGame}
        onToggleReady={() => {
          const id = myPlayerId;
          if (!id) return;
          const nextReady = !playerReadyStates[id];
          if (onlineMultiplayer && isSocketAdapter(networkAdapter) && effectiveRoomId) {
            if (nextReady) {
              networkAdapter.playerReadyForNextRound(effectiveRoomId);
            }
            setPlayerReadyStates((prev) => ({ ...prev, [id]: nextReady }));
            return;
          }
          setPlayerReadyStates((prev) => {
            const next = { ...prev, [id]: nextReady };
            if (nextReady) {
              maybeStartNextOfflineRound(next);
            }
            return next;
          });
        }}
      />

      <LeaveGameConfirmModal
        visible={leaveConfirmVisible}
        onCancel={cancelLeaveGame}
        onConfirm={confirmLeaveGame}
      />

      <LobbyPlayerModal
        visible={showPlayerProfile}
        player={profilePlayer}
        colors={colors}
        ui={ui}
        blur={blur}
        onClose={() => setShowPlayerProfile(false)}
      />
      
    </ScreenContainer>
  );
}

export default GameScreen;

const local = StyleSheet.create({
  container: { flex: 1 },
  topHeaderRow: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 40,
  },
  topHeaderSpacer: {
    flex: 1,
  },
  topFabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  ceremonyStatusPill: {
    flexShrink: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: "72%",
  },
  ceremonyStatusText: {
    color: "#d4af37",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  ceremonyHandDeck: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
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
  dealerReshuffleOverlay: {
    position: "absolute",
    zIndex: 58,
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
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
  tradeReturnFlightLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5000,
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
  spectatorActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 4,
  },
  spectatorSecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
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
