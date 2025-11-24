import React from "react";
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from "react-native";
import { styles as theme, colors } from "../styles/theme";

export default function Header({ title, onBack, right, titleStyle }: { title?: string; onBack?: () => void; right?: React.ReactNode; titleStyle?: any }) {
  return (
    <SafeAreaView style={local.container}>
      <View style={local.row}>
        <View style={local.left}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={local.backButton}>
              <Text style={local.backText}>{'← Back'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={local.center} pointerEvents="none">
          {title ? <Text style={[local.title, titleStyle]}>{title}</Text> : null}
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
  left: { width: 88, alignItems: 'flex-start' },
  center: { position: 'absolute', left: 0, right: 0, alignItems: "center" },
  right: { width: 88, alignItems: "flex-end" },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  title: {
    color: colors.secondary,
    fontSize: 18,
    fontWeight: "600",
  },
});
