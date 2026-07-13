import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  /** Animated opacity 0–1; defaults to internal fade when `visible` toggles. */
  opacity?: Animated.Value;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
  zIndex?: number;
  children?: React.ReactNode;
};

/**
 * Shared glass backdrop for round-end modals — soft blur, subtle dim, table still visible.
 */
export default function ModalBackdrop({
  opacity: opacityProp,
  visible = true,
  style,
  zIndex = 180,
  children,
}: Props) {
  const { colors, blur } = useAppTheme();
  const internalOpacity = useRef(new Animated.Value(0)).current;
  const opacity = opacityProp ?? internalOpacity;
  const modalBlur = blur.modal;
  const scrimRgb = colors.mode === "light" ? "255, 255, 255" : "8, 28, 18";
  const webBlurPx = Math.round(
    Math.min(28, Math.max(16, modalBlur.intensity * 0.46)),
  );
  const dimOpacity = colors.mode === "light" ? 0.18 : 0.42;

  useEffect(() => {
    if (opacityProp) return;
    Animated.timing(internalOpacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, opacityProp, internalOpacity]);

  return (
    <Animated.View
      style={[
        styles.root,
        { zIndex, elevation: zIndex, opacity },
        style,
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      {Platform.OS === "web" ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: `rgba(${scrimRgb}, ${modalBlur.webOpacity})`,
              backdropFilter: `blur(${webBlurPx}px) saturate(1.35)`,
              WebkitBackdropFilter: `blur(${webBlurPx}px) saturate(1.35)`,
            } as ViewStyle,
          ]}
          pointerEvents="none"
        />
      ) : (
        <BlurView
          intensity={modalBlur.intensity}
          tint={modalBlur.tint}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(0, 0, 0, ${dimOpacity})` },
        ]}
        pointerEvents="none"
      />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
