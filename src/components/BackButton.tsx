import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { strings } from '../strings';

type Props = {
  onPress: () => void;
  /** Render as a menu-styled button (dark background) instead of text-only header link */
  menu?: boolean;
  label?: string;
};

export default function BackButton({ onPress, menu = false, label }: Props) {
  const { colors, ui } = useAppTheme();
  const text = label ?? (menu ? strings.common.back : strings.common.leave);
  if (menu) {
    return (
      <TouchableOpacity
        style={ui.btnSecondary}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={text}
      >
        <Text style={ui.btnSecondaryText}>{text}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      style={[ui.leaveButton, styles.headerBackButton]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      <Text style={ui.leaveButtonText}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerBackButton: {
    marginTop: 0,
    minHeight: 44,
    paddingHorizontal: 18,
  },
});
