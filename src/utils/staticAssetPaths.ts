type WindowGlobals = {
  __PS_AND_AS_BASE__?: string;
  __PS_AND_AS_STATIC_ROOT__?: string;
  location?: { pathname?: string; hostname?: string };
};

const README_FALLBACK_PAGE = "readme-fallback.html";

function readGlobals(): WindowGlobals {
  return globalThis as WindowGlobals;
}

function hasWebLocation(): boolean {
  return typeof readGlobals().location !== "undefined";
}

/** Local Metro / Expo web dev host (no deploy inject). */
export function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * True when Metro serves the SPA without a deployed `__PS_AND_AS_BASE__` inject.
 * In that mode, `public/` assets are mounted at the server root, not under experiments.baseUrl.
 */
export function isExpoWebDevWithoutDeployBase(): boolean {
  if (!hasWebLocation()) return false;
  const g = readGlobals();
  const deployBase = g.__PS_AND_AS_BASE__?.trim();
  if (deployBase) return false;
  return isLocalDevHost(g.location?.hostname ?? "");
}

function deriveBaseFromPathname(pathname: string): string {
  const marker = `/${README_FALLBACK_PAGE}`;
  const idx = pathname.indexOf(marker);
  if (idx >= 0) {
    const prefix = pathname.slice(0, idx).replace(/\/+$/, "");
    if (prefix) return prefix;
  }
  if (pathname.includes("/ps_and_as/dev")) return "/ps_and_as/dev";
  if (pathname.includes("/ps_and_as")) return "/ps_and_as";
  return "";
}

/**
 * URL path prefix for static assets (`public/` in dev, copied into web-build on deploy).
 *
 * | Environment              | Prefix              | Example                    |
 * |--------------------------|---------------------|----------------------------|
 * | Expo local web (Metro)   | `` (server root)    | `/studio/dashboard.json`   |
 * | GitHub Pages / deploy    | `/ps_and_as`        | `/ps_and_as/studio/...`    |
 * | Future override          | `__PS_AND_AS_STATIC_ROOT__` | explicit           |
 */
export function resolveStaticAssetPrefix(): string {
  const g = readGlobals();

  const configuredRoot = g.__PS_AND_AS_STATIC_ROOT__?.trim();
  if (configuredRoot) {
    return configuredRoot.replace(/\/+$/, "");
  }

  const deployBase = g.__PS_AND_AS_BASE__?.trim();
  if (deployBase) {
    return deployBase.replace(/\/+$/, "");
  }

  if (isExpoWebDevWithoutDeployBase()) {
    return "";
  }

  return deriveBaseFromPathname(g.location?.pathname ?? "");
}

/** Absolute path (from site origin) to a static asset under public/ or web-build/. */
export function resolveStaticAssetUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, "");
  const prefix = resolveStaticAssetPrefix();
  if (!prefix) return `/${clean}`;
  return `${prefix}/${clean}`.replace(/\/{2,}/g, "/");
}

/** App SPA base path (experiments.baseUrl) — not the same as static asset prefix on local dev. */
export function resolveAppBasePath(): string {
  const g = readGlobals();
  const configured = g.__PS_AND_AS_BASE__?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const pathname = g.location?.pathname ?? "";
  const derived = deriveBaseFromPathname(pathname);
  if (derived) return derived;

  if (isLocalDevHost(g.location?.hostname ?? "")) {
    return "/ps_and_as";
  }
  return "";
}
