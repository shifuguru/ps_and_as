import React from "react";
import {
  Modal,
  View,
  Text,
  useWindowDimensions,
} from "react-native";
import BlurPanel from "./BlurPanel";
import AppButton from "./ui/AppButton";
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
  const { ui, blur } = useAppTheme();
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
            <AppButton
              label="Cancel"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                triggerHaptic("light");
                onCancel();
              }}
              accessibilityLabel="Cancel — stay in game"
            />
            <AppButton
              label="Yes, Leave"
              variant="destructive"
              style={{ flex: 1.45 }}
              onPress={() => {
                triggerHaptic("medium");
                onConfirm();
              }}
              accessibilityLabel="Yes, leave game"
            />
          </View>
        </BlurPanel>
      </View>
    </Modal>
  );
}
