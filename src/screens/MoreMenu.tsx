import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import MenuIcon from "../components/MenuIcon";
import Header from "../components/Header";

type Props = {
  onBack: () => void;
  onFindGame: () => void;
  onAchievements: () => void;
  onSettings: () => void;
};

const ITEMS: { label: string; icon: "globe" | "trophy" | "gear"; action: keyof Omit<Props, "onBack"> }[] = [
  { label: "Find Game", icon: "globe", action: "onFindGame" },
  { label: "Achievements", icon: "trophy", action: "onAchievements" },
  { label: "Settings", icon: "gear", action: "onSettings" },
];

export default function MoreMenu({ onBack, onFindGame, onAchievements, onSettings }: Props) {
  const handlers: Record<string, () => void> = {
    onFindGame,
    onAchievements,
    onSettings,
  };

  return (
    <ScreenContainer>
      <Header onBack={onBack} title="More" />
      <View style={styles.container}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.row}
            onPress={handlers[item.action]}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrap}>
              <MenuIcon name={item.icon} size={22} color="rgba(255,255,255,0.5)" />
            </View>
            <Text style={styles.label}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 20, 20, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  iconWrap: {
    width: 32,
    alignItems: "center",
    marginRight: 14,
  },
  label: {
    color: "#f0f0f0",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
