import React from "react";
import { useGameTerminology } from "../hooks/useGameTerminology";
import { Modal, View, Text, Button, StyleSheet } from "react-native";

export interface TutorialModalProps {
  visible: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ visible, onClose }) => {
  const wording = useGameTerminology();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{wording("Welcome to P's & A's")}</Text>
          <Text style={styles.body}>A quick tutorial before playing online?</Text>
          <Button title="Okay" onPress={onClose} />
          <Button title="No thanks" onPress={onClose} />
          /* Change button behaviour relative to user choice */
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: 250,
    padding: 20,
    backgroundColor: "white",
    borderRadius: 8,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  body: {
    marginBottom: 20,
    textAlign: "center",
  },
});
