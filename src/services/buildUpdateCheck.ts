import { Platform } from "react-native";
import {
  APP_VERSION,
  CLIENT_BUILD_ID,
  WEB_BASE_PATH,
  type BuildVersionInfo,
} from "../config/buildVersion";
import { getServerUrl } from "../config/server";
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const version = typeof data.version === "string" ? data.version : APP_VERSION;
  const buildId = typeof data.buildId === "string" ? data.buildId : "";
  if (!buildId) return null;
  const builtAt = typeof data.builtAt === "string" ? data.builtAt : undefined;
  return { version, buildId, builtAt };
}

function webVersionJsonUrl(): string | null {
  if (Platform.OS !== "web") return null;
  const loc = (globalThis as { location?: { origin?: string } }).location;
  if (!loc?.origin) return null;
  const base = WEB_BASE_PATH ? `${WEB_BASE_PATH}/` : "/";
  return `${loc.origin}${base}version.json`;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Latest deployed build metadata (GitHub Pages version.json or game server /version). */
export async function fetchLatestBuildInfo(): Promise<BuildVersionInfo | null> {
  const cacheBust = `t=${Date.now()}`;

  if (Platform.OS === "web" && !__DEV__) {
    const webUrl = webVersionJsonUrl();
    if (webUrl) {
      const fromWeb = parseVersionPayload(
        await fetchJson(`${webUrl}?${cacheBust}`),
      );
      if (fromWeb) return fromWeb;
    }
  }

  const serverBase = getServerUrl().replace(/\/$/, "");
  const fromServer = parseVersionPayload(
    await fetchJson(`${serverBase}/version?${cacheBust}`),
  );
  return fromServer;
}

export function isRemoteBuildNewer(remote: BuildVersionInfo): boolean {
  if (!remote.buildId || remote.buildId === CLIENT_BUILD_ID) return false;
  if (CLIENT_BUILD_ID === "dev" || CLIENT_BUILD_ID === "unknown") return false;
  return true;
}

export function applyBuildUpdate(): void {
  if (Platform.OS === "web") {
    const loc = (globalThis as { location?: Location }).location;
    if (loc) {
      const url = new URL(loc.href);
      url.searchParams.set("_refresh", String(Date.now()));
      loc.replace(url.toString());
      loc.reload();
    }
  }
}
