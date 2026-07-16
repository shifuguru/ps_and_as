/**
 * Production-safe viewport diagnostics gate and app-height trace buffer.
 * This module has no React or gameplay dependencies.
 */

export type AppHeightWriteLog = {
  at: string;
  heightPx: number;
  topPx: number;
  caller: string;
  calc: {
    inner: number;
    outer: number | null;
    client: number;
    vvHeight: number | null;
    vvOffsetTop: number | null;
    visualBottom: number;
    keyboardLikelyOpen: boolean;
    chosen: number;
    chosenBy: string;
  };
  appliedTo: string[];
  stack: string;
};

const WRITE_LOG_MAX = 40;
const writeLog: AppHeightWriteLog[] = [];
let listeners: Array<() => void> = [];
let cachedEnabled: boolean | undefined;

/** Enabled only by `?viewportDebug=1` or `?viewportDebug=true`. */
export function isViewportDebugEnabled(): boolean {
  if (cachedEnabled !== undefined) return cachedEnabled;
  const win = (
    globalThis as { window?: { location?: { search?: string } } }
  ).window;
  if (!win) {
    cachedEnabled = false;
    return cachedEnabled;
  }

  try {
    const value = new URLSearchParams(win.location?.search ?? "")
      .get("viewportDebug")
      ?.toLowerCase();
    cachedEnabled = value === "1" || value === "true";
  } catch {
    cachedEnabled = false;
  }
  return cachedEnabled;
}

/**
 * Active experiment id from `?viewportExperiment=N` (1–5). 0 = none.
 * Used by the reversible experiment harness to prove Safari's compositing path.
 */
export function getViewportExperiment(): number {
  const win = (
    globalThis as { window?: { location?: { search?: string } } }
  ).window;
  if (!win) return 0;
  try {
    const raw = new URLSearchParams(win.location?.search ?? "").get(
      "viewportExperiment",
    );
    const n = raw == null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
  } catch {
    return 0;
  }
}

export function getAppHeightWriteLog(): AppHeightWriteLog[] {
  return writeLog.slice();
}

export function subscribeAppHeightWrites(fn: () => void): () => void {
  if (!isViewportDebugEnabled()) return () => undefined;
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((listener) => listener !== fn);
  };
}

export function recordAppHeightWrite(entry: AppHeightWriteLog): void {
  if (!isViewportDebugEnabled()) return;

  writeLog.push(entry);
  if (writeLog.length > WRITE_LOG_MAX) writeLog.shift();
  console.log("[--app-height WRITE]", {
    heightPx: entry.heightPx,
    topPx: entry.topPx,
    caller: entry.caller,
    calc: entry.calc,
    appliedTo: entry.appliedTo,
  });
  console.log("[--app-height STACK]\n" + entry.stack);
  for (const listener of listeners) listener();
}
