import { Platform } from "react-native";

/** Reload the app — cache-busting navigation on web, dev reload on native when available. */
export function attemptAppRefresh(): void {
  if (Platform.OS === "web") {
    const loc = (globalThis as {
      location?: { href: string; replace: (url: string) => void };
    }).location;
    if (loc) {
      const url = new URL(loc.href);
      url.searchParams.set("_", String(Date.now()));
      loc.replace(url.toString());
    }
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
