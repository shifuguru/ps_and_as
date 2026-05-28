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
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import ScreenContainer from "../components/ScreenContainer";
import LobbyStatusBar, {
  LOBBY_STATUS_BAR_HEIGHT,
} from "../components/LobbyStatusBar";
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  bottomOuterPad,
} from "../components/BottomBar";
import BlurPanel from "../components/BlurPanel";
import OpponentSeat from "../components/OpponentSeat";
import LobbyPlayerModal from "../components/LobbyPlayerModal";
import ShimmerText from "../components/ShimmerText";
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
import { polarSeatPosition, ringAngleForSeat, sideAnchorMarginForWidth } from "../utils/tableLayout";
const MIN_PLAYERS = 2;
const MIN_PLAYERS_FULL_TABLE = 3;
const MAX_PLAYERS = 8;
const LOBBY_SEAT_W = 88;
const LOBBY_SEAT_H = 92;
const LOBBY_RING_R = 104;
const LOBBY_ADD_CPU_W = 76;
const LOBBY_ADD_CPU_H = 92;

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
  wrapStyle: ViewStyle;
  wrapFocusedStyle: ViewStyle;
  hintStyle: TextStyle;
}) {
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
        placeholderTextColor="rgba(255,255,255,0.4)"
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
  const [names, setNames] = useState<string[]>([]);
  const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[]>([]);
  const lobbyMembersRef = useRef<LobbyMember[]>([]);
  const playerNameRef = useRef("");
  const playerIdRef = useRef<string | null>(null);
  const localIdRef = useRef<string | null>(null);
  const [roomName, setRoomName] = useState<string>("My Room");
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
  const topBarHeight = insets.top + LOBBY_STATUS_BAR_HEIGHT;
  const bottomBarHeight = lobbyBottomReserve(insets.bottom || 0);

  const usingMock = !adapter || !isSocketAdapter(adapter);
  const onlineLobby = isSocketAdapter(adapter);
  const isHost = usingMock || (localId != null && hostId != null && localId === hostId);

  const seatMembers = useMemo((): LobbyMember[] => {
    if (usingMock) {
      return names.map((name, index) => ({
        id: `mock-${index}-${name}`,
        name,
        feltTint: /^CPU\b/i.test(name) ? undefined : localFeltTint,
      }));
    }
    return lobbyMembers;
  }, [usingMock, names, lobbyMembers, localFeltTint]);

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
  const isLocalReady = !!localMember?.ready;
  const guestMembers = seatMembers.filter((m) => m.id !== hostId);
  const anyGuestReady = guestMembers.some((m) => m.ready);
  const hostWaitingForGuest =
    onlineLobby && isHost && lobbyFullEnough && !anyGuestReady;
  const showGuestReadyAction = onlineLobby && !isHost && lobbyFullEnough;
  const showHostReadyAction = hostWaitingForGuest;
  const showReadyAction = showGuestReadyAction || showHostReadyAction;

  const handleRoomNameCommit = useCallback(
    (name: string) => {
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

  const statusLabel = usingMock ? "Local" : isHost ? "You" : "Lobby";
  const statusValue = usingMock
    ? "Host"
    : isHost
      ? "Host"
      : connectionStatus === "connected"
        ? "Guest"
        : "Connecting…";

  const contentMaxWidth = Math.min(520, Math.max(320, width - 24));
  const estimatedTableHeight = Math.max(
    140,
    windowHeight - topBarHeight - bottomBarHeight - 240,
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
        const isCPU = !isDeadHandSeat && member.name.startsWith("CPU ");
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
        const myProfileId = playerIdRef.current;
        if (myProfileId && ev.state.id === myProfileId) {
          setLocalId(ev.state.id);
          localIdRef.current = ev.state.id;
          if (usingMock) setHostId(ev.state.id);
          setConnectionStatus("connected");
        } else if (
          usingMock &&
          typeof ev.state.name === "string" &&
          ev.state.name.startsWith("CPU ") &&
          actualRoomId
        ) {
          (net as MockAdapter).toggleReady(actualRoomId, ev.state.id, true);
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
            const displayName = roomName.trim() || "Game Room";
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
          setNames([hostName, "CPU 1", "CPU 2"]);
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
    const usedNums = new Set<number>();
    for (const n of names) {
      const m = /^CPU\s+(\d+)$/i.exec(n.trim());
      if (m) usedNums.add(parseInt(m[1], 10));
    }
    let i = 1;
    while (usedNums.has(i)) i++;
    let cpuName = `CPU ${i}`;
    while (names.some((n) => n.toLowerCase() === cpuName.toLowerCase())) {
      i++;
      cpuName = `CPU ${i}`;
    }
    setNames((s) => [...s, cpuName]);
  };

  const canRemovePlayer = (member: LobbyMember, isCPU: boolean) => {
    if (isCPU) return usingMock;
    if (!isHost || !localId) return false;
    return member.id !== localId;
  };

  const removePlayerAt = (index: number) => {
    const member = seatMembers[index];
    if (!member) return;

    const isCPU = member.name.startsWith("CPU ");
    if (!canRemovePlayer(member, isCPU)) return;

    triggerHaptic("light");
    if (isCPU) {
      setNames((s) => s.filter((_, i) => i !== index));
    } else if (adapter && isSocketAdapter(adapter) && actualRoomId) {
      adapter.kickPlayer(actualRoomId, member.name);
    } else {
      setNames((s) => s.filter((_, i) => i !== index));
    }
  };

  const removeCpu = () => {
    const lastCPUIndex = names
      .map((n, i) => ({ n, i }))
      .reverse()
      .find(({ n }) => n.startsWith("CPU "))?.i;
    if (lastCPUIndex !== undefined) {
      setNames((s) => s.filter((_, i) => i !== lastCPUIndex));
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
      onStart(
        names.map((name, i) => ({ id: String(i + 1), name })),
        playerName,
        undefined,
      );
      return;
    }
    if ((net as any).startGame && isHost && actualRoomId) {
      (net as any).startGame(actualRoomId);
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
    : isHost
      ? anyGuestReady
        ? !lobbyFullEnough
        : false
      : !lobbyFullEnough;

  const primaryLabel = usingMock
    ? "Start Game"
    : isHost
      ? anyGuestReady
        ? "Start Game"
        : isLocalReady
          ? "Unready"
          : "Ready"
      : lobbyFullEnough
        ? isLocalReady
          ? "Unready"
          : "Ready"
        : `Need ${playersNeeded} More`;

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <LobbyStatusBar
        playerCount={seatCount}
        roomName={roomName}
        statusLabel={statusLabel}
        statusValue={statusValue}
        topInset={insets.top}
      />

      {lobbyNotice ? (
        <View style={[local.lobbyNoticeBanner, { top: topBarHeight + 6 }]}>
          <Text style={local.lobbyNoticeText}>{lobbyNotice}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <DismissKeyboardArea
          style={{
            flex: 1,
            paddingTop: topBarHeight + 10,
            paddingBottom: bottomBarHeight,
            paddingHorizontal: 12,
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
              <BlurPanel style={local.roomPanel} intensity={48}>
                {onlineLobby && actualRoomId ? (
                  <View style={local.roomCodeRow}>
                    <Text style={local.roomCodeLabel}>Room Code:</Text>
                    <TouchableOpacity
                      style={[
                        local.roomCodeButton,
                        codeCopied && local.roomCodeButtonCopied,
                      ]}
                      onPress={handleCopyRoomCode}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Copy room code ${actualRoomId}`}
                    >
                      <Text style={local.roomCodeButtonText} numberOfLines={1}>
                        {codeCopied ? "Copied!" : actualRoomId}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {canEditRoom ? (
                  <>
                    <Text
                      style={[
                        local.fieldLabel,
                        local.fieldLabelSpaced,
                        onlineLobby && actualRoomId
                          ? local.fieldLabelAfterCode
                          : null,
                      ]}
                    >
                      Room Name
                    </Text>
                    <Text style={local.roomNameHint}>
                      Shown in Open Games — guests join with the room code.
                    </Text>
                    <RoomNameInput
                      value={roomName}
                      onCommit={handleRoomNameCommit}
                      validate={validateRoomName}
                      onEditingChange={(editing) => {
                        roomNameEditingRef.current = editing;
                      }}
                      inputStyle={local.roomInput}
                      wrapStyle={local.roomInputWrap}
                      wrapFocusedStyle={local.roomInputWrapFocused}
                      hintStyle={local.roomInputHint}
                    />
                  </>
                ) : null}
                {onlineLobby && seatCount === MIN_PLAYERS ? (
                  <>
                    <Text
                      style={[
                        local.fieldLabel,
                        local.fieldLabelSpaced,
                        local.fieldLabelAfterCode,
                      ]}
                    >
                      Open Seat
                    </Text>
                    <Text style={local.deadHandInfo}>
                      A dead hand is dealt automatically with two players. A
                      third person can spectate from Open Games and take that
                      seat after the round.
                    </Text>
                  </>
                ) : null}
              </BlurPanel>

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
                  <Text style={local.tableHint}>
                    {onlineLobby
                      ? seatCount < MIN_PLAYERS
                        ? "Share the room code — waiting for players"
                        : showDeadHandSeat
                          ? "Dead hand active — third player can spectate & join next round"
                          : `${seatCount} players in lobby`
                      : seatCount < MIN_PLAYERS_FULL_TABLE
                        ? `Add at least ${MIN_PLAYERS_FULL_TABLE} players to start`
                        : `${seatCount} players at the table`}
                  </Text>

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
                        <Text style={[local.emptySeatPlus, { color: colors.gold }]}>+</Text>
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
                              <Text style={local.deadHandSeatLabel}>Dead Hand</Text>
                              <Text style={local.deadHandSeatHint}>Open seat</Text>
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
                            {seat.isHostSeat && (
                              <Text style={[local.hostBadge, { color: colors.gold }]}>Host</Text>
                            )}
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
      </KeyboardAvoidingView>

      <BottomBar>
        <BottomBarControls style={local.bottomControls}>
          <View style={[local.bottomInner, { maxWidth: contentMaxWidth }]}>
            {usingMock ? (
            <View style={local.cpuSection}>
              <Text style={local.fieldLabel}>CPU Players</Text>
              <View style={local.stepper}>
                <TouchableOpacity
                  style={[
                    local.stepBtn,
                    names.filter((n) => n.startsWith("CPU ")).length === 0 &&
                      local.stepBtnDisabled,
                  ]}
                  onPress={removeCpu}
                  disabled={
                    names.filter((n) => n.startsWith("CPU ")).length === 0
                  }
                >
                  <Text style={[local.stepBtnText, { color: colors.gold }]}>−</Text>
                </TouchableOpacity>
                <Text style={local.cpuCount}>
                  {names.filter((n) => n.startsWith("CPU ")).length}
                </Text>
                <TouchableOpacity
                  style={[
                    local.stepBtn,
                    names.length >= MAX_PLAYERS && local.stepBtnDisabled,
                  ]}
                  onPress={addCpu}
                  disabled={names.length >= MAX_PLAYERS}
                >
                  <Text style={[local.stepBtnText, { color: colors.gold }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            ) : null}

            {hostWaitingForGuest ? (
              <Text style={local.lobbyWaitHint}>
                Waiting for a guest to ready up…
              </Text>
            ) : null}

            <View style={ui.actionTrack}>
              {onNavigateToAchievements ? (
                <TouchableOpacity
                  style={[ui.actionSecondary, local.lobbySideBtn]}
                  onPress={onNavigateToAchievements}
                >
                  <ShimmerText style={ui.actionSecondaryText}>Stats</ShimmerText>
                </TouchableOpacity>
              ) : (
                <View style={local.lobbySideBtn} />
              )}
              <TouchableOpacity
                style={[
                  ui.btnGoldFill,
                  local.lobbyPrimaryBtn,
                  primaryDisabled && local.lobbyPrimaryDisabled,
                  showReadyAction &&
                    isLocalReady &&
                    local.lobbyPrimaryReady,
                ]}
                onPress={handlePrimaryAction}
                disabled={primaryDisabled}
                activeOpacity={0.88}
              >
                <Text
                  style={[
                    ui.btnGoldFillText,
                    local.lobbyPrimaryBtnText,
                    primaryDisabled && local.lobbyPrimaryTextDisabled,
                    showReadyAction &&
                      isLocalReady &&
                      local.lobbyPrimaryReadyText,
                  ]}
                >
                  {primaryLabel}
                </Text>
              </TouchableOpacity>
              {onNavigateToSettings ? (
                <TouchableOpacity
                  style={[ui.actionSecondary, local.lobbySideBtn]}
                  onPress={onNavigateToSettings}
                >
                  <Text style={ui.actionSecondaryText}>Settings</Text>
                </TouchableOpacity>
              ) : (
                <View style={local.lobbySideBtn} />
              )}
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

const local = StyleSheet.create({
  lobbyNoticeBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 70,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212, 175, 55, 0.45)",
  },
  lobbyNoticeText: {
    color: "#f5e6b8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  roomPanel: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
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
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 12,
    minHeight: 48,
  },
  roomInputWrapFocused: {
    borderColor: "rgba(212,175,55,0.6)",
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  roomInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 12,
  },
  roomInputHint: {
    color: "rgba(212,175,55,0.65)",
    fontSize: 16,
    marginLeft: 8,
  },
  fieldLabelAfterCode: {
    marginTop: 6,
  },
  roomNameHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  deadHandInfo: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  deadHandSeat: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  deadHandSeatIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  deadHandSeatLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  deadHandSeatHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  roomCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roomCodeLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 0,
  },
  roomCodeButton: {
    marginLeft: "auto",
    minWidth: 96,
    maxWidth: "56%",
    minHeight: 36,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    borderRadius: 12,
    ...BUTTON_CENTER,
  },
  roomCodeButtonCopied: {
    borderColor: "rgba(120,220,140,0.55)",
    backgroundColor: "rgba(20,48,28,0.45)",
  },
  roomCodeButtonText: buttonLabel(15, {
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 1.2,
  }),
  tableArea: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 4,
  },
  tableHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginBottom: 8,
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
  },
  removeSeatBtn: {
    position: "absolute",
    top: -2,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(18,12,12,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,120,120,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  removeSeatBtnText: {
    color: "#ff9a9a",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: -1,
  },
  hostBadge: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  emptySeat: {
    position: "absolute",
    width: LOBBY_ADD_CPU_W,
    height: LOBBY_ADD_CPU_H,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    zIndex: 2,
  },
  emptySeatPlus: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  emptySeatLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },
  cpuSection: {
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  bottomControls: {
    paddingTop: BOTTOM_BAR_TOP_PAD,
  },
  lobbyWaitHint: {
    textAlign: "center",
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  lobbySideBtn: {
    flex: 1,
  },
  lobbyPrimaryBtn: {
    flex: 1.45,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 10,
    ...BUTTON_CENTER,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  lobbyPrimaryBtnText: buttonLabel(16, {
    letterSpacing: 0.35,
    textTransform: "uppercase",
  }),
  lobbyPrimaryDisabled: {
    backgroundColor: "rgba(120,120,120,0.35)",
    opacity: 0.72,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
      default: {},
    }),
  },
  lobbyPrimaryTextDisabled: {
    color: "rgba(255,255,255,0.45)",
  },
  lobbyPrimaryReady: {
    backgroundColor: "#2e7d32",
  },
  lobbyPrimaryReadyText: {
    color: "#ffffff",
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
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.18)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepBtnText: buttonLabel(20, {
    fontWeight: "700",
  }),
  cpuCount: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
});
