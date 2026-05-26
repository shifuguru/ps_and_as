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
  /** Dark scrim over blur — lower = more see-through (default 0.28). */
  scrimOpacity?: number;
  /** Web glass fill opacity (default 0.08). */
  webOpacity?: number;
};

export default function BlurPanel({
  children,
  style,
  intensity = 52,
  scrimOpacity = 0.28,
  webOpacity = 0.08,
}: Props) {
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: `rgba(255, 255, 255, ${webOpacity})` },
          style,
        ]}
      >
        <View
          style={[
            styles.fallbackTint,
            { backgroundColor: `rgba(255, 255, 255, ${webOpacity * 0.5})` },
          ]}
          pointerEvents="none"
        />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint="dark" style={[styles.blur, style]}>
      <View
        style={[
          styles.scrim,
          { backgroundColor: `rgba(8, 28, 18, ${scrimOpacity})` },
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
