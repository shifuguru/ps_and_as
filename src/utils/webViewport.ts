import { Platform } from "react-native";
import { isStandaloneWebApp } from "./safariChrome";
import { getWebShellCssText } from "./webShellCssContent";
import {
  isViewportDebugEnabled,
  recordAppHeightWrite,
} from "../debug/viewportDebug";

type WebWindow = {
  innerWidth?: number;
  innerHeight?: number;
  visualViewport?: {
    width: number;
    height: number;
    offsetTop: number;
    addEventListener?: (type: string, fn: () => void) => void;
    removeEventListener?: (type: string, fn: () => void) => void;
  } | null;
  addEventListener?: (type: string, fn: () => void) => void;
  removeEventListener?: (type: string, fn: () => void) => void;
};

const WEB_KEYBOARD_GAP_THRESHOLD = 120;
export const APP_SHELL_HEIGHT_VAR = "--app-shell-h";
/** Alias used by early boot script and docs; same value as --app-shell-h. */
export const APP_HEIGHT_VAR = "--app-height";
export const APP_SHELL_TOP_VAR = "--app-shell-top";
export const WEB_SHELL_STYLE_ID = "ps-web-shell";
export const WEB_BODY_PORTAL_ID = "ps-body-portal";
export const WEB_OVERLAY_PORTAL_ID = "ps-overlay-portal";
/** Environment layer root — owns felt / ambient paint (not interactive shell). */
export const WEB_FELT_LAYER_ID = "ps-felt-layer";
/** Alias for the environment layer class (same node as WEB_FELT_LAYER_ID). */
export const WEB_ENVIRONMENT_LAYER_CLASS = "ps-environment-layer";
export const WEB_ENV_READY_CLASS = "ps-env-ready";
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
  // Standalone PWA only — Safari tab should use 0 when env() reads 0 (no fake band).
  if (isStandaloneWebApp() && isMobileWeb()) return IOS_HOME_INDICATOR_FALLBACK;
  return 0;
}

/** Prevent iOS Safari from scrolling the document (toolbar reveal / rubber-band). */
export function clampDocumentScroll(): void {
  if (Platform.OS !== "web") return;
  const win = (globalThis as {
    window?: { scrollTo: (x: number, y: number) => void };
  }).window;
  const doc = (globalThis as {
    document?: { documentElement: { scrollTop: number }; body: { scrollTop: number } };
  }).document;
  if (!win || !doc) return;
  win.scrollTo(0, 0);
  doc.documentElement.scrollTop = 0;
  doc.body.scrollTop = 0;
}

