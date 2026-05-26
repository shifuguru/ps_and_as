import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, Animated, StyleSheet, Text, TouchableOpacity, Platform } from "react-native";
import SplashScreen from "./src/screens/SplashScreen";
import CreateGame from "./src/screens/CreateGame";
import FindGame from "./src/screens/FindGame";
import GameScreen from "./src/screens/GameScreen";
import Achievements from "./src/screens/Achievements";
import Settings from "./src/screens/Settings";
import MainMenu from "./src/screens/MainMenu";
import ScreenContainer from "./src/components/ScreenContainer";
import BlurPanel from "./src/components/BlurPanel";
import { ui, BLUR_PANEL } from "./src/styles/uiStandards";
import { useMenuAudio } from "./src/hooks/useMenuAudio";
import AnimatedBackground from "./src/components/AnimatedBackground";
import { SocketAdapter } from "./src/game/socketAdapter";
import { MockAdapter } from "./src/game/network";
import type { LobbyMember } from "./src/game/network";
import { isSocketAdapter } from "./src/game/socketAdapter";
import { getOrCreatePlayerId } from "./src/services/gameCenter";
import { SafeAreaProvider } from "react-native-safe-area-context";
import FeltBackground from "./src/components/FeltBackground";
import { DEFAULT_FELT_COLOR } from "./src/services/wallpaper";
import { WEB_SPLASH_OVERLAY } from "./src/styles/webFullBleed";
import { tryCollapseSafariChrome } from "./src/utils/safariChrome";

