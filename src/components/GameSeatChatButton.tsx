import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import BlurPanel from "./BlurPanel";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";
import { normalizeSeatChatText, SEAT_CHAT_MAX_LENGTH } from "../utils/seatChat";
import { MODAL_OVERLAY_Z } from "../styles/overlayZIndex";

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
  bottomOffset?: number;
};

export default function GameSeatChatButton({
  onSend,
  disabled = false,
  bottomOffset = 12,
}: Props) {
  const { colors, ui, blur } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = normalizeSeatChatText(draft);
    if (!text) return;
    triggerHaptic("light");
    onSend(text);
    setDraft("");
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: bottomOffset },
          disabled && styles.fabDisabled,
        ]}
        onPress={() => {
          if (disabled) return;
          triggerHaptic("light");
          setOpen(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Open chat"
      >
        <Text style={styles.fabLabel}>Chat</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <KeyboardAvoidingView
          style={[ui.modalOverlay, styles.modalRoot]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <BlurPanel style={[ui.modalCard, styles.modalCard]} preset={blur.modal}>
            <Text style={ui.modalTitle}>Table chat</Text>
            <Text style={[ui.emptyBody, styles.modalHint]}>
              Your message appears above your avatar for everyone at the table.
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Say something…"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.panelBorder }]}
              maxLength={SEAT_CHAT_MAX_LENGTH}
              multiline
              autoFocus
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={submit}
            />
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setDraft("");
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel chat"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, !normalizeSeatChatText(draft) && styles.sendBtnDisabled]}
                onPress={submit}
                disabled={!normalizeSeatChatText(draft)}
                accessibilityRole="button"
                accessibilityLabel="Send chat message"
              >
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </BlurPanel>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    fab: {
      position: "absolute",
      left: 0,
      zIndex: MODAL_OVERLAY_Z - 30,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.actionSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.actionSecondaryBorder,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    fabDisabled: {
      opacity: 0.45,
    },
    fabLabel: {
      color: colors.actionSecondaryText,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    modalRoot: {
      zIndex: MODAL_OVERLAY_Z,
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
    },
    modalHint: {
      marginBottom: 12,
    },
    input: {
      minHeight: 44,
      maxHeight: 120,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      textAlignVertical: "top",
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 16,
    },
    cancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    cancelText: {
      color: colors.textSecondary,
      fontWeight: "700",
      fontSize: 14,
    },
    sendBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.gold,
    },
    sendBtnDisabled: {
      opacity: 0.45,
    },
    sendText: {
      color: colors.textOnGold,
      fontWeight: "800",
      fontSize: 14,
    },
  });
}
