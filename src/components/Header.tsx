import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from "react-native";
import BackButton from "../components/BackButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles as theme, colors, fonts } from "../styles/theme";

export default function Header({ title, onBack, right, titleStyle }: { title?: string; onBack?: () => void; right?: React.ReactNode; titleStyle?: any }) {
  return (
    <SafeAreaView edges={["top"]} style={[theme.headerContainer, local.container] as any}>
      <View style={theme.headerRow}>
        <View style={theme.headerLeft}>
          {onBack ? (
            <BackButton onPress={onBack} label={"← Leave"} />
          ) : null}
        </View>
        <View style={theme.headerCenter} pointerEvents="none">
          {title ? <Text style={[theme.headerTitle, titleStyle]}>{title}</Text> : null}
        </View>
        <View style={theme.headerRight}>
          {right}
        </View>
      </View>
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  container: {
    // ensure header content sits below system status/UI elements (Dynamic Island etc.)
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 60 : 60,
    backgroundColor: "transparent",
  },
});
