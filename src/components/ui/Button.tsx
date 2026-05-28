import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { BUTTON_CENTER, buttonLabel } from '../../styles/buttonStyles';

interface ButtonProps {
  label: string;
  onPress: () => void;
}

const Button: React.FC<ButtonProps> = ({ label, onPress }) => {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    ...BUTTON_CENTER,
    shadowColor: 'black',
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 2, height: 2 },
  },
  buttonText: buttonLabel(18, {
    color: 'white',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  }),
});

export default Button;