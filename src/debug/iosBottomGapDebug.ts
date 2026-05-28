import { Platform } from "react-native";
import { isStandaloneWebApp } from "../utils/safariChrome";
import { isMobileWeb, readWebSafeAreaInsets, WEB_BODY_PORTAL_ID } from "../utils/webViewport";

/** Set true while diagnosing iOS PWA bottom gap — remove when done. */
export const IOS_BOTTOM_GAP_DEBUG = Platform.OS === "web" && isMobileWeb();

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

  const win = (globalThis as {
    window?: {
      innerHeight?: number;
      innerWidth?: number;
      visualViewport?: { height: number; width: number; offsetTop: number };
    };
  }).window;

  const cssSafe = readWebSafeAreaInsets();
  const standalone = isStandaloneWebApp();

  const payload = {
    standalone,
    innerHeight: win?.innerHeight ?? null,
    innerWidth: win?.innerWidth ?? null,
    visualViewport: win?.visualViewport
      ? {
          height: win.visualViewport.height,
          width: win.visualViewport.width,
          offsetTop: win.visualViewport.offsetTop,
        }
      : null,
    gapBelowVisualViewport:
      win?.innerHeight != null && win.visualViewport
        ? Math.round(
            win.innerHeight -
              win.visualViewport.height -
              (win.visualViewport.offsetTop ?? 0),
          )
        : null,
    safeAreaInsetsHook: safeAreaInsets,
    safeAreaInsetsCss: cssSafe,
    actionBarHeight: actionBarHeight ?? null,
    layoutProbes: probes,
    domShell: [
      readDomBox("root"),
      readDomBox(WEB_BODY_PORTAL_ID),
    ].filter(Boolean),
    viewportBottom:
      win?.visualViewport != null
        ? Math.round(
            (win.visualViewport.offsetTop ?? 0) + win.visualViewport.height,
          )
        : win?.innerHeight ?? null,
  };

  console.log("[iOS gap debug]", payload);
}

export function debugBg(color: string | undefined): { backgroundColor?: string } {
  if (!IOS_BOTTOM_GAP_DEBUG || !color) return {};
  return { backgroundColor: color };
}
