import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BlurPanel from "./BlurPanel";
import AddToHomeScreenModal from "./AddToHomeScreenModal";
import { useAppTheme } from "../context/ThemeContext";
import { useWebAppInstall } from "../hooks/useWebAppInstall";
import {
  dismissAddToHomeBanner,
  isAddToHomeBannerDismissed,
} from "../services/addToHomeScreenPrefs";

export default function AddToHomeScreenBanner() {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showOffer, installButtonLabel, requestInstall } = useWebAppInstall();
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !showOffer) {
      setPrefsLoaded(true);
      return;
    }
    void isAddToHomeBannerDismissed().then((value) => {
      setDismissed(value);
      setPrefsLoaded(true);
    });
  }, [showOffer]);

  if (Platform.OS !== "web" || !showOffer || !prefsLoaded || dismissed) {
    return null;
  }

  const handlePrimary = async () => {
    setWorking(true);
    try {
      const result = await requestInstall();
      if (result === "manual") {
        setModalOpen(true);
      }
    } finally {
      setWorking(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    void dismissAddToHomeBanner();
  };

  return (
    <>
      <BlurPanel style={styles.banner} intensity={54}>
        <Text style={styles.eyebrow}>Full screen</Text>
        <Text style={styles.title}>Play without the browser bar</Text>
        <Text style={styles.body}>
          Add P&apos;s & A&apos;s to your home screen for a full-screen app
          experience. On iPhone, use Safari&apos;s Share button in the bottom
          toolbar — we&apos;ll walk you through it.
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[ui.btnPrimary, styles.primaryBtn]}
            onPress={() => void handlePrimary()}
            disabled={working}
            activeOpacity={0.85}
          >
            {working ? (
              <ActivityIndicator color={colors.textOnGold} />
            ) : (
              <Text style={ui.btnPrimaryText}>{installButtonLabel}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={ui.btnGhost}
            onPress={handleDismiss}
            activeOpacity={0.85}
          >
            <Text style={ui.btnGhostText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </BlurPanel>

      <AddToHomeScreenModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    banner: {
      marginBottom: 14,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
      padding: 14,
    },
    eyebrow: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "800",
      marginBottom: 6,
    },
    body: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 12,
    },
    actions: {
      gap: 8,
    },
    primaryBtn: {
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
    },
  });
}
