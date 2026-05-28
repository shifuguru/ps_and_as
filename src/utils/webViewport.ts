import { Platform } from "react-native";

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

export function readWebSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
  if (Platform.OS !== "web") {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  return {
    top: measureCssLength("paddingTop", "env(safe-area-inset-top, 0px)"),
    bottom: measureCssLength("paddingBottom", "env(safe-area-inset-bottom, 0px)"),
    left: measureCssLength("paddingLeft", "env(safe-area-inset-left, 0px)"),
    right: measureCssLength("paddingRight", "env(safe-area-inset-right, 0px)"),
  };
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

  const dvh = measureCssLength("height", "100dvh");
  const svh = measureCssLength("height", "100svh");
  const lvh = measureCssLength("height", "100lvh");
  const visualBottom = vv ? Math.round(vv.height + (vv.offsetTop ?? 0)) : 0;

  return Math.max(layoutH, visualBottom, dvh, svh, lvh);
}

/** Keep html/body/#root and --app-shell-h aligned on mobile web (iOS Safari). */
export function applyMobileWebShellHeight(win: WebWindow): number {
  if (Platform.OS !== "web" || !isMobileWeb()) return readWebShellHeight(win);

  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return readWebShellHeight(win);

  const h = readWebShellHeight(win);
  const px = `${h}px`;
  doc.documentElement.style.setProperty(APP_SHELL_HEIGHT_VAR, px);
  doc.documentElement.style.height = px;
  doc.documentElement.style.minHeight = px;
  doc.body.style.height = px;
  doc.body.style.minHeight = px;

  const root = doc.getElementById("root");
  if (root) {
    root.style.height = px;
    root.style.minHeight = px;
    root.style.maxHeight = px;
  }

  return h;
}
