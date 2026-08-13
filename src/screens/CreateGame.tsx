import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  Animated,
  Easing,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { useGamePreferences } from "../hooks/useGamePreferences";

const KeyboardShell =
  Platform.OS === "web" ? View : KeyboardAvoidingView;
const keyboardShellProps =
  Platform.OS === "web"
    ? ({ style: { flex: 1 } } as const)
    : ({
        style: { flex: 1 },
        behavior: Platform.OS === "ios" ? ("padding" as const) : undefined,
      } as const);

import ScreenContainer from "../components/ScreenContainer";
import BlurPanel from "../components/BlurPanel";
import MenuIcon from "../components/MenuIcon";
import LobbyStatusBar, {
  LOBBY_STATUS_BAR_HEIGHT,
  LOBBY_STACK_BAR_HEIGHT,
} from "../components/LobbyStatusBar";
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  bottomOuterPad,
} from "../components/BottomBar";
import OpponentSeat from "../components/OpponentSeat";
import LobbyPlayerModal from "../components/LobbyPlayerModal";
import { NetworkAdapter, MockAdapter, type LobbyMember } from "../game/network";
import { isSocketAdapter } from "../game/socketAdapter";
import { getOrCreatePlayerId } from "../services/gameCenter";
import { triggerHaptic } from "../utils/haptics";
import { validateDisplayText, displayTextError, isValidDisplayText } from "../utils/profanityFilter";
import { generateRoomCode } from "../utils/roomCode";
import { DEAD_HAND_ID, DEAD_HAND_NAME } from "../game/deadHand";
import { ACTION_BAR_HEIGHT } from "../components/ActionBar";
import { useAppTheme } from "../context/ThemeContext";
import { copyToClipboard } from "../utils/clipboard";
import { BUTTON_CENTER, buttonLabel } from "../styles/buttonStyles";
import { hexToRgba } from "../utils/colorTheory";
import type { AppThemeColors } from "../styles/themeColors";
import { polarSeatPosition, ringAngleForSeat, sideAnchorMarginForWidth } from "../utils/tableLayout";
import {
  isBotDisplayName,
  makeCpuPlayerId,
  pickCpuDisplayName,
  pickCpuDisplayNames,
  resolveCpuTierInNameOrder,
} from "../utils/cpuNames";
import { isCpuPlayer } from "../utils/localPlayer";
const MIN_PLAYERS = 2;
const MIN_PLAYERS_FULL_TABLE = 3;
const MAX_PLAYERS = 8;
const LOBBY_SEAT_W = 88;
const LOBBY_SEAT_H = 92;
const LOBBY_RING_R = 104;
const LOBBY_ADD_CPU_W = 76;
const LOBBY_ADD_CPU_H = 92;
const CAPSULE_RADIUS = 999;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function defaultRoomNameFromHost(hostName: string): string {
  const trimmed = hostName.trim();
  if (!trimmed) return "Game Room";
  return `${trimmed}'s Room`;
}

/** Evenly spaced circle — seat 0 at bottom, then clockwise. */
function lobbyRingSlotPositions(
  containerW: number,
  containerH: number,
  totalPlayers: number,
  seatW = LOBBY_SEAT_W,
  seatH = LOBBY_SEAT_H,
): Array<{ left: number; top: number }> {
  if (totalPlayers <= 0) return [];

  const cx = containerW / 2;
  const cy = containerH / 2;
  const margin = 6;
  const radius = Math.min(
    containerW / 2 - seatW / 2 - margin,
    containerH / 2 - seatH / 2 - margin,
  );

  const sideMargin = sideAnchorMarginForWidth(containerW, containerW >= 640);

  return Array.from({ length: totalPlayers }, (_, index) => {
    const angle = ringAngleForSeat(index, totalPlayers);
    return polarSeatPosition(
      angle,
      cx,
      cy,
      radius,
      0,
      containerW,
      containerH,
      seatW,
      seatH,
      { sideAnchorMargin: sideMargin, anchorSides: true },
    );
  });
}

type LobbyRingLayout = {
  width: number;
  height: number;
  seatW: number;
  seatH: number;
  compactSeats: boolean;
};

function lobbyRingLayout(
  contentWidth: number,
  areaHeight: number,
  totalPlayers: number,
): LobbyRingLayout {
  const width = Math.min(contentWidth - 8, 320);
  let seatScale = 1;
  if (totalPlayers >= 8) seatScale = 0.68;
  else if (totalPlayers >= 6) seatScale = 0.78;
  else if (totalPlayers >= 5) seatScale = 0.86;
  else if (totalPlayers >= 4) seatScale = 0.93;

  const seatW = Math.round(LOBBY_SEAT_W * seatScale);
  const seatH = Math.round(LOBBY_SEAT_H * seatScale);
  const idealHeight = LOBBY_RING_R * 2 * seatScale + seatH + 12;

  let height = idealHeight;
  if (areaHeight > 0 && idealHeight > areaHeight) {
    const fitScale = Math.max(
      0.55,
      (areaHeight - seatH - 12) / (LOBBY_RING_R * 2),
    );
    seatScale = Math.min(seatScale, fitScale);
    height = areaHeight;
  }

  const finalSeatW = Math.round(LOBBY_SEAT_W * seatScale);
  const finalSeatH = Math.round(LOBBY_SEAT_H * seatScale);
  const finalHeight = Math.min(
    areaHeight > 0 ? areaHeight : idealHeight,
    LOBBY_RING_R * 2 * seatScale + finalSeatH + 12,
  );

  return {
    width,
    height: Math.max(finalHeight, finalSeatH + 24),
    seatW: finalSeatW,
    seatH: finalSeatH,
    compactSeats: seatScale < 0.92,
  };
}

