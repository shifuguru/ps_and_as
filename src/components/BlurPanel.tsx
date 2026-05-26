import React from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Blur strength on native (0–100). */
  intensity?: number;
};

const FALLBACK_BG = "rgba(14, 42, 28, 0.68)";

export default function BlurPanel({
  children,
  style,
  intensity = 52,
}: Props) {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.fallback, style]}>
        <View style={styles.fallbackTint} pointerEvents="none" />
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint="dark" style={[styles.blur, style]}>
      <View style={styles.scrim} pointerEvents="none" />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    overflow: "hidden",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 28, 18, 0.28)",
  },
  fallback: {
    backgroundColor: FALLBACK_BG,
    overflow: "hidden",
  },
  fallbackTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
});
