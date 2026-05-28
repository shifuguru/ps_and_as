import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import FullscreenBlurScrim from "./FullscreenBlurScrim";
import BlurPanel from "./BlurPanel";
import { useAppTheme } from "../context/ThemeContext";
import {
  APP_VERSION,
  resolveClientBuildId,
  formatBuildLabel,
  type BuildVersionInfo,
} from "../config/buildVersion";
import { applyBuildUpdate } from "../services/buildUpdateCheck";

type Props = {
  latestBuild: BuildVersionInfo | null;
};

export default function UpdateRequiredOverlay({ latestBuild }: Props) {
  const { colors, ui, blur } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const currentLabel = formatBuildLabel({
    version: APP_VERSION,
    buildId: CLIENT_BUILD_ID,
  });
  const latestLabel = formatBuildLabel(latestBuild);

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <FullscreenBlurScrim />
      <View style={styles.foreground}>
        <BlurPanel style={[ui.panel, styles.panel]} {...blur.panel} intensity={58}>
          <Text style={ui.panelEyebrow}>Update available</Text>
          <Text style={styles.title}>A newer version is ready</Text>
          <Text style={styles.body}>
            {Platform.OS === "web"
              ? "This tab is running an older copy of the game. Refresh to load the latest fixes and features."
              : "This install is out of date. Close the app completely and reopen it to pick up the latest version."}
          </Text>
          <View style={styles.versionRow}>
            <Text style={styles.versionLine}>
              Your build: <Text style={styles.versionStrong}>{currentLabel}</Text>
            </Text>
            {latestBuild ? (
              <Text style={styles.versionLine}>
                Latest: <Text style={styles.versionStrong}>{latestLabel}</Text>
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[ui.actionPrimary, styles.primaryBtn]}
            onPress={() => applyBuildUpdate(latestBuild?.buildId)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Refresh to update"
          >
            <Text style={ui.actionPrimaryText}>
              {Platform.OS === "web" ? "Refresh now" : "Restart app"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            {Platform.OS === "web"
              ? "If the page still looks old, close the tab and open the game again."
              : "On iPhone: swipe the app away from the app switcher, then reopen."}
          </Text>
        </BlurPanel>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 500,
      elevation: 500,
    },
    foreground: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      paddingHorizontal: 24,
      zIndex: 1,
    },
    panel: {
      width: "100%",
      maxWidth: 400,
      alignSelf: "center",
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      marginBottom: 10,
    },
    body: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 14,
    },
    versionRow: {
      gap: 4,
      marginBottom: 18,
    },
    versionLine: {
      color: colors.textMuted,
      fontSize: 12,
    },
    versionStrong: {
      color: colors.gold,
      fontWeight: "700",
    },
    primaryBtn: {
      width: "100%",
    },
    hint: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 12,
      textAlign: "center",
    },
  });
}
