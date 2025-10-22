import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, ImageBackground, Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import SplashScreen from "./src/screens/SplashScreen";
import MainMenu from "./src/screens/MainMenu";
import CreateGame from "./src/screens/CreateGame";
import GameScreen from "./src/screens/GameScreen";
import { useMenuAudio } from "./src/hooks/useMenuAudio";
import MuteButton from "./src/components/ui/MuteButton";
import { styles } from "./src/styles/theme";

export default function App() {
  // splashVisible: whether the splash overlay is still mounted
  // menuVisible: whether the main menu should be shown (after splash fully hidden)
  const [splashVisible, setSplashVisible] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const { playEffect, toggleMute, isMuted, muted } = useMenuAudio();
  const [screen, setScreen] = useState<"menu" | "create" | "game">("menu");
  const [lobbyPlayers, setLobbyPlayers] = useState<string[] | null>(null);
  // try to construct a network adapter at runtime and memoize it
  const networkAdapter = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { SocketAdapter } = require("./src/game/socketAdapter");
      return new SocketAdapter("http://localhost:3000", "main", "Host");
    } catch (e) {
      return null;
    }
  }, []);

  const splashScale = useRef(new Animated.Value(1)).current;

  const hideSplashAndShowMenu = () => {
    Animated.timing(splashScale, {
      toValue: 0.0,
      duration: 800,
      useNativeDriver: false,
    }).start(() => {
      // after animation completes remove splash and show menu
      setSplashVisible(false);
      setMenuVisible(true);
    });
  };

  const buttons = ["Create Game", "Random Game", "Online", "Local", "Achievements"];

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
                transform: [
                  {
                    scale: splashScale.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                  },
                ],
                opacity: splashScale.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
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
          <View style={styles.menuContainer}>
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
                    else if (label === "Random Game") {
                      // start a quick random 4-player game
                      const rnd = ["Alice", "Bob", "Charlie", "Dana"];
                      setLobbyPlayers(rnd);
                      setScreen("game");
                    } else if (label === "Local") {
                      // start a small local hotseat game
                      const local = ["You", "Local Player"];
                      setLobbyPlayers(local);
                      setScreen("game");
                    } else if (label === "Online") {
                      // open the Create Game screen in online mode (adapter passed in)
                      setScreen("create");
                    } else if (label === "Achievements") {
                      // placeholder for achievements
                      // TODO: navigate to Achievements screen
                    }
                  }}
                >
                  <Text style={styles.menuButtonText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {menuVisible && screen === "create" && (
          <CreateGame adapter={networkAdapter} onBack={() => setScreen("menu")} onStart={(names) => { setLobbyPlayers(names); setScreen("game"); }} />
        )}
        {menuVisible && screen === "game" && (
          <GameScreen initialPlayers={lobbyPlayers ?? undefined} onBack={() => setScreen("menu")} />
        )}
      </ImageBackground>
    </View>
  );
}