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
  /** True when direction is chosen before the 10 is committed. */
  preCommit?: boolean;
  onChoose: (direction: "higher" | "lower") => void;
  onCancel?: () => void;
};

export default function TenRuleModal({
  visible,
  preCommit = false,
  onChoose,
  onCancel,
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
          <Text style={ui.modalTitle}>
            {preCommit ? "Playing a 10" : "10 Played"}
          </Text>
          <Text style={[ui.modalBody, { fontSize: 22, marginBottom: 10 }]}>
            Higher Or Lower?
          </Text>
          <Text style={[ui.emptyBody, { marginBottom: 18 }]}>
            {preCommit
              ? "Choose what the next player must beat your tens with — then your play will land on the table."
              : "Choose what the next player must beat your tens with — a same-size set that is either higher or lower in rank."}
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

          {preCommit && onCancel ? (
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.85}
              onPress={() => {
                triggerHaptic("light");
                onCancel();
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel — keep your selected cards"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
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
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.panelBorder,
      backgroundColor: colors.btnSecondaryBg,
    },
    choiceArrow: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    choiceLabel: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    choiceHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    cancelBtn: {
      marginTop: 14,
      alignItems: "center",
      paddingVertical: 12,
    },
    cancelLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textMuted,
    },
  });
}
