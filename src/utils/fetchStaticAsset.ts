import { resolveStaticAssetUrl } from "./staticAssetPaths";

export class StaticAssetHtmlError extends Error {
  readonly url: string;
  readonly contentType: string | null;

  constructor(url: string, contentType: string | null, kind: "json" | "text" = "json") {
    const label =
      kind === "json"
        ? "Static asset path resolved to HTML instead of JSON."
        : "Static asset path resolved to HTML instead of the expected file.";
    super(`${label} (${url})`);
    this.name = "StaticAssetHtmlError";
    this.url = url;
    this.contentType = contentType;
  }
}

function looksLikeHtml(text: string, contentType: string | null): boolean {
  if (contentType?.toLowerCase().includes("text/html")) return true;
  const trimmed = text.trimStart().slice(0, 32).toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
}

function assertNotHtmlResponse(
  text: string,
  url: string,
  contentType: string | null,
  kind: "json" | "text",
): void {
  if (looksLikeHtml(text, contentType)) {
    throw new StaticAssetHtmlError(url, contentType, kind);
  }
}

export async function fetchStaticText(
  relativePath: string,
  options?: { rejectHtml?: boolean },
): Promise<string> {
  const url = `${resolveStaticAssetUrl(relativePath)}?_=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ${relativePath} (${res.status}) — ${url}`);
  }
  const text = await res.text();
  if (options?.rejectHtml !== false) {
    assertNotHtmlResponse(text, url, res.headers.get("content-type"), "text");
  }
  return text;
}

export async function fetchStaticJson<T>(relativePath: string): Promise<T> {
  const url = `${resolveStaticAssetUrl(relativePath)}?_=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ${relativePath} (${res.status}) — ${url}`);
  }
  const contentType = res.headers.get("content-type");
  const text = await res.text();
  assertNotHtmlResponse(text, url, contentType, "json");
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (looksLikeHtml(text, contentType)) {
      throw new StaticAssetHtmlError(url, contentType, "json");
    }
    throw new Error(`Invalid JSON for ${relativePath}: ${message} — ${url}`);
  }
}
