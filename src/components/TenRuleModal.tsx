import React from "react";
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
import { GOLD, ui, BLUR_MODAL } from "../styles/uiStandards";

type Props = {
  visible: boolean;
  onChoose: (direction: "higher" | "lower") => void;
};

export default function TenRuleModal({ visible, onChoose }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 400);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={ui.modalOverlay}>
        <BlurPanel
          style={[ui.modalCard, { width: cardWidth, maxWidth: cardWidth }]}
          intensity={62}
          scrimOpacity={BLUR_MODAL.scrimOpacity}
          webOpacity={BLUR_MODAL.webOpacity}
        >
          <Text style={ui.modalTitle}>10 Played</Text>
          <Text style={[ui.modalBody, { fontSize: 22, marginBottom: 10 }]}>
            Higher Or Lower?
          </Text>
          <Text style={[ui.emptyBody, { marginBottom: 18 }]}>
            Choose what the next player must beat your tens with — a same-size
            set that is either higher or lower in rank.
          </Text>

          <View style={styles.choiceRow}>
            <TouchableOpacity
              style={styles.choiceBtn}
              activeOpacity={0.85}
              onPress={() => {
                triggerHaptic("medium");
                onChoose("lower");
              }}
              accessibilityRole="button"
              accessibilityLabel="Call Lower — Next Play Must Be a Lower Rank"
            >
              <Text style={styles.choiceArrow}>↓</Text>
              <Text style={styles.choiceLabel}>Lower</Text>
              <Text style={styles.choiceHint}>Weaker Rank</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.choiceBtn}
              activeOpacity={0.85}
              onPress={() => {
                triggerHaptic("medium");
                onChoose("higher");
              }}
              accessibilityRole="button"
              accessibilityLabel="Call Higher — Next Play Must Be a Higher Rank"
            >
              <Text style={styles.choiceArrow}>↑</Text>
              <Text style={styles.choiceLabel}>Higher</Text>
              <Text style={styles.choiceHint}>Stronger Rank</Text>
            </TouchableOpacity>
          </View>
        </BlurPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  choiceRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  choiceBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.45)",
    backgroundColor: "rgba(212, 175, 55, 0.12)",
    minHeight: 108,
  },
  choiceArrow: {
    color: GOLD,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 30,
    marginBottom: 6,
  },
  choiceLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  choiceHint: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 4,
  },
});
