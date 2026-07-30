/**
 * DEV-only Round Complete crash probe.
 * Open with ?rcProbe=1 to mount RoundCompleteModal without playing a full game.
 */
import React, { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import RoundCompleteModal from "./RoundCompleteModal";

export function shouldRunRcCrashProbe(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("rcProbe") === "1";
  } catch {
    return false;
  }
}

export default function RcCrashProbe() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", marginBottom: 12 }}>RC crash probe…</Text>
      <RoundCompleteModal
        visible={visible}
        finishedOrder={["cpu:alpha", "p1", "cpu:bravo", "cpu:charlie"]}
        players={[
          { id: "cpu:alpha", name: "CPU Alpha" },
          { id: "p1", name: "Alice" },
          { id: "cpu:bravo", name: "CPU Bravo" },
          { id: "cpu:charlie", name: "CPU Charlie" },
        ]}
        readyStates={{ p1: false }}
        playerXp={{
          "cpu:alpha": 100,
          p1: 1200,
          "cpu:bravo": 90,
          "cpu:charlie": 80,
        }}
        playerRoundXp={{
          "cpu:alpha": 12,
          p1: 45,
          "cpu:bravo": 10,
          "cpu:charlie": 8,
        }}
        localPlayerId="p1"
        botsAutoReady
        botNextRoundAt={Date.now() + 8000}
        onQuit={() => setVisible(false)}
        onToggleReady={() => {}}
        xpAnimationReady={false}
      />
    </View>
  );
}
