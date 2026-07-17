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
import ShimmerText from "../components/ShimmerText";
import { useLayoutInsets } from "../hooks/useLayoutInsets";

const KeyboardShell =
  Platform.OS === "web" ? View : KeyboardAvoidingView;
const keyboardShellProps =
  Platform.OS === "web"
    ? ({ style: { flex: 1 } } as const)
    : ({
        style: { flex: 1 },
        behavior: Platform.OS === "ios" ? ("padding" as const) : undefined,
      } as const);

import { NetworkAdapter } from "../game/network";
import { SocketAdapter } from "../game/socketAdapter";
import { getOrCreatePlayerId } from "../services/gameCenter";
import { triggerHaptic } from "../utils/haptics";
import { playerInitials } from "../utils/playerDisplay";
import { validateDisplayText, displayTextError } from "../utils/profanityFilter";
import {
  isBotPublicRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../utils/roomCode";
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

interface AvailableRoom {
  roomId: string;
  hostName: string;
  roomName?: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  inGame?: boolean;
  roundInProgress?: boolean;
  deadHandSeatOpen?: boolean;
  spectatorCount?: number;
  isBotHosted?: boolean;
  botTableStalled?: boolean;
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

function normalizeRoomCodeInput(raw: string): string {
  return normalizeRoomCode(raw);
}

export default function FindGame({
  onBack,
  onJoinRoom,
  onHostGame,
  onSpectateRoom,
  adapter,
  onNavigateToSettings,
  onNavigateToAchievements,
  preferredPlayerName,
}: {
  onBack: () => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onHostGame: (playerName: string) => void;
  onSpectateRoom?: (roomId: string, playerName: string) => void;
  adapter: NetworkAdapter;
  onNavigateToSettings?: () => void;
  onNavigateToAchievements?: () => void;
  preferredPlayerName?: string;
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

  useEffect(() => {
    const next = preferredPlayerName?.trim();
    if (next) setPlayerName(next);
  }, [preferredPlayerName]);

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
    if (!playerName.trim()) {
      setError("Set your name in Settings first.");
      return false;
    }
    const check = validateDisplayText(playerName, "Player name");
    const err = displayTextError(check);
    if (err) {
      setError(err);
      return false;
    }
    return true;
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
    const code = normalizeRoomCodeInput(roomCode);
    if (!code) {
      setError("Enter a room code from your host.");
      return;
    }
    if (!isValidRoomCode(code)) {
      setError("Room codes are 4–8 letters and numbers.");
      return;
    }
    if (isBotPublicRoomCode(code)) {
      setError("No public games available right now. Host a game or try again later.");
      return;
    }
    handleJoinRoom(code);
  };

  /** D-010 — hide bot-hosted public table from Find Game listing. */
  const publicRooms = useMemo(
    () =>
      availableRooms.filter(
        (room) => !room.isBotHosted && !isBotPublicRoomCode(room.roomId),
      ),
    [availableRooms],
  );

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
        countLabel="Open"
        roomName="Multiplayer"
        statusLabel="Server"
        statusValue={connectionLabel(connectionStatus)}
        topInset={insets.top}
      />

      <KeyboardShell {...keyboardShellProps}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: topBarHeight + 12,
            paddingBottom: bottomBarHeight,
            paddingHorizontal: 16,
            alignItems: "center",
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: contentMax }}>
            <BlurPanel style={[ui.panel, styles.glassCard, { marginBottom: 14 }]}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {playerInitials(playerName || "?")}
                  </Text>
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.sectionEyebrow}>Playing As</Text>
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
                      <ShimmerText style={ui.btnSecondaryText}>Stats</ShimmerText>
                    </TouchableOpacity>
                  ) : null}
                  {onNavigateToSettings ? (
                    <TouchableOpacity
                      style={[ui.btnSecondary, styles.profileIconBtn]}
                      onPress={onNavigateToSettings}
                      accessibilityRole="button"
                      accessibilityLabel="Settings"
                    >
                      <MenuIcon name="gear" size={18} color={colors.gold} />
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
                  <View style={styles.actionTileHostLayout}>
                    <View style={styles.actionTileHostCopy}>
                      <Text style={styles.actionTileTitle}>Host Open Game</Text>
                      <Text style={styles.actionTileHint}>
                        Create an open lobby for anyone to join.
                      </Text>
                    </View>
                    <View style={styles.actionTileIconHost}>
                      <MenuIcon name="plus" size={28} color={colors.gold} />
                    </View>
                  </View>
                </BlurPanel>
              </TouchableOpacity>

              <View style={styles.actionTile}>
                <BlurPanel style={styles.actionTileInnerJoin} intensity={50}>
                  <View style={styles.joinTitleRow}>
                    <MenuIcon name="multiplayer" size={18} color={colors.gold} />
                    <Text style={styles.actionTileTitle}>Join With Code</Text>
                  </View>
                  <View
                    style={[
                      styles.codeInputWrap,
                      codeFocused && styles.codeInputWrapFocused,
                    ]}
                  >
                    <TextInput
                      placeholder="Enter room code"
                      placeholderTextColor={colors.textMuted}
                      value={roomCode}
                      onChangeText={(text) =>
                        setRoomCode(normalizeRoomCodeInput(text))
                      }
                      onFocus={() => setCodeFocused(true)}
                      onBlur={() => setCodeFocused(false)}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      spellCheck={false}
                      textContentType={
                        Platform.OS === "ios" ? "oneTimeCode" : "none"
                      }
                      autoComplete={
                        Platform.OS === "web" ? "one-time-code" : "off"
                      }
                      importantForAutofill="no"
                      passwordRules={Platform.OS === "ios" ? "" : undefined}
                      keyboardType={
                        Platform.OS === "ios" ? "ascii-capable" : "default"
                      }
                      {...(Platform.OS === "web"
                        ? ({
                            name: "ps-and-as-room-join-code",
                            id: "ps-and-as-room-join-code",
                            autoComplete: "one-time-code",
                            "data-1p-ignore": true,
                            "data-lpignore": "true",
                            "data-bwignore": "true",
                            "data-form-type": "other",
                          } as object)
                        : null)}
                      style={styles.codeInput}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      ui.btnGoldFill,
                      styles.codeJoinBtn,
                      !normalizeRoomCodeInput(roomCode) && styles.codeJoinBtnDisabled,
                    ]}
                    onPress={handleJoinWithCode}
                    disabled={!normalizeRoomCodeInput(roomCode)}
                  >
                    <Text style={ui.btnGoldFillText}>Join</Text>
                  </TouchableOpacity>
                </BlurPanel>
              </View>
            </View>

            <View style={styles.listHeader}>
              <View style={styles.listHeaderLeft}>
                <Text style={styles.sectionEyebrow}>Open Games</Text>
                <View style={styles.listHeaderSpinnerSlot}>
                  {isSearching ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                onPress={refreshRooms}
                disabled={isSearching}
                style={[ui.btnSecondary, styles.refreshBtn]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    ui.btnSecondaryText,
                    styles.refreshBtnText,
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

            {publicRooms.length === 0 && roomsLoaded ? (
              <BlurPanel style={[ui.panel, styles.glassCard]} intensity={44}>
                <Text style={ui.emptyTitle}>No Public Games Available</Text>
                <Text style={ui.emptyBody}>
                  Host a game above and share the room code, or browse again
                  when someone opens a public game.
                </Text>
              </BlurPanel>
            ) : (
              publicRooms.map((room) => {
                const inPlay = !!room.inGame && !!room.roundInProgress;
                const betweenRounds = !!room.inGame && !room.roundInProgress;
                const seatOpen = !!room.deadHandSeatOpen;
                const isBotTable = !!room.isBotHosted;
                const botStalled = !!room.botTableStalled;
                const full =
                  !inPlay && !isBotTable && room.playerCount >= room.maxPlayers;
                const showSpectate =
                  !!onSpectateRoom &&
                  !!room.inGame &&
                  seatOpen &&
                  room.playerCount >= 2 &&
                  (isBotTable || inPlay);
                const actionLabel = showSpectate
                  ? "Spectate"
                  : full
                    ? "Full"
                    : betweenRounds
                      ? "Join"
                      : "Join";
                const actionDisabled =
                  !playerName.trim() || (showSpectate ? false : full);
                return (
                  <BlurPanel
                    key={room.roomId}
                    style={[
                      ui.panel,
                      styles.glassCard,
                      { padding: 14, marginBottom: 10 },
                    ]}
                    intensity={46}
                  >
                    <View style={styles.roomRow}>
                      <View style={styles.roomInfo}>
                        <Text style={styles.roomTitle} numberOfLines={1}>
                          {room.roomName || `${room.hostName}'s Game`}
                        </Text>
                        <Text style={styles.roomHost} numberOfLines={1}>
                          {isBotTable
                            ? "Bots · dead hand seat open next round"
                            : `Host · ${room.hostName}`}
                        </Text>
                        <View style={styles.roomMeta}>
                          <Text style={styles.roomMetaText}>
                            {room.playerCount}/{room.maxPlayers} players
                          </Text>
                          {botStalled ? (
                            <>
                              <Text style={styles.roomMetaDot}>·</Text>
                              <Text
                                style={[
                                  styles.roomMetaText,
                                  styles.roomMetaStalled,
                                ]}
                              >
                                Stalled
                              </Text>
                            </>
                          ) : inPlay ? (
                            <>
                              <Text style={styles.roomMetaDot}>·</Text>
                              <Text
                                style={[
                                  styles.roomMetaText,
                                  styles.roomMetaInPlay,
                                ]}
                              >
                                {isBotTable
                                  ? "Bots playing · join to watch"
                                  : seatOpen
                                    ? "In Play · seat open"
                                    : "In Play"}
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
                      <View style={styles.roomActions}>
                        <TouchableOpacity
                          style={[
                            showSpectate ? ui.btnSecondary : ui.btnGold,
                            styles.roomPrimaryBtn,
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
                    </View>
                  </BlurPanel>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardShell>

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
  const isDark = colors.mode === "dark";
  const goldRim = hexToRgba(colors.gold, isDark ? 0.22 : 0.18);
  const cardDepth = Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  });

  return StyleSheet.create({
  bottomControls: {
    paddingTop: 18,
  },
  glassCard: {
    borderColor: goldRim,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...cardDepth,
  },
  sectionEyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 4,
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
    backgroundColor: hexToRgba(colors.gold, isDark ? 0.14 : 0.12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba(colors.gold, isDark ? 0.45 : 0.35),
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
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  profileIconBtn: {
    paddingHorizontal: 11,
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
    alignSelf: "stretch",
  },
  actionTileInner: {
    borderRadius: 16,
    padding: 14,
    minHeight: 168,
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: goldRim,
    overflow: "hidden",
    ...cardDepth,
  },
  actionTileHostLayout: {
    flex: 1,
    minHeight: 140,
    alignItems: "stretch",
  },
  actionTileHostCopy: {
    alignItems: "center",
    gap: 6,
  },
  actionTileInnerJoin: {
    borderRadius: 16,
    padding: 14,
    alignItems: "stretch",
    minHeight: 168,
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: goldRim,
    overflow: "hidden",
    ...cardDepth,
  },
  actionTileIconHost: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  joinTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
  },
  actionTileTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
  actionTileHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
  },
  codeInputWrap: {
    width: "100%",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba(colors.gold, isDark ? 0.2 : 0.16),
    backgroundColor: hexToRgba("#ffffff", isDark ? 0.08 : 0.55),
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    marginTop: 12,
  },
  codeInputWrapFocused: {
    borderColor: hexToRgba(colors.gold, isDark ? 0.45 : 0.36),
  },
  codeInput: {
    color: colors.inputText,
    fontSize: 16,
    textAlign: "center",
  },
  codeJoinBtn: {
    width: "100%",
    paddingVertical: 9,
    marginTop: 6,
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
  refreshBtn: {
    minWidth: 72,
    marginLeft: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  refreshBtnText: {
    fontSize: 13,
  },
  refreshLinkDisabled: {
    opacity: 0.45,
  },
  errorPanel: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hexToRgba("#ff8a8a", 0.4),
  },
  errorText: {
    color: "#ff8a8a",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
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
  roomMetaStalled: {
    color: "#e8a87c",
    fontWeight: "700",
  },
  roomActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  roomPrimaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  roomMetaDot: {
    color: colors.textMuted,
    marginHorizontal: 6,
  },
  joinBtnDisabled: {
    backgroundColor: hexToRgba(colors.gold, 0.06),
    borderColor: hexToRgba(colors.gold, 0.18),
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
