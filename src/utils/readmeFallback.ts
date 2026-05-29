import { Platform } from "react-native";

/** Same source as readme-fallback.html — always the repo README on main. */
export const README_RAW_URL =
  "https://raw.githubusercontent.com/shifuguru/ps_and_as/main/README.md";

export const README_FALLBACK_PAGE = "readme-fallback.html";

function webBasePath(): string {
  const loc = (globalThis as { location?: { pathname?: string } }).location;
  const path = loc?.pathname ?? "";
  const marker = `/${README_FALLBACK_PAGE}`;
  const idx = path.indexOf(marker);
  if (idx > 0) return path.slice(0, idx);
  if (path.includes("/ps_and_as")) return "/ps_and_as";
  return "";
}

/** Navigate to the static README fallback (loads real README.md, not a copy). */
export function redirectToReadmeFallback(): void {
  if (Platform.OS !== "web") return;

  const loc = (globalThis as {
    location?: { origin?: string; replace: (url: string) => void };
  }).location;
  if (!loc?.origin) return;

  const base = webBasePath();
  const url = new URL(`${base}/${README_FALLBACK_PAGE}`, loc.origin);
  url.searchParams.set("_", String(Date.now()));
  loc.replace(url.toString());
}

/** Fetch README markdown for native crash fallback. */
export async function fetchReadmeMarkdown(): Promise<string> {
  const res = await fetch(`${README_RAW_URL}?_=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`README fetch failed (${res.status})`);
  }
  return res.text();
}
