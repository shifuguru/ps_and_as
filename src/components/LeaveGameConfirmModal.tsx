import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import BlurPanel from "./BlurPanel";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Defaults to in-progress game copy. */
  message?: string;
};

export default function LeaveGameConfirmModal({
  visible,
  onCancel,
  onConfirm,
  message = "You'll forfeit this game and return to the menu. Other players may continue without you.",
}: Props) {
  const { colors, ui, blur } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 400);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={ui.modalOverlay}>
        <BlurPanel
          style={[ui.modalCard, { width: cardWidth, maxWidth: cardWidth }]}
          preset={blur.modal}
        >
          <Text style={ui.modalTitle}>Leave game?</Text>
          <Text style={[ui.modalBody, { fontSize: 16, marginBottom: 18 }]}>
            {message}
          </Text>

          <View style={ui.actionTrack}>
            <TouchableOpacity
              style={ui.actionSecondary}
              activeOpacity={0.82}
              onPress={() => {
                triggerHaptic("light");
                onCancel();
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel — stay in game"
            >
              <Text style={ui.actionSecondaryText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ui.actionPrimary, styles.leaveConfirmBtn]}
              activeOpacity={0.82}
              onPress={() => {
                triggerHaptic("medium");
                onConfirm();
              }}
              accessibilityRole="button"
              accessibilityLabel="Yes, leave game"
            >
              <Text style={[ui.actionPrimaryText, styles.leaveConfirmText]}>
                Yes, Leave
              </Text>
            </TouchableOpacity>
          </View>
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    leaveConfirmBtn: {
      backgroundColor: colors.mode === "light" ? "#c62828" : "#8b1a1a",
      borderColor: colors.mode === "light" ? "#b71c1c" : "#6d1515",
    },
    leaveConfirmText: {
      color: "#fff",
    },
  });
}
