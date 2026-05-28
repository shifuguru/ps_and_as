import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  useWindowDimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
} from "react-native";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import ScreenContainer from "../components/ScreenContainer";
import LobbyStatusBar, {
  LOBBY_STATUS_BAR_HEIGHT,
} from "../components/LobbyStatusBar";
import BottomBar, { BottomBarControls, BottomBarLeave } from "../components/BottomBar";
import BlurPanel from "../components/BlurPanel";
import OpponentSeat from "../components/OpponentSeat";
import { NetworkAdapter, MockAdapter, type LobbyMember } from "../game/network";
import { isSocketAdapter } from "../game/socketAdapter";
import { getOrCreatePlayerId } from "../services/gameCenter";
import { triggerHaptic } from "../utils/haptics";
import { ACTION_BAR_HEIGHT } from "../components/ActionBar";
import { useAppTheme } from "../context/ThemeContext";
import { polarSeatPosition, ringAngleForSeat, sideAnchorMarginForWidth } from "../utils/tableLayout";
const MIN_PLAYERS = 2;
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
): Array<{ left: number; top: number }> {
  if (totalPlayers <= 0) return [];

  const cx = containerW / 2;
  const cy = containerH / 2;
  const margin = 8;
  const radius = Math.min(
    containerW / 2 - LOBBY_SEAT_W / 2 - margin,
    containerH / 2 - LOBBY_SEAT_H / 2 - margin,
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
      LOBBY_SEAT_W,
      LOBBY_SEAT_H,
      { sideAnchorMargin: sideMargin, anchorSides: true },
    );
  });
}

function lobbyRingSize(contentWidth: number): { width: number; height: number } {
  const width = Math.min(contentWidth - 8, 320);
  const height = LOBBY_RING_R * 2 + LOBBY_SEAT_H + 16;
  return { width, height };
}

const BOTTOM_CPU_ROW_HEIGHT = 78;
const BOTTOM_BAR_TOP_PAD = 18;

