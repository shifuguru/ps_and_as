import React, { useMemo } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import BlurPanel from "./BlurPanel";
import AppButton from "./ui/AppButton";
import { useAppTheme } from "../context/ThemeContext";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { triggerHaptic } from "../utils/haptics";
import { hexToRgba } from "../utils/colorTheory";
import {
  PRACTICE_MAX_PLAYERS,
  PRACTICE_MIN_PLAYERS,
} from "../services/practicePreferences";

type Props = {
  visible: boolean;
  playerCount: number;
  onSelectPlayerCount: (count: number) => void;
  onClose: () => void;
};

const PLAYER_COUNTS = Array.from(
  { length: PRACTICE_MAX_PLAYERS - PRACTICE_MIN_PLAYERS + 1 },
  (_, i) => PRACTICE_MIN_PLAYERS + i,
);

export default function PracticeSetupModal({
  visible,
  playerCount,
  onSelectPlayerCount,
  onClose,
}: Props) {
  const { ui, blur, colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 400);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          ui.modalOverlay,
          {
            paddingTop: Math.max(24, insets.top + 12),
            paddingBottom: Math.max(24, insets.bottom + 12),
          },
        ]}
      >
        <BlurPanel
          style={[
            ui.modalCard,
            styles.card,
            { width: cardWidth, maxWidth: cardWidth },
          ]}
          preset={blur.modal}
        >
          <Text style={ui.modalTitle}>Practice setup</Text>
          <Text style={styles.subtitle}>
            Choose how many players sit at the table. Empty seats are filled with
            AI opponents.
          </Text>

          <Text style={styles.sectionLabel}>Players at the table</Text>
          <View style={styles.chipRow}>
            {PLAYER_COUNTS.map((count) => {
              const selected = count === playerCount;
              return (
                <TouchableOpacity
                  key={count}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => {
                    triggerHaptic("light");
                    onSelectPlayerCount(count);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${count} players`}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextSelected]}
                  >
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.hint}>
            You plus {Math.max(0, playerCount - 1)} AI opponent
            {playerCount - 1 === 1 ? "" : "s"}.
          </Text>

          <AppButton
            label="Done"
            variant="primary"
            onPress={onClose}
            style={styles.doneBtn}
          />
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      gap: 12,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.textTertiary,
      marginTop: 4,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      minWidth: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.btnSecondaryBorder,
      backgroundColor: colors.btnSecondaryBg,
    },
    chipSelected: {
      borderColor: colors.accent,
      backgroundColor: hexToRgba(colors.accent, 0.14),
    },
    chipText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.btnSecondaryText,
    },
    chipTextSelected: {
      color: colors.accent,
    },
    hint: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    doneBtn: {
      marginTop: 4,
    },
  });
}
