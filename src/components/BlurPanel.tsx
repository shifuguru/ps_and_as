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

export default function BlurPanel({
  children,
  style,
  intensity = 52,
}: Props) {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.fallback, style]}>
        <View style={styles.fallbackTint} pointerEvents="none" />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint="dark" style={[styles.blur, style]}>
      <View style={styles.scrim} pointerEvents="none" />
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
    backgroundColor: "rgba(8, 28, 18, 0.28)",
  },
  content: {
    position: "relative",
    zIndex: 1,
  },
  fallback: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
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
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
});
