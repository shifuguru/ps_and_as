import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import BlurPanel from "./BlurPanel";
import { TABLE_CHAT_MESSAGES } from "../chat/tableChatMessages";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  visible: boolean;
  onSelect: (emoteId: string) => void;
  onClose: () => void;
};

export default function TableChatModal({
  visible,
  onSelect,
  onClose,
}: Props) {
  const { colors, ui, blur } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 40, 360);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ui.modalOverlay} onPress={onClose}>
        <Pressable onPress={(event) => event.stopPropagation()}>
          <BlurPanel
            style={[ui.modalCard, styles.card, { width: cardWidth, maxWidth: cardWidth }]}
            preset={blur.modal}
          >
            <Text style={ui.modalTitle}>Quick Chat</Text>
            <Text style={[ui.emptyBody, styles.subtitle]}>
              Pick a short line for everyone at the table.
            </Text>

            <View style={styles.grid}>
              {TABLE_CHAT_MESSAGES.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.optionBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    triggerHaptic("light");
                    onSelect(entry.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={entry.text}
                >
                  <Text style={styles.optionText}>{entry.text}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close quick chat"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </BlurPanel>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      paddingBottom: 18,
    },
    subtitle: {
      marginBottom: 14,
      textAlign: "center",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 8,
    },
    optionBtn: {
      width: "48%",
      minHeight: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.btnSecondaryBorder,
      backgroundColor: colors.btnSecondaryBg,
    },
    optionText: {
      color: colors.btnSecondaryText,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "center",
    },
    cancelBtn: {
      marginTop: 14,
      alignSelf: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    cancelText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
