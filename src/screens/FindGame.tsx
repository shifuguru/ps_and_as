import React, { useCallback, useEffect, useState } from "react";
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
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { NetworkAdapter } from "../game/network";
import { SocketAdapter } from "../game/socketAdapter";
import { getOrCreatePlayerId } from "../services/gameCenter";
import { triggerHaptic } from "../utils/haptics";
import { playerInitials } from "../utils/playerDisplay";
import { GOLD, BLUR_PANEL, contentMaxWidth, ui } from "../styles/uiStandards";

interface AvailableRoom {
  roomId: string;
  hostName: string;
  roomName?: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
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

export default function FindGame({
  onBack,
  onJoinRoom,
  adapter,
  onNavigateToSettings,
}: {
  onBack: () => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  adapter: NetworkAdapter;
  onNavigateToSettings?: () => void;
}) {
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [isSearching, setIsSearching] = useState(true);
  const [playerName, setPlayerName] = useState("");
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
        setIsSearching(false);
        setError(null);
      } else if (ev.state.type === "error") {
        setError(ev.state.message);
        setIsSearching(false);
        setConnectionStatus("disconnected");
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
  }, [adapter, refreshRooms]);

  const handleJoinRoom = (roomId: string) => {
    if (!playerName.trim()) {
      setError("Set your name in Settings first.");
      return;
    }
    triggerHaptic("medium");
    setError(null);
    onJoinRoom(roomId, playerName.trim());
  };

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <LobbyStatusBar
        playerCount={availableRooms.length}
        roomName="Find Game"
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
            <BlurPanel style={[ui.panel, { marginBottom: 16 }]} {...BLUR_PANEL}>
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
                {onNavigateToSettings ? (
                  <TouchableOpacity
                    style={ui.btnSecondary}
                    onPress={onNavigateToSettings}
                  >
                    <Text style={ui.btnSecondaryText}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </BlurPanel>

            <View style={styles.listHeader}>
              <View style={styles.listHeaderLeft}>
                {isSearching ? (
                  <ActivityIndicator
                    size="small"
                    color={GOLD}
                    style={{ marginRight: 8 }}
                  />
                ) : null}
                <Text style={styles.listTitle}>
                  {isSearching
                    ? "Searching For Games…"
                    : `${availableRooms.length} Open Game${availableRooms.length === 1 ? "" : "s"}`}
                </Text>
              </View>
            </View>

            {error ? (
              <BlurPanel style={styles.errorPanel} intensity={40}>
                <Text style={styles.errorText}>{error}</Text>
              </BlurPanel>
            ) : null}

            {availableRooms.length === 0 && !isSearching ? (
              <BlurPanel style={ui.panel} intensity={44}>
                <Text style={ui.emptyTitle}>No Games Nearby</Text>
                <Text style={ui.emptyBody}>
                  Host a public game from Create Game and it will show up here
                  for others on your network.
                </Text>
              </BlurPanel>
            ) : (
              availableRooms.map((room) => {
                const full = room.playerCount >= room.maxPlayers;
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
                          <Text style={styles.roomMetaDot}>·</Text>
                          <Text style={styles.roomMetaText}>
                            {formatTimeAgo(room.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[
                          ui.btnGold,
                          { paddingVertical: 10, paddingHorizontal: 18 },
                          full && styles.joinBtnDisabled,
                        ]}
                        onPress={() => handleJoinRoom(room.roomId)}
                        disabled={full || !playerName.trim()}
                      >
                        <Text
                          style={[
                            styles.joinBtnText,
                            full && styles.joinBtnTextDisabled,
                          ]}
                        >
                          {full ? "Full" : "Join"}
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
            <View style={ui.actionTrack}>
              <TouchableOpacity
                style={[
                  ui.actionSecondary,
                  !onNavigateToSettings && { flex: 1 },
                ]}
                onPress={refreshRooms}
                disabled={isSearching}
              >
                <Text style={ui.actionSecondaryText}>Refresh</Text>
              </TouchableOpacity>
              {onNavigateToSettings ? (
                <TouchableOpacity
                  style={ui.actionPrimary}
                  onPress={onNavigateToSettings}
                >
                  <Text style={ui.actionPrimaryText}>Settings</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <BottomBarLeave onPress={onBack} />
          </View>
        </BottomBarControls>
      </BottomBar>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(212,175,55,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(212,175,55,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: GOLD,
    fontSize: 15,
    fontWeight: "800",
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
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
    flex: 1,
  },
  listTitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "600",
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
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  roomHost: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginBottom: 6,
  },
  roomMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  roomMetaText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
  },
  roomMetaDot: {
    color: "rgba(255,255,255,0.25)",
    marginHorizontal: 6,
  },
  joinBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.15)",
  },
  joinBtnText: {
    color: GOLD,
    fontSize: 14,
    fontWeight: "800",
  },
  joinBtnTextDisabled: {
    color: "rgba(255,255,255,0.35)",
  },
});
