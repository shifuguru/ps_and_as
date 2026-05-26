import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Pressable,
} from "react-native";
import { BlurView } from "expo-blur";
import { useMenuAudio } from "../hooks/useMenuAudio";

export default function MainMenu() {
  const { playEffect } = useMenuAudio();

  return (
    <ImageBackground
      source={require("../../assets/ps_and_as_bg.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <View style={styles.container}>
        <BlurView intensity={35} tint="dark" style={styles.card}>
          <Text style={styles.title}>P’s & A’s</Text>
          <Text style={styles.subtitle}>Presidents & Assholes</Text>

          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() => playEffect("click")}
          >
            <Text style={styles.primaryText}>Create Game</Text>
          </Pressable>

          <View style={styles.grid}>
            <Pressable style={styles.button} onPress={() => playEffect("click")}>
              <Text style={styles.text}>Find Game</Text>
            </Pressable>

            <Pressable style={styles.button} onPress={() => playEffect("click")}>
              <Text style={styles.text}>Online</Text>
            </Pressable>

            <Pressable style={styles.button} onPress={() => playEffect("click")}>
              <Text style={styles.text}>Local</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => playEffect("click")}>
              <Text style={styles.footerText}>Achievements</Text>
            </Pressable>

            <Pressable onPress={() => playEffect("click")}>
              <Text style={styles.footerText}>Settings</Text>
            </Pressable>
          </View>
        </BlurView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },

  card: {
    borderRadius: 24,
    padding: 20,
    overflow: "hidden",
  },

  title: {
    color: "white",
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  subtitle: {
    color: "rgba(255,255,255,0.6)",
    marginBottom: 20,
  },

  button: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
    alignItems: "center",
  },

  primary: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  primaryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  text: {
    color: "rgba(255,255,255,0.85)",
  },

  grid: {
    marginTop: 10,
  },

  footer: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  footerText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
});