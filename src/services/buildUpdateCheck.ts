import { Platform } from "react-native";
import {
  resolveAppVersion,
  resolveClientBuildId,
  WEB_BASE_PATH,
  type BuildVersionInfo,
} from "../config/buildVersion";

function parseVersionPayload(raw: unknown): BuildVersionInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const version =
    typeof data.version === "string" ? data.version : resolveAppVersion();
  const buildId = typeof data.buildId === "string" ? data.buildId : "";
  if (!buildId) return null;
  const builtAt = typeof data.builtAt === "string" ? data.builtAt : undefined;
  return { version, buildId, builtAt };
}

function webVersionJsonUrl(): string | null {
  if (Platform.OS !== "web") return null;
  const loc = (globalThis as {
    location?: { origin?: string; pathname?: string };
  }).location;
  if (!loc?.origin) return null;
  const base = WEB_BASE_PATH ? `${WEB_BASE_PATH}/` : "/";
  return `${loc.origin}${base}version.json`;
}

async function fetchLatestWebBuildInfo(): Promise<BuildVersionInfo | null> {
  const primary = webVersionJsonUrl();
  const urls: string[] = [];
  if (primary) urls.push(primary);

  const loc = (globalThis as { location?: { origin?: string; pathname?: string } })
    .location;
  if (loc?.origin && loc.pathname) {
    const segments = loc.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      const derived = `${loc.origin}/${segments[0]}/version.json`;
      if (!urls.includes(derived)) urls.push(derived);
    }
  }

  for (const url of urls) {
    const parsed = parseVersionPayload(
      await fetchJson(`${url}?t=${Date.now()}`),
    );
    if (parsed) return parsed;
  }
  return null;
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

/** Deployed build metadata from version.json (works in dev for display labels). */
export async function fetchDeployedBuildInfo(): Promise<BuildVersionInfo | null> {
  if (Platform.OS !== "web") {
    return null;
  }
  return fetchLatestWebBuildInfo();
}

/** Latest deployed build metadata. Web polls version.json; native relies on App Store + socket hints. */
export async function fetchLatestBuildInfo(): Promise<BuildVersionInfo | null> {
  if (__DEV__ || Platform.OS !== "web") {
    return null;
  }
  return fetchLatestWebBuildInfo();
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