function lobbyBottomReserve(safeBottom = 0): number {
  const outerPad =
    Platform.OS === "web" ? 12 + 32 : safeBottom + 10;
  return (
    ACTION_BAR_HEIGHT +
    BOTTOM_CPU_ROW_HEIGHT +
    BOTTOM_BAR_TOP_PAD +
    16 +
    outerPad +
    8
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
  onRoomReady?: (roomId: string) => void;
}) {
  const { colors, ui, blur } = useAppTheme();
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
  const [roomInputFocused, setRoomInputFocused] = useState(false);

  const mockRef = useRef<MockAdapter | null>(null);
  if (!adapter && !mockRef.current) {
    mockRef.current = new MockAdapter();
  }
  const net = adapter ?? mockRef.current!;

  const { width } = useWindowDimensions();
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
      }));
    }
    return lobbyMembers;
  }, [usingMock, names, lobbyMembers]);

  const seatCount = seatMembers.length;
  const canEditRoom = isHost;
  const canStart = seatCount >= MIN_PLAYERS && isHost;

  const statusLabel = usingMock ? "Local" : isHost ? "You" : "Lobby";
  const statusValue = usingMock
    ? "Host"
    : isHost
      ? "Host"
      : connectionStatus === "connected"
        ? "Guest"
        : "Connecting…";

  const contentMaxWidth = Math.min(520, Math.max(320, width - 24));
  const ringSize = useMemo(
    () => lobbyRingSize(contentMaxWidth),
    [contentMaxWidth],
  );
  const ringPositions = useMemo(
    () => lobbyRingSlotPositions(ringSize.width, ringSize.height, seatCount),
    [ringSize.width, ringSize.height, seatCount],
  );

  const lobbyPlayers = useMemo(
    () =>
      seatMembers.map((member, index) => {
        const isCPU = member.name.startsWith("CPU ");
        const isLocalPlayer = usingMock
          ? !isCPU && index === 0
          : localId != null && member.id === localId;
        const isHostSeat = usingMock
          ? index === 0
          : hostId != null && member.id === hostId;
        return {
          id: member.id,
          name: member.name,
          handCount: 0,
          role: "Neutral" as const,
          isCPU,
          isHostSeat,
          isLocalPlayer,
        };
      }),
    [seatMembers, usingMock, localId, hostId],
  );

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
    playerNameRef.current = playerName;
  }, [playerName]);

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
    ) => {
      const active = players.filter((p) => !p.disconnected);
      setLobbyMembers(active);
      lobbyMembersRef.current = active;
      setNames(active.map((p) => p.name));
      setHostId(host ?? null);
      setConnectionStatus("connected");
    };

    net.on("message", (ev) => {
      if (!mounted) return;
      if (ev.type === "state" && ev.state?.type === "lobby") {
        if (onlineLobby) {
          applyLobbyFromServer(
            ev.state.players as LobbyMember[],
            ev.state.host ?? null,
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
        if (onlineLobby) {
          setLobbyMembers((prev) => {
            const next = prev.filter((p) => p.id !== ev.state.playerId);
            lobbyMembersRef.current = next;
            setNames(next.map((p) => p.name));
            return next;
          });
        }
      }
      if (ev.type === "state" && ev.state?.type === "kicked") {
        Alert.alert(
          "Removed from Game",
          ev.state.message || "You have been removed from the game",
          [{ text: "OK", onPress: () => onBack() }],
        );
      }
      if (ev.type === "state" && ev.state?.type === "roomDismissed") {
        Alert.alert(
          "Room Closed",
          "The host closed this lobby.",
          [{ text: "OK", onPress: () => onBack() }],
        );
      }
      if (ev.type === "state" && ev.state?.type === "hostMigrated") {
        setHostId(ev.state.newHost ?? null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [adapter, net, usingMock, onlineLobby, onStart, onBack, actualRoomId]);

  useEffect(() => {
    if (!playerNameReady) return;
    let mounted = true;
    (async () => {
      try {
        if (adapter) {
          setConnectionStatus("connecting");
          await adapter.connect();
          if (!isJoining && (adapter as any).createRoom) {
            const rid = `${roomName.trim().replace(/\s+/g, "_")}-${Date.now()}`;
            (adapter as any).createRoom(rid, playerName, roomName.trim());
            setActualRoomId(rid);
            onRoomReady?.(rid);
          } else if (joinRoomId) {
            setActualRoomId(joinRoomId);
            onRoomReady?.(joinRoomId);
          }
        } else {
          setConnectionStatus("connecting");
          const m = mockRef.current!;
          const rid = `${roomName.trim().replace(/\s+/g, "_")}-${Date.now()}`;
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

  const startLabel = usingMock
    ? "Start Game"
    : seatCount < MIN_PLAYERS
      ? `Need ${MIN_PLAYERS - seatCount} More`
      : isHost
        ? "Start Game"
        : "Waiting For Host…";

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <LobbyStatusBar
        playerCount={seatCount}
        roomName={roomName}
        statusLabel={statusLabel}
        statusValue={statusValue}
        topInset={insets.top}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View
            style={{
              flex: 1,
              paddingTop: topBarHeight + 10,
              paddingBottom: bottomBarHeight,
              paddingHorizontal: 12,
            }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                alignItems: "center",
                paddingBottom: 12,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={{ width: contentMaxWidth, flex: 1 }}>
                <BlurPanel style={local.roomPanel} intensity={48}>
                  <Text style={[local.fieldLabel, local.fieldLabelSpaced]}>
                    Room Name
                    {!canEditRoom ? (
                      <Text style={local.hostOnlyHint}> · Host only</Text>
                    ) : null}
                  </Text>
                  {canEditRoom ? (
                    <View
                      style={[
                        local.roomInputWrap,
                        roomInputFocused && local.roomInputWrapFocused,
                      ]}
                    >
                      <TextInput
                        placeholder="Enter Room Name"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={roomName}
                        onChangeText={setRoomName}
                        onFocus={() => setRoomInputFocused(true)}
                        onBlur={() => setRoomInputFocused(false)}
                        selectTextOnFocus
                        style={local.roomInput}
                      />
                      <Text style={local.roomInputHint} pointerEvents="none">
                        ✎
                      </Text>
                    </View>
                  ) : (
                    <Text style={local.roomNameReadOnly} numberOfLines={2}>
                      {roomName.trim() || "Game Room"}
                    </Text>
                  )}
                  {onlineLobby && actualRoomId ? (
                    <Text style={local.roomCodeHint} selectable>
                      Room code: {actualRoomId}
                    </Text>
                  ) : null}
                </BlurPanel>

                <View style={local.tableArea}>
                  <Text style={local.tableHint}>
                    {onlineLobby
                      ? seatCount < MIN_PLAYERS
                        ? "Share the room code — waiting for players"
                        : `${seatCount} players in lobby`
                      : seatCount < MIN_PLAYERS
                        ? `Add at least ${MIN_PLAYERS} players to start`
                        : `${seatCount} players at the table`}
                  </Text>

                  <View
                    style={[
                      local.seatRing,
                      { width: ringSize.width, height: ringSize.height },
                    ]}
                  >
                    {usingMock && names.length < MAX_PLAYERS ? (
                      <TouchableOpacity
                        style={[
                          local.emptySeat,
                          {
                            left: (ringSize.width - LOBBY_ADD_CPU_W) / 2,
                            top: (ringSize.height - LOBBY_ADD_CPU_H) / 2,
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
                      const canRemove = canRemovePlayer(
                        { id: seat.id, name: seat.name },
                        isCPU,
                      );

                      return (
                        <View
                          key={seat.id}
                          style={[
                            local.seatSlot,
                            { left: pos.left, top: pos.top },
                          ]}
                        >
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => {
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
                              }}
                              isLocal={seat.isLocalPlayer}
                              isActive={false}
                              isOut={false}
                              hasPassed={false}
                              isThinking={isCPU}
                            />
                            {seat.isHostSeat && (
                              <Text style={[local.hostBadge, { color: colors.gold }]}>Host</Text>
                            )}
                          </TouchableOpacity>

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
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
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

            <View style={ui.actionTrack}>
              {onNavigateToAchievements ? (
                <TouchableOpacity
                  style={ui.actionSecondary}
                  onPress={onNavigateToAchievements}
                >
                  <Text style={ui.actionSecondaryText}>Stats</Text>
                </TouchableOpacity>
              ) : null}
              {onNavigateToSettings ? (
                <TouchableOpacity
                  style={ui.actionSecondary}
                  onPress={onNavigateToSettings}
                >
                  <Text style={ui.actionSecondaryText}>Settings</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  ui.actionPrimary,
                  !canStart && ui.actionPrimaryDisabled,
                  !onNavigateToSettings && !onNavigateToAchievements && { flex: 1 },
                ]}
                onPress={handleStart}
                disabled={!canStart}
              >
                <Text
                  style={[
                    ui.actionPrimaryText,
                    !canStart && ui.actionPrimaryTextDisabled,
                  ]}
                >
                  {startLabel}
                </Text>
              </TouchableOpacity>
            </View>

            <BottomBarLeave onPress={handleLeave} />
          </View>
        </BottomBarControls>
      </BottomBar>

      <Modal
        visible={showPlayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlayerModal(false)}
      >
        <View style={ui.modalOverlay}>
          <BlurPanel style={ui.modalCard} preset={blur.modal}>
            <Text style={ui.modalTitle}>Player</Text>
            <Text style={ui.modalBody}>
              {typeof selectedLobbyIndex === "number"
                ? names[selectedLobbyIndex]
                : ""}
            </Text>
            <View style={ui.actionTrack}>
              <TouchableOpacity
                style={[ui.actionSecondary, { flex: 1 }]}
                onPress={() => setShowPlayerModal(false)}
              >
                <Text style={ui.actionSecondaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </BlurPanel>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const local = StyleSheet.create({
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
  hostOnlyHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "500",
  },
  roomNameReadOnly: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 10,
    textAlign: "center",
  },
  roomCodeHint: {
    color: "rgba(212,175,55,0.85)",
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 17,
  },
  tableArea: {
    flex: 1,
    minHeight: LOBBY_RING_R * 2 + LOBBY_SEAT_H + 32,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },
  tableHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  seatRing: {
    position: "relative",
    alignSelf: "center",
  },
  seatSlot: {
    position: "absolute",
    width: LOBBY_SEAT_W,
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
  stepBtnText: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },
  cpuCount: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
});
