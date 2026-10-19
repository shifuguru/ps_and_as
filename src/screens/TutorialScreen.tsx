import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";

export default function TutorialScreen({
  visible,
  onComplete,
  onSkip,
}: {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={s.container}>
      <Text style={s.title}>Tutorial</Text>
      <Text style={s.body}>[Stub] CPU plays 3♣. Play the matching rank.</Text>
      <Button title="Skip" onPress={onSkip} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, marginBottom: 20 },
  body: { fontSize: 16, marginBottom: 20 },
});