type ShellHeightCalc = {
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

function captureStack(): string {
  try {
    return (new Error("app-height apply")).stack ?? "(no stack)";
  } catch {
    return "(no stack)";
  }
}

function traceAppHeightApply(
  heightPx: number,
  topPx: number,
  calc: ShellHeightCalc,
  caller: string,
  appliedTo: string[],
): void {
  if (!isViewportDebugEnabled()) return;
  recordAppHeightWrite({
    at: new Date().toISOString(),
    heightPx,
    topPx,
    caller,
    calc,
    appliedTo,
    stack: captureStack(),
  });
}

/**
 * Interactive shell geometry only.
 * Never resize html/body or the environment layer — those own the paint viewport.
 */
function applyShellGeometry(
  doc: any,
  heightPx: number,
  topPx: number,
  calc: ShellHeightCalc | null,
  caller: string,
): void {
  const h = `${heightPx}px`;
  const top = `${topPx}px`;

  // Exact CSS var writes for --app-height / aliases
  doc.documentElement.style.setProperty(APP_SHELL_HEIGHT_VAR, h);
  doc.documentElement.style.setProperty(APP_HEIGHT_VAR, h);
  doc.documentElement.style.setProperty(APP_SHELL_TOP_VAR, top);

  // Clear legacy inline clamps that previously tied wallpaper/document to shell.
  for (const el of [doc.documentElement, doc.body, doc.getElementById(WEB_FELT_LAYER_ID)]) {
    if (!el?.style) continue;
    el.style.removeProperty("height");
    el.style.removeProperty("max-height");
    el.style.removeProperty("min-height");
    if (el !== doc.documentElement) {
      el.style.removeProperty("top");
    }
  }

  const targets = [
    doc.getElementById("root"),
    doc.getElementById(WEB_BODY_PORTAL_ID),
    doc.getElementById(WEB_OVERLAY_PORTAL_ID),
  ];

  const debugEnabled = isViewportDebugEnabled();
  const appliedTo: string[] | null = debugEnabled
    ? [
        `documentElement.style ${APP_HEIGHT_VAR}=${h}`,
        `documentElement.style ${APP_SHELL_HEIGHT_VAR}=${h}`,
        `documentElement.style ${APP_SHELL_TOP_VAR}=${top}`,
      ]
    : null;

  for (const el of targets) {
    if (!el) continue;
    el.style.height = h;
    el.style.maxHeight = h;
    el.style.minHeight = "0";
    el.style.top = top;
    if (appliedTo) {
      appliedTo.push(`#${el.id} inline height/maxHeight/top`);
    }
  }

  if (appliedTo && calc) {
    traceAppHeightApply(heightPx, topPx, calc, caller, appliedTo);
  }
}

export function keyboardLikelyOpen(win: WebWindow): boolean {
  const vv = win.visualViewport;
  if (!vv) return false;
  const layoutH = win.innerHeight ?? vv.height;
  const gap = layoutH - vv.height - (vv.offsetTop ?? 0);
  return gap > WEB_KEYBOARD_GAP_THRESHOLD;
}

/**
 * Height for the interactive application shell only.
 * Prefer layout viewport (innerHeight) over dvh so keyboard / Safari chrome
 * resize #root and portals — never the Environment wallpaper layer.
 */
export function readWebShellHeight(win: WebWindow): number {
  const vv = win.visualViewport;
  const doc = (globalThis as { document?: { documentElement?: { clientHeight?: number } } })
    .document;
  const inner = Math.round(win.innerHeight ?? 0);
  const client = Math.round(doc?.documentElement?.clientHeight ?? 0);

  if (vv && keyboardLikelyOpen(win)) {
    return Math.round(vv.height);
  }

  const visualBottom = vv
    ? Math.round(vv.height + (vv.offsetTop ?? 0))
    : 0;
  const h = Math.max(inner, client, visualBottom);

  if (Platform.OS === "web") {
    cachedShellHeight = h;
  }
  return h;
}

/** Capture provenance only when viewport diagnostics are enabled. */
function captureShellHeightCalc(
  win: WebWindow,
  chosen: number,
): ShellHeightCalc {
  const vv = win.visualViewport;
  const doc = (globalThis as { document?: { documentElement?: { clientHeight?: number } } })
    .document;
  const g = globalThis as { window?: { outerHeight?: number } };
  const inner = Math.round(win.innerHeight ?? 0);
  const client = Math.round(doc?.documentElement?.clientHeight ?? 0);
  const vvHeight = vv ? Math.round(vv.height) : null;
  const vvOffsetTop = vv ? Math.round(vv.offsetTop ?? 0) : null;
  const keyboardOpen = !!(vv && keyboardLikelyOpen(win));
  const visualBottom = vv
    ? Math.round(vv.height + (vv.offsetTop ?? 0))
    : 0;

  return {
    inner,
    outer:
      typeof g.window?.outerHeight === "number"
        ? Math.round(g.window.outerHeight)
        : null,
    client,
    vvHeight,
    vvOffsetTop,
    visualBottom,
    keyboardLikelyOpen: keyboardOpen,
    chosen,
    chosenBy: keyboardOpen
      ? `keyboardLikelyOpen → Math.round(visualViewport.height) = ${chosen}`
      : `Math.max(innerHeight=${inner}, documentElement.clientHeight=${client}, visualBottom(vv.height+offsetTop)=${visualBottom}) = ${chosen}`,
  };
}

/** Top offset for the shell — only when the keyboard is open. */
export function readWebShellTop(win: WebWindow): number {
  if (!win.visualViewport || !keyboardLikelyOpen(win)) return 0;
  return Math.max(0, Math.round(win.visualViewport.offsetTop));
}

/**
 * Sync interactive shell (#root + portals) to the visible layout viewport.
 * Environment wallpaper is intentionally excluded.
 */
export function applyMobileWebShellHeight(
  win: WebWindow,
  caller = "applyMobileWebShellHeight",
): number {
  if (Platform.OS !== "web" || !isMobileWeb()) return readWebShellHeight(win);

  const doc = (globalThis as { document?: any }).document;
  if (!doc) return readWebShellHeight(win);

  const topPx = readWebShellTop(win);
  const h = readWebShellHeight(win);
  const calc = isViewportDebugEnabled()
    ? captureShellHeightCalc(win, h)
    : null;

  applyShellGeometry(doc, h, topPx, calc, caller);
  return h;
}

/**
 * Keep the shell locked to visualViewport on mobile web — prevents document
 * scroll (Safari toolbar drag) and resizes the shell when the keyboard opens.
 */
export function installWebMobileViewportGuard(): () => void {
  if (Platform.OS !== "web" || !isMobileWeb()) return () => undefined;

  const win = (globalThis as { window?: WebWindow }).window;
  const doc = (globalThis as {
    document?: {
      addEventListener: (type: string, fn: (ev: Event) => void) => void;
      removeEventListener: (type: string, fn: (ev: Event) => void) => void;
    };
  }).document;
  if (!win || !doc) return () => undefined;

  const sync = () => {
    clampDocumentScroll();
    applyMobileWebShellHeight(win, "installWebMobileViewportGuard.sync");
  };

  sync();

  const onFocusIn = () => {
    requestAnimationFrame(sync);
  };
  const onFocusOut = () => {
    setTimeout(sync, 80);
  };

  win.addEventListener?.("resize", sync);
  win.addEventListener?.("orientationchange", sync);
  win.visualViewport?.addEventListener?.("resize", sync);
  win.visualViewport?.addEventListener?.("scroll", sync);
  doc.addEventListener("focusin", onFocusIn);
  doc.addEventListener("focusout", onFocusOut);

  return () => {
    win.removeEventListener?.("resize", sync);
    win.removeEventListener?.("orientationchange", sync);
    win.visualViewport?.removeEventListener?.("resize", sync);
    win.visualViewport?.removeEventListener?.("scroll", sync);
    doc.removeEventListener("focusin", onFocusIn);
    doc.removeEventListener("focusout", onFocusOut);
  };
}

/**
 * Global mobile-web CSS: Environment Layer (viewport) + Application shell vars.
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
    applyMobileWebShellHeight(win, "installWebShellCss");
  }

  return () => {
    style?.remove();
  };
}
