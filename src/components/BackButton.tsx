import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { styles, colors } from '../styles/theme';

type Props = {
  onPress: () => void;
  /** Render as a menu-styled button (dark background) instead of text-only header link */
  menu?: boolean;
  label?: string;
};

export default function BackButton({ onPress, menu = false, label }: Props) {
  const text = label ?? 'Leave';
  if (menu) {
    return (
      <TouchableOpacity style={styles.menuButton} onPress={onPress}>
        <Text style={styles.menuButtonText}>Back</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: 'transparent', paddingHorizontal: 8, paddingVertical: 6 }} accessibilityLabel="Leave">
      <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>{text}</Text>
    </TouchableOpacity>
  );
}
