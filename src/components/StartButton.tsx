import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { styles, colors } from '../styles/theme';

type Props = {
  onPress: () => void;
  /** Render as a menu-styled button (dark background) instead of text-only header link */
  menu?: boolean;
  label?: string;
};

export default function StartGameButton({ onPress}) {
  return (
    <TouchableOpacity style={styles.menuButton} onPress={onPress}>
      <Text style={styles.menuButtonText}>Start Game</Text>
    </TouchableOpacity>
  );
}