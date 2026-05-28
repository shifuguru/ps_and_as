import React from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { useAppTheme } from "../context/ThemeContext";
import type { BlurPreset } from "../styles/themeColors";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Blur strength on native (0–100). */
  intensity?: number;
  /** Dark scrim over blur — lower = more see-through. */
  scrimOpacity?: number;
  /** Web glass fill opacity. */
  webOpacity?: number;
  /** Override blur preset (chrome / panel / modal). */
  preset?: BlurPreset;
};

export default function BlurPanel({
  children,
  style,
  intensity,
  scrimOpacity,
  webOpacity,
  preset,
}: Props) {
  const { colors } = useAppTheme();
  const blur = preset ?? colors.blur.panel;
  const resolvedIntensity = intensity ?? blur.intensity;
  const resolvedScrim = scrimOpacity ?? blur.scrimOpacity;
  const resolvedWebOpacity = webOpacity ?? blur.webOpacity;
  const scrimRgb = colors.mode === "light" ? "255, 255, 255" : "8, 28, 18";
  const webTintStrength = colors.mode === "light" ? 0.28 : 0.5;

  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: `rgba(${scrimRgb}, ${resolvedWebOpacity})` },
          style,
        ]}
      >
        <View
          style={[
            styles.fallbackTint,
            {
              backgroundColor: `rgba(${scrimRgb}, ${resolvedWebOpacity * webTintStrength})`,
            },
          ]}
          pointerEvents="none"
        />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <BlurView
      intensity={resolvedIntensity}
      tint={blur.tint}
      style={[styles.blur, style]}
    >
      <View
        style={[
          styles.scrim,
          { backgroundColor: `rgba(${scrimRgb}, ${resolvedScrim})` },
        ]}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    overflow: "hidden",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    alignSelf: "stretch",
  },
  fallback: {
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        } as object)
      : null),
  },
  fallbackTint: {
    ...StyleSheet.absoluteFillObject,
  },
});
