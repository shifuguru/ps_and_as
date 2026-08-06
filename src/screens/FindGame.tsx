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

  /** D-010 — hide bot-hosted public table from Find Game listing (fragile cold-start surface). */
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
        roomName="Find Game"
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
            {/* Utility identity strip — no glass panel */}
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {playerInitials(playerName || "?")}
                </Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {playerName || "…"}
                </Text>
              </View>
              <View style={styles.profileActions}>
                {onNavigateToAchievements ? (
                  <TouchableOpacity
                    style={styles.tertiaryBtn}
                    onPress={onNavigateToAchievements}
                    accessibilityRole="button"
                    accessibilityLabel="Stats"
                  >
                    <ShimmerText style={styles.tertiaryBtnText}>Stats</ShimmerText>
                  </TouchableOpacity>
                ) : null}
                {onNavigateToSettings ? (
                  <TouchableOpacity
                    style={styles.iconOnlyBtn}
                    onPress={onNavigateToSettings}
                    accessibilityRole="button"
                    accessibilityLabel="Settings"
                  >
                    <MenuIcon name="gear" size={18} color={colors.accent} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Primary task: join a room */}
            <BlurPanel style={styles.joinHero} intensity={52}>
              <Text style={styles.joinHeroTitle}>Join With Code</Text>
              <View
                style={[
                  styles.codeInputWrap,
                  codeFocused && styles.codeInputWrapFocused,
                ]}
              >
                <TextInput
                  placeholder="Enter room code"
                  placeholderTextColor={colors.textQuaternary}
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

            {/* Secondary: host */}
            <TouchableOpacity
              style={[
                styles.hostSecondary,
                connectionStatus !== "connected" && styles.hostSecondaryDisabled,
              ]}
              activeOpacity={0.85}
              onPress={handleHost}
              disabled={connectionStatus !== "connected"}
              accessibilityRole="button"
              accessibilityLabel="Host Open Game"
            >
              <MenuIcon name="plus" size={18} color={colors.accent} />
              <View style={styles.hostSecondaryCopy}>
                <Text style={styles.hostSecondaryTitle}>Host Open Game</Text>
                <Text style={styles.hostSecondaryHint}>
                  Open a lobby and share the room code
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.listHeader}>
              <View style={styles.listHeaderLeft}>
                <Text style={styles.sectionTitle}>Open Games</Text>
                <View style={styles.listHeaderSpinnerSlot}>
                  {isSearching ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                onPress={refreshRooms}
                disabled={isSearching}
                style={styles.refreshLink}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Refresh open games"
              >
                <Text
                  style={[
                    styles.refreshLinkText,
                    isSearching && styles.refreshLinkDisabled,
                  ]}
                >
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorPanel}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {publicRooms.length === 0 && roomsLoaded ? (
              <View style={styles.emptyState}>
                <Text style={ui.emptyTitle}>No Public Games Available</Text>
                <Text style={ui.emptyBody}>
                  Host above and share the room code, or check again later.
                </Text>
              </View>
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
                  <View key={room.roomId} style={styles.roomRowCard}>
                    <View style={styles.roomRow}>
                      <View style={styles.roomInfo}>
                        <Text style={styles.roomTitle} numberOfLines={1}>
                          {room.roomName || `${room.hostName}'s Game`}
                        </Text>
                        <Text style={styles.roomMetaLine} numberOfLines={2}>
                          {isBotTable
                            ? "Bots"
                            : `Host · ${room.hostName}`}
                          {" · "}
                          {room.playerCount}/{room.maxPlayers}
                          {botStalled
                            ? " · Stalled"
                            : inPlay
                              ? isBotTable
                                ? " · Watching"
                                : seatOpen
                                  ? " · In Play · seat open"
                                  : " · In Play"
                              : betweenRounds
                                ? " · Between Rounds"
                                : ` · ${formatTimeAgo(room.createdAt)}`}
                        </Text>
                      </View>
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
  const accentRim = hexToRgba(colors.accent, isDark ? 0.28 : 0.22);

  return StyleSheet.create({
    bottomControls: {
      paddingTop: 18,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
      paddingHorizontal: 2,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: hexToRgba(colors.accent, isDark ? 0.14 : 0.12),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.accent, isDark ? 0.4 : 0.3),
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "800",
    },
    profileCopy: {
      flex: 1,
      minWidth: 0,
    },
    profileActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    },
    playerName: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "700",
    },
    tertiaryBtn: {
      minHeight: 40,
      paddingHorizontal: 10,
      justifyContent: "center",
    },
    tertiaryBtnText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    iconOnlyBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    joinHero: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: accentRim,
      overflow: "hidden",
    },
    joinHeroTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 4,
    },
    hostSecondary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 18,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.textPrimary, isDark ? 0.14 : 0.12),
      backgroundColor: hexToRgba(
        isDark ? colors.textPrimary : "#ffffff",
        isDark ? 0.06 : 0.35,
      ),
    },
    hostSecondaryDisabled: {
      opacity: 0.45,
    },
    hostSecondaryCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    hostSecondaryTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    hostSecondaryHint: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 16,
    },
    codeInputWrap: {
      width: "100%",
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.accent, isDark ? 0.2 : 0.16),
      backgroundColor: hexToRgba("#ffffff", isDark ? 0.08 : 0.55),
      paddingHorizontal: 10,
      paddingVertical: Platform.OS === "ios" ? 10 : 6,
      marginTop: 12,
    },
    codeInputWrapFocused: {
      borderColor: hexToRgba(colors.accent, isDark ? 0.45 : 0.36),
    },
    codeInput: {
      color: colors.inputText,
      fontSize: 16,
      textAlign: "center",
    },
    codeJoinBtn: {
      width: "100%",
      paddingVertical: 11,
      marginTop: 10,
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
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    listHeaderSpinnerSlot: {
      width: 20,
      height: 20,
      marginLeft: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    refreshLink: {
      minHeight: 40,
      paddingHorizontal: 8,
      justifyContent: "center",
    },
    refreshLinkText: {
      color: colors.accent,
      fontSize: 14,
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
      borderColor: hexToRgba("#ff8a8a", 0.4),
      backgroundColor: hexToRgba("#ff8a8a", isDark ? 0.1 : 0.08),
    },
    errorText: {
      color: "#ff8a8a",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
    },
    emptyState: {
      paddingVertical: 20,
      paddingHorizontal: 12,
      alignItems: "center",
    },
    roomRowCard: {
      paddingVertical: 12,
      paddingHorizontal: 4,
      marginBottom: 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: hexToRgba(colors.textPrimary, isDark ? 0.12 : 0.1),
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
      marginBottom: 3,
    },
    roomMetaLine: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 16,
    },
    roomPrimaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    joinBtnDisabled: {
      backgroundColor: hexToRgba(colors.accent, 0.06),
      borderColor: hexToRgba(colors.accent, 0.18),
    },
    joinBtnText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "800",
    },
    joinBtnTextDisabled: {
      color: colors.textTertiary,
    },
  });
}
