import React from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import BlurPanel from "../components/BlurPanel";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  compact?: boolean;
  /** Soft accent rim (e.g. rarity / gold). */
  accentColor?: string;
  onPress?: () => void;
  disabled?: boolean;
};

/**
 * Premium frosted glass — opacity from theme blur.panel (mode-neutral).
 * Theme brightness lives on the felt / ambient, not here.
 */
export default function GameplayGlassPanel({
  children,
  style,
  intensity,
  compact = false,
  accentColor,
  onPress,
  disabled,
}: Props) {
  const { colors, blur } = useAppTheme();
  const rim = accentColor ?? colors.gold;
  const panel = blur.panel;
  const env = colors.environment;
  const depth = Platform.select({
    ios: {
      shadowColor: rim,
      shadowOpacity: env.shadowOpacity * 0.55,
      shadowRadius: env.shadowSoftness,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 4 },
    default: {},
  }) as ViewStyle;

  const body = (
    <BlurPanel
      intensity={intensity ?? panel.intensity}
      scrimOpacity={panel.scrimOpacity}
      webOpacity={panel.webOpacity}
      preset={panel}
      style={[
        styles.panel,
        depth,
        {
          borderColor: hexToRgba(rim, 0.34),
          padding: compact ? 10 : 12,
        },
        style,
      ]}
    >
      {children}
    </BlurPanel>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
