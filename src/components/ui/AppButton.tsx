import React, { useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { BUTTON_CENTER, buttonLabel } from "../../styles/buttonStyles";
import { hexToRgba } from "../../utils/colorTheory";
import MenuIcon from "../MenuIcon";

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
  /** Optional leading glyph from MenuIcon. */
  icon?: React.ComponentProps<typeof MenuIcon>["name"];
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
  icon,
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
  const iconColor =
    variant === "primary"
      ? colors.actionPrimaryText
      : variant === "destructive"
        ? (styles.destructiveText.color as string)
        : (colors.btnSecondaryText as string);

  return (
    <TouchableOpacity
      style={[shell, disabled && styles.disabled, style]}
      activeOpacity={activeOpacity}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View style={styles.contentRow}>
        {icon ? <MenuIcon name={icon} size={18} color={iconColor} /> : null}
        <Text style={[labelStyles[variant], disabled && styles.disabledText, textStyle]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function createVariantStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  const isDark = colors.mode === "dark";
  const destructiveFill = hexToRgba(isDark ? "#e57373" : "#c62828", isDark ? 0.22 : 0.14);
  const destructiveBorder = hexToRgba(isDark ? "#ef9a9a" : "#b71c1c", isDark ? 0.4 : 0.28);
  const destructiveLabel = isDark ? "#ffcdd2" : "#8b1a1a";

  return StyleSheet.create({
    contentRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primary: {
      borderRadius: 14,
      paddingHorizontal: 14,
      minHeight: 48,
      ...BUTTON_CENTER,
      backgroundColor: colors.actionPrimaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.actionPrimaryBorder,
    },
    primaryText: buttonLabel(15, {
      color: colors.actionPrimaryText,
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
      backgroundColor: destructiveFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: destructiveBorder,
    },
    destructiveText: buttonLabel(15, {
      color: destructiveLabel,
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
