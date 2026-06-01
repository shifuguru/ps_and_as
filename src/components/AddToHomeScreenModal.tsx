import React, { useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import BlurPanel from "./BlurPanel";
import WebModalPortal from "./WebModalPortal";
import FullscreenBlurScrim from "./FullscreenBlurScrim";
import { useAppTheme } from "../context/ThemeContext";
import { useWebAppInstall } from "../hooks/useWebAppInstall";
import { isMobileWeb } from "../utils/webViewport";
import { BUTTON_CENTER } from "../styles/buttonStyles";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AddToHomeScreenModal({ visible, onClose }: Props) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 40, 420);
  const { canInstall, installButtonLabel, instructions, installNative } = useWebAppInstall();
  const [installing, setInstalling] = useState(false);

  if (Platform.OS !== "web" || !visible) return null;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await installNative();
    } finally {
      setInstalling(false);
    }
  };

  const panel = (
    <BlurPanel
      style={[ui.panel, styles.panel, { width: cardWidth, maxWidth: cardWidth }]}
      intensity={56}
    >
      <Text style={ui.panelEyebrow}>Mobile</Text>
      <Text style={styles.title}>{instructions.title}</Text>
      <Text style={styles.intro}>{instructions.intro}</Text>

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

      {canInstall ? (
        <TouchableOpacity
          style={[ui.btnPrimary, styles.primaryBtn]}
          onPress={() => void handleInstall()}
          disabled={installing}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={installButtonLabel}
        >
          <Text style={ui.btnPrimaryText}>
            {installing ? "Opening install…" : installButtonLabel}
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[ui.btnSecondary, styles.secondaryBtn]}
        onPress={onClose}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Close add to home screen instructions"
      >
        <Text style={ui.btnSecondaryText}>Close</Text>
      </TouchableOpacity>
    </BlurPanel>
  );

  if (isMobileWeb()) {
    return (
      <WebModalPortal style={styles.portal}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss add to home screen instructions"
        >
          <FullscreenBlurScrim />
        </TouchableOpacity>
        <View style={styles.center} pointerEvents="box-none">
          {panel}
        </View>
      </WebModalPortal>
    );
  }

  return (
    <WebModalPortal style={styles.portal}>
      <View style={ui.modalOverlay}>
        {panel}
      </View>
    </WebModalPortal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    portal: {
      flex: 1,
      ...(Platform.OS === "web"
        ? ({
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 400,
          } as object)
        : null),
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    center: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    panel: {
      alignSelf: "center",
      maxHeight: "90%",
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      marginBottom: 8,
    },
    intro: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
    },
    stepBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.btnGoldBg,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    stepBadgeText: {
      color: colors.textOnGold,
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
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
      marginBottom: 16,
    },
    primaryBtn: {
      marginTop: 8,
      ...BUTTON_CENTER,
    },
    secondaryBtn: {
      marginTop: 10,
      ...BUTTON_CENTER,
    },
  });
}
