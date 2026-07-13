import React, { useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { BUTTON_CENTER, buttonLabel } from "../../styles/buttonStyles";
import { hexToRgba } from "../../utils/colorTheory";

export type AppButtonVariant = "primary" | "secondary" | "destructive" | "tertiary";

type Props = {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  activeOpacity?: number;
  accessibilityLabel?: string;
};

export default function AppButton({
  label,
  onPress,
  variant = "secondary",
  disabled = false,
  style,
  textStyle,
  activeOpacity = 0.82,
  accessibilityLabel,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createVariantStyles(colors), [colors]);
  const shell = styles[variant];
  const labelStyles = {
    primary: styles.primaryText,
    secondary: styles.secondaryText,
    destructive: styles.destructiveText,
    tertiary: styles.tertiaryText,
  } as const;

  return (
    <TouchableOpacity
      style={[shell, disabled && styles.disabled, style]}
      activeOpacity={activeOpacity}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[labelStyles[variant], disabled && styles.disabledText, textStyle]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function createVariantStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  const isDark = colors.mode === "dark";
  const destructiveBg = isDark ? "#8b1a1a" : "#c62828";
  const destructiveText = "#ffffff";

  return StyleSheet.create({
    primary: {
      borderRadius: 14,
      paddingHorizontal: 14,
      minHeight: 48,
      ...BUTTON_CENTER,
      backgroundColor: colors.gold,
      borderWidth: 0,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.28 : 0.12,
      shadowRadius: 6,
      elevation: 3,
    },
    primaryText: buttonLabel(15, {
      color: colors.textOnGold,
      fontWeight: "800",
    }),
    secondary: {
      borderRadius: 14,
      paddingHorizontal: 14,
      minHeight: 48,
      ...BUTTON_CENTER,
      backgroundColor: colors.btnSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.btnSecondaryBorder,
    },
    secondaryText: buttonLabel(15, {
      color: colors.btnSecondaryText,
      fontWeight: "700",
    }),
    destructive: {
      borderRadius: 14,
      paddingHorizontal: 14,
      minHeight: 48,
      ...BUTTON_CENTER,
      backgroundColor: destructiveBg,
      borderWidth: 0,
    },
    destructiveText: buttonLabel(15, {
      color: destructiveText,
      fontWeight: "800",
    }),
    tertiary: {
      borderRadius: 14,
      paddingHorizontal: 10,
      minHeight: 44,
      ...BUTTON_CENTER,
      backgroundColor: "transparent",
      borderWidth: 0,
    },
    tertiaryText: buttonLabel(15, {
      color: hexToRgba(colors.textPrimary, isDark ? 0.72 : 0.68),
      fontWeight: "600",
    }),
    disabled: {
      opacity: 0.45,
    },
    disabledText: {},
  });
}
