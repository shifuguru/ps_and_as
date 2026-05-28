import { useEffect, useState } from "react";
import { Platform, ScaledSize, useWindowDimensions } from "react-native";
import {
  applyMobileWebShellHeight,
  isMobileWeb,
  readWebShellHeight,
} from "../utils/webViewport";

type WebWindow = {
  innerWidth?: number;
  innerHeight?: number;
  visualViewport?: {
    width: number;
    height: number;
    offsetTop: number;
    addEventListener: (type: string, fn: () => void) => void;
    removeEventListener: (type: string, fn: () => void) => void;
  } | null;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};

const WEB_KEYBOARD_GAP_THRESHOLD = 120;

function readVisualViewport(win: WebWindow): ScaledSize {
  const vv = win.visualViewport;
  if (vv) {
    const layoutH = win.innerHeight ?? vv.height;
    const gap = layoutH - vv.height - (vv.offsetTop ?? 0);
    const keyboardLikelyOpen = gap > WEB_KEYBOARD_GAP_THRESHOLD;
    const height = keyboardLikelyOpen
      ? vv.height
      : isMobileWeb()
        ? readWebShellHeight(win)
        : Math.max(vv.height, layoutH);
    return {
      width: Math.round(vv.width),
      height: Math.round(height),
      scale: 1,
      fontScale: 1,
    };
  }
  return {
    width: Math.round(win.innerWidth ?? 0),
    height: Math.round(
      isMobileWeb()
        ? applyMobileWebShellHeight(win)
        : win.innerHeight ?? 0,
    ),
    scale: 1,
    fontScale: 1,
  };
}

/** Layout size that tracks the visible viewport on mobile web (URL bar, toolbars). */
export function useVisualViewportSize(): ScaledSize {
  const windowDims = useWindowDimensions();
  const [size, setSize] = useState<ScaledSize>(() => {
    if (Platform.OS !== "web") return windowDims;
    const win = (globalThis as { window?: WebWindow }).window;
    return win ? readVisualViewport(win) : windowDims;
  });

  useEffect(() => {
    if (Platform.OS !== "web") {
      setSize(windowDims);
      return;
    }

    const win = (globalThis as { window?: WebWindow }).window;
    if (!win) {
      setSize(windowDims);
      return;
    }

    const sync = () => {
      const next = readVisualViewport(win);
      setSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };

    sync();
    const vv = win.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    win.addEventListener("resize", sync);
    win.addEventListener("orientationchange", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      win.removeEventListener("resize", sync);
      win.removeEventListener("orientationchange", sync);
    };
  }, [windowDims.width, windowDims.height]);

  return Platform.OS === "web" ? size : windowDims;
}
