import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { usePhoneLandscapeBlock } from "../utils/orientationLock";
import { gameTitleFontFamily } from "../utils/gameTitleFont";
import { DEFAULT_FELT_COLOR } from "../services/wallpaper";

/**
 * Browsers cannot force portrait in a normal tab (or DevTools device mode).
 * On phones, cover the UI in landscape and ask the player to rotate.
 */
export default function PhoneLandscapeGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const blocked = usePhoneLandscapeBlock();
  const { colors, feltTint } = useAppTheme();

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      {children}
      {blocked ? (
        <View
          style={[
            styles.overlay,
            { backgroundColor: feltTint || DEFAULT_FELT_COLOR },
          ]}
          accessibilityRole="alert"
          accessibilityLabel="Rotate your phone to portrait"
        >
          <Text style={[styles.eyebrow, { color: colors.gold }]}>Ps & As</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Rotate to portrait
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            This game is played upright on phones.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    ...(Platform.OS === "web"
      ? ({ position: "fixed", inset: 0 } as object)
      : null),
  },
  eyebrow: {
    fontFamily: gameTitleFontFamily(),
    fontSize: 28,
    marginBottom: 12,
    textAlign: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    textAlign: "center",
    opacity: 0.9,
    maxWidth: 320,
  },
});
