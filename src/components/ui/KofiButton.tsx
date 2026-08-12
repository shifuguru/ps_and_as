import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

/** Ko-fi brand red — https://more.ko-fi.com/brand-assets */
export const KOFI_BRAND_RED = "#FF5E5B";

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function KofiButton({
  onPress,
  style,
  accessibilityLabel = "Support on Ko-fi",
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
        ☕
      </Text>
      <Text style={styles.label}>Ko-fi</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: KOFI_BRAND_RED,
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
