import { useEffect, useState } from "react";
import { Platform, ScaledSize, useWindowDimensions } from "react-native";
import { isStandaloneWebApp } from "../utils/safariChrome";
import {
  isMobileWeb,
  keyboardLikelyOpen,
  readWebShellHeight,
  readWebShellTop,
} from "../utils/webViewport";
import { applyPortraitLockToSize } from "../utils/orientationLock";

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

function readVisualViewport(win: WebWindow): ScaledSize {
  const vv = win.visualViewport;
  let size: ScaledSize;
  if (vv) {
    // Standalone keeps layout height at the full display; Safari tab tracks keyboard.
    const keyboardOpen = keyboardLikelyOpen(win) && !isStandaloneWebApp();
    const layoutH = win.innerHeight ?? vv.height;
    const height = keyboardOpen
      ? vv.height
      : isMobileWeb()
        ? readWebShellHeight(win)
        : Math.max(vv.height, layoutH);
    size = {
      width: Math.round(vv.width),
      height: Math.round(height),
      scale: 1,
      fontScale: 1,
    };
  } else {
    size = {
      width: Math.round(win.innerWidth ?? 0),
      height: Math.round(
        isMobileWeb()
          ? readWebShellHeight(win)
          : win.innerHeight ?? 0,
      ),
      scale: 1,
      fontScale: 1,
    };
  }
  const locked = applyPortraitLockToSize(size);
  return { ...size, width: locked.width, height: locked.height };
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

/** Mobile web layout box aligned with html/body/#root shell geometry. */
export function useWebShellLayout(): {
  width: number;
  height: number;
  shellTop: number;
} {
  const size = useVisualViewportSize();
  const [shellTop, setShellTop] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web" || !isMobileWeb()) {
      setShellTop(0);
      return;
    }
    const win = (globalThis as { window?: WebWindow }).window;
    if (!win) return;

    const syncTop = () => {
      const next = readWebShellTop(win);
      setShellTop((prev) => (prev === next ? prev : next));
    };

    syncTop();
    const vv = win.visualViewport;
    vv?.addEventListener("resize", syncTop);
    vv?.addEventListener("scroll", syncTop);
    win.addEventListener("resize", syncTop);
    win.addEventListener("orientationchange", syncTop);
    return () => {
      vv?.removeEventListener("resize", syncTop);
      vv?.removeEventListener("scroll", syncTop);
      win.removeEventListener("resize", syncTop);
      win.removeEventListener("orientationchange", syncTop);
    };
  }, [size.height]);

  return { width: size.width, height: size.height, shellTop };
}
