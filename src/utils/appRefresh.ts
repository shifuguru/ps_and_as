import { Platform } from "react-native";

/** Reload the app — full page refresh on web, dev reload on native when available. */
export function attemptAppRefresh(): void {
  if (Platform.OS === "web") {
    const loc = (globalThis as { location?: { reload: () => void } }).location;
    loc?.reload();
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DevSettings } = require("react-native") as typeof import("react-native");
    DevSettings?.reload?.();
  } catch {
    /* native release builds have no dev reload */
  }
}
