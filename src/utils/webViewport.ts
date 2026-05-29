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
export const WEB_FELT_LAYER_ID = "ps-felt-layer";
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

function applyShellHeightPx(doc: any, px: string): void {
  doc.documentElement.style.height = px;
  doc.documentElement.style.minHeight = px;
  doc.body.style.height = px;
  doc.body.style.minHeight = px;

  for (const id of ["root", WEB_BODY_PORTAL_ID, WEB_FELT_LAYER_ID]) {
    const el = doc.getElementById(id);
    if (!el) continue;
    el.style.height = px;
    el.style.minHeight = px;
  }
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

  const visualFull = vv
    ? Math.round(vv.height + (vv.offsetTop ?? 0))
    : layoutH;
  const dvh = measureCssLength("height", "100dvh");
  const svh = measureCssLength("height", "100svh");
  const lvh = measureCssLength("height", "100lvh");
  const fillAvail = measureCssLength("height", "-webkit-fill-available");
  const screen = (globalThis as { screen?: { height?: number; availHeight?: number } }).screen;
  const screenAvail = screen?.availHeight ?? 0;

  // Prefer the tallest credible device height so fixed shell + felt reach the
  // physical bottom (home-indicator band) on iOS Safari and standalone PWA.
  const h = Math.max(
    layoutH,
    visualFull,
    dvh,
    svh,
    lvh,
    fillAvail,
    screenAvail,
  );
  if (Platform.OS === "web") {
    cachedShellHeight = h;
  }
  return h;
}

/** Sync html/body/#root/#ps-body-portal/#ps-felt-layer to measured device height. */
export function applyMobileWebShellHeight(win: WebWindow): number {
  if (Platform.OS !== "web" || !isMobileWeb()) return readWebShellHeight(win);

  const doc = (globalThis as { document?: any }).document;
  if (!doc) return readWebShellHeight(win);

  const h = readWebShellHeight(win);
  const px = `${h}px`;

  if (doc.documentElement.style.getPropertyValue(APP_SHELL_HEIGHT_VAR) !== px) {
    doc.documentElement.style.setProperty(APP_SHELL_HEIGHT_VAR, px);
  }

  applyShellHeightPx(doc, px);
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

  doc.documentElement.style.setProperty("--ps-felt-tint", feltTint);

  style.textContent = getWebShellCssText(feltTint);

  const win = (globalThis as { window?: WebWindow }).window;
  if (win && isMobileWeb()) {
    applyMobileWebShellHeight(win);
  }

  return () => {
    style?.remove();
  };
}
