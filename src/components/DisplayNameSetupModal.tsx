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
import {
  getGoogleAccountSyncStatus,
  getGoogleSignInButtonLabel,
  googleAccountSyncBlurb,
  isGoogleAccountSyncOffered,
  requestGoogleAccountLink,
} from "../services/googleAccountSync";

export type DisplayNameSetupVariant = "default" | "browser-with-account-sync";

type Props = {
  visible: boolean;
  onComplete: (name: string) => void;
  /**
   * After declining PWA install on mobile browser — couple name choice
   * with upcoming Google Sign-in sync for Play Store / game stats.
   */
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
      const link = await requestGoogleAccountLink();
      if (!link) {
        setError("Google Sign-in is not available yet. Enter a display name to continue.");
        return;
      }
      const preferred =
        (link.displayName?.trim() || name.trim() || "").slice(0, 20);
      if (preferred) {
        setName(preferred);
        const check = validateDisplayText(preferred, "Player name");
        if (check.ok) {
          const saved = await saveChosenDisplayName(check.value);
          triggerHaptic("light");
          onComplete(saved);
          return;
        }
      }
      setError("Signed in — choose a display name to finish.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google Sign-in failed. Try again.";
      setError(message);
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
              ? "This is the name other players will see at the table. Pair it with Google Sign-in so your name and game stats stay in sync across devices and the Play Store build."
              : "This is the name other players will see at the table — offline and online."}
          </Text>

          {showGoogle ? (
            <View style={styles.syncBlock}>
              <Text style={styles.syncBlurb}>
                {googleAccountSyncBlurb(googleStatus)}
              </Text>
              <AppButton
                label={getGoogleSignInButtonLabel(googleStatus)}
                variant="secondary"
                disabled={!googleReady || googleBusy || saving}
                onPress={() => void handleGoogleSignIn()}
                accessibilityLabel={getGoogleSignInButtonLabel(googleStatus)}
                style={styles.googleBtn}
              />
            </View>
          ) : null}

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
            editable={!saving && !googleBusy}
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
    syncBlock: {
      alignSelf: "stretch",
      marginBottom: 16,
      gap: 10,
    },
    syncBlurb: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      fontWeight: "600",
    },
    googleBtn: {
      width: "100%",
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
