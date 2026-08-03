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
import { getDisplayNameInputProps } from "../utils/displayNameInputProps";
import { saveChosenDisplayName } from "../services/playerDisplayName";
import {
  getGoogleAccountSyncStatus,
  getGoogleSignInButtonLabel,
  isGoogleAccountSyncOffered,
  linkGoogleAccountAndSync,
} from "../services/googleAccountSync";

export type DisplayNameSetupVariant = "default" | "browser-with-account-sync";

type Props = {
  visible: boolean;
  onComplete: (name: string) => void;
  /** After declining PWA install — offer Google sync with name setup. */
  variant?: DisplayNameSetupVariant;
};

export default function DisplayNameSetupModal({
  visible,
  onComplete,
  variant = "default",
}: Props) {
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
  const [googleBusy, setGoogleBusy] = useState(false);

  const accountSync = variant === "browser-with-account-sync";
  const googleStatus = getGoogleAccountSyncStatus();
  const showGoogle = accountSync && isGoogleAccountSyncOffered();
  const googleReady = googleStatus === "ready";

  const validation = validateDisplayText(name, "Player name");
  const canContinue = validation.ok === true && !saving && !googleBusy;

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

  const handleGoogleSignIn = async () => {
    if (!googleReady) return;
    setGoogleBusy(true);
    setError(null);
    try {
      const result = await linkGoogleAccountAndSync({
        preferredDisplayName: name.trim() || null,
      });
      if (result.displayName) {
        setName(result.displayName);
        triggerHaptic("light");
        onComplete(result.displayName);
        return;
      }
      setError("Choose a display name to finish.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google account link failed. Try again.";
      if (/cancelled/i.test(message)) {
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setGoogleBusy(false);
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
            {accountSync
              ? "Shown at the table. Link Google to sync stats."
              : "Shown to other players at the table."}
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
            returnKeyType="done"
            editable={!saving && !googleBusy}
            accessibilityLabel="Display name"
            {...getDisplayNameInputProps("ps-and-as-display-name-setup")}
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

          {showGoogle && googleReady ? (
            <AppButton
              label={
                googleBusy
                  ? "Connecting…"
                  : getGoogleSignInButtonLabel(googleStatus)
              }
              variant="secondary"
              disabled={googleBusy || saving}
              onPress={() => void handleGoogleSignIn()}
              accessibilityLabel={getGoogleSignInButtonLabel(googleStatus)}
              style={styles.googleBtn}
            />
          ) : showGoogle ? (
            <Text style={styles.syncHint}>Google sync coming soon</Text>
          ) : null}
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
    googleBtn: {
      width: "100%",
      marginTop: 10,
    },
    syncHint: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      fontWeight: "600",
      marginTop: 12,
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
