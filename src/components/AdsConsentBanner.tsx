import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import {
  getAdsConsentSync,
  isAdsConsentLoaded,
  preloadAdsConsent,
  setAdsConsent,
  subscribeAdsConsent,
} from "../services/ads/adsConsent";

type Props = {
  onOpenPrivacy?: () => void;
};

/**
 * Bottom consent strip — shown on web until the player accepts or declines ads.
 */
export default function AdsConsentBanner({ onOpenPrivacy }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [consent, setConsent] = useState(getAdsConsentSync());
  const [ready, setReady] = useState(isAdsConsentLoaded());

  useEffect(() => {
    void preloadAdsConsent().then(() => {
      setConsent(getAdsConsentSync());
      setReady(true);
    });
    return subscribeAdsConsent(() => setConsent(getAdsConsentSync()));
  }, []);

  if (Platform.OS !== "web" || !ready || consent !== "unknown") return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.body}>
        We use ads to keep servers running. Accept to enable ads (and optional
        watch-for-XP). You can remove forced ads later in Settings.
      </Text>
      <View style={styles.row}>
        {onOpenPrivacy ? (
          <TouchableOpacity onPress={onOpenPrivacy} accessibilityRole="link">
            <Text style={styles.link}>Privacy</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              void Linking.openURL(
                "https://shifuguru.github.io/ps_and_as/?privacy=1",
              );
            }}
            accessibilityRole="link"
          >
            <Text style={styles.link}>Privacy</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => void setAdsConsent("declined")}
          accessibilityRole="button"
          accessibilityLabel="Decline ads"
        >
          <Text style={styles.secondaryLabel}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => void setAdsConsent("accepted")}
          accessibilityRole="button"
          accessibilityLabel="Accept ads"
        >
          <Text style={styles.primaryLabel}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 12,
      zIndex: 10050,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
      gap: 10,
    },
    body: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
      flexWrap: "wrap",
    },
    link: {
      color: colors.textSecondary,
      fontSize: 13,
      textDecorationLine: "underline",
      marginRight: "auto",
    },
    secondaryBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    secondaryLabel: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    primaryBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.actionPrimaryBg,
    },
    primaryLabel: {
      color: colors.actionPrimaryText,
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
