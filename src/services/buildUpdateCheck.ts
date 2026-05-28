import { Platform } from "react-native";
import {
  APP_VERSION,
  resolveClientBuildId,
  WEB_BASE_PATH,
  type BuildVersionInfo,
} from "../config/buildVersion";
import { getServerUrl } from "../config/server";

function parseVersionPayload(raw: unknown): BuildVersionInfo | null {
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
    // Web clients must compare against the deployed bundle, not the game server.
    return null;
  }

  const serverBase = getServerUrl().replace(/\/$/, "");
  const fromServer = parseVersionPayload(
    await fetchJson(`${serverBase}/version?${cacheBust}`),
  );
  return fromServer;
}

export function isRemoteBuildNewer(remote: BuildVersionInfo): boolean {
  const clientId = resolveClientBuildId();
  if (!remote.buildId || remote.buildId === clientId) return false;
  if (clientId === "dev" || clientId === "unknown") return false;
  return true;
}

export function applyBuildUpdate(latestBuildId?: string): void {
  if (Platform.OS !== "web") return;

  const loc = (globalThis as {
    location?: { href: string; replace: (url: string) => void };
    caches?: { keys: () => Promise<string[]>; delete: (n: string) => Promise<boolean> };
  }).location;
  if (!loc) return;

  void (async () => {
    try {
      const caches = (globalThis as {
        caches?: { keys: () => Promise<string[]>; delete: (n: string) => Promise<boolean> };
      }).caches;
      if (caches) {
        for (const name of await caches.keys()) {
          await caches.delete(name);
        }
      }
    } catch {
      /* ignore */
    }

    const url = new URL(loc.href);
    url.searchParams.delete("_refresh");
    url.searchParams.delete("b");
    const bust = (latestBuildId || String(Date.now())).slice(0, 40);
    url.searchParams.set("b", bust);
    loc.replace(url.toString());
  })();
}
