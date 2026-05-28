import { Platform } from "react-native";
import { isStandaloneWebApp } from "./safariChrome";
import { getWebShellCssText } from "./webShellCssContent";

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
export const WEB_SHELL_STYLE_ID = "ps-web-shell";
export const WEB_BODY_PORTAL_ID = "ps-body-portal";
export const WEB_BOTTOM_BAR_SHELL_CLASS = "ps-bottom-bar-shell";
export const WEB_FELT_FIXED_CLASS = "ps-felt-fixed";

/** iOS home-indicator fallback when env(safe-area-inset-bottom) reads 0 in RN Web. */
export const IOS_HOME_INDICATOR_FALLBACK = 34;

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
  const doc = (globalThis as { document?: any }).document;
  if (!doc?.body) return 0;

  const probe = doc.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style[property] = value;
  doc.body.appendChild(probe);
  const styles = (globalThis as { getComputedStyle?: (el: any) => any }).getComputedStyle!(probe);
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

/** Bottom inset with iOS PWA fallback when CSS env probes report 0. */
export function resolveWebBottomInset(measured = 0): number {
  if (Platform.OS !== "web") return Math.max(0, measured);
  const n = Math.max(0, measured);
  if (n > 0) return n;
  if (isStandaloneWebApp() && isMobileWeb()) return IOS_HOME_INDICATOR_FALLBACK;
  if (isMobileWeb()) return 20;
  return 0;
}

function clearStandaloneShellInlineHeights(doc: any): void {
  if (!isStandaloneWebApp()) return;
  doc.documentElement.style.removeProperty("height");
  doc.documentElement.style.removeProperty("min-height");
  doc.documentElement.style.removeProperty("max-height");
  doc.body.style.removeProperty("height");
  doc.body.style.removeProperty("min-height");
  doc.body.style.removeProperty("max-height");
  const root = doc.getElementById("root");
  root?.style.removeProperty("height");
  root?.style.removeProperty("min-height");
  root?.style.removeProperty("max-height");
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

/** Keep html/body/#root aligned on mobile Safari (non-standalone tab only). */
export function applyMobileWebShellHeight(win: WebWindow): number {
  if (Platform.OS !== "web" || !isMobileWeb()) return readWebShellHeight(win);

  const doc = (globalThis as { document?: any }).document;
  if (!doc) return readWebShellHeight(win);

  const h = readWebShellHeight(win);
  clearStandaloneShellInlineHeights(doc);

  // Standalone PWA: shell CSS (web-shell.css) owns layout — never set pixel heights.
  if (isStandaloneWebApp()) {
    return h;
  }

  // Safari tab: expose shell height var for any legacy consumers only.
  const px = `${h}px`;
  if (doc.documentElement.style.getPropertyValue(APP_SHELL_HEIGHT_VAR) !== px) {
    doc.documentElement.style.setProperty(APP_SHELL_HEIGHT_VAR, px);
  }

  return h;
}

/**
 * Global mobile-web shell CSS: full device viewport (not 100vh), viewport-fit safe
 * areas, and bottom-bar extension into the home-indicator band.
 */
export function installWebShellCss(feltTint: string): () => void {
  if (Platform.OS !== "web") return () => undefined;

  const doc = (globalThis as { document?: any }).document;
  if (!doc) return () => undefined;

  let style = doc.getElementById(WEB_SHELL_STYLE_ID);
  if (!style) {
    style = doc.createElement("style");
    style.id = WEB_SHELL_STYLE_ID;
    doc.head.appendChild(style);
  }

  clearStandaloneShellInlineHeights(doc);
  doc.documentElement.style.setProperty("--ps-felt-tint", feltTint);

  style.textContent = getWebShellCssText(feltTint);

  return () => {
    style?.remove();
  };
}
