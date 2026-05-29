import { Platform } from "react-native";
import { README_FALLBACK_PAGE } from "./readmeFallback";

/** App base path on web (e.g. `/ps_and_as`). */
export function webBasePath(): string {
  const loc = (globalThis as { location?: { pathname?: string } }).location;
  const path = loc?.pathname ?? "";
  const marker = `/${README_FALLBACK_PAGE}`;
  const idx = path.indexOf(marker);
  if (idx > 0) return path.slice(0, idx);
  if (path.includes("/ps_and_as")) return "/ps_and_as";
  return "";
}

function normalizePathname(pathname: string): string {
  let path = pathname.replace(/\/+$/, "") || "/";
  if (path.endsWith("/index.html")) {
    path = path.slice(0, -"/index.html".length) || "/";
  }
  return path;
}

/** Canonical game root URL for the current deploy (same tab navigation). */
export function gameHomeUrl(origin?: string): string {
  const loc = (globalThis as { location?: { origin?: string } }).location;
  const base = webBasePath();
  const url = new URL(`${base}/`, origin ?? loc?.origin ?? "https://shifuguru.github.io");
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function isGameHomeLink(href: string): boolean {
  try {
    const loc = (globalThis as { location?: { href?: string } }).location;
    const resolved = new URL(href, loc?.href ?? gameHomeUrl());
    const home = new URL(gameHomeUrl(resolved.origin));
    if (resolved.origin !== home.origin) return false;
    return normalizePathname(resolved.pathname) === normalizePathname(home.pathname);
  } catch {
    return false;
  }
}

export function linkWantsRefresh(href: string, label: string): boolean {
  if (/refresh/i.test(label.trim())) return true;
  try {
    const loc = (globalThis as { location?: { href?: string } }).location;
    const resolved = new URL(href, loc?.href ?? gameHomeUrl());
    return (
      resolved.searchParams.has("refresh") ||
      resolved.searchParams.has("reload")
    );
  } catch {
    return false;
  }
}

/** Same-tab — Play returns to menu when in-app; Refresh hard-reloads the shell. */
export function openGameLink(options?: {
  refresh?: boolean;
  inAppDismiss?: () => void;
}): void {
  if (Platform.OS !== "web") return;
  const loc = (globalThis as {
    location?: { replace: (url: string) => void };
  }).location;
  if (!loc) return;

  if (options?.refresh) {
    const url = new URL(gameHomeUrl());
    url.searchParams.set("_", String(Date.now()));
    loc.replace(url.toString());
    return;
  }

  if (options?.inAppDismiss) {
    options.inAppDismiss();
    return;
  }

  loc.replace(gameHomeUrl());
}
