import { Linking, Platform } from "react-native";

/** Same source as readme-fallback.html — always the repo README on main. */
export const README_RAW_URL =
  "https://raw.githubusercontent.com/shifuguru/ps_and_as/main/README.md";

export const README_FALLBACK_PAGE = "readme-fallback.html";

/** Deployed fallback — used when opening from native apps. */
export const README_FALLBACK_DEPLOYED_URL =
  "https://shifuguru.github.io/ps_and_as/readme-fallback.html";

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** App home path — e.g. /ps_and_as on GitHub Pages and Expo web dev. */
export function resolveAppBasePath(): string {
  const configured = (globalThis as { __PS_AND_AS_BASE__?: string })
    .__PS_AND_AS_BASE__;
  if (typeof configured === "string" && configured.length > 0) {
    return configured.replace(/\/+$/, "");
  }

  const loc = (globalThis as { location?: { pathname?: string; hostname?: string } })
    .location;
  const path = loc?.pathname ?? "";
  const marker = `/${README_FALLBACK_PAGE}`;
  const idx = path.indexOf(marker);
  if (idx >= 0) {
    const prefix = path.slice(0, idx).replace(/\/+$/, "");
    if (prefix) return prefix;
  }
  if (path.includes("/ps_and_as/dev")) return "/ps_and_as/dev";
  if (path.includes("/ps_and_as")) return "/ps_and_as";

  const host = loc?.hostname ?? "";
  if (isLocalDevHost(host)) {
    return "/ps_and_as";
  }
  return "";
}

function readmeFallbackPath(): string {
  const loc = (globalThis as { location?: { hostname?: string } }).location;
  const host = loc?.hostname ?? "";
  if (isLocalDevHost(host)) {
    return `/${README_FALLBACK_PAGE}`;
  }
  const base = resolveAppBasePath();
  return `${base}/${README_FALLBACK_PAGE}`.replace(/\/{2,}/g, "/");
}

function readmeFallbackUrl(origin?: string): string {
  const url = new URL(
    readmeFallbackPath(),
    origin ?? "https://shifuguru.github.io",
  );
  url.searchParams.set("_", String(Date.now()));
  return url.toString();
}

/** Menu / preview — keeps browser history so Back returns to the game. */
export function openReadmeFallbackPage(): void {
  if (Platform.OS === "web") {
    const loc = (globalThis as {
      location?: { origin?: string; assign: (url: string) => void };
    }).location;
    if (!loc?.origin) return;
    loc.assign(readmeFallbackUrl(loc.origin));
    return;
  }

  void Linking.openURL(readmeFallbackUrl());
}

/** Navigate to the static README fallback (loads real README.md, not a copy). */
export function redirectToReadmeFallback(): void {
  if (Platform.OS !== "web") return;

  const loc = (globalThis as {
    location?: { origin?: string; replace: (url: string) => void };
  }).location;
  if (!loc?.origin) return;

  loc.replace(readmeFallbackUrl(loc.origin));
}

/** Fetch README markdown — live GitHub raw first, bundled copy as fallback (web build). */
export async function fetchReadmeMarkdown(): Promise<string> {
  try {
    const remote = await fetch(`${README_RAW_URL}?_=${Date.now()}`, {
      cache: "no-store",
    });
    if (remote.ok) return remote.text();
  } catch {
    /* fall through */
  }

  if (Platform.OS === "web") {
    try {
      const local = await fetch(`./README.md?_=${Date.now()}`, { cache: "no-store" });
      if (local.ok) return local.text();
    } catch {
      /* fall through */
    }
  }

  throw new Error("README fetch failed");
}
