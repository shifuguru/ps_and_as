import { Platform } from "react-native";
import { isStandaloneWebApp } from "./safariChrome";

type WebWindow = {
  innerWidth?: number;
  innerHeight?: number;
  visualViewport?: {
    width: number;
    height: number;
    offsetTop: number;
  } | null;
};

const WEB_KEYBOARD_GAP_THRESHOLD = 120;
export const APP_SHELL_HEIGHT_VAR = "--app-shell-h";

type SafeAreaInsets = { top: number; bottom: number; left: number; right: number };

let cachedSafeArea: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
let cachedShellHeight = 0;
let viewportCacheListenersAttached = false;

function attachViewportCacheListeners(): void {
  if (viewportCacheListenersAttached || Platform.OS !== "web") return;
  const win = (globalThis as {
    window?: {
      addEventListener: (type: string, fn: () => void) => void;
      visualViewport?: {
        addEventListener: (type: string, fn: () => void) => void;
      } | null;
    };
  }).window;
  if (!win) return;

  const refresh = () => {
    cachedSafeArea = readWebSafeAreaInsetsUncached();
    cachedShellHeight = 0;
  };

  win.addEventListener("resize", refresh);
  win.addEventListener("orientationchange", refresh);
  win.visualViewport?.addEventListener("resize", refresh);
  win.visualViewport?.addEventListener("scroll", refresh);
  viewportCacheListenersAttached = true;
  refresh();
}

function readWebSafeAreaInsetsUncached(): SafeAreaInsets {
  return {
    top: measureSafeAreaInset("top"),
    bottom: measureSafeAreaInset("bottom"),
    left: measureSafeAreaInset("left"),
    right: measureSafeAreaInset("right"),
  };
}

/** Touch-first / narrow layouts where Safari dvh vs innerHeight gaps appear. */
export function isMobileWeb(): boolean {
  if (Platform.OS !== "web") return false;
  const win = (globalThis as { window?: WebWindow & { matchMedia?: (q: string) => { matches: boolean } } }).window;
  if (!win) return false;
  if (win.matchMedia?.("(pointer: coarse) and (max-width: 900px)").matches) return true;
  if (win.matchMedia?.("(max-width: 768px)").matches) return true;
  return (win.innerWidth ?? 0) <= 768;
}

function measureCssLength(
  property: "height" | "paddingTop" | "paddingBottom" | "paddingLeft" | "paddingRight",
  value: string,
): number {
  if (Platform.OS !== "web") return 0;
  const doc = (globalThis as { document?: Document }).document;
  if (!doc?.body) return 0;

  const probe = doc.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style[property] = value;
  doc.body.appendChild(probe);
  const styles = getComputedStyle(probe);
  const raw =
    property === "height"
      ? styles.height
      : property === "paddingTop"
        ? styles.paddingTop
        : property === "paddingBottom"
          ? styles.paddingBottom
          : property === "paddingLeft"
            ? styles.paddingLeft
            : styles.paddingRight;
  doc.body.removeChild(probe);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function measureSafeAreaInset(
  edge: "top" | "bottom" | "left" | "right",
): number {
  const prop =
    edge === "top"
      ? "paddingTop"
      : edge === "bottom"
        ? "paddingBottom"
        : edge === "left"
          ? "paddingLeft"
          : "paddingRight";
  const envKey = `env(safe-area-inset-${edge}, 0px)`;
  const legacyKey = `constant(safe-area-inset-${edge})`;
  return Math.max(
    measureCssLength(prop, envKey),
    measureCssLength(prop, legacyKey),
  );
}

export function readWebSafeAreaInsets(): SafeAreaInsets {
  if (Platform.OS !== "web") {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  attachViewportCacheListeners();
  return cachedSafeArea;
}

function keyboardLikelyOpen(win: WebWindow): boolean {
  const vv = win.visualViewport;
  if (!vv) return false;
  const layoutH = win.innerHeight ?? vv.height;
  const gap = layoutH - vv.height - (vv.offsetTop ?? 0);
  return gap > WEB_KEYBOARD_GAP_THRESHOLD;
}

/**
 * Height for the mobile web shell. iOS Safari often reports a shorter 100dvh than
 * window.innerHeight, leaving a theme-color strip below #root — use the layout
 * viewport (innerHeight) when the keyboard is closed.
 */
export function readWebShellHeight(win: WebWindow): number {
  const vv = win.visualViewport;
  const layoutH = win.innerHeight ?? 0;

  if (vv && keyboardLikelyOpen(win)) {
    return Math.round(vv.height);
  }

  // Standalone PWA: visualViewport can be shorter than innerHeight (home-indicator
  // band), which leaves a strip below #root and fixed bottom bars. Prefer layout
  // viewport height so felt and chrome reach the physical bottom.
  if (isStandaloneWebApp()) {
    const visualFull = vv
      ? Math.round(vv.height + (vv.offsetTop ?? 0))
      : layoutH;
    const lvh = measureCssLength("height", "100lvh");
    return Math.max(layoutH, visualFull, lvh);
  }

  if (Platform.OS === "web" && cachedShellHeight > 0 && !keyboardLikelyOpen(win)) {
    return cachedShellHeight;
  }

  const dvh = measureCssLength("height", "100dvh");
  const svh = measureCssLength("height", "100svh");
  const lvh = measureCssLength("height", "100lvh");
  const visualBottom = vv ? Math.round(vv.height + (vv.offsetTop ?? 0)) : 0;

  const h = Math.max(layoutH, visualBottom, dvh, svh, lvh);
  if (Platform.OS === "web") {
    cachedShellHeight = h;
  }
  return h;
}

/** Keep html/body/#root and --app-shell-h aligned on mobile web (iOS Safari). */
export function applyMobileWebShellHeight(win: WebWindow): number {
  if (Platform.OS !== "web" || !isMobileWeb()) return readWebShellHeight(win);

  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return readWebShellHeight(win);

  const h = readWebShellHeight(win);
  const px = `${h}px`;
  const prev = doc.documentElement.style.getPropertyValue(APP_SHELL_HEIGHT_VAR);
  if (prev !== px) {
    doc.documentElement.style.setProperty(APP_SHELL_HEIGHT_VAR, px);
  }

  // Home-screen PWA: position:fixed + inset:0 on html/body/#root fills the screen.
  // Locking pixel height to visualViewport leaves a gap below fixed bottom bars.
  if (isStandaloneWebApp()) {
    return h;
  }

  const root = doc.getElementById("root");
  if (
    prev === px &&
    doc.documentElement.style.height === px &&
    root?.style.height === px
  ) {
    return h;
  }

  doc.documentElement.style.height = px;
  doc.documentElement.style.minHeight = px;
  doc.body.style.height = px;
  doc.body.style.minHeight = px;

  if (root) {
    root.style.height = px;
    root.style.minHeight = px;
    root.style.maxHeight = px;
  }

  return h;
}
