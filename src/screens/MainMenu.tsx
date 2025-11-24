import React from "react";
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity } from "react-native";
import { styles as theme } from "../styles/theme";
import { useMenuAudio } from "../hooks/useMenuAudio";
import Button from "../components/ui/Button";


const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 20,
    borderRadius: 10,
  },
  title: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    color: "gray",
    fontSize: 18,
    marginBottom: 30,
  },
  buttonGroup: {
    width: "100%",
    alignItems: "center",
  },
});

export default function MainMenu() {
  const { playEffect } = useMenuAudio();

  return (
    <View style={[theme.container, { justifyContent: "center" }]}>
      <ImageBackground
      source={require("../../assets/ps_and_as_bg.png")} // update this to user's saved wallpaper
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.menuContainer}>
        <Text style={styles.title}>P's & A's</Text>
        <Text style={styles.subtitle}>by rabbithole Games</Text>

        <View style={styles.buttonGroup}>
          <Button label="Create Game" onPress={() => {}} />
          <Button label="Random Game" onPress={() => {}} />
          <Button label="Online" onPress={() => {}} />
          <Button label="Local" onPress={() => {}} />
          <Button label="Achievements" onPress={() => {}} />
        </View>
      </View>
    </ImageBackground>
      <Text style={theme.title}>P's & A's</Text>
      <Text style={theme.developerLabel}>by rabbithole Games</Text>

      <View style={theme.buttonGroup}>
        {["Create Game", "Play Random", "Online", "Achievements", "Profile"].map((label, i) => (
          <TouchableOpacity
            key={i}
            style={theme.button}
            onPress={() => {
              playEffect("click");
              if (label === "Create Game") playEffect("other");
              if (label === "Profile") playEffect("other");
            }}
          >
            <Text style={theme.buttonText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}