const BOTTOM_CPU_ROW_HEIGHT = 78;
const BOTTOM_BAR_TOP_PAD = 18;

function lobbyBottomReserve(safeBottom = 0): number {
  return (
    ACTION_BAR_HEIGHT +
    BOTTOM_CPU_ROW_HEIGHT +
    BOTTOM_BAR_TOP_PAD +
    16 +
    bottomOuterPad(safeBottom) +
    8
  );
}

function RoomNameInput({
  value,
  onCommit,
  onEditingChange,
  validate,
  inputStyle,
  wrapStyle,
  wrapFocusedStyle,
  hintStyle,
}: {
  value: string;
  onCommit: (name: string) => void;
  onEditingChange?: (editing: boolean) => void;
  validate?: (text: string) => string | null;
  inputStyle: TextStyle;
  wrapStyle: ViewStyle | ViewStyle[];
  wrapFocusedStyle: ViewStyle;
  hintStyle: TextStyle;
}) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  const draftRef = useRef(value);
  const skipNextBlurCommitRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
      draftRef.current = value;
    }
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = draftRef.current.trim() || "Game Room";
    const err = validate?.(trimmed);
    if (err) {
      Alert.alert("Not Allowed", err);
      setDraft(value);
      draftRef.current = value;
      return;
    }
    if (trimmed !== draftRef.current) {
      setDraft(trimmed);
      draftRef.current = trimmed;
    }
    onCommit(trimmed);
  }, [onCommit, validate, value]);

  return (
    <View style={[wrapStyle, focused && wrapFocusedStyle]}>
      <TextInput
        ref={inputRef}
        placeholder="Enter Room Name"
        placeholderTextColor={colors.textQuaternary}
        value={draft}
        onChangeText={setDraft}
        onFocus={() => {
          focusedRef.current = true;
          setFocused(true);
          onEditingChange?.(true);
        }}
        onBlur={() => {
          focusedRef.current = false;
          setFocused(false);
          onEditingChange?.(false);
          if (skipNextBlurCommitRef.current) {
            skipNextBlurCommitRef.current = false;
            return;
          }
          commit();
        }}
        onSubmitEditing={() => {
          skipNextBlurCommitRef.current = true;
          commit();
          inputRef.current?.blur();
          if (Platform.OS !== "web") {
            Keyboard.dismiss();
          }
        }}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        selectTextOnFocus={Platform.OS !== "web"}
        blurOnSubmit
        style={inputStyle}
      />
      <Text style={hintStyle} pointerEvents="none">
        ✎
      </Text>
    </View>
  );
}

function DismissKeyboardArea({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  if (Platform.OS === "web") {
    return <View style={style}>{children}</View>;
  }
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={style}>{children}</View>
    </TouchableWithoutFeedback>
  );
}

