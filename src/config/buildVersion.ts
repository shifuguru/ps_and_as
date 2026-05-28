import { Platform } from "react-native";

export type BuildVersionInfo = {
  version: string;
  buildId: string;
  builtAt?: string;
};

type RuntimeBuild = {
  version?: string;
  buildId?: string;
  builtAt?: string;
};

function runtimeBuild(): RuntimeBuild | null {
  try {
    return (
      (globalThis as { __PS_AND_AS_BUILD__?: RuntimeBuild }).__PS_AND_AS_BUILD__ ??
      null
    );
  } catch {
    return null;
  }
}

/** Semantic app version from package.json / app.json. */
export const APP_VERSION =
  process.env.EXPO_PUBLIC_APP_VERSION?.trim() ||
  runtimeBuild()?.version ||
  "0.0.0";

/** Resolve build id — on web prefer inline HTML meta over baked bundle env (Android cache). */
export function resolveClientBuildId(): string {
  const runtime = runtimeBuild()?.buildId?.trim();
  const env = process.env.EXPO_PUBLIC_BUILD_ID?.trim();
  if (Platform.OS === "web") {
    return runtime || env || (__DEV__ ? "dev" : "unknown");
  }
  return env || runtime || (__DEV__ ? "dev" : "unknown");
}

/**
 * Unique id for this build (git SHA in CI). Used to detect stale cached web bundles.
 * Local dev uses "dev" and skips update prompts.
 */
export const CLIENT_BUILD_ID = resolveClientBuildId();

export const WEB_BASE_PATH = (
  process.env.EXPO_PUBLIC_BASE_PATH?.trim() || "/ps_and_as"
).replace(/\/$/, "");

export function isTrackableBuild(): boolean {
  return !!CLIENT_BUILD_ID && CLIENT_BUILD_ID !== "dev" && CLIENT_BUILD_ID !== "unknown";
}

export function formatBuildLabel(info?: BuildVersionInfo | null): string {
  if (!info) return APP_VERSION;
  const shortId =
    info.buildId.length > 8 ? info.buildId.slice(0, 7) : info.buildId;
  return `${info.version} (${shortId})`;
}
