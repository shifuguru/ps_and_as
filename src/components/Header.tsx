import React from "react";
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from "react-native";
import { styles as theme } from "../styles/theme";

export default function Header({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <SafeAreaView style={local.container}>
      <View style={local.row}>
        <View style={local.left}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={local.backButton}>
              <Text style={local.backText}>{'< Back'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={local.center} pointerEvents="none">
          {title ? <Text style={local.title}>{title}</Text> : null}
        </View>
        <View style={local.right}>
          {right}
        </View>
      </View>
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    // keep a minimum top padding across platforms; SafeAreaView handles iOS notches
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 8 : 0,
  },
  row: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  left: { width: 88 },
  center: { flex: 1, alignItems: "center" },
  right: { width: 88, alignItems: "flex-end" },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