export default function CreateGame({
  onBack,
  onStart,
  adapter,
  isJoining = false,
  onNavigateToSettings,
  onNavigateToAchievements,
  joinRoomId,
  onRoomReady,
  onLobbyMembersChange,
  preferredPlayerName,
}: {
  onBack: () => void;
  onStart: (
    lobby: LobbyMember[],
    localPlayerName: string,
    localSocketId?: string,
    dealSeed?: number,
  ) => void;
  adapter?: NetworkAdapter;
  isJoining?: boolean;
  onNavigateToSettings?: () => void;
  onNavigateToAchievements?: () => void;
  joinRoomId?: string;
  onRoomReady?: (roomId: string, roomName?: string) => void;
  onLobbyMembersChange?: (members: LobbyMember[]) => void;
  preferredPlayerName?: string;
}) {
  const { colors, ui, blur, feltTint: localFeltTint } = useAppTheme();
  const { skipDealAnimations } = useGamePreferences();
  const local = useMemo(() => createLocalStyles(colors), [colors]);
  const [names, setNames] = useState<string[]>([]);
  const [cpuBotNames, setCpuBotNames] = useState<string[]>([]);
  const cpuBotNamesRef = useRef<string[]>([]);
  cpuBotNamesRef.current = cpuBotNames;
  const cpuBotNameSet = useMemo(() => new Set(cpuBotNames), [cpuBotNames]);
  const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[]>([]);
  const lobbyMembersRef = useRef<LobbyMember[]>([]);
  const playerNameRef = useRef("");
  const playerIdRef = useRef<string | null>(null);
  const localIdRef = useRef<string | null>(null);
  const [roomName, setRoomName] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerNameReady, setPlayerNameReady] = useState(false);
  const [localId, setLocalId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("disconnected");
  const [actualRoomId, setActualRoomId] = useState<string | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [selectedLobbyIndex, setSelectedLobbyIndex] = useState<number | null>(null);
  const [lobbyNotice, setLobbyNotice] = useState<string | null>(null);
  const [tableAreaHeight, setTableAreaHeight] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);
  const codeCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lobbyNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomNameEditingRef = useRef(false);
  const roomNameTouchedRef = useRef(false);
  const roomCreatedRef = useRef(false);

  const showLobbyNotice = (message: string) => {
    setLobbyNotice(message);
    if (lobbyNoticeTimerRef.current) {
      clearTimeout(lobbyNoticeTimerRef.current);
    }
    lobbyNoticeTimerRef.current = setTimeout(() => {
      setLobbyNotice(null);
      lobbyNoticeTimerRef.current = null;
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (lobbyNoticeTimerRef.current) {
        clearTimeout(lobbyNoticeTimerRef.current);
      }
      if (codeCopiedTimerRef.current) {
        clearTimeout(codeCopiedTimerRef.current);
      }
    };
  }, []);

  const mockRef = useRef<MockAdapter | null>(null);
  if (!adapter && !mockRef.current) {
    mockRef.current = new MockAdapter();
  }
  const net = adapter ?? mockRef.current!;

  const { width, height: windowHeight } = useWindowDimensions();
  const insets = useLayoutInsets();
  const topBarHeight = insets.top + LOBBY_STACK_BAR_HEIGHT;
  const bottomBarHeight = lobbyBottomReserve(insets.bottom || 0);

  const usingMock = !adapter || !isSocketAdapter(adapter);
  const onlineLobby = isSocketAdapter(adapter);
  const isHost = usingMock || (localId != null && hostId != null && localId === hostId);

  const seatMembers = useMemo((): LobbyMember[] => {
    if (usingMock) {
      return names.map((name, index) => {
        const isBot = isBotDisplayName(name, cpuBotNameSet);
        const tier = isBot
          ? resolveCpuTierInNameOrder(name, names, cpuBotNameSet)
          : null;
        return {
          id:
            isBot && tier
              ? makeCpuPlayerId(tier)
              : `mock-${index}-${name}`,
          name,
          feltTint: isBot ? undefined : localFeltTint,
        };
      });
    }
    return lobbyMembers;
  }, [usingMock, names, cpuBotNameSet, lobbyMembers, localFeltTint]);

  const seatCount = seatMembers.length;
  const showDeadHandSeat = onlineLobby && seatCount === MIN_PLAYERS;
  const displaySeatMembers = useMemo((): LobbyMember[] => {
    if (!showDeadHandSeat) return seatMembers;
    return [
      ...seatMembers,
      { id: DEAD_HAND_ID, name: DEAD_HAND_NAME },
    ];
  }, [seatMembers, showDeadHandSeat]);
  const displaySeatCount = displaySeatMembers.length;
  const canEditRoom = isHost;
  const canStart =
    isHost &&
    (usingMock ? seatCount >= MIN_PLAYERS_FULL_TABLE : seatCount >= MIN_PLAYERS);

  const playersNeeded = Math.max(0, MIN_PLAYERS - seatCount);
  const lobbyFullEnough = seatCount >= MIN_PLAYERS;
  const localMember = seatMembers.find((m) => m.id === localId);
  const localIsSpectator = !!localMember?.isSpectator;
  const isLocalReady = !!localMember?.ready;
  const guestMembers = seatMembers.filter((m) => m.id !== hostId);
  const guestsReadyCount = guestMembers.filter((m) => m.ready).length;
  const allGuestsReady =
    guestMembers.length > 0 && guestMembers.every((m) => m.ready);
  const hostWaitingForGuests =
    onlineLobby && isHost && lobbyFullEnough && !allGuestsReady;
  const showGuestReadyAction = onlineLobby && !isHost && lobbyFullEnough;
  const showReadyAction = showGuestReadyAction;

  const readyFlash = useRef(new Animated.Value(0)).current;

  const handleRoomNameCommit = useCallback(
    (name: string) => {
      roomNameTouchedRef.current = true;
      const check = validateDisplayText(name, "Room name");
      if (!isValidDisplayText(check)) {
        Alert.alert("Not Allowed", check.reason);
        return;
      }
      setRoomName(check.value);
      if (!usingMock && adapter && isSocketAdapter(adapter) && actualRoomId) {
        adapter.updateRoomName(actualRoomId, check.value);
      }
    },
    [adapter, actualRoomId, usingMock],
  );

  const validateRoomName = useCallback((text: string) => {
    return displayTextError(validateDisplayText(text, "Room name"));
  }, []);

  const displayRoomName = useMemo(() => {
    const trimmed = roomName.trim();
    if (trimmed) return trimmed;
    if (isHost || usingMock) {
      return defaultRoomNameFromHost(playerName) || "Game Room";
    }
    return "Game Room";
  }, [roomName, playerName, isHost, usingMock]);

  const partyCount = Math.max(1, seatCount);

  const contentMaxWidth = Math.min(520, Math.max(320, width - 24));
  const estimatedTableHeight = Math.max(
    180,
    windowHeight - topBarHeight - bottomBarHeight - 160,
  );
  const effectiveTableHeight = tableAreaHeight || estimatedTableHeight;
  const ringLayout = useMemo(
    () =>
      lobbyRingLayout(contentMaxWidth, effectiveTableHeight, displaySeatCount),
    [contentMaxWidth, effectiveTableHeight, displaySeatCount],
  );
  const ringPositions = useMemo(
    () =>
      lobbyRingSlotPositions(
        ringLayout.width,
        ringLayout.height,
        displaySeatCount,
        ringLayout.seatW,
        ringLayout.seatH,
      ),
    [
      ringLayout.width,
      ringLayout.height,
      ringLayout.seatW,
      ringLayout.seatH,
      displaySeatCount,
    ],
  );

  const handleCopyRoomCode = useCallback(async () => {
    if (!actualRoomId) return;
    triggerHaptic("light");
    const ok = await copyToClipboard(actualRoomId);
    if (!ok) {
      Alert.alert("Copy Failed", "Could not copy the room code.");
      return;
    }
    setCodeCopied(true);
    if (codeCopiedTimerRef.current) {
      clearTimeout(codeCopiedTimerRef.current);
    }
    codeCopiedTimerRef.current = setTimeout(() => {
      setCodeCopied(false);
      codeCopiedTimerRef.current = null;
    }, 1800);
  }, [actualRoomId]);

  const lobbyPlayers = useMemo(
    () =>
      displaySeatMembers.map((member, index) => {
        const isDeadHandSeat = member.id === DEAD_HAND_ID;
        const isCPU = !isDeadHandSeat && isCpuPlayer(member);
        const isLocalPlayer =
          !isDeadHandSeat &&
          (usingMock
            ? !isCPU && index === 0
            : localId != null && member.id === localId);
        const isHostSeat =
          !isDeadHandSeat &&
          (usingMock
            ? index === 0
            : hostId != null && member.id === hostId);
        const memberReady =
          !isDeadHandSeat &&
          !usingMock &&
          !!seatMembers.find((m) => m.id === member.id)?.ready;
        return {
          id: member.id,
          name: member.name,
          handCount: 0,
          role: "Neutral" as const,
          isCPU,
          isHostSeat,
          isLocalPlayer,
          isDeadHandSeat,
          ready: memberReady,
          feltTint: member.feltTint,
        };
      }),
    [displaySeatMembers, seatMembers, usingMock, localId, hostId],
  );

  const selectedPlayer =
    typeof selectedLobbyIndex === "number"
      ? lobbyPlayers[selectedLobbyIndex] ?? null
      : null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const playerInfo = await getOrCreatePlayerId();
      if (mounted) {
        setPlayerId(playerInfo.id);
        setPlayerName(playerInfo.displayName);
        setPlayerNameReady(true);
      }
      if (playerInfo.source === "fallback") {
        setTimeout(async () => {
          const updatedInfo = await getOrCreatePlayerId();
          if (mounted) {
            setPlayerId(updatedInfo.id);
            setPlayerName(updatedInfo.displayName);
          }
        }, 2000);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (adapter && isSocketAdapter(adapter)) {
      adapter.setFeltTint(localFeltTint);
    }
  }, [adapter, localFeltTint]);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    const next = preferredPlayerName?.trim();
    if (!next) return;
    setPlayerName(next);
    playerNameRef.current = next;
  }, [preferredPlayerName]);

  useEffect(() => {
    if (
      isJoining ||
      roomCreatedRef.current ||
      roomNameTouchedRef.current ||
      roomNameEditingRef.current
    ) {
      return;
    }
    const hostName = playerName.trim();
    if (!hostName) return;
    setRoomName(defaultRoomNameFromHost(hostName));
  }, [playerName, isJoining]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    localIdRef.current = localId;
  }, [localId]);

  useEffect(() => {
    lobbyMembersRef.current = lobbyMembers;
  }, [lobbyMembers]);

  useEffect(() => {
    let mounted = true;
    const applyLobbyFromServer = (
      players: LobbyMember[],
      host: string | null,
      serverRoomName?: string,
    ) => {
      const active = players.filter((p) => !p.disconnected);
      setLobbyMembers(active);
      lobbyMembersRef.current = active;
      setNames(active.map((p) => p.name));
      setHostId(host ?? null);
      setConnectionStatus("connected");
      if (
        typeof serverRoomName === "string" &&
        serverRoomName &&
        !roomNameEditingRef.current
      ) {
        setRoomName(serverRoomName);
      }
      onLobbyMembersChange?.(active);
    };

    net.on("message", (ev) => {
      if (!mounted) return;
      if (ev.type === "state" && ev.state?.type === "lobby") {
        if (onlineLobby) {
          applyLobbyFromServer(
            ev.state.players as LobbyMember[],
            ev.state.host ?? null,
            ev.state.roomName as string | undefined,
          );
        }
      }
      if (ev.type === "state" && ev.state?.type === "startGame") {
        // Navigation is handled globally in App.tsx so guests still in the lobby receive it.
        if (adapter && isSocketAdapter(adapter) && actualRoomId) {
          adapter.requestGameState(actualRoomId);
        }
      }
      if (ev.type === "state" && ev.state?.type === "connected") {
        if (onlineLobby) {
          // Server seat id is authoritative (may differ from local profile id).
          if (typeof ev.state.id === "string" && ev.state.id) {
            setLocalId(ev.state.id);
            localIdRef.current = ev.state.id;
            playerIdRef.current = ev.state.id;
            setConnectionStatus("connected");
          }
        } else {
          const myProfileId = playerIdRef.current;
          if (myProfileId && ev.state.id === myProfileId) {
            setLocalId(ev.state.id);
            localIdRef.current = ev.state.id;
            if (usingMock) setHostId(ev.state.id);
            setConnectionStatus("connected");
          } else if (
            usingMock &&
            typeof ev.state.name === "string" &&
            cpuBotNamesRef.current.includes(ev.state.name) &&
            actualRoomId
          ) {
            (net as MockAdapter).toggleReady(actualRoomId, ev.state.id, true);
          }
        }
      }
      if (ev.type === "state" && ev.state?.type === "playerRemoved") {
        const playerName = ev.state.playerName as string | undefined;
        const reason = ev.state.reason as string | undefined;
        if (playerName) {
          showLobbyNotice(
            reason === "kicked"
              ? `${playerName} was removed from the lobby`
              : reason === "disconnected"
                ? `${playerName} left the room`
                : `${playerName} left the lobby`,
          );
        }
        if (onlineLobby) {
          setLobbyMembers((prev) => {
            const next = prev.filter((p) => p.id !== ev.state.playerId);
            lobbyMembersRef.current = next;
            setNames(next.map((p) => p.name));
            return next;
          });
        }
      }
      if (ev.type === "state" && ev.state?.type === "playerDisconnected") {
        const playerName = ev.state.playerName as string | undefined;
        if (playerName) {
          showLobbyNotice(`${playerName} disconnected — waiting to reconnect…`);
        }
      }
      if (ev.type === "state" && ev.state?.type === "hostMigrated") {
        setHostId(ev.state.newHost ?? null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [adapter, net, usingMock, onlineLobby, onStart, onBack, actualRoomId, onLobbyMembersChange]);

  useEffect(() => {
    if (!actualRoomId || !adapter || !isSocketAdapter(adapter)) return;
    adapter.setActiveRoomId(actualRoomId);
  }, [adapter, actualRoomId]);

  useEffect(() => {
    if (!playerNameReady || roomCreatedRef.current) return;
    let mounted = true;
    (async () => {
      try {
        if (adapter) {
          setConnectionStatus("connecting");
          await adapter.connect();
          if (!isJoining && (adapter as any).createRoom) {
            roomCreatedRef.current = true;
            const code = generateRoomCode();
            const displayName =
              roomName.trim() ||
              defaultRoomNameFromHost(playerName) ||
              "Game Room";
            const roomTitleCheck = validateDisplayText(displayName, "Room name");
            const title = roomTitleCheck.ok ? roomTitleCheck.value : "Game Room";
            const nameCheck = validateDisplayText(playerName, "Player name");
            if (!isValidDisplayText(nameCheck)) {
              Alert.alert("Not Allowed", nameCheck.reason);
              roomCreatedRef.current = false;
              return;
            }
            (adapter as any).createRoom(code, nameCheck.value, title);
            setActualRoomId(code);
            if (!roomName.trim()) {
              setRoomName(title);
            }
            if (!roomTitleCheck.ok) {
              setRoomName("Game Room");
            }
            onRoomReady?.(code, title);
          } else if (joinRoomId) {
            setActualRoomId(joinRoomId);
            onRoomReady?.(joinRoomId);
          }
        } else {
          if (roomCreatedRef.current) return;
          roomCreatedRef.current = true;
          setConnectionStatus("connecting");
          const m = mockRef.current!;
          const rid = generateRoomCode();
          const hostName = playerName.trim() || "Player";
          m.createRoom(rid, hostName);
          setActualRoomId(rid);
          const defaultBots = pickCpuDisplayNames(2, [hostName]);
          setNames([hostName, ...defaultBots]);
          setCpuBotNames(defaultBots);
          if (!roomName.trim()) {
            setRoomName(defaultRoomNameFromHost(hostName));
          }
          setConnectionStatus("connected");
        }
      } catch {
        if (mounted) setConnectionStatus("disconnected");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [playerNameReady]);

  const addCpu = () => {
    if (!usingMock) return;
    if (names.length >= MAX_PLAYERS) return;
    const cpuName = pickCpuDisplayName(names);
    setNames((s) => [...s, cpuName]);
    setCpuBotNames((s) => [...s, cpuName]);
  };

  const canRemovePlayer = (member: LobbyMember, isCPU: boolean) => {
    if (isCPU) return usingMock;
    if (!isHost || !localId) return false;
    return member.id !== localId;
  };

  const removePlayerAt = (index: number) => {
    const member = seatMembers[index];
    if (!member) return;

    const isCPU = isCpuPlayer(member);
    if (!canRemovePlayer(member, isCPU)) return;

    triggerHaptic("light");
    if (isCPU) {
      setNames((s) => s.filter((_, i) => i !== index));
      setCpuBotNames((s) => s.filter((n) => n !== member.name));
    } else if (adapter && isSocketAdapter(adapter) && actualRoomId) {
      adapter.kickPlayer(actualRoomId, member.name);
    } else {
      setNames((s) => s.filter((_, i) => i !== index));
    }
  };

  const removeCpu = () => {
    const lastBotName = [...names]
      .reverse()
      .find((n) => cpuBotNameSet.has(n));
    if (lastBotName !== undefined) {
      setNames((s) => s.filter((n) => n !== lastBotName));
      setCpuBotNames((s) => s.filter((n) => n !== lastBotName));
    }
  };

  const handleLeave = () => {
    if (onlineLobby && actualRoomId && isSocketAdapter(adapter)) {
      if (isHost) {
        adapter.dismissRoom(actualRoomId);
      } else {
        adapter.leaveRoom(actualRoomId);
      }
    }
    onBack();
  };

  const handleStart = () => {
    triggerHaptic("heavy");
    if (usingMock) {
      onStart(seatMembers, playerName, seatMembers[0]?.id);
      return;
    }
    if (adapter && isSocketAdapter(adapter) && isHost && actualRoomId) {
      adapter.startGame(actualRoomId, skipDealAnimations);
    }
  };

  const handleToggleReady = () => {
    if (!actualRoomId || !localId) return;
    triggerHaptic("light");
    const nextReady = !isLocalReady;
    if (adapter && isSocketAdapter(adapter)) {
      adapter.toggleReady(actualRoomId, localId, nextReady);
    } else if (usingMock) {
      (net as MockAdapter).toggleReady(actualRoomId, localId, nextReady);
    }
  };

  const handlePrimaryAction = () => {
    if (showReadyAction) {
      handleToggleReady();
      return;
    }
    handleStart();
  };

  const primaryDisabled = usingMock
    ? !canStart
    : showReadyAction
      ? false
      : isHost
        ? !lobbyFullEnough || !allGuestsReady
        : !lobbyFullEnough;

  const showReadyFlash = showReadyAction && !isLocalReady && !primaryDisabled;

  useEffect(() => {
    if (!showReadyFlash) {
      readyFlash.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(readyFlash, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(readyFlash, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showReadyFlash, readyFlash]);

  const primaryLabel = usingMock
    ? "Start Game"
    : isHost
      ? "Start Game"
      : isLocalReady
        ? "Unready"
        : "Ready";

  const actionHint = (() => {
    if (usingMock && !canStart) {
      const need = Math.max(0, MIN_PLAYERS_FULL_TABLE - seatCount);
      if (need <= 0) return null;
      return need === 1
        ? "Need 1 more player to start"
        : `Need ${need} more players to start`;
    }
    if (!onlineLobby) return null;
    if (isHost && !lobbyFullEnough) {
      return playersNeeded === 1
        ? "Need 1 more player to start"
        : `Need ${playersNeeded} more players to start`;
    }
    if (hostWaitingForGuests) {
      return `Waiting for all players to ready up (${guestsReadyCount}/${guestMembers.length})…`;
    }
    if (!isHost && !lobbyFullEnough) {
      if (seatCount === 0 && connectionStatus !== "connected") {
        return "Joining lobby…";
      }
      return playersNeeded === 1
        ? "Waiting for 1 more player"
        : `Waiting for ${playersNeeded} more players`;
    }
    return null;
  })();

  const tableStatusText = onlineLobby
    ? localIsSpectator
      ? "Spectating this round"
      : seatCount < MIN_PLAYERS
        ? "Waiting for players"
        : showDeadHandSeat
          ? "Table ready — dead hand open for a third"
          : `${seatCount} at the table`
    : seatCount < MIN_PLAYERS_FULL_TABLE
      ? `Need ${MIN_PLAYERS_FULL_TABLE} to start`
      : `${seatCount} at the table`;

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <LobbyStatusBar
        variant="lobby"
        hideStatus
        playerCount={partyCount}
        roomName={displayRoomName}
        statusLabel=""
        statusValue=""
        topInset={insets.top}
      />

      {lobbyNotice ? (
        <View style={[local.lobbyNoticeBanner, { top: topBarHeight + 6 }]}>
          <Text style={local.lobbyNoticeText}>{lobbyNotice}</Text>
        </View>
      ) : null}

      {onNavigateToAchievements || onNavigateToSettings ? (
        <View
          style={[local.utilHost, { top: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <View style={local.utilRow}>
            {onNavigateToAchievements ? (
              <TouchableOpacity
                style={local.utilBtn}
                onPress={onNavigateToAchievements}
                accessibilityRole="button"
                accessibilityLabel="Stats"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MenuIcon name="trophy" size={16} color={colors.accent} />
              </TouchableOpacity>
            ) : null}
            {onNavigateToSettings ? (
              <TouchableOpacity
                style={local.utilBtn}
                onPress={onNavigateToSettings}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MenuIcon name="gear" size={16} color={colors.accent} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      <KeyboardShell {...keyboardShellProps}>
        <DismissKeyboardArea
          style={{
            flex: 1,
            paddingTop: topBarHeight + 10,
            paddingBottom: bottomBarHeight,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              flex: 1,
              alignItems: "center",
              paddingBottom: 4,
            }}
          >
            <View style={{ width: contentMaxWidth, flex: 1 }}>
              {(onlineLobby && actualRoomId) || canEditRoom || localIsSpectator ? (
                <BlurPanel intensity={48} style={local.inviteCard}>
                  {onlineLobby && actualRoomId ? (
                    <>
                      <Text style={local.inviteEyebrow}>Invite Friends</Text>
                      <TouchableOpacity
                        style={[
                          local.codeCapsule,
                          codeCopied && local.codeCapsuleCopied,
                        ]}
                        onPress={handleCopyRoomCode}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={`Copy room code ${actualRoomId}`}
                      >
                        <Text style={local.codeCapsuleText} numberOfLines={1}>
                          {codeCopied ? "Copied!" : actualRoomId}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                  {canEditRoom ? (
                    <RoomNameInput
                      value={displayRoomName}
                      onCommit={handleRoomNameCommit}
                      validate={validateRoomName}
                      onEditingChange={(editing) => {
                        roomNameEditingRef.current = editing;
                        if (editing) {
                          roomNameTouchedRef.current = true;
                        }
                      }}
                      inputStyle={local.roomInput}
                      wrapStyle={[
                        local.roomInputWrap,
                        onlineLobby && actualRoomId
                          ? local.roomInputWrapSpaced
                          : null,
                      ]}
                      wrapFocusedStyle={local.roomInputWrapFocused}
                      hintStyle={local.roomInputHint}
                    />
                  ) : null}
                  {onlineLobby && localIsSpectator ? (
                    <Text style={local.supportNote}>
                      Spectating — Ready to take a seat next round
                    </Text>
                  ) : null}
                </BlurPanel>
              ) : null}

                <View
                  style={local.tableArea}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (h > 0) {
                      setTableAreaHeight((prev) =>
                        Math.abs(prev - h) > 2 ? h : prev,
                      );
                    }
                  }}
                >
                  <View style={local.statusChip}>
                    <Text style={local.statusChipText}>{tableStatusText}</Text>
                  </View>

                  <View
                    style={[
                      local.seatRing,
                      {
                        width: ringLayout.width,
                        height: ringLayout.height,
                      },
                    ]}
                  >
                    {usingMock && names.length < MAX_PLAYERS ? (
                      <TouchableOpacity
                        style={[
                          local.emptySeat,
                          {
                            width: Math.round(LOBBY_ADD_CPU_W * (ringLayout.seatW / LOBBY_SEAT_W)),
                            height: Math.round(LOBBY_ADD_CPU_H * (ringLayout.seatH / LOBBY_SEAT_H)),
                            left:
                              (ringLayout.width -
                                Math.round(LOBBY_ADD_CPU_W * (ringLayout.seatW / LOBBY_SEAT_W))) /
                              2,
                            top:
                              (ringLayout.height -
                                Math.round(LOBBY_ADD_CPU_H * (ringLayout.seatH / LOBBY_SEAT_H))) /
                              2,
                          },
                        ]}
                        onPress={addCpu}
                        accessibilityLabel="Add CPU Player"
                      >
                        <Text style={local.emptySeatPlus}>+</Text>
                        <Text style={local.emptySeatLabel}>Add CPU</Text>
                      </TouchableOpacity>
                    ) : null}

                    {lobbyPlayers.map((seat, index) => {
                      const pos = ringPositions[index];
                      if (!pos) return null;

                      const isCPU = seat.isCPU;
                      const isDeadHandSeat = seat.isDeadHandSeat;
                      const canRemove = !isDeadHandSeat && canRemovePlayer(
                        { id: seat.id, name: seat.name },
                        isCPU,
                      );

                      return (
                        <View
                          key={seat.id}
                          style={[
                            local.seatSlot,
                            {
                              left: pos.left,
                              top: pos.top,
                              width: ringLayout.seatW,
                            },
                          ]}
                        >
                          {isDeadHandSeat ? (
                            <View
                              style={[
                                local.deadHandSeat,
                                {
                                  width: ringLayout.seatW,
                                  minHeight: ringLayout.seatH,
                                },
                              ]}
                            >
                              <Text style={local.deadHandSeatIcon}>🃏</Text>
                              <Text style={local.deadHandSeatLabel}>Open Seat</Text>
                            </View>
                          ) : (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => {
                              if (isDeadHandSeat) return;
                              setSelectedLobbyIndex(index);
                              setShowPlayerModal(true);
                            }}
                            onLongPress={() => {
                              const options: {
                                text: string;
                                style?: "destructive" | "cancel";
                                onPress?: () => void;
                              }[] = [
                                {
                                  text: "Report",
                                  onPress: () =>
                                    Alert.alert(
                                      "Reported",
                                      `${seat.name} has been reported.`,
                                    ),
                                },
                              ];
                              if (canRemove) {
                                options.unshift({
                                  text: "Remove",
                                  style: "destructive",
                                  onPress: () => removePlayerAt(index),
                                });
                              }
                              options.push({ text: "Cancel", style: "cancel" });
                              Alert.alert(seat.name, undefined, options);
                            }}
                            style={local.seatTapTarget}
                          >
                            <OpponentSeat
                              player={{
                                id: seat.id,
                                name: seat.name,
                                handCount: 0,
                                role: "Neutral",
                                feltTint: seat.feltTint,
                              }}
                              isLocal={seat.isLocalPlayer}
                              isActive={false}
                              isOut={false}
                              hasPassed={false}
                              isThinking={isCPU}
                              isReady={seat.ready}
                              compact={ringLayout.compactSeats}
                              layoutWidth={ringLayout.width}
                            />
                            {seat.isHostSeat ? (
                              <View style={local.hostBadgePill}>
                                <Text style={local.hostBadgeText}>Host</Text>
                              </View>
                            ) : null}
                          </TouchableOpacity>
                          )}

                          {canRemove ? (
                            <TouchableOpacity
                              style={local.removeSeatBtn}
                              onPress={() => removePlayerAt(index)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${seat.name}`}
                            >
                              <Text style={local.removeSeatBtnText}>−</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
            </View>
          </View>
        </DismissKeyboardArea>
      </KeyboardShell>

      <BottomBar>
        <BottomBarControls style={local.bottomControls}>
          <View style={[local.bottomInner, { maxWidth: contentMaxWidth }]}>
            {usingMock ? (
            <View style={local.cpuSection}>
              <Text style={local.cpuSectionLabel}>CPU Players</Text>
              <View style={local.stepper}>
                <TouchableOpacity
                  style={[
                    local.stepBtn,
                    cpuBotNames.length === 0 && local.stepBtnDisabled,
                  ]}
                  onPress={removeCpu}
                  disabled={cpuBotNames.length === 0}
                >
                  <Text style={local.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={local.cpuCount}>
                  {cpuBotNames.length}
                </Text>
                <TouchableOpacity
                  style={[
                    local.stepBtn,
                    names.length >= MAX_PLAYERS && local.stepBtnDisabled,
                  ]}
                  onPress={addCpu}
                  disabled={names.length >= MAX_PLAYERS}
                >
                  <Text style={local.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            ) : null}

            {actionHint ? (
              <Text style={local.actionHint}>{actionHint}</Text>
            ) : null}

            <View style={local.actionTrack}>
              <AnimatedTouchable
                style={[
                  local.primaryCapsule,
                  primaryDisabled
                    ? local.primaryCapsuleDisabled
                    : showReadyAction && isLocalReady
                      ? local.primaryCapsuleReady
                      : {
                          backgroundColor: colors.actionPrimaryBg,
                          borderColor: colors.actionPrimaryBorder,
                        },
                  showReadyFlash && local.primaryCapsuleFlash,
                  showReadyFlash && {
                    backgroundColor: readyFlash.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        colors.actionPrimaryBg,
                        colors.mode === "light"
                          ? "rgba(255,255,255,0.96)"
                          : "rgba(255,255,255,0.92)",
                      ],
                    }),
                    borderColor: readyFlash.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        colors.actionPrimaryBorder,
                        colors.mode === "light"
                          ? "rgba(255,255,255,0.95)"
                          : "rgba(255,255,255,0.95)",
                      ],
                    }),
                    borderWidth: 1.5,
                  },
                ]}
                onPress={handlePrimaryAction}
                disabled={primaryDisabled}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                accessibilityState={{ disabled: primaryDisabled }}
              >
                {showReadyFlash ? (
                  <Animated.Text
                    style={[
                      local.primaryCapsuleText,
                      {
                        color: readyFlash.interpolate({
                          inputRange: [0, 1],
                          outputRange: [colors.actionPrimaryText, "#111111"],
                        }),
                      },
                    ]}
                  >
                    {primaryLabel}
                  </Animated.Text>
                ) : (
                  <Text
                    style={[
                      local.primaryCapsuleText,
                      primaryDisabled && local.primaryCapsuleTextDisabled,
                      showReadyAction &&
                        isLocalReady &&
                        local.primaryCapsuleReadyText,
                    ]}
                  >
                    {primaryLabel}
                  </Text>
                )}
              </AnimatedTouchable>
            </View>

            <BottomBarLeave onPress={handleLeave} />
          </View>
        </BottomBarControls>
      </BottomBar>

      <LobbyPlayerModal
        visible={showPlayerModal}
        player={selectedPlayer}
        colors={colors}
        ui={ui}
        blur={blur}
        onClose={() => setShowPlayerModal(false)}
      />
    </ScreenContainer>
  );
}

function createLocalStyles(colors: AppThemeColors) {
  const isDark = colors.mode === "dark";

  return StyleSheet.create({
  lobbyNoticeBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 70,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: hexToRgba(
      isDark ? "#0a1a12" : "#ffffff",
      isDark ? 0.55 : 0.72,
    ),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba(colors.accent, isDark ? 0.35 : 0.28),
  },
  lobbyNoticeText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  utilHost: {
    position: "absolute",
    right: 12,
    zIndex: 45,
    elevation: 45,
  },
  utilRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  utilBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hexToRgba(colors.textPrimary, isDark ? 0.1 : 0.08),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba(colors.accent, isDark ? 0.28 : 0.22),
  },
  inviteCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  inviteEyebrow: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  codeCapsule: {
    width: "100%",
    minHeight: 48,
    borderRadius: CAPSULE_RADIUS,
    borderWidth: 1,
    borderColor: colors.actionSecondaryBorder,
    backgroundColor: colors.actionSecondaryBg,
    paddingHorizontal: 16,
    ...BUTTON_CENTER,
  },
  codeCapsuleCopied: {
    borderColor: hexToRgba(colors.accent, isDark ? 0.55 : 0.45),
    backgroundColor: hexToRgba(colors.accent, isDark ? 0.14 : 0.1),
  },
  codeCapsuleText: buttonLabel(17, {
    color: colors.accent,
    fontWeight: "800",
    letterSpacing: 1.4,
  }),
  supportNote: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginBottom: 0,
  },
  fieldLabelSpaced: {
    marginBottom: 6,
  },
  roomInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.actionSecondaryBg,
    borderWidth: 1,
    borderColor: colors.actionSecondaryBorder,
    borderRadius: CAPSULE_RADIUS,
    paddingLeft: 16,
    paddingRight: 14,
    minHeight: 48,
  },
  roomInputWrapSpaced: {
    marginTop: 12,
  },
  roomInputWrapFocused: {
    borderColor: hexToRgba(colors.accent, isDark ? 0.55 : 0.45),
  },
  roomInput: {
    flex: 1,
    color: colors.inputText,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 12,
  },
  roomInputHint: {
    color: colors.textTertiary,
    fontSize: 16,
    marginLeft: 8,
  },
  fieldLabelAfterCode: {
    marginTop: 8,
  },
  deadHandSeat: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba(colors.accent, isDark ? 0.28 : 0.22),
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: hexToRgba(colors.accent, isDark ? 0.06 : 0.08),
  },
  deadHandSeatIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  deadHandSeatLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  tableArea: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 4,
  },
  statusChip: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: CAPSULE_RADIUS,
    backgroundColor: hexToRgba(colors.textPrimary, isDark ? 0.08 : 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba(colors.accent, isDark ? 0.22 : 0.18),
    marginBottom: 12,
  },
  statusChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  seatRing: {
    position: "relative",
    alignSelf: "center",
  },
  seatSlot: {
    position: "absolute",
    alignItems: "center",
    zIndex: 1,
  },
  seatTapTarget: {
    width: "100%",
    alignItems: "center",
    position: "relative",
  },
  removeSeatBtn: {
    position: "absolute",
    top: -2,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: hexToRgba(isDark ? "#1a1010" : "#2a1818", 0.82),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba("#ff8a8a", 0.45),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  removeSeatBtnText: {
    color: "#ffb0b0",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: -1,
  },
  hostBadgePill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: CAPSULE_RADIUS,
    backgroundColor: hexToRgba(colors.accent, isDark ? 0.16 : 0.12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba(colors.accent, isDark ? 0.38 : 0.28),
  },
  hostBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  emptySeat: {
    position: "absolute",
    width: LOBBY_ADD_CPU_W,
    height: LOBBY_ADD_CPU_H,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba(colors.accent, isDark ? 0.35 : 0.28),
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hexToRgba(colors.accent, isDark ? 0.08 : 0.1),
    zIndex: 2,
  },
  emptySeatPlus: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
    color: colors.accent,
  },
  emptySeatLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  cpuSection: {
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  cpuSectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  bottomControls: {
    paddingTop: BOTTOM_BAR_TOP_PAD,
  },
  actionHint: {
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  actionTrack: {
    width: "100%",
    minHeight: 48,
    marginBottom: 2,
  },
  primaryCapsule: {
    width: "100%",
    minHeight: 52,
    borderRadius: CAPSULE_RADIUS,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    ...BUTTON_CENTER,
    ...Platform.select({
      ios: {
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  primaryCapsuleDisabled: {
    backgroundColor: colors.actionPrimaryDisabledBg,
    borderColor: colors.actionPrimaryDisabledBorder,
    opacity: 0.72,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
      default: {},
    }),
  },
  primaryCapsuleReady: {
    backgroundColor: colors.actionSecondaryBg,
    borderColor: colors.actionSecondaryBorder,
  },
  primaryCapsuleFlash: {
    ...Platform.select({
      ios: {
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  primaryCapsuleText: buttonLabel(16, {
    color: colors.actionPrimaryText,
    fontWeight: "800",
    letterSpacing: 0.3,
  }),
  primaryCapsuleTextDisabled: {
    color: colors.actionPrimaryDisabledText,
  },
  primaryCapsuleReadyText: {
    color: colors.actionSecondaryText,
  },
  bottomInner: {
    width: "100%",
    alignSelf: "center",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hexToRgba(colors.accent, isDark ? 0.1 : 0.08),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba(colors.accent, isDark ? 0.28 : 0.22),
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepBtnText: buttonLabel(20, {
    fontWeight: "700",
    color: colors.accent,
  }),
  cpuCount: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
  });
}
