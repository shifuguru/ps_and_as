import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  children: React.ReactNode;
};

export default function HandDock({ children }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === "web" ? 0 : insets.bottom || 0;

  return (
    <View style={[styles.container, { paddingBottom: bottom + (Platform.OS === "web" ? 16 : 12) }]}>
      <View style={styles.fadeTop} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 200,
  },
  fadeTop: {
    height: 24,
    backgroundColor: "rgba(10,10,10,0.6)",
    borderTopWidth: 0,
  },
  content: {
    backgroundColor: "rgba(10,10,10,0.98)",
    paddingTop: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
});
