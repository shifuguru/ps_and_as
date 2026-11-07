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
  /** Frosted, whitish "milky" blur instead of a dark dim. */
  milky?: boolean;
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
  milky = false,
}: Props) {
  const { colors, blur } = useAppTheme();
  const internalOpacity = useRef(new Animated.Value(0)).current;
  const opacity = opacityProp ?? internalOpacity;
  const modalBlur = blur.modal;
  const scrimRgb = colors.frostRgb;
  const webBlurPx = Math.round(
    Math.min(28, Math.max(16, modalBlur.intensity * 0.46)),
  );
  const dimOpacity = colors.mode === "light" ? 0.28 : 0.52;

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
        { zIndex, elevation: zIndex },
        // An opacity ancestor is a backdrop root on web and hides earlier siblings from the filter.
        Platform.OS !== "web" && { opacity },
        style,
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      {Platform.OS === "web" ? (
        <Animated.View
          testID="modal-backdrop-blur"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity,
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
          style={[
            StyleSheet.absoluteFill,
            milky && {
              backgroundColor: `rgba(${scrimRgb}, ${modalBlur.scrimOpacity})`,
            },
          ]}
          pointerEvents="none"
        />
      )}
      {!milky ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: `rgba(0, 0, 0, ${dimOpacity})`,
              ...(Platform.OS === "web" ? { opacity } : null),
            },
          ]}
          pointerEvents="none"
        />
      ) : null}
      {Platform.OS === "web" && children ? (
        <Animated.View style={[styles.root, { opacity }]}>
          {children}
        </Animated.View>
      ) : children}
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
