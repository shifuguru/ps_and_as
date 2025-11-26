import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, ImageBackground, Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import SplashScreen from "./src/screens/SplashScreen";
import { Platform } from 'react-native';
import MainMenu from "./src/screens/MainMenu";
import CreateGame from "./src/screens/CreateGame";
import FindGame from "./src/screens/FindGame";
import GameScreen from "./src/screens/GameScreen";
import Achievements from "./src/screens/Achievements";
import Settings from "./src/screens/Settings";
import Header from "./src/components/Header";
import { useMenuAudio } from "./src/hooks/useMenuAudio";
import MuteButton from "./src/components/ui/MuteButton";
import { styles } from "./src/styles/theme";
import { SocketAdapter } from "./src/game/socketAdapter";
import { MockAdapter } from "./src/game/network";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  // splashVisible: whether the splash overlay is still mounted
  // menuVisible: whether the main menu should be shown (after splash fully hidden)
  const [splashVisible, setSplashVisible] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const { playEffect, toggleMute, isMuted, muted } = useMenuAudio();
  const [screen, setScreen] = useState<"menu" | "create" | "find" | "game" | "achievements" | "settings">("menu");
  const [lobbyPlayers, setLobbyPlayers] = useState<string[] | null>(null);
  const [localPlayerName, setLocalPlayerName] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [roomAdapter, setRoomAdapter] = useState<SocketAdapter | null>(null);
  // localAdapter is used for offline/mock games so we can reuse the same
  // MockAdapter instance between screens and avoid multiple adapters/logs.
  const [localAdapter, setLocalAdapter] = useState<any | null>(null);
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  // Discovery adapter is created lazily only when viewing the Find Game screen so
  // we don't attempt network connections while the user is in offline/local flows.
  const discoveryAdapter = useMemo(() => {
    if (screen !== "find") return null;
    try {
      console.log("[App] Creating network adapter for discovery only...");
      // Discovery adapter should NOT auto-join any room
      return new SocketAdapter("http://192.168.88.138:3000", "", "", false);
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
      // Fade in the menu
      Animated.timing(menuOpacity, {
        toValue: 1.0,
        duration: 600,
        useNativeDriver: false,
      }).start();
    });
  };

  const buttons = ["Create Game", "Find Game", "Random Game", "Local", "Achievements", "Settings"];
  const [wallpaperSource, setWallpaperSource] = useState<any>(require("./assets/ps_and_as_bg.png"));
  const [wallpaperTint, setWallpaperTint] = useState<string | null>(null);
  const [wallpaperRawUri, setWallpaperRawUri] = useState<string | null>(null);

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
    <View style={{ flex: 1 }}>
        <ImageBackground
          source={wallpaperSource}
          resizeMode="cover"
          style={styles.background}
        >
          {/* If using the bundled felt asset, render a semi-transparent overlay
              with the selected felt color so the texture shows through. We detect
              the felt choice by checking the raw storage value (wallpaperRawUri). */}
          {(() => {
            try {
              const svc = require("./src/services/wallpaper");
              const isFeltSelected = wallpaperRawUri === null || wallpaperRawUri === svc.FELT_GREY_ASSET_MARKER;
              if (!isFeltSelected || !wallpaperTint) return null;
              // Normalize tint string: append alpha if user stored a 6-digit hex
              const t = (wallpaperTint || "").trim();
              let bg: string | undefined = undefined;
              if (/^#[0-9a-fA-F]{6}$/.test(t)) bg = t + "99";
              else if (/^#[0-9a-fA-F]{8}$/.test(t)) bg = t;
              else bg = t || undefined;
              return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: bg }]} pointerEvents="none" />;
            } catch (e) {
              return null;
            }
          })()}
        {/* Background scrim to improve contrast over wallpapers */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.36)' }} />
        </View>

        {/* Splash overlay (kept mounted until hide animation finishes) */}
        {splashVisible && (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
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

        {/* Main menu or screens */}
        {menuVisible && screen === "menu" && (
          <Animated.View style={[styles.menuContainer, { opacity: menuOpacity }]}>
            <Text style={[styles.title, { fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : "'Georgia', 'Palatino Linotype', 'Book Antiqua', serif", fontSize: 48, fontStyle: 'italic', marginTop: 120 }]}>P's & A's</Text>
            <Text style={styles.subtitle}>by rabbithole Games</Text>

            <View style={styles.buttonGroup}>
              {buttons.map((label, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.menuButton}
                  onPress={() => {
                    playEffect("click");
                    if (label === "Create Game") setScreen("create");
                    else if (label === "Find Game") setScreen("find");
                    else if (label === "Random Game") {
                      // start a quick random 4-player game
                      const rnd = ["You", "CPU 1", "CPU 2", "CPU 3"];
                      setLobbyPlayers(rnd);
                      setScreen("game");
                    } else if (label === "Local") {
                      // open Create Game screen in local (hotseat) mode so user can customize players
                      setScreen("create");
                    } else if (label === "Achievements") {
                      setScreen("achievements");
                    } else if (label === "Settings") {
                      setScreen("settings");
                    }
                  }}
                >
                  <Text style={styles.menuButtonText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}
        {menuVisible && screen === "achievements" && (
          <Achievements onBack={() => setScreen("menu")} />
        )}
        {menuVisible && screen === "settings" && (
          <Settings onWallpaperChange={() => reloadWallpaper()} onBack={() => setScreen("menu")} />
        )}
        {menuVisible && screen === "create" && (
          <CreateGame 
            adapter={roomAdapter || undefined} 
            isJoining={!!roomAdapter}
            joinRoomId={joinedRoomId || undefined}
            onBack={() => {
              setScreen("menu");
              setRoomAdapter(null);
              setJoinedRoomId(null);
            }}
            onNavigateToAchievements={() => setScreen("achievements")}
            onStart={(names, localName, localId) => {
              console.log("[App] CreateGame onStart called with names:", names, "localName:", localName, "localId:", localId);
              setLobbyPlayers(names); 
              setLocalPlayerName(localName);
              // store device-local player id (if provided)
              if (localId) setLocalPlayerId(localId);
              // Create a shared MockAdapter for local/offline games so the GameScreen
              // doesn't create its own adapter instance (which made logs interleaved)
              try {
                const m = new MockAdapter();
                setLocalAdapter(m);
              } catch (e) {
                console.warn('[App] Failed to create MockAdapter:', e);
                setLocalAdapter(null);
              }
              setScreen("game");
              setRoomAdapter(null);
              setJoinedRoomId(null);
            }} 
          />
        )}
        {menuVisible && screen === "find" && (
          discoveryAdapter ? (
            <FindGame 
              adapter={discoveryAdapter} 
              onBack={() => setScreen("menu")}
              onNavigateToAchievements={() => setScreen("achievements")}
              onJoinRoom={(roomId, playerName) => {
                // Create a new adapter for this specific room with auto-join enabled
                const newAdapter = new SocketAdapter("http://192.168.88.138:3000", roomId, playerName, true);
                setRoomAdapter(newAdapter);
                setJoinedRoomId(roomId);
                setScreen("create");
              }} 
            />
          ) : (
            <View style={styles.menuContainer}>
              <Text style={styles.title}>Network Unavailable</Text>
              <Text style={[styles.subtitle, { textAlign: "center", marginTop: 20 }]}>
                Unable to connect to server.{"\n"}Please check your connection.
              </Text>
              <TouchableOpacity 
                style={[styles.menuButton, { marginTop: 20 }]} 
                onPress={() => setScreen("menu")}
              >
                <Text style={styles.menuButtonText}>Back</Text>
              </TouchableOpacity>
            </View>
          )
        )}
        {menuVisible && screen === "game" && (
          <GameScreen 
            initialPlayers={lobbyPlayers ?? undefined} 
            localPlayerName={localPlayerName ?? undefined}
            // pass device id (if we have it) so logs can include the device id
            localPlayerId={localPlayerId ?? undefined}
            // pass a shared mock adapter for local games to avoid multiple adapters/log interleaving
            adapter={localAdapter ?? undefined}
            onBack={() => setScreen("menu")} 
          />
        )}
      </ImageBackground>
    </View>
    </SafeAreaProvider>
  );
}