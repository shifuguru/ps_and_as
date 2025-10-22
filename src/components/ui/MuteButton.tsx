import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { colors, styles as themeStyles } from "../../styles/theme";

export default function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity onPress={onToggle} style={localStyles.button} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <View style={localStyles.iconWrap}>
        <Text style={localStyles.icon}>{muted ? "⛔" : "♪"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const localStyles = StyleSheet.create({
  button: {
    padding: 8,
    marginRight: 8,
    marginTop: 8,
    borderRadius: 10,
  },
  iconWrap: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 8,
    borderRadius: 8,
  },
  icon: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
  },
});
