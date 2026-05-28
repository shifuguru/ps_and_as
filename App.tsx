import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { View, Animated, StyleSheet, Text, TouchableOpacity, Platform, Alert } from "react-native";
import SplashScreen from "./src/screens/SplashScreen";
import CreateGame from "./src/screens/CreateGame";
import FindGame from "./src/screens/FindGame";
import GameScreen from "./src/screens/GameScreen";
import Achievements from "./src/screens/Achievements";
import Settings from "./src/screens/Settings";
import MainMenu from "./src/screens/MainMenu";
import ScreenContainer from "./src/components/ScreenContainer";
import BlurPanel from "./src/components/BlurPanel";
import { ThemeProvider, useAppTheme } from "./src/context/ThemeContext";
import { useMenuAudio } from "./src/hooks/useMenuAudio";
import AnimatedBackground from "./src/components/AnimatedBackground";
import { SocketAdapter } from "./src/game/socketAdapter";
import { MockAdapter } from "./src/game/network";
import type { LobbyMember } from "./src/game/network";
import { isSocketAdapter } from "./src/game/socketAdapter";
import { getOrCreatePlayerId } from "./src/services/gameCenter";
import {
  clearLobbySession,
  getLobbySession,
  saveLobbySession,
  type LobbySession,
} from "./src/services/lobbySession";
import { SafeAreaProvider } from "react-native-safe-area-context";
import FeltBackground from "./src/components/FeltBackground";
import FullscreenBlurScrim from "./src/components/FullscreenBlurScrim";
import { DEFAULT_FELT_COLOR } from "./src/services/wallpaper";
import { WEB_SPLASH_OVERLAY } from "./src/styles/webFullBleed";
import { tryCollapseSafariChrome } from "./src/utils/safariChrome";
import { useVisualViewportSize } from "./src/hooks/useVisualViewportSize";
import { useAppFonts } from "./src/hooks/useAppFonts";
import { StatusBar } from "expo-status-bar";

