import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { styles } from '../styles/theme';

export default function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuButton} onPress={onPress}>
      <Text style={styles.menuButtonText}>Back</Text>
    </TouchableOpacity>
  );
}
