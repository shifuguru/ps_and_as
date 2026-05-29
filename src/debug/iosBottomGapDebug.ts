import { Platform } from "react-native";
import { isStandaloneWebApp } from "../utils/safariChrome";
import {
  APP_SHELL_HEIGHT_VAR,
  isMobileWeb,
  readWebSafeAreaInsets,
  readWebShellHeight,
  WEB_BODY_PORTAL_ID,
  WEB_BOTTOM_BAR_SHELL_CLASS,
  WEB_FELT_LAYER_ID,
} from "../utils/webViewport";

/** Set true while diagnosing iOS PWA bottom gap. */
export const IOS_BOTTOM_GAP_DEBUG = false;

export const IOS_GAP_DEBUG_COLORS = {
  rootApp: "rgba(0, 0, 255, 0.45)", // blue — App.tsx root View
  gameScreen: "rgba(0, 180, 0, 0.45)", // green — GameScreen ScreenContainer
  tableFelt: "rgba(255, 220, 0, 0.45)", // yellow — GamePlayArea / table zone
  actionBarShell: "rgba(128, 0, 200, 0.55)", // purple — BottomBar BlurPanel shell
  actionBarContent: "rgba(255, 120, 0, 0.55)", // orange — BottomBar inner content
  safeAreaWrapper: "rgba(255, 105, 180, 0.65)", // pink — bottom safe-area band
} as const;

export type IosGapLayoutProbe = {
  label: string;
  width: number;
  height: number;
  top?: number;
  bottom?: number;
};

let lastLogMs = 0;

function readDomBox(id: string): IosGapLayoutProbe | null {
  if (Platform.OS !== "web") return null;
  const doc = (globalThis as { document?: any }).document;
  const el = doc?.getElementById?.(id);
  if (!el?.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return {
    label: `#${id}`,
    width: Math.round(r.width),
    height: Math.round(r.height),
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
  };
}

function readClassBox(className: string): IosGapLayoutProbe | null {
  if (Platform.OS !== "web") return null;
  const doc = (globalThis as { document?: any }).document;
  const el = doc?.querySelector?.(`.${className}`);
  if (!el?.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return {
    label: `.${className}`,
    width: Math.round(r.width),
    height: Math.round(r.height),
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
  };
}

/** Layout metrics for post-fix verification on iOS Safari / PWA. */
export function readShellLayoutMetrics(): Record<string, unknown> {
  if (Platform.OS !== "web") return {};

  const g = globalThis as {
    window?: {
      innerHeight?: number;
      innerWidth?: number;
      visualViewport?: { height: number; width: number; offsetTop: number };
    };
    screen?: { height?: number; availHeight?: number; width?: number };
  };
  const win = g.window;

  const doc = (globalThis as { document?: any }).document;
  const vv = win?.visualViewport;
  const inner = win?.innerHeight ?? null;
  const client = doc?.documentElement?.clientHeight ?? null;
  const visualBottom = vv
    ? Math.round((vv.offsetTop ?? 0) + vv.height)
    : win?.innerHeight ?? null;
  const shellHeightVar =
    doc?.documentElement?.style?.getPropertyValue?.(APP_SHELL_HEIGHT_VAR)?.trim() ||
    null;
  const bottomBar = readClassBox(WEB_BOTTOM_BAR_SHELL_CLASS);
  const barBottom = bottomBar?.bottom ?? null;

  return {
    innerHeight: inner,
    documentClientHeight: client,
    innerVsClient:
      inner != null && client != null ? Math.round(inner - client) : null,
    viewportHeight: inner,
    viewportWidth: win?.innerWidth ?? null,
    visualViewportBottom: visualBottom,
    screenAvailHeight: g.screen?.availHeight ?? null,
    shellHeightVar,
    shellHeightComputed: win ? readWebShellHeight(win) : null,
    feltLayer: readDomBox(WEB_FELT_LAYER_ID),
    domShell: [
      readDomBox("root"),
      readDomBox(WEB_BODY_PORTAL_ID),
      readDomBox(WEB_FELT_LAYER_ID),
    ].filter(Boolean),
    bottomBar,
    bottomBarHeight: bottomBar?.height ?? null,
    gapBarToLayoutViewport:
      win?.innerHeight != null && barBottom != null
        ? Math.round(win.innerHeight - barBottom)
        : null,
    gapBarToVisualBottom:
      visualBottom != null && barBottom != null
        ? Math.round(visualBottom - barBottom)
        : null,
    gapBarToShellVar:
      shellHeightVar && barBottom != null
        ? Math.round(parseFloat(shellHeightVar) - barBottom)
        : null,
    standalone: isStandaloneWebApp(),
    orientation:
      (win?.innerWidth ?? 0) > (win?.innerHeight ?? 0) ? "landscape" : "portrait",
  };
}

/** Console diagnostics for iOS web bottom gap (throttled). */
export function logIosBottomGapMetrics(
  probes: IosGapLayoutProbe[],
  safeAreaInsets: { top: number; bottom: number; left: number; right: number },
  actionBarHeight?: number,
): void {
  if (!IOS_BOTTOM_GAP_DEBUG) return;

  const now = Date.now();
  if (now - lastLogMs < 800) return;
  lastLogMs = now;

  const cssSafe = readWebSafeAreaInsets();

  const payload = {
    ...readShellLayoutMetrics(),
    safeAreaInsetsHook: safeAreaInsets,
    safeAreaInsetsCss: cssSafe,
    actionBarHeight: actionBarHeight ?? null,
    layoutProbes: probes,
  };

  console.log("[iOS gap debug]", payload);
}

export function debugBg(color: string | undefined): { backgroundColor?: string } {
  if (!IOS_BOTTOM_GAP_DEBUG || !color) return {};
  return { backgroundColor: color };
}