function AppContent() {
  const { colors, ui, blur, feltTint, setFeltTint, refreshFeltTint } = useAppTheme();
  const viewport = useVisualViewportSize();
  // splashVisible: whether the splash overlay is still mounted
  // menuVisible: whether the main menu should be shown (after splash fully hidden)
  const [splashVisible, setSplashVisible] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const { playEffect, toggleMute, isMuted, muted } = useMenuAudio();
  const [screen, setScreen] = useState<
    "menu" | "create" | "find" | "game"
  >("menu");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[] | null>(null);
  const [dealSeed, setDealSeed] = useState<number | undefined>(undefined);
  const [localPlayerName, setLocalPlayerName] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [roomAdapter, setRoomAdapter] = useState<SocketAdapter | null>(null);
  // localAdapter is used for offline/mock games so we can reuse the same
  // MockAdapter instance between screens and avoid multiple adapters/logs.
  const [localAdapter, setLocalAdapter] = useState<any | null>(null);
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isOnlineGame, setIsOnlineGame] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);

  const disconnectRoom = () => {
    try {
      roomAdapter?.disconnect();
    } catch {
      /* ignore */
    }
    void clearLobbySession();
    setPendingRejoin(null);
    setRoomAdapter(null);
    setJoinedRoomId(null);
    setActiveRoomId(null);
    setIsSpectator(false);
  };

  // Discovery adapter is created lazily only when viewing the Find Game screen so
  // we don't attempt network connections while the user is in offline/local flows.
  const discoveryAdapter = useMemo(() => {
    if (screen !== "find") return null;
    try {
      console.log("[App] Creating network adapter for discovery only...");
      return new SocketAdapter(undefined, "", "", "", false);
    } catch (e) {
      console.error("[App] Failed to create network adapter:", e);
      return null;
    }
  }, [screen]);

  useEffect(() => {
    void (async () => {
      const session = await getLobbySession();
      if (session) setPendingRejoin(session);
    })();
  }, []);

  const rejoinLobby = async () => {
    if (!pendingRejoin) return;
    const profile = await getOrCreatePlayerId();
    if (profile.id !== pendingRejoin.profileId) {
      await clearLobbySession();
      setPendingRejoin(null);
      Alert.alert(
        "Cannot Rejoin",
        "This lobby was saved under a different player profile on this device.",
      );
      return;
    }
    playEffect("click");
    setLocalPlayerName(pendingRejoin.playerName);
    setRoomAdapter(
      new SocketAdapter(
        undefined,
        pendingRejoin.roomId,
        pendingRejoin.playerName,
        profile.id,
        true,
      ),
    );
    setJoinedRoomId(pendingRejoin.roomId);
    setActiveRoomId(pendingRejoin.roomId);
    setIsOnlineGame(true);
    setScreen("create");
    setPendingRejoin(null);
  };

  const splashOpacity = useRef(new Animated.Value(1)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;

  const hideSplashAndShowMenu = () => {
    Animated.timing(splashOpacity, {
      toValue: 0.0,
      duration: 800,
      useNativeDriver: false,
    }).start(() => {
      // after animation completes remove splash and show menu
      setSplashVisible(false);
      setMenuVisible(true);
      tryCollapseSafariChrome();
      // Fade in the menu
      Animated.timing(menuOpacity, {
        toValue: 1.0,
        duration: 600,
        useNativeDriver: false,
      }).start();
    });
  };

  const startRandomGame = async () => {
    const playerInfo = await getOrCreatePlayerId();
    const hostName = playerInfo.displayName || "Player";
    console.log("[App] Quick Game requested", {
      hostName,
      playerInfoId: playerInfo.id,
    });
    setLocalPlayerName(hostName);
    setLocalPlayerId(playerInfo.id);
    setLobbyMembers([
      { id: "1", name: hostName },
      { id: "2", name: "CPU 1" },
      { id: "3", name: "CPU 2" },
      { id: "4", name: "CPU 3" },
    ]);
    setIsOnlineGame(false);
    try {
      const m = new MockAdapter();
      setLocalAdapter(m);
    } catch (e) {
      console.warn("[App] Failed to create MockAdapter:", e);
      setLocalAdapter(null);
    }
    setRoomAdapter(null);
    setJoinedRoomId(null);
    setScreen("game");
  };

  const primaryButtons: {
    label: string;
    icon: "plus" | "shuffle" | "person" | "globe" | "multiplayer" | "trophy" | "gear";
    action: () => void;
  }[] = [
    {
      label: "Create Game",
      icon: "plus",
      action: () => {
        disconnectRoom();
        setIsOnlineGame(false);
        setRoomAdapter(null);
        setJoinedRoomId(null);
        setScreen("create");
      },
    },
    {
      label: "Quick Game",
      icon: "shuffle",
      action: () => {
        void startRandomGame();
      },
    },
    {
      label: "Multiplayer",
      icon: "multiplayer",
      action: () => {
        disconnectRoom();
        setIsOnlineGame(false);
        setRoomAdapter(null);
        setJoinedRoomId(null);
        setScreen("find");
      },
    },
    {
      label: "Achievements",
      icon: "trophy",
      action: () => openAchievements(),
    },
    {
      label: "Settings",
      icon: "gear",
      action: () => openSettings(),
    },
  ];
  const [wallpaperSource, setWallpaperSource] = useState<any>(require("./assets/ps_and_as_bg.png"));
  const [wallpaperRawUri, setWallpaperRawUri] = useState<string | null>(null);
  const [pendingRejoin, setPendingRejoin] = useState<LobbySession | null>(null);

  useEffect(() => {
    console.log("[App] screen state", {
      screen,
      menuVisible,
      isOnlineGame,
      joinedRoomId,
      activeRoomId,
      localAdapter: !!localAdapter,
      roomAdapter: !!roomAdapter,
      lobbyMembersCount: lobbyMembers?.length ?? 0,
    });
  }, [screen, menuVisible, isOnlineGame, joinedRoomId, activeRoomId, localAdapter, roomAdapter, lobbyMembers]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const doc: any = (globalThis as { document?: any }).document;
    if (!doc) return;
    const style = doc.createElement("style");
    style.setAttribute("data-app", "no-text-select");
    style.textContent = `
      html, body, #root {
        position: fixed;
        inset: 0;
        width: 100%;
        margin: 0;
        padding: 0;
        background-color: ${colors.surface};
        overflow: hidden;
        overscroll-behavior: none;
        touch-action: manipulation;
      }
      @supports (height: 100dvh) {
        html, body, #root {
          height: 100dvh;
          min-height: 100dvh;
        }
      }
      html, body, #root, #root * {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }
      input, textarea {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
    `;
    doc.head.appendChild(style);
    return () => {
      doc.head.removeChild(style);
    };
  }, [colors.surface]);

  useEffect(() => {
    (async () => {
      try {
        const svc = require("./src/services/wallpaper");
        const src = await svc.getWallpaperSource();
        const tint = await svc.getWallpaperTint();
        const raw = await svc.getWallpaperUri();
        setWallpaperSource(src);
        setFeltTint(tint ?? DEFAULT_FELT_COLOR);
        setWallpaperRawUri(raw);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const reloadWallpaper = async () => {
    try {
      const svc = require("./src/services/wallpaper");
      const src = await svc.getWallpaperSource();
      const tint = await svc.getWallpaperTint();
      const raw = await svc.getWallpaperUri();
      setWallpaperSource(src);
      setFeltTint(tint ?? DEFAULT_FELT_COLOR);
      await refreshFeltTint();
      setWallpaperRawUri(raw);
    } catch (e) {
      // ignore
    }
  };

  const openSettings = () => setSettingsOpen(true);

  const closeSettings = () => {
    void reloadWallpaper();
    setSettingsOpen(false);
  };

  const openAchievements = () => setAchievementsOpen(true);

  const closeAchievements = () => setAchievementsOpen(false);

  const lobbyMembersRef = useRef(lobbyMembers);
  lobbyMembersRef.current = lobbyMembers;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const localPlayerNameRef = useRef(localPlayerName);
  localPlayerNameRef.current = localPlayerName;
  const localPlayerIdRef = useRef(localPlayerId);
  localPlayerIdRef.current = localPlayerId;
  const activeRoomIdRef = useRef(activeRoomId);
  activeRoomIdRef.current = activeRoomId;
  const joinedRoomIdRef = useRef(joinedRoomId);
  joinedRoomIdRef.current = joinedRoomId;

  const enterOnlineGame = useCallback(
    (
      members: LobbyMember[],
      localName: string,
      localSocketId?: string,
      asSpectator = false,
    ) => {
      console.log("[App] enterOnlineGame:", members.length, "players", asSpectator ? "(spectator)" : "");
      setLobbyMembers(members);
      setLocalPlayerName(localName);
      if (localSocketId) setLocalPlayerId(localSocketId);
      setIsSpectator(asSpectator);
      setDealSeed(undefined);
      setIsOnlineGame(true);
      setLocalAdapter(null);
      setScreen("game");
    },
    [],
  );

  // Kicked / room dismissed must work from any screen (lobby or in-game).
  useEffect(() => {
    if (!roomAdapter || !isSocketAdapter(roomAdapter)) return;

    const onForcedExit = (ev: {
      type: string;
      state?: { type?: string; message?: string };
    }) => {
      if (ev.type !== "state" || !ev.state?.type) return;
      const kind = ev.state.type;
      if (kind !== "kicked" && kind !== "roomDismissed") return;

      roomAdapter.clearRoomSession();
      void clearLobbySession();
      setPendingRejoin(null);
      setJoinedRoomId(null);
      setActiveRoomId(null);
      setIsOnlineGame(false);
      setIsSpectator(false);
      setLobbyMembers(null);
      setRoomAdapter(null);
      setScreen("menu");

      if (kind === "kicked") {
        Alert.alert(
          "Removed from Game",
          ev.state.message || "You have been removed from the game",
        );
      } else {
        Alert.alert("Room Closed", "The host closed this lobby.");
      }
    };

    roomAdapter.on("message", onForcedExit);
    return () => {
      roomAdapter.off("message", onForcedExit);
    };
  }, [roomAdapter]);

  // All clients must react to startGame here — CreateGame may unmount before guests receive it.
  useEffect(() => {
    if (!roomAdapter || !isSocketAdapter(roomAdapter)) return;

    const onMessage = (ev: {
      type: string;
      state?: {
        type?: string;
        players?: unknown;
        spectator?: boolean;
      };
    }) => {
      if (ev.type !== "state" || ev.state?.type !== "startGame") return;
      if (screenRef.current === "game") return;

      const asSpectator = !!ev.state.spectator;
      const rawPlayers = ev.state.players;
      const fromEvent: LobbyMember[] = Array.isArray(rawPlayers)
        ? rawPlayers.map((p: string | LobbyMember, i: number) =>
            typeof p === "string"
              ? { id: String(i + 1), name: p }
              : { id: p.id, name: p.name, ready: p.ready },
          )
        : [];
      const members =
        fromEvent.length > 0
          ? fromEvent
          : lobbyMembersRef.current && lobbyMembersRef.current.length > 0
            ? lobbyMembersRef.current
            : [];

      const roomId = activeRoomIdRef.current ?? joinedRoomIdRef.current;
      const displayName = localPlayerNameRef.current ?? "Player";
      const profileId = roomAdapter.getProfileId();
      const localId =
        members.find((m) => m.id === profileId)?.id ??
        members.find(
          (m) =>
            m.name.toLowerCase() === displayName.trim().toLowerCase(),
        )?.id ??
        localPlayerIdRef.current ??
        undefined;

      const enter = () => {
        if (screenRef.current === "game") return;
        enterOnlineGame(members, displayName, localId, asSpectator);
      };

      if (roomId) {
        roomAdapter.requestGameState(roomId);
      }

      if (roomAdapter.getCachedGameState()) {
        enter();
        return;
      }

      let entered = false;
      const onSync = (syncEv: { type: string; state?: { type?: string } }) => {
        if (entered) return;
        if (syncEv.type === "state" && syncEv.state?.type === "gameStateSync") {
          entered = true;
          roomAdapter.off("message", onSync);
          enter();
        }
      };
      roomAdapter.on("message", onSync);
      setTimeout(() => {
        if (entered) return;
        entered = true;
        roomAdapter.off("message", onSync);
        enter();
      }, 2000);
    };

    roomAdapter.on("message", onMessage);
    return () => {
      roomAdapter.off("message", onMessage);
    };
  }, [roomAdapter, enterOnlineGame]);

  return (
    <>
      <StatusBar style={colors.statusBarStyle} />
    <View
      style={[
        { flex: 1 },
        Platform.OS === "web" && [
          appStyles.webRoot,
          { height: viewport.height, maxHeight: viewport.height },
        ],
      ]}
    >
        {/* Persistent felt wallpaper — one instance for the whole app */}
        <FeltBackground
          fullBleed
          tint={feltTint}
        />

        <View style={appStyles.appContent}>
        {/* Menu / lobby background — game & menu use their own felt layer */}
        {screen !== "game" &&
          screen !== "create" &&
          screen !== "find" &&
          screen !== "menu" &&
          !settingsOpen &&
          !achievementsOpen && <AnimatedBackground />}

        {/* Splash overlay (kept mounted until hide animation finishes) */}
        {splashVisible && (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              WEB_SPLASH_OVERLAY,
              {
                justifyContent: "center",
                alignItems: "center",
                opacity: splashOpacity,
              },
            ]}
            pointerEvents="auto"
          >
            <SplashScreen onFinish={hideSplashAndShowMenu} />
          </Animated.View>
        )}

        {/* Main menu — consolidated with icons */}
        {menuVisible && screen === "menu" && (
          <Animated.View style={[{ flex: 1 }, { opacity: menuOpacity }]}>
            {pendingRejoin ? (
              <View
                style={[
                  appStyles.rejoinBanner,
                  {
                    backgroundColor: colors.btnGoldBg,
                    borderColor: colors.btnGoldBorder,
                  },
                ]}
              >
                <Text style={[appStyles.rejoinTitle, { color: colors.onFelt.textPrimary }]}>
                  Resume your lobby?
                </Text>
                <Text style={[appStyles.rejoinBody, { color: colors.onFelt.textSecondary }]} numberOfLines={2}>
                  {pendingRejoin.isHost ? "Host" : "Guest"} · room{" "}
                  {pendingRejoin.roomName || pendingRejoin.roomId}
                </Text>
                <View style={appStyles.rejoinActions}>
                  <TouchableOpacity
                    style={[appStyles.rejoinPrimary, { backgroundColor: colors.gold }]}
                    onPress={() => void rejoinLobby()}
                    activeOpacity={0.85}
                  >
                    <Text style={[appStyles.rejoinPrimaryText, { color: colors.textOnGold }]}>
                      Rejoin
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      appStyles.rejoinSecondary,
                      {
                        backgroundColor: colors.btnSecondaryBg,
                        borderColor: colors.btnSecondaryBorder,
                      },
                    ]}
                    onPress={() => {
                      void clearLobbySession();
                      setPendingRejoin(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[appStyles.rejoinSecondaryText, { color: colors.btnSecondaryText }]}>
                      Dismiss
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            <MainMenu
              buttons={primaryButtons}
              onButtonPress={(action) => {
                playEffect("click");
                action();
              }}
            />
          </Animated.View>
        )}
        {menuVisible && screen === "create" && (
          <CreateGame 
            adapter={roomAdapter || undefined} 
            isJoining={!!roomAdapter && !!joinedRoomId}
            joinRoomId={joinedRoomId || undefined}
            onRoomReady={(roomId) => {
              setActiveRoomId(roomId);
              if (isSocketAdapter(roomAdapter)) {
                roomAdapter.setActiveRoomId(roomId);
              }
              void (async () => {
                const profile = await getOrCreatePlayerId();
                await saveLobbySession({
                  roomId,
                  profileId: profile.id,
                  playerName: profile.displayName,
                  isHost: !joinedRoomId,
                  roomName: roomId,
                });
                setPendingRejoin(null);
              })();
            }}
            onBack={() => {
              const wasOnlineLobby = isSocketAdapter(roomAdapter);
              disconnectRoom();
              setIsOnlineGame(false);
              setScreen(wasOnlineLobby ? "find" : "menu");
            }}
            onNavigateToSettings={openSettings}
            onNavigateToAchievements={openAchievements}
            onLobbyMembersChange={(members) => {
              setLobbyMembers(members);
              lobbyMembersRef.current = members;
            }}
            onStart={(members, localName, localSocketId) => {
              if (isSocketAdapter(roomAdapter)) {
                enterOnlineGame(members, localName, localSocketId);
                return;
              }
              setLobbyMembers(members);
              setLocalPlayerName(localName);
              if (localSocketId) setLocalPlayerId(localSocketId);
              setDealSeed(undefined);
              setIsOnlineGame(false);
              disconnectRoom();
              try {
                const m = new MockAdapter();
                setLocalAdapter(m);
              } catch (e) {
                console.warn("[App] Failed to create MockAdapter:", e);
                setLocalAdapter(null);
              }
              setScreen("game");
            }} 
          />
        )}
        {menuVisible && screen === "find" && (
          discoveryAdapter ? (
            <FindGame 
              adapter={discoveryAdapter} 
              onBack={() => setScreen("menu")}
              onNavigateToSettings={openSettings}
            onNavigateToAchievements={openAchievements}
              onHostGame={(name) => {
                void (async () => {
                  const profile = await getOrCreatePlayerId();
                  setLocalPlayerName(name);
                  setRoomAdapter(
                    new SocketAdapter(undefined, "", name, profile.id, false),
                  );
                  setJoinedRoomId(null);
                  setActiveRoomId(null);
                  setIsOnlineGame(true);
                  setScreen("create");
                })();
              }}
              onJoinRoom={(roomId, playerName) => {
                void (async () => {
                  const profile = await getOrCreatePlayerId();
                  setLocalPlayerName(playerName);
                  setIsSpectator(false);
                  setRoomAdapter(
                    new SocketAdapter(
                      undefined,
                      roomId,
                      playerName,
                      profile.id,
                      true,
                    ),
                  );
                  setJoinedRoomId(roomId);
                  setActiveRoomId(roomId);
                  setIsOnlineGame(true);
                  setScreen("create");
                })();
              }}
              onSpectateRoom={(roomId, playerName) => {
                void (async () => {
                  const profile = await getOrCreatePlayerId();
                  setLocalPlayerName(playerName);
                  setIsSpectator(true);
                  setLobbyMembers([]);
                  const adapter = new SocketAdapter(
                    undefined,
                    roomId,
                    playerName,
                    profile.id,
                    true,
                  );
                  setRoomAdapter(adapter);
                  setJoinedRoomId(roomId);
                  setActiveRoomId(roomId);
                  setIsOnlineGame(true);
                  setScreen("game");
                  await adapter.connect();
                })();
              }}
            />
          ) : (
            <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 24,
                }}
              >
                <BlurPanel style={[ui.panel, { width: "100%", maxWidth: 360 }]} {...blur.panel} intensity={52}>
                  <Text style={ui.panelEyebrow}>Connection</Text>
                  <Text style={ui.emptyTitle}>Network Unavailable</Text>
                  <Text style={[ui.emptyBody, { marginBottom: 16 }]}>
                    Unable to connect to the game server. Check your connection and try again.
                  </Text>
                  <TouchableOpacity
                    style={ui.btnSecondary}
                    onPress={() => setScreen("menu")}
                    activeOpacity={0.85}
                  >
                    <Text style={ui.btnSecondaryText}>Back To Menu</Text>
                  </TouchableOpacity>
                </BlurPanel>
              </View>
            </ScreenContainer>
          )
        )}
        {menuVisible && screen === "game" && (
          <GameScreen 
            initialLobbyPlayers={lobbyMembers ?? undefined}
            dealSeed={dealSeed}
            localPlayerName={localPlayerName ?? undefined}
            localPlayerId={localPlayerId ?? undefined}
            adapter={
              isOnlineGame && roomAdapter
                ? roomAdapter
                : localAdapter ?? undefined
            }
            roomId={activeRoomId ?? joinedRoomId ?? undefined}
            isSpectator={isOnlineGame && isSpectator}
            onNavigateToAchievements={openAchievements}
            onBack={() => {
              if (isOnlineGame && activeRoomId && roomAdapter) {
                roomAdapter.leaveRoom(activeRoomId);
              }
              disconnectRoom();
              setIsOnlineGame(false);
              setLobbyMembers(null);
              setLocalAdapter(null);
              setScreen("menu");
            }}
          />
        )}
        {menuVisible && settingsOpen && (
          <View style={appStyles.settingsOverlay}>
            <FullscreenBlurScrim />
            <View style={appStyles.settingsForeground}>
              <Settings
                onWallpaperPreview={setFeltTint}
                onWallpaperChange={() => reloadWallpaper()}
                onBack={closeSettings}
              />
            </View>
          </View>
        )}
        {menuVisible && achievementsOpen && (
          <View style={appStyles.settingsOverlay}>
            <FullscreenBlurScrim />
            <View style={appStyles.settingsForeground}>
              <Achievements
                onBack={closeAchievements}
                onNavigateToSettings={() => {
                  closeAchievements();
                  openSettings();
                }}
              />
            </View>
          </View>
        )}
        </View>
    </View>
    </>
  );
}

export default function App() {
  const { ready: fontsReady } = useAppFonts();

  if (!fontsReady) {
    return (
      <SafeAreaProvider>
        <View style={appStyles.fontBoot} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
  fontBoot: {
    flex: 1,
    backgroundColor: "#000000",
  },
  webRoot: {
    minHeight: "100dvh",
    height: "100dvh",
    width: "100%",
  } as object,
  appContent: {
    flex: 1,
    position: "relative",
    zIndex: 1,
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
  },
  settingsForeground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 1,
  },
  rejoinBanner: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 20,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rejoinTitle: {
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 4,
  },
  rejoinBody: {
    fontSize: 12,
    marginBottom: 10,
  },
  rejoinActions: {
    flexDirection: "row",
    gap: 8,
  },
  rejoinPrimary: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  rejoinPrimaryText: {
    fontWeight: "800",
    fontSize: 13,
  },
  rejoinSecondary: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  rejoinSecondaryText: {
    fontWeight: "700",
    fontSize: 13,
  },
});