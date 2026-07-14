import type { ErrorInfo } from "react";
import { Platform } from "react-native";

/** sessionStorage key — readme-fallback.html reads this after web redirect. */
export const RENDER_CRASH_STORAGE_KEY = "ps_and_as:last_render_crash";

export type RenderCrashLocation = {
  file: string | null;
  line: number | null;
  column: number | null;
  symbol: string | null;
};

export type RenderCrashReport = {
  capturedAt: string;
  errorName: string;
  errorMessage: string;
  stack: string;
  componentStack: string;
  originComponent: string | null;
  location: RenderCrashLocation;
  formatted: string;
};

const LOG_PREFIX = "[ROUND-END-CRASH]";

/** First in-app stack frame (prefer src/). */
export function parseJsStackLocation(stack: string): RenderCrashLocation {
  const empty: RenderCrashLocation = {
    file: null,
    line: null,
    column: null,
    symbol: null,
  };
  if (!stack) return empty;

  const lines = stack.split("\n").slice(1);
  const appFrame =
    lines.find((line) => /[/\\]src[/\\]/.test(line)) ?? lines[0] ?? "";

  const paren = appFrame.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?$/);
  if (paren) {
    return {
      symbol: paren[1]?.trim() || null,
      file: paren[2] ?? null,
      line: Number(paren[3]),
      column: Number(paren[4]),
    };
  }

  const bare = appFrame.match(/at\s+(.+?):(\d+):(\d+)/);
  if (bare) {
    return {
      symbol: null,
      file: bare[1] ?? null,
      line: Number(bare[2]),
      column: Number(bare[3]),
    };
  }

  return empty;
}

/** First user component in the React component stack (skip boundary / providers). */
export function parseOriginComponent(componentStack: string): string | null {
  if (!componentStack) return null;

  const skip = new Set([
    "AppErrorBoundary",
    "ThemeProvider",
    "CardAppearanceProvider",
    "SafeAreaProvider",
  ]);

  for (const raw of componentStack.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const match =
      line.match(/^\s*in\s+(\w+)/) ??
      line.match(/^\s*at\s+(\w+)/) ??
      line.match(/^(\w+)\s*\(/);
    const name = match?.[1];
    if (!name || skip.has(name)) continue;
    return name;
  }

  return null;
}

export function buildRenderCrashReport(
  error: Error,
  info: ErrorInfo,
): RenderCrashReport {
  const stack = error.stack ?? "";
  const componentStack = info.componentStack ?? "";
  const location = parseJsStackLocation(stack);
  const originComponent = parseOriginComponent(componentStack);

  const fileLine =
    location.file != null
      ? `${location.file}${location.line != null ? `:${location.line}` : ""}${
          location.column != null ? `:${location.column}` : ""
        }`
      : "(unknown)";

  const formatted = [
    LOG_PREFIX,
    "",
    "Component:",
    originComponent ?? "(unknown)",
    "",
    "Error:",
    `${error.name}: ${error.message}`,
    "",
    "File:",
    fileLine,
    location.symbol ? `Symbol: ${location.symbol}` : "",
    "",
    "Stack:",
    stack || "(no JavaScript stack)",
    "",
    "Component Stack:",
    componentStack.trim() || "(no component stack)",
  ]
    .filter((line, index, arr) => line !== "" || arr[index - 1] !== "")
    .join("\n");

  return {
    capturedAt: new Date().toISOString(),
    errorName: error.name,
    errorMessage: error.message,
    stack,
    componentStack,
    originComponent,
    location,
    formatted,
  };
}

function persistReport(report: RenderCrashReport): void {
  if (Platform.OS !== "web") return;
  try {
    const storage = (
      globalThis as { sessionStorage?: Storage }
    ).sessionStorage;
    storage?.setItem(RENDER_CRASH_STORAGE_KEY, JSON.stringify(report));
  } catch {
    /* quota / private mode */
  }
}

/** Log + persist a render exception. README fallback still runs after this. */
export function logRenderCrash(error: Error, info: ErrorInfo): RenderCrashReport {
  const report = buildRenderCrashReport(error, info);
  console.error(report.formatted);
  console.error(`${LOG_PREFIX} (structured)`, report);
  persistReport(report);
  return report;
}
