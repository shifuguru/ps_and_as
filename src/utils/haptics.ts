import { Platform } from "react-native";

let Haptics: any = null;

try {
  Haptics = require("expo-haptics");
} catch (_e) {
  // expo-haptics not available
}

export function triggerHaptic(
  style: "light" | "medium" | "heavy" = "medium",
): void {
  if (Platform.OS === "web" || !Haptics) return;
  try {
    const map: Record<string, any> = {
      light: Haptics.ImpactFeedbackStyle?.Light,
      medium: Haptics.ImpactFeedbackStyle?.Medium,
      heavy: Haptics.ImpactFeedbackStyle?.Heavy,
    };
    Haptics.impactAsync?.(map[style]);
  } catch (_e) {
    // silently ignore
  }
}