export default function App() {
  // splashVisible: whether the splash overlay is still mounted
  // menuVisible: whether the main menu should be shown (after splash fully hidden)
  const [splashVisible, setSplashVisible] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const { playEffect, toggleMute, isMuted, muted } = useMenuAudio();
  const [screen, setScreen] = useState<"menu" | "create" | "find" | "game" | "achievements" | "settings">("menu");
  const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[] | null>(null);
  const [localPlayerName, setLocalPlayerName] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [roomAdapter, setRoomAdapter] = useState<SocketAdapter | null>(null);
  // localAdapter is used for offline/mock games so we can reuse the same
  // MockAdapter instance between screens and avoid multiple adapters/logs.
  const [localAdapter, setLocalAdapter] = useState<any | null>(null);
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isOnlineGame, setIsOnlineGame] = useState(false);

  const disconnectRoom = () => {
    try {
      roomAdapter?.disconnect();
    } catch {
      /* ignore */
    }
    setRoomAdapter(null);
    setJoinedRoomId(null);
    setActiveRoomId(null);
  };

  // Discovery adapter is created lazily only when viewing the Find Game screen so
  // we don't attempt network connections while the user is in offline/local flows.
  const discoveryAdapter = useMemo(() => {
    if (screen !== "find") return null;
    try {
      console.log("[App] Creating network adapter for discovery only...");
      return new SocketAdapter(undefined, "", "", false);
    } catch (e) {
      console.error("[App] Failed to create network adapter:", e);
      return null;
    }
  }, [screen]);

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
    icon: "plus" | "shuffle" | "person" | "globe" | "trophy" | "gear";
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
    /* LOCAL GAME DISABLED FOR NOW
    {
      label: "Local",
      icon: "person",
      action: () => {
        disconnectRoom();
        setIsOnlineGame(false);
        setScreen("create");
      },
    },
    */
    /* FIND GAME DISABLED FOR NOW
    {
      label: "Find Game",
      icon: "globe",
      action: () => setScreen("find"),
    },
    */
    {
      label: "Achievements",
      icon: "trophy",
      action: () => setScreen("achievements"),
    },
    {
      label: "Settings",
      icon: "gear",
      action: () => setScreen("settings"),
    },
  ];
  const [wallpaperSource, setWallpaperSource] = useState<any>(require("./assets/ps_and_as_bg.png"));
  const [wallpaperTint, setWallpaperTint] = useState<string | null>(null);
  const [wallpaperRawUri, setWallpaperRawUri] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const doc: any = (globalThis as { document?: any }).document;
    if (!doc) return;
    const style = doc.createElement("style");
    style.setAttribute("data-app", "no-text-select");
    style.textContent = `
      html, body, #root {
        height: 100%;
        min-height: 100%;
        min-height: 100dvh;
        margin: 0;
        padding: 0;
        background-color: ${DEFAULT_FELT_COLOR};
        overflow: hidden;
        overscroll-behavior: none;
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
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const svc = require("./src/services/wallpaper");
        const src = await svc.getWallpaperSource();
        const tint = await svc.getWallpaperTint();
        const raw = await svc.getWallpaperUri();
        setWallpaperSource(src);
        setWallpaperTint(tint);
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
      setWallpaperTint(tint);
      setWallpaperRawUri(raw);
    } catch (e) {
      // ignore
    }
  };

  return (
    <SafeAreaProvider>
    <View style={[{ flex: 1 }, Platform.OS === "web" && appStyles.webRoot]}>
        {/* Persistent felt wallpaper — one instance for the whole app */}
        <FeltBackground
          fullBleed
          tint={wallpaperTint ?? DEFAULT_FELT_COLOR}
        />

        <View style={appStyles.appContent}>
        {/* Menu / lobby background — game & menu use their own felt layer */}
        {screen !== "game" &&
          screen !== "create" &&
          screen !== "find" &&
          screen !== "menu" &&
          screen !== "achievements" &&
          screen !== "settings" && <AnimatedBackground />}

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
            <MainMenu
              buttons={primaryButtons}
              onButtonPress={(action) => {
                playEffect("click");
                action();
              }}
            />
          </Animated.View>
        )}
        {menuVisible && screen === "achievements" && (
          <Achievements onBack={() => setScreen("menu")} />
        )}
        {menuVisible && screen === "settings" && (
          <Settings
            onWallpaperPreview={(tint) => setWallpaperTint(tint)}
            onWallpaperChange={() => reloadWallpaper()}
            onBack={() => {
              void reloadWallpaper();
              setScreen("menu");
            }}
          />
        )}
        {menuVisible && screen === "create" && (
          <CreateGame 
            adapter={roomAdapter || undefined} 
            isJoining={!!roomAdapter && !!joinedRoomId}
            joinRoomId={joinedRoomId || undefined}
            onRoomReady={(roomId) => setActiveRoomId(roomId)}
            onBack={() => {
              disconnectRoom();
              setIsOnlineGame(false);
              setScreen("menu");
            }}
            onNavigateToSettings={() => setScreen("settings")}
            onStart={(members, localName, localSocketId) => {
              console.log("[App] CreateGame onStart:", members, localName, localSocketId);
              setLobbyMembers(members);
              setLocalPlayerName(localName);
              if (localSocketId) setLocalPlayerId(localSocketId);
              const online = isSocketAdapter(roomAdapter);
              setIsOnlineGame(online);
              if (online) {
                setLocalAdapter(null);
              } else {
                disconnectRoom();
                try {
                  const m = new MockAdapter();
                  setLocalAdapter(m);
                } catch (e) {
                  console.warn("[App] Failed to create MockAdapter:", e);
                  setLocalAdapter(null);
                }
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
              onNavigateToSettings={() => setScreen("settings")}
              onJoinRoom={(roomId, playerName) => {
                setRoomAdapter(
                  new SocketAdapter(undefined, roomId, playerName, true),
                );
                setJoinedRoomId(roomId);
                setActiveRoomId(roomId);
                setIsOnlineGame(true);
                setScreen("create");
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
                <BlurPanel style={[ui.panel, { width: "100%", maxWidth: 360 }]} {...BLUR_PANEL} intensity={52}>
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
            localPlayerName={localPlayerName ?? undefined}
            localPlayerId={localPlayerId ?? undefined}
            adapter={
              isOnlineGame && roomAdapter
                ? roomAdapter
                : localAdapter ?? undefined
            }
            roomId={activeRoomId ?? joinedRoomId ?? undefined}
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
        </View>
    </View>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
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
});