import React from "react";
import {
  LayoutChangeEvent,
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
  className?: string;
  /** Blur strength on native (0–100). */
  intensity?: number;
  /** Dark scrim over blur — lower = more see-through. */
  scrimOpacity?: number;
  /** Web glass fill opacity. */
  webOpacity?: number;
  /** Override blur preset (chrome / panel / modal). */
  preset?: BlurPreset;
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Allow children (e.g. flame accents) to paint outside the panel. */
  overflowVisible?: boolean;
};

type PaddingKeys =
  | "padding"
  | "paddingTop"
  | "paddingBottom"
  | "paddingLeft"
  | "paddingRight"
  | "paddingHorizontal"
  | "paddingVertical"
  | "paddingStart"
  | "paddingEnd";

const PADDING_KEYS: PaddingKeys[] = [
  "padding",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingHorizontal",
  "paddingVertical",
  "paddingStart",
  "paddingEnd",
];

/**
 * Split visual chrome (border, radius, shadow) from layout padding.
 * Padding on the painted surface makes AbsoluteFill children inset and
 * read as a nested rectangular plate — keep paint on the outer surface only.
 */
function splitPadding(style: StyleProp<ViewStyle>): {
  surface: ViewStyle;
  contentPad: ViewStyle;
} {
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const contentPad: ViewStyle = {};
  const surface: ViewStyle = { ...flat };
  for (const key of PADDING_KEYS) {
    if (surface[key] != null) {
      (contentPad as Record<string, unknown>)[key] = surface[key];
      delete surface[key];
    }
  }
  // Nested AbsoluteFill layers must never inherit a second background.
  // Callers paint via BlurPanel's single glass fill only.
  delete surface.backgroundColor;
  return { surface, contentPad };
}

export default function BlurPanel({
  children,
  style,
  className,
  intensity,
  scrimOpacity,
  webOpacity,
  preset,
  onLayout,
  overflowVisible = false,
}: Props) {
  const { colors } = useAppTheme();
  const blur = preset ?? colors.blur.panel;
  const resolvedIntensity = intensity ?? blur.intensity;
  const resolvedScrim = scrimOpacity ?? blur.scrimOpacity;
  const resolvedWebOpacity = webOpacity ?? blur.webOpacity;
  const webBlurPx = Math.round(Math.min(28, Math.max(16, resolvedIntensity * 0.46)));
  const scrimRgb = colors.frostRgb;
  const { surface, contentPad } = splitPadding(style);
  const overflowStyle = {
    overflow: overflowVisible ? ("visible" as const) : ("hidden" as const),
  };

  if (Platform.OS === "web") {
    // Single painted surface. No nested tint View — that was the inset plate.
    return (
      <View
        // @ts-expect-error className is supported on RN Web
        className={className}
        onLayout={onLayout}
        style={[
          styles.fallback,
          overflowStyle,
          {
            backgroundColor: `rgba(${scrimRgb}, ${resolvedWebOpacity})`,
            backdropFilter: `blur(${webBlurPx}px) saturate(1.35)`,
            WebkitBackdropFilter: `blur(${webBlurPx}px) saturate(1.35)`,
          } as ViewStyle,
          surface,
        ]}
      >
        <View
          style={[
            styles.content,
            overflowStyle,
            contentPad,
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  // Native: single BlurView surface. Scrim is the BlurView backgroundColor —
  // never a nested AbsoluteFill sibling (that became an inset plate when
  // callers put padding on the BlurView).
  return (
    <BlurView
      intensity={resolvedIntensity}
      tint={blur.tint}
      onLayout={onLayout}
      style={[
        styles.blur,
        overflowStyle,
        { backgroundColor: `rgba(${scrimRgb}, ${resolvedScrim})` },
        surface,
      ]}
    >
      <View style={[styles.content, overflowStyle, contentPad]}>
        {children}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    overflow: "hidden",
  },
  content: {
    position: "relative",
    zIndex: 1,
    alignSelf: "stretch",
    width: "100%",
  },
  fallback: {
    overflow: "hidden",
  },
});
