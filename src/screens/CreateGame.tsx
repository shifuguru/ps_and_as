import React, { useEffect, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenContainer from "../components/ScreenContainer";
import FeltBackground from "../components/FeltBackground";
import LobbyStatusBar, {
  LOBBY_STATUS_BAR_HEIGHT,
} from "../components/LobbyStatusBar";
import BottomBar, { BottomBarControls } from "../components/BottomBar";
import BlurPanel from "../components/BlurPanel";
import OpponentSeat from "../components/OpponentSeat";
import { NetworkAdapter, MockAdapter } from "../game/network";
import { getOrCreatePlayerId } from "../services/gameCenter";
import { triggerHaptic } from "../utils/haptics";
import { ACTION_BAR_HEIGHT } from "../components/ActionBar";

const GOLD = "#d4af37";
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

function lobbyBottomReserve(safeBottom = 0): number {
  const outerPad =
    Platform.OS === "web" ? 12 + 32 : safeBottom + 10;
  return ACTION_BAR_HEIGHT + 16 + outerPad + 8;
}

export default function CreateGame({
  onBack,
  onStart,
  adapter,
  isJoining = false,
  onNavigateToAchievements,
  joinRoomId,
}: {
  onBack: () => void;
  onStart: (names: string[], localPlayerName: string, localPlayerId?: string) => void;
  adapter?: NetworkAdapter;
  isJoining?: boolean;
  onNavigateToAchievements?: () => void;
  joinRoomId?: string;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [roomName, setRoomName] = useState<string>("My Room");
  const [playerName, setPlayerName] = useState<string>("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerNameReady, setPlayerNameReady] = useState(false);
  const [localId, setLocalId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("disconnected");
  const [actualRoomId, setActualRoomId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [selectedLobbyIndex, setSelectedLobbyIndex] = useState<number | null>(null);

  const net = adapter ?? new MockAdapter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topBarHeight = insets.top + LOBBY_STATUS_BAR_HEIGHT;
  const bottomBarHeight = lobbyBottomReserve(insets.bottom || 0);

  const usingMock =
    adapter == null || (net as any)?.constructor?.name === "MockAdapter";
  const isHost = usingMock || (localId != null && hostId != null && localId === hostId);
  const canStart = names.length >= MIN_PLAYERS && isHost;

  const statusLabel = usingMock ? "Local" : isHost ? "You" : "Lobby";
  const statusValue = usingMock
    ? "Host"
    : isHost
      ? "Host"
      : connectionStatus === "connected"
        ? "Guest"
        : "Connecting…";

  const contentMaxWidth = Math.min(520, Math.max(320, width - 24));

  const lobbyPlayers = useMemo(
    () =>
      names.map((name, index) => ({
        id: `lobby-${index}-${name}`,
        name,
        handCount: 0,
        role: "Neutral" as const,
        isCPU: name.startsWith("CPU "),
        isHostSeat: index === 0 && isHost,
      })),
    [names, isHost],
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
    let mounted = true;
    net.on("message", (ev) => {
      if (!mounted) return;
      if (ev.type === "state" && ev.state?.type === "lobby") {
        setNames(ev.state.players.map((p: { name: string }) => p.name));
        setHostId(ev.state.host ?? null);
        setConnectionStatus("connected");
      }
      if (ev.type === "state" && ev.state?.type === "startGame") {
        onStart(ev.state.players, playerName, playerId ?? undefined);
      }
      if (ev.type === "state" && ev.state?.type === "connected") {
        if (ev.state.name === playerName) {
          setLocalId(ev.state.id);
          setConnectionStatus("connected");
        } else if (
          (net as any)?.constructor?.name === "MockAdapter" &&
          typeof ev.state.name === "string" &&
          ev.state.name.startsWith("CPU ") &&
          actualRoomId
        ) {
          (net as any).toggleReady(actualRoomId, ev.state.id, true);
        }
      }
      if (ev.type === "state" && ev.state?.type === "kicked") {
        Alert.alert(
          "Removed from Game",
          ev.state.message || "You have been removed from the game",
          [{ text: "OK", onPress: () => onBack() }],
        );
      }
    });
    return () => {
      mounted = false;
      try {
        if (adapter) adapter.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, []);

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
            (adapter as any).createRoom(rid, playerName);
            setActualRoomId(rid);
          } else if (joinRoomId) {
            setActualRoomId(joinRoomId);
          }
        } else {
          setConnectionStatus("connecting");
          const m = net as MockAdapter;
          const rid = `${roomName.trim().replace(/\s+/g, "_")}-${Date.now()}`;
          const hostName = playerName || "You";
          m.createRoom(rid, hostName);
          setActualRoomId(rid);
          m.joinRoom(rid, "CPU 1");
          m.joinRoom(rid, "CPU 2");
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
    try {
      if ((net as any)?.constructor?.name === "MockAdapter") {
        const m = net as MockAdapter;
        const rid = actualRoomId || roomName;
        setActualRoomId(rid);
        m.joinRoom(rid, cpuName);
      }
    } catch {
      /* ignore */
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

  const addNamedPlayer = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (names.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Duplicate name", "That name is already in the lobby.");
      return;
    }
    if (names.length >= MAX_PLAYERS) {
      const lastCPUIndex = names
        .map((n, i) => ({ n, i }))
        .reverse()
        .find(({ n }) => n.startsWith("CPU "))?.i;
      if (lastCPUIndex === undefined) {
        Alert.alert("Lobby full", "The lobby is full.");
        return;
      }
      setNames((s) => {
        const copy = s.slice();
        copy.splice(lastCPUIndex, 1);
        copy.push(trimmed);
        return copy;
      });
      setInput("");
      return;
    }
    setNames((s) => [...s, trimmed]);
    setInput("");
  };

  const handleStart = () => {
    triggerHaptic("heavy");
    if (usingMock) {
      onStart(names, playerName, playerId ?? undefined);
      return;
    }
    if ((net as any).startGame && isHost && actualRoomId) {
      (net as any).startGame(actualRoomId);
    } else {
      onStart(names, playerName, playerId ?? undefined);
    }
  };

  const startLabel = usingMock
    ? "Start game"
    : names.length < MIN_PLAYERS
      ? `Need ${MIN_PLAYERS - names.length} more`
      : isHost
        ? "Start game"
        : "Waiting for host…";

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <FeltBackground />

      <LobbyStatusBar
        playerCount={names.length}
        roomName={roomName}
        statusLabel={statusLabel}
        statusValue={statusValue}
        topInset={insets.top}
        onLeave={onBack}
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
                  <Text style={local.fieldLabel}>Room name</Text>
                  <TextInput
                    placeholder="Enter room name"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={roomName}
                    onChangeText={setRoomName}
                    style={local.roomInput}
                  />
                </BlurPanel>

                <View style={local.tableArea}>
                  <Text style={local.tableHint}>
                    {names.length < MIN_PLAYERS
                      ? `Add at least ${MIN_PLAYERS} players to start`
                      : `${names.length} players at the table`}
                  </Text>

                  <View style={local.seatGrid}>
                    {lobbyPlayers.map((seat, index) => {
                      const isCPU = seat.isCPU;
                      const canRemove =
                        (isHost && index !== 0 && !isCPU) || isCPU;

                      return (
                        <TouchableOpacity
                          key={seat.id}
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
                                onPress: () => {
                                  if (isCPU) {
                                    setNames((s) =>
                                      s.filter((_, i) => i !== index),
                                    );
                                  } else if (
                                    adapter &&
                                    (adapter as any).kickPlayer
                                  ) {
                                    (adapter as any).kickPlayer(
                                      roomName,
                                      seat.name,
                                    );
                                  } else {
                                    setNames((s) =>
                                      s.filter((_, i) => i !== index),
                                    );
                                  }
                                },
                              });
                            }
                            options.push({ text: "Cancel", style: "cancel" });
                            Alert.alert(seat.name, undefined, options);
                          }}
                          style={local.seatSlot}
                        >
                          <OpponentSeat
                            player={{
                              id: seat.id,
                              name: seat.name,
                              handCount: 0,
                              role: seat.isHostSeat ? "President" : "Neutral",
                            }}
                            isLocal={index === 0}
                            isActive={false}
                            isOut={false}
                            hasPassed={false}
                            isThinking={isCPU}
                          />
                          {seat.isHostSeat && (
                            <Text style={local.hostBadge}>Host</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}

                    {names.length < MAX_PLAYERS && (
                      <TouchableOpacity
                        style={local.emptySeat}
                        onPress={addCpu}
                        accessibilityLabel="Add CPU player"
                      >
                        <Text style={local.emptySeatPlus}>+</Text>
                        <Text style={local.emptySeatLabel}>Add CPU</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <BlurPanel style={local.controlsPanel} intensity={48}>
                  <View style={local.cpuRow}>
                    <Text style={local.fieldLabel}>CPU players</Text>
                    <View style={local.stepper}>
                      <TouchableOpacity
                        style={[
                          local.stepBtn,
                          names.filter((n) => n.startsWith("CPU ")).length ===
                            0 && local.stepBtnDisabled,
                        ]}
                        onPress={removeCpu}
                        disabled={
                          names.filter((n) => n.startsWith("CPU ")).length === 0
                        }
                      >
                        <Text style={local.stepBtnText}>−</Text>
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
                        <Text style={local.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={local.addRow}>
                    <TextInput
                      placeholder="Add player by name"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={input}
                      onChangeText={setInput}
                      style={local.addInput}
                      onSubmitEditing={addNamedPlayer}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={local.addBtn}
                      onPress={addNamedPlayer}
                    >
                      <Text style={local.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </BlurPanel>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <BottomBar>
        <BottomBarControls>
          <View style={local.actionTrack}>
            <TouchableOpacity
              style={[local.backBtn, { flex: 1 }]}
              onPress={onBack}
            >
              <Text style={local.backBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                local.startBtn,
                { flex: 1.45 },
                !canStart && local.startBtnDisabled,
              ]}
              onPress={handleStart}
              disabled={!canStart}
            >
              <Text
                style={[
                  local.startBtnText,
                  !canStart && local.startBtnTextDisabled,
                ]}
              >
                {startLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomBarControls>
      </BottomBar>

      <Modal
        visible={showPlayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlayerModal(false)}
      >
        <View style={local.modalOverlay}>
          <BlurPanel style={local.modalCard} intensity={62}>
            <Text style={local.modalTitle}>Player</Text>
            <Text style={local.modalName}>
              {typeof selectedLobbyIndex === "number"
                ? names[selectedLobbyIndex]
                : ""}
            </Text>
            <View style={local.modalActions}>
              {onNavigateToAchievements ? (
                <TouchableOpacity
                  style={[local.modalBtn, { marginRight: 8 }]}
                  onPress={() => {
                    setShowPlayerModal(false);
                    onNavigateToAchievements();
                  }}
                >
                  <Text style={local.modalBtnText}>Achievements</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={local.modalBtn}
                onPress={() => setShowPlayerModal(false)}
              >
                <Text style={local.modalBtnText}>Close</Text>
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
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  roomInput: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 4,
  },
  tableArea: {
    flex: 1,
    minHeight: 200,
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
  seatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 8,
    maxWidth: 360,
  },
  seatSlot: {
    width: 88,
    alignItems: "center",
  },
  hostBadge: {
    marginTop: 2,
    color: GOLD,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptySeat: {
    width: 76,
    height: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptySeatPlus: {
    color: GOLD,
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
  controlsPanel: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cpuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
    color: GOLD,
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
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(212,175,55,0.22)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
  },
  addBtnText: {
    color: GOLD,
    fontWeight: "800",
    fontSize: 14,
  },
  actionTrack: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    padding: 5,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    minHeight: 58,
  },
  backBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  backBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
    fontSize: 16,
  },
  startBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    backgroundColor: "rgba(212,175,55,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  startBtnDisabled: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  startBtnText: {
    color: GOLD,
    fontWeight: "800",
    fontSize: 16,
  },
  startBtnTextDisabled: {
    color: "rgba(255,255,255,0.4)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212,175,55,0.3)",
  },
  modalTitle: {
    color: GOLD,
    fontWeight: "800",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  modalBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
