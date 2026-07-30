import React, { useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import BlurPanel from "./BlurPanel";
import AppButton from "./ui/AppButton";
import { useAppTheme } from "../context/ThemeContext";
import { useKeyboardAvoidingOverlay } from "../hooks/useKeyboardAvoidingOverlay";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { triggerHaptic } from "../utils/haptics";
import {
  displayTextError,
  validateDisplayText,
} from "../utils/profanityFilter";
import { saveChosenDisplayName } from "../services/playerDisplayName";

type Props = {
  visible: boolean;
  onComplete: (name: string) => void;
};

export default function DisplayNameSetupModal({ visible, onComplete }: Props) {
  const { ui, blur, colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 400);

  const baseTop = Math.max(24, insets.top + 12);
  const baseBottom = Math.max(24, insets.bottom + 12);
  const keyboardOverlay = useKeyboardAvoidingOverlay(baseTop, baseBottom);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validation = validateDisplayText(name, "Player name");
  const canContinue = validation.ok === true && !saving;

  const handleContinue = async () => {
    const check = validateDisplayText(name, "Player name");
    const reason = displayTextError(check);
    if (reason) {
      setError(reason);
      return;
    }
    if (!check.ok) return;

    setSaving(true);
    setError(null);
    try {
      const saved = await saveChosenDisplayName(check.value);
      triggerHaptic("light");
      onComplete(saved);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save name. Please try again.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        /* Blocking gate — cannot dismiss without choosing a name. */
      }}
    >
      <View
        style={[
          ui.modalOverlay,
          {
            justifyContent: keyboardOverlay.justifyContent,
            paddingTop: keyboardOverlay.paddingTop,
            paddingBottom: keyboardOverlay.paddingBottom,
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
          <Text style={ui.modalTitle}>What should we call you?</Text>
          <Text style={styles.body}>
            This is the name other players will see at the table — offline and
            online.
          </Text>

          <Text style={ui.fieldLabel}>Display Name</Text>
          <TextInput
            style={[ui.input, styles.input]}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (error) setError(null);
            }}
            onSubmitEditing={() => {
              if (canContinue) void handleContinue();
            }}
            placeholder="Enter Your Name"
            placeholderTextColor={colors.textQuaternary}
            maxLength={20}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            editable={!saving}
            accessibilityLabel="Display name"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            label={saving ? "Saving…" : "Continue"}
            variant="primary"
            disabled={!canContinue}
            onPress={() => void handleContinue()}
            accessibilityLabel="Continue with display name"
            style={styles.continueBtn}
          />
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      width: "100%",
    },
    body: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 18,
    },
    input: {
      marginBottom: 8,
      textAlign: "center",
    },
    error: {
      color: colors.mode === "dark" ? "#ffcdd2" : "#8b1a1a",
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
      marginBottom: 10,
    },
    continueBtn: {
      width: "100%",
      marginTop: 8,
    },
  });
}
