import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  TextInput,
} from "react-native";
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  menuBottomReserve,
} from "../components/BottomBar";
import ScreenContainer from "../components/ScreenContainer";
import LobbyStatusBar, {
  LOBBY_STATUS_BAR_HEIGHT,
} from "../components/LobbyStatusBar";
import BlurPanel from "../components/BlurPanel";
import MenuIcon from "../components/MenuIcon";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { NetworkAdapter } from "../game/network";
import { SocketAdapter } from "../game/socketAdapter";
import { getOrCreatePlayerId } from "../services/gameCenter";
import { triggerHaptic } from "../utils/haptics";
import { playerInitials } from "../utils/playerDisplay";
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";

interface AvailableRoom {
  roomId: string;
  hostName: string;
  roomName?: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  inGame?: boolean;
  roundInProgress?: boolean;
}

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function connectionLabel(
  status: "disconnected" | "connecting" | "connected",
): string {
  if (status === "connected") return "Online";
  if (status === "connecting") return "Connecting…";
  return "Offline";
}

function normalizeRoomCode(raw: string): string {
  return raw.trim();
}

export default function FindGame({
  onBack,
  onJoinRoom,
  onHostGame,
  onSpectateRoom,
  adapter,
  onNavigateToSettings,
  onNavigateToAchievements,
}: {
  onBack: () => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onHostGame: (playerName: string) => void;
  onSpectateRoom?: (roomId: string, playerName: string) => void;
  adapter: NetworkAdapter;
  onNavigateToSettings?: () => void;
  onNavigateToAchievements?: () => void;
}) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [isSearching, setIsSearching] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");

  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const topBarHeight = insets.top + LOBBY_STATUS_BAR_HEIGHT;
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);
  const contentMax = contentMaxWidth(width, 520, 320, 24);
  const socket = adapter as SocketAdapter;

  useEffect(() => {
    let mounted = true;

    (async () => {
      const playerInfo = await getOrCreatePlayerId();
      if (mounted) setPlayerName(playerInfo.displayName);

      if (playerInfo.source === "fallback") {
        setTimeout(async () => {
          const updated = await getOrCreatePlayerId();
          if (mounted) setPlayerName(updated.displayName);
        }, 2000);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const refreshRooms = useCallback(async () => {
    if (!socket.discoverRooms) return;
    setIsSearching(true);
    await socket.discoverRooms();
  }, [socket]);

  useEffect(() => {
    let mounted = true;

    adapter.on("message", (ev) => {
      if (!mounted || ev.type !== "state" || !ev.state) return;

      if (ev.state.type === "availableRooms") {
        setAvailableRooms(ev.state.rooms || []);
        setRoomsLoaded(true);
        setIsSearching(false);
        setError(null);
      } else if (ev.state.type === "error") {
        setError(ev.state.message);
        setIsSearching(false);
        setConnectionStatus("disconnected");
      } else if (ev.state.type === "socketConnected") {
        setConnectionStatus("connected");
        setError(null);
        void refreshRooms();
      } else if (ev.state.type === "socketDisconnected") {
        setConnectionStatus("disconnected");
        setIsSearching(false);
      } else if (ev.state.type === "connected") {
        setConnectionStatus("connected");
      }
    });

    (async () => {
      try {
        setConnectionStatus("connecting");
        setIsSearching(true);
        await adapter.connect();
        if (!mounted) return;
        setConnectionStatus("connected");
        await refreshRooms();
      } catch {
        if (mounted) {
          setError("Could not reach the game server. Check your connection.");
          setIsSearching(false);
          setConnectionStatus("disconnected");
        }
      }
    })();

    const interval = setInterval(() => {
      if (!mounted || !socket.isConnected?.()) return;
      void refreshRooms();
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(interval);
      void adapter.disconnect();
    };
  }, [adapter, refreshRooms, socket]);

  const requireName = (): boolean => {
    if (playerName.trim()) return true;
    setError("Set your name in Settings first.");
    return false;
  };

  const handleJoinRoom = (roomId: string) => {
    if (!requireName()) return;
    triggerHaptic("medium");
    setError(null);
    onJoinRoom(roomId, playerName.trim());
  };

  const handleSpectateRoom = (roomId: string) => {
    if (!requireName()) return;
    if (!onSpectateRoom) return;
    triggerHaptic("medium");
    setError(null);
    onSpectateRoom(roomId, playerName.trim());
  };

  const handleJoinWithCode = () => {
    const code = normalizeRoomCode(roomCode);
    if (!code) {
      setError("Enter a room code from your host.");
      return;
    }
    handleJoinRoom(code);
  };

  const handleHost = () => {
    if (!requireName()) return;
    if (connectionStatus !== "connected") {
      setError("Connect to the server before hosting.");
      return;
    }
    triggerHaptic("medium");
    setError(null);
    onHostGame(playerName.trim());
  };

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <LobbyStatusBar
        playerCount={availableRooms.length}
        roomName="Multiplayer"
        statusLabel="Server"
        statusValue={connectionLabel(connectionStatus)}
        topInset={insets.top}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: topBarHeight + 12,
            paddingBottom: bottomBarHeight,
            paddingHorizontal: 12,
            alignItems: "center",
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: contentMax }}>
            <BlurPanel style={[ui.panel, { marginBottom: 14 }]}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {playerInitials(playerName || "?")}
                  </Text>
                </View>
                <View style={styles.profileCopy}>
                  <Text style={ui.fieldLabel}>Playing As</Text>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {playerName || "…"}
                  </Text>
                </View>
                <View style={styles.profileActions}>
                  {onNavigateToAchievements ? (
                    <TouchableOpacity
                      style={ui.btnSecondary}
                      onPress={onNavigateToAchievements}
                    >
                      <Text style={ui.btnSecondaryText}>Stats</Text>
                    </TouchableOpacity>
                  ) : null}
                  {onNavigateToSettings ? (
                    <TouchableOpacity
                      style={ui.btnSecondary}
                      onPress={onNavigateToSettings}
                    >
                      <Text style={ui.btnSecondaryText}>Edit</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </BlurPanel>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionTile}
                activeOpacity={0.85}
                onPress={handleHost}
                disabled={connectionStatus !== "connected"}
              >
                <BlurPanel style={styles.actionTileInner} intensity={50}>
                  <MenuIcon name="plus" size={22} color={colors.gold} />
                  <Text style={styles.actionTileTitle}>Host Game</Text>
                  <Text style={styles.actionTileHint}>
                    Create a lobby for friends
                  </Text>
                </BlurPanel>
              </TouchableOpacity>

              <View style={styles.actionTile}>
                <BlurPanel style={styles.actionTileInner} intensity={50}>
                  <MenuIcon name="multiplayer" size={22} color={colors.gold} />
                  <Text style={styles.actionTileTitle}>Join With Code</Text>
                  <View
                    style={[
                      styles.codeInputWrap,
                      codeFocused && styles.codeInputWrapFocused,
                    ]}
                  >
                    <TextInput
                      placeholder="Paste room code"
                      placeholderTextColor={colors.textMuted}
                      value={roomCode}
                      onChangeText={setRoomCode}
                      onFocus={() => setCodeFocused(true)}
                      onBlur={() => setCodeFocused(false)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                      textContentType="none"
                      importantForAutofill="no"
                      keyboardType="default"
                      {...(Platform.OS === "web"
                        ? ({
                            name: "room-code",
                            autoComplete: "off",
                            "data-1p-ignore": true,
                            "data-lpignore": "true",
                          } as object)
                        : null)}
                      style={styles.codeInput}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      ui.btnGoldFill,
                      styles.codeJoinBtn,
                      !normalizeRoomCode(roomCode) && styles.codeJoinBtnDisabled,
                    ]}
                    onPress={handleJoinWithCode}
                    disabled={!normalizeRoomCode(roomCode)}
                  >
                    <Text style={ui.btnGoldFillText}>Join</Text>
                  </TouchableOpacity>
                </BlurPanel>
              </View>
            </View>

            <View style={styles.listHeader}>
              <View style={styles.listHeaderLeft}>
                <Text style={styles.listTitle}>Open Games</Text>
                <View style={styles.listHeaderSpinnerSlot}>
                  {isSearching ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                onPress={refreshRooms}
                disabled={isSearching}
                style={styles.refreshBtn}
              >
                <Text
                  style={[
                    styles.refreshLink,
                    isSearching && styles.refreshLinkDisabled,
                  ]}
                >
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <BlurPanel style={styles.errorPanel} intensity={40}>
                <Text style={styles.errorText}>{error}</Text>
              </BlurPanel>
            ) : null}

            {availableRooms.length === 0 && roomsLoaded ? (
              <BlurPanel style={ui.panel} intensity={44}>
                <Text style={ui.emptyTitle}>No Public Games</Text>
                <Text style={ui.emptyBody}>
                  Host a game above and share the room code, or browse again
                  when someone opens a public lobby.
                </Text>
              </BlurPanel>
            ) : (
              availableRooms.map((room) => {
                const inPlay = !!room.inGame && !!room.roundInProgress;
                const betweenRounds = !!room.inGame && !room.roundInProgress;
                const full = !inPlay && room.playerCount >= room.maxPlayers;
                const showSpectate = inPlay && !!onSpectateRoom;
                const actionLabel = showSpectate
                  ? "Spectate"
                  : full
                    ? "Full"
                    : betweenRounds
                      ? "Join"
                      : "Join";
                const actionDisabled =
                  !playerName.trim() ||
                  (showSpectate ? false : full);
                return (
                  <BlurPanel
                    key={room.roomId}
                    style={[ui.panel, { padding: 14, marginBottom: 10 }]}
                    intensity={46}
                  >
                    <View style={styles.roomRow}>
                      <View style={styles.roomInfo}>
                        <Text style={styles.roomTitle} numberOfLines={1}>
                          {room.roomName || `${room.hostName}'s Game`}
                        </Text>
                        <Text style={styles.roomHost} numberOfLines={1}>
                          Host · {room.hostName}
                        </Text>
                        <View style={styles.roomMeta}>
                          <Text style={styles.roomMetaText}>
                            {room.playerCount}/{room.maxPlayers} players
                          </Text>
                          {inPlay ? (
                            <>
                              <Text style={styles.roomMetaDot}>·</Text>
                              <Text
                                style={[
                                  styles.roomMetaText,
                                  styles.roomMetaInPlay,
                                ]}
                              >
                                In Play
                              </Text>
                            </>
                          ) : betweenRounds ? (
                            <>
                              <Text style={styles.roomMetaDot}>·</Text>
                              <Text style={styles.roomMetaText}>
                                Between Rounds
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={styles.roomMetaDot}>·</Text>
                              <Text style={styles.roomMetaText}>
                                {formatTimeAgo(room.createdAt)}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[
                          showSpectate ? ui.btnSecondary : ui.btnGold,
                          { paddingVertical: 10, paddingHorizontal: 18 },
                          actionDisabled && styles.joinBtnDisabled,
                        ]}
                        onPress={() =>
                          showSpectate
                            ? handleSpectateRoom(room.roomId)
                            : handleJoinRoom(room.roomId)
                        }
                        disabled={actionDisabled}
                      >
                        <Text
                          style={[
                            showSpectate
                              ? ui.btnSecondaryText
                              : styles.joinBtnText,
                            actionDisabled && styles.joinBtnTextDisabled,
                          ]}
                        >
                          {actionLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </BlurPanel>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomBar>
        <BottomBarControls style={styles.bottomControls}>
          <View style={{ width: contentMax, alignSelf: "center" }}>
            <BottomBarLeave onPress={onBack} />
          </View>
        </BottomBarControls>
      </BottomBar>
    </ScreenContainer>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
  bottomControls: {
    paddingTop: 18,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.btnGoldBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.btnGoldBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "800",
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileActions: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  playerName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  actionTile: {
    flex: 1,
    minWidth: 0,
  },
  actionTileInner: {
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 8,
    minHeight: 168,
  },
  actionTileTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  actionTileHint: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
  codeInputWrap: {
    width: "100%",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  codeInputWrapFocused: {
    borderColor: colors.btnGoldBorder,
  },
  codeInput: {
    color: colors.inputText,
    fontSize: 13,
    textAlign: "center",
  },
  codeJoinBtn: {
    width: "100%",
    paddingVertical: 9,
    marginTop: 2,
  },
  codeJoinBtnDisabled: {
    opacity: 0.45,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  listHeaderSpinnerSlot: {
    width: 20,
    height: 20,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  listTitle: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 0,
  },
  refreshBtn: {
    minWidth: 64,
    alignItems: "flex-end",
    marginLeft: 12,
  },
  refreshLink: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "600",
  },
  refreshLinkDisabled: {
    opacity: 0.45,
  },
  errorPanel: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,100,100,0.35)",
    backgroundColor: "rgba(120,20,20,0.25)",
  },
  errorText: {
    color: "#ff8a8a",
    fontSize: 13,
    lineHeight: 18,
  },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  roomInfo: {
    flex: 1,
    minWidth: 0,
  },
  roomTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  roomHost: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  roomMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  roomMetaText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  roomMetaInPlay: {
    color: colors.gold,
    fontWeight: "700",
  },
  roomMetaDot: {
    color: colors.textMuted,
    marginHorizontal: 6,
  },
  joinBtnDisabled: {
    backgroundColor: colors.btnSecondaryBg,
    borderColor: colors.panelBorder,
  },
  joinBtnText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "800",
  },
  joinBtnTextDisabled: {
    color: colors.textMuted,
  },
  });
}
