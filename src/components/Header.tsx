import React from "react";
import { View, Text, StyleSheet } from "react-native";
import BackButton from "../components/BackButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";

export default function Header({ title, onBack, right, titleStyle }: { title?: string; onBack?: () => void; right?: React.ReactNode; titleStyle?: any }) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={["top"]} style={local.container as any}>
      <View style={local.headerRow}>
        <View style={local.headerLeft}>
          {onBack ? (
            <BackButton onPress={onBack} label={"← Leave"} />
          ) : null}
        </View>
        <View style={local.headerCenter} pointerEvents="none">
          {title ? <Text style={[local.headerTitle, { color: colors.textPrimary }, titleStyle]}>{title}</Text> : null}
        </View>
        <View style={local.headerRight}>
          {right}
        </View>
      </View>
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  container: {
    // ensure header content sits below system status/UI elements (Dynamic Island etc.)
    // paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 60 : 60,
    backgroundColor: "transparent",
  },
  headerRow: {
    height: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  headerLeft: { width: 88, alignItems: "flex-start" },
  headerCenter: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  headerRight: { width: 88, alignItems: "flex-end" },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontStyle: "italic",
  },
});
