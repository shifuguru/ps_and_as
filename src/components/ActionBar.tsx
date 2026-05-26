import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { triggerHaptic } from "../utils/haptics";

type Props = {
  selectedCount: number;
  onPlay: () => void;
  onPass: () => void;
  onQuit: () => void;
  playDisabled: boolean;
  passDisabled: boolean;
};

export default function ActionBar({
  selectedCount,
  onPlay,
  onPass,
  onQuit,
  playDisabled,
  passDisabled,
}: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.primaryButton, playDisabled && styles.disabledButton]}
        onPress={() => { triggerHaptic("medium"); onPlay(); }}
        disabled={playDisabled}
      >
        <Text style={styles.primaryText}>
          {selectedCount > 0 ? `Play (${selectedCount})` : "Select Cards"}
        </Text>
      </TouchableOpacity>
      <View style={styles.sideButtons}>
        <TouchableOpacity
          style={[styles.secondaryButton, passDisabled && styles.disabledButton]}
          onPress={() => { triggerHaptic("light"); onPass(); }}
          disabled={passDisabled}
        >
          <Text style={styles.secondaryText}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tertiaryButton} onPress={onQuit}>
          <Text style={styles.tertiaryText}>Quit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    minWidth: 90,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  tertiaryButton: {
    minWidth: 72,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryText: {
    color: "#0a0a0a",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  secondaryText: {
    color: "#e8e8e8",
    fontWeight: "600",
    fontSize: 14,
  },
  tertiaryText: {
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.3,
  },
});
