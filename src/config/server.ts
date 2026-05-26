import { Platform } from "react-native";

/** Keep in sync with `server/index.js` default PORT. */
export const DEFAULT_SERVER_PORT = 4000;

/** Resolve the multiplayer server URL for the current platform / environment. */
export function getServerUrl(override?: string): string {
  if (override) return override;

  const port = DEFAULT_SERVER_PORT;

  // Web dev: same-origin via Metro proxy (/socket.io → backend). Avoids CORS.
  if (__DEV__ && Platform.OS === "web") {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    if (loc?.origin) return loc.origin;
  }

  if (process.env.EXPO_PUBLIC_SERVER_URL) {
    return process.env.EXPO_PUBLIC_SERVER_URL;
  }

  if (__DEV__) {
    if (Platform.OS === "android") return `http://10.0.2.2:${port}`;
    if (Platform.OS === "ios") return `http://localhost:${port}`;
    return `http://localhost:${port}`;
  }

  return "https://YOUR-PROD-URL.example.com";
}
