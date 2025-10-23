import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, ImageBackground, Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import SplashScreen from "./src/screens/SplashScreen";
import MainMenu from "./src/screens/MainMenu";
import CreateGame from "./src/screens/CreateGame";
import FindGame from "./src/screens/FindGame";
import GameScreen from "./src/screens/GameScreen";
import Achievements from "./src/screens/Achievements";
import { useMenuAudio } from "./src/hooks/useMenuAudio";
import MuteButton from "./src/components/ui/MuteButton";
import { styles } from "./src/styles/theme";
import { SocketAdapter } from "./src/game/socketAdapter";

export default function App() {
  // splashVisible: whether the splash overlay is still mounted
  // menuVisible: whether the main menu should be shown (after splash fully hidden)
  const [splashVisible, setSplashVisible] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const { playEffect, toggleMute, isMuted, muted } = useMenuAudio();
  const [screen, setScreen] = useState<"menu" | "create" | "find" | "game" | "achievements">("menu");
  const [lobbyPlayers, setLobbyPlayers] = useState<string[] | null>(null);
  const [localPlayerName, setLocalPlayerName] = useState<string | null>(null);
  const [roomAdapter, setRoomAdapter] = useState<SocketAdapter | null>(null);
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  // try to construct a network adapter at runtime and memoize it
  const networkAdapter = useMemo(() => {
    try {
      console.log("[App] Creating network adapter for discovery only...");
      // Discovery adapter should NOT auto-join any room
      return new SocketAdapter("http://192.168.88.138:3000", "", "", false);
    } catch (e) {
      console.error("[App] Failed to create network adapter:", e);
      return null;
    }
  }, []);

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

  const buttons = ["Create Game", "Find Game", "Random Game", "Local", "Achievements"];

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={require("./assets/ps_and_as_bg.png")}
        resizeMode="cover"
        style={styles.background}
      >
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

        {/* Top-right mute button */}
        {menuVisible && (
          <View style={{ position: "absolute", top: 42, right: 24, zIndex: 30 }}>
            <MuteButton muted={muted} onToggle={() => toggleMute()} />
          </View>
        )}

        {/* Main menu or screens */}
        {menuVisible && screen === "menu" && (
          <Animated.View style={[styles.menuContainer, { opacity: menuOpacity }]}>
            <Text style={styles.title}>P's & A's</Text>
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
                      // start a small local hotseat game
                      const local = ["You", "Local Player"];
                      setLobbyPlayers(local);
                      setScreen("game");
                    } else if (label === "Achievements") {
                      setScreen("achievements");
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

        {menuVisible && screen === "create" && (
          <CreateGame 
            adapter={roomAdapter || networkAdapter} 
            isJoining={!!roomAdapter}
            joinRoomId={joinedRoomId || undefined}
            onBack={() => {
              setScreen("menu");
              setRoomAdapter(null);
              setJoinedRoomId(null);
            }}
            onNavigateToAchievements={() => setScreen("achievements")}
            onStart={(names, localName) => {
              console.log("[App] CreateGame onStart called with names:", names, "localName:", localName);
              setLobbyPlayers(names); 
              setLocalPlayerName(localName);
              setScreen("game");
              setRoomAdapter(null);
              setJoinedRoomId(null);
            }} 
          />
        )}
        {menuVisible && screen === "find" && (
          networkAdapter ? (
            <FindGame 
              adapter={networkAdapter} 
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
            onBack={() => setScreen("menu")} 
          />
        )}
      </ImageBackground>
    </View>
  );
}