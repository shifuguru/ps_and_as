import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  /** Blur strength on native (0–100). */
  intensity?: number;
  /** Dark scrim — higher hides more of the screen beneath. */
  scrimOpacity?: number;
};

/** Full-screen frosted scrim for modal overlays (Settings, etc.). */
export default function FullscreenBlurScrim({
  intensity,
  scrimOpacity,
}: Props) {
  const { colors } = useAppTheme();
  const resolvedIntensity = intensity ?? (colors.mode === "light" ? 64 : 78);
  const resolvedScrim =
    scrimOpacity ??
    (colors.mode === "light" ? 0.72 : parseFloat(colors.fullscreenScrim.split(",")[3]?.replace(")", "") || "0.58"));

  const scrimColor = colors.fullscreenScrim;

  if (Platform.OS === "web") {
    return (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.webBackdrop,
          { backgroundColor: scrimColor },
        ]}
        pointerEvents="none"
      />
    );
  }

  return (
    <BlurView
      intensity={resolvedIntensity}
      tint={colors.mode === "light" ? "light" : "dark"}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      <View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: scrimColor }]}
      />
    </BlurView>
  );
}

const styles = StyleSheet.create({
  webBackdrop: {
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
        } as object)
      : null),
  },
});
