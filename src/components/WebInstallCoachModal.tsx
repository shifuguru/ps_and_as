import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import BlurPanel from "./BlurPanel";
import AppButton from "./ui/AppButton";
import { useAppTheme } from "../context/ThemeContext";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { useWebAppInstall } from "../hooks/useWebAppInstall";
import { triggerHaptic } from "../utils/haptics";

type Props = {
  visible: boolean;
  /** Player chose to stay in the browser tab (decline install). */
  onContinueInBrowser: () => void;
};

/**
 * Blocking first-run coach for mobile browser tabs (not standalone PWA).
 * Shown before display-name setup so install is offered first.
 */
export default function WebInstallCoachModal({
  visible,
  onContinueInBrowser,
}: Props) {
  const { ui, blur, colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 420);
  const { inAppBrowser, installButtonLabel, instructions, requestInstall } =
    useWebAppInstall();
  const [showSteps, setShowSteps] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowSteps(false);
      setWorking(false);
    }
  }, [visible]);

  const handlePrimary = async () => {
    setWorking(true);
    try {
      const result = await requestInstall();
      setShowSteps(true);
      if (result === "accepted") {
        triggerHaptic("light");
      }
    } finally {
      setWorking(false);
    }
  };

  const handleContinueInBrowser = () => {
    triggerHaptic("light");
    onContinueInBrowser();
  };

  const primaryLabel = working
    ? "Opening…"
    : showSteps
      ? installButtonLabel
      : inAppBrowser
        ? "How to open"
        : "Install for best experience";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        /* Blocking — choose install path or continue in browser. */
      }}
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
          <Text style={ui.panelEyebrow}>
            {inAppBrowser ? "Mobile browser" : "Best experience"}
          </Text>
          <Text style={ui.modalTitle}>
            {inAppBrowser
              ? "Open in Safari or Chrome"
              : "Play better as an app"}
          </Text>
          <Text style={styles.body}>
            {inAppBrowser
              ? "You're in a limited in-app browser. Open P's & A's in Safari or Chrome, then add it to your home screen for full-screen play."
              : "Add P's & A's to your home screen for full-screen play without the browser bar — the best way to play on your phone."}
          </Text>

          {showSteps ? (
            <View style={styles.stepsBlock}>
              <Text style={styles.stepsTitle}>{instructions.title}</Text>
              {instructions.steps.map((step, index) => (
                <View key={step} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
              {instructions.footnote ? (
                <Text style={styles.footnote}>{instructions.footnote}</Text>
              ) : null}
            </View>
          ) : null}

          <AppButton
            label={primaryLabel}
            variant="primary"
            disabled={working}
            onPress={() => void handlePrimary()}
            accessibilityLabel={installButtonLabel}
            style={styles.primaryBtn}
          />

          <AppButton
            label="Continue in browser"
            variant="tertiary"
            onPress={handleContinueInBrowser}
            accessibilityLabel="Continue in browser without installing"
            style={styles.secondaryBtn}
          />
          <Text style={styles.declineHint}>
            Or continue in the browser and set your name — Google can sync
            stats later.
          </Text>
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
      marginBottom: 16,
    },
    stepsBlock: {
      alignSelf: "stretch",
      marginBottom: 12,
    },
    stepsTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 10,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 10,
    },
    stepBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.btnAccentBg,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    stepBadgeText: {
      color: colors.textOnAccent,
      fontSize: 12,
      fontWeight: "800",
    },
    stepText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
    footnote: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
      marginBottom: 8,
    },
    primaryBtn: {
      width: "100%",
      marginTop: 4,
    },
    secondaryBtn: {
      width: "100%",
      marginTop: 6,
    },
    declineHint: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 8,
    },
  });
}
