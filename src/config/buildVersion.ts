import { Platform } from "react-native";
import { resolveBuildCodename } from "./buildCodenames";

export type BuildVersionInfo = {
  version: string;
  buildId: string;
  builtAt?: string;
  codename?: string;
  channel?: "production" | "development";
};

type RuntimeBuild = {
  version?: string;
  buildId?: string;
  builtAt?: string;
  channel?: "production" | "development";
};

function readExtraBuild(): RuntimeBuild | null {
  try {
    const Constants = require("expo-constants").default as {
      expoConfig?: {
        extra?: {
          buildId?: string | null;
          appVersion?: string | null;
        };
      };
    };
    const extra = Constants.expoConfig?.extra;
    if (!extra) return null;
    return {
      buildId: extra.buildId?.trim() || undefined,
      version: extra.appVersion?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

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

let cachedPackageVersion: string | undefined;

function readPackageVersion(): string | undefined {
  if (cachedPackageVersion !== undefined) {
    return cachedPackageVersion || undefined;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require("../../package.json") as { version?: string };
    cachedPackageVersion = pkg.version?.trim() || "";
  } catch {
    cachedPackageVersion = "";
  }
  return cachedPackageVersion || undefined;
}

/** Semantic app version from package.json / app.json (resolved lazily). */
export function resolveAppVersion(): string {
  return (
    runtimeBuild()?.version?.trim() ||
    readExtraBuild()?.version?.trim() ||
    process.env.EXPO_PUBLIC_APP_VERSION?.trim() ||
    readPackageVersion() ||
    "0.0.0"
  );
}

/** @deprecated Prefer `resolveAppVersion()` — constant may be stale if read before HTML inject. */
export const APP_VERSION = resolveAppVersion();

/** Resolve build id — on web prefer the baked bundle id so stale cached JS still compares correctly against version.json. */
export function resolveClientBuildId(): string {
  const runtime = runtimeBuild()?.buildId?.trim();
  const env = process.env.EXPO_PUBLIC_BUILD_ID?.trim();
  const extra = readExtraBuild()?.buildId?.trim();
  if (Platform.OS === "web") {
    return env || extra || runtime || (__DEV__ ? "dev" : "unknown");
  }
  return env || extra || runtime || (__DEV__ ? "dev" : "unknown");
}

/** Build id for UI labels — prefer runtime HTML inject (matches version.json on deploy). */
function resolveDisplayBuildId(): string {
  const runtime = runtimeBuild()?.buildId?.trim();
  const env = process.env.EXPO_PUBLIC_BUILD_ID?.trim();
  const extra = readExtraBuild()?.buildId?.trim();
  if (Platform.OS === "web") {
    return runtime || env || extra || resolveClientBuildId();
  }
  return env || extra || runtime || resolveClientBuildId();
}

/** Deploy channel baked into version.json / index.html on CI builds. */
export function resolveDeployChannel(): "production" | "development" {
  const channel = runtimeBuild()?.channel;
  return channel === "development" ? "development" : "production";
}

/** Build metadata for UI labels (main menu, update overlay "Your build"). */
export function resolveClientBuildInfo(): BuildVersionInfo {
  const version = resolveAppVersion();
  return {
    version,
    buildId: resolveDisplayBuildId(),
    codename: resolveBuildCodename(version),
    channel: resolveDeployChannel(),
  };
}

export function resolveClientBuildLabel(): string {
  return formatBuildLabel(resolveClientBuildInfo());
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
  if (!info) return resolveAppVersion();
  const version = info.version?.trim() || resolveAppVersion();
  const codename = info.codename?.trim() || resolveBuildCodename(version);
  const id = info.buildId?.trim();
  const devPrefix = info.channel === "development" ? "Dev · " : "";
  const namePart = codename ? `${version} · ${codename}` : version;
  if (!id || id === "dev" || id === "unknown") {
    return `${devPrefix}${namePart}`;
  }
  const shortId = id.length > 8 ? id.slice(0, 7) : id;
  return `${devPrefix}${namePart} (${shortId})`;
}
