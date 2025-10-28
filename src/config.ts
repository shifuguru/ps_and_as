import { Platform } from "react-native";
// If you're not using RN/Expo on web, this import won't hurt on native; on web you can stub it.
let host = "";
try {
  // Expo SDK 49+:
  // @ts-ignore
  const Constants = require("expo-constants").default;
  const fromExpo = (Constants?.expoGoConfig?.debuggerHost || Constants?.expoConfig?.hostUri || "");
  host = fromExpo.split(":")[0] || "";
} catch {}

export function getServerUrl() {
  // 1) use env override if set
  const env = process.env.EXPO_PUBLIC_SERVER_URL || process.env.SERVER_URL;
  if (env) return env;

  // 2) dev heuristics
  if (__DEV__) {
    if (Platform.OS === "android") return "http://10.0.2.2:3000"; // Android emulator
    if (Platform.OS === "ios") return "http://localhost:3000";   // iOS simulator
    if (host) return `http://${host}:3000`;                      // Expo on device (LAN)
  }

  // 3) fallback to your staging/prod URL
  return "https://YOUR-PROD-URL.example.com";
}
