import { Platform } from "react-native";

/** Keep in sync with `server/index.js` default PORT. */
export const DEFAULT_SERVER_PORT = 4000;

function isLoopbackUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return url.includes("localhost") || url.includes("127.0.0.1");
  }
}

/** Expo Go / dev client reports the Metro host — same machine that should run the game server. */
function devLanHostFromExpo(): string | null {
  try {
    const Constants = require("expo-constants").default as {
      expoGoConfig?: { debuggerHost?: string };
      expoConfig?: { hostUri?: string };
      manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
    };
    const raw =
      Constants.expoGoConfig?.debuggerHost ??
      Constants.manifest2?.extra?.expoGo?.debuggerHost ??
      Constants.expoConfig?.hostUri ??
      "";
    const host = String(raw).split(":")[0]?.trim();
    if (!host || host === "localhost" || host === "127.0.0.1") return null;
    return host;
  } catch {
    return null;
  }
}

/** Resolve the multiplayer server URL for the current platform / environment. */
export function getServerUrl(override?: string): string {
  if (override) return override;

  const port = DEFAULT_SERVER_PORT;
  const envUrl = process.env.EXPO_PUBLIC_SERVER_URL?.trim();

  // Web dev: same-origin via Metro proxy (/socket.io → backend). Avoids CORS.
  if (__DEV__ && Platform.OS === "web") {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    if (loc?.origin) return loc.origin;
  }

  // Native dev: localhost in .env only works on simulators — prefer Expo LAN host on device.
  if (__DEV__ && Platform.OS !== "web") {
    const lanHost = devLanHostFromExpo();
    if (lanHost) {
      return `http://${lanHost}:${port}`;
    }
    if (envUrl && !isLoopbackUrl(envUrl)) {
      return envUrl;
    }
    if (Platform.OS === "android") {
      return `http://10.0.2.2:${port}`;
    }
    return `http://localhost:${port}`;
  }

  if (envUrl) {
    return envUrl;
  }

  if (__DEV__) {
    return `http://localhost:${port}`;
  }

  return "https://YOUR-PROD-URL.example.com";
}
