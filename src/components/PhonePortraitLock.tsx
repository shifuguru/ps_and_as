import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useForcedPortraitFrame } from "../utils/orientationLock";

/**
 * Phones render at their real (physical) size in any orientation — we no
 * longer fake/letterbox a portrait frame. That structural swap used to force
 * React to unmount and remount the entire app whenever a phone rotated
 * (different wrapper depth around `children` on each render), which looked
 * like the whole app "reloading" and lost in-progress game state.
 *
 * `children` now always renders at the exact same tree position. When a
 * phone is landscape we simply overlay a lightweight reminder asking the
 * player to rotate back to portrait — no layout is forced or scaled.
 *
 * Tablets and desktop are unaffected.
 */
export default function PhonePortraitLock({
  children,
}: {
  children: React.ReactNode;
}) {
  const frame = useForcedPortraitFrame();
  const showReminder = Platform.OS === "web" && frame.forcePortrait;

  return (
    <View style={styles.root}>
      {children}
      {showReminder ? (
        <View style={styles.reminderBanner} pointerEvents="none">
          <Text style={styles.reminderText}>
            Rotate your device to portrait for the best experience
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  reminderBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.72)",
    zIndex: 9999,
  },
  reminderText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
