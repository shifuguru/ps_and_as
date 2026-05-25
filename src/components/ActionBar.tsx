import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

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
        onPress={onPlay}
        disabled={playDisabled}
      >
        <Text style={styles.primaryText}>
          {selectedCount > 0 ? `Play Selected (${selectedCount})` : "Select Cards"}
        </Text>
      </TouchableOpacity>
      <View style={styles.sideButtons}>
        <TouchableOpacity
          style={[styles.secondaryButton, passDisabled && styles.disabledButton]}
          onPress={onPass}
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
    marginTop: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 58,
    marginRight: 10,
    borderRadius: 16,
    backgroundColor: "#d4af37",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  secondaryButton: {
    minWidth: 110,
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  tertiaryButton: {
    minWidth: 94,
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryText: {
    color: "#111",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  tertiaryText: {
    color: "#d4af37",
    fontWeight: "800",
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.4,
  },
});