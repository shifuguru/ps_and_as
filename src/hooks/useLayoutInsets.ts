import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isStandaloneWebApp } from "../utils/safariChrome";
import { isMobileWeb, readWebSafeAreaInsets } from "../utils/webViewport";

type ChromeInsets = { top: number; bottom: number };
type SafeAreaInsets = { top: number; bottom: number; left: number; right: number };

/** Browser UI only — virtual keyboard shrink must not count as bottom inset. */
const WEB_MAX_BOTTOM_CHROME = 80;
const WEB_KEYBOARD_GAP_THRESHOLD = 120;

function readWebChromeInsets(win: {
  innerHeight?: number;
  visualViewport?: {
    height: number;
    offsetTop: number;
  } | null;
}): ChromeInsets {
  const vv = win.visualViewport;
  if (!vv) return { top: 0, bottom: 0 };

  const top = Math.max(0, Math.round(vv.offsetTop));
  const layoutH = win.innerHeight ?? vv.height;
  const gap = layoutH - vv.height - vv.offsetTop;

  // Mobile browsers keep layout viewport height when the keyboard opens; the
  // visual viewport shrinks instead. Treating that gap as bottom inset inflates
  // fixed bottom bars (Settings Back button) to fill the keyboard area.
  const keyboardLikelyOpen = gap > WEB_KEYBOARD_GAP_THRESHOLD;
  const bottom = keyboardLikelyOpen
    ? 0
    : Math.max(0, Math.min(Math.round(gap), WEB_MAX_BOTTOM_CHROME));

  return { top, bottom };
}

/** Safe-area + mobile browser chrome (Safari address bar, etc.) on web. */
export function useLayoutInsets() {
  const insets = useSafeAreaInsets();
  const [webChrome, setWebChrome] = useState<ChromeInsets>({ top: 0, bottom: 0 });
  const [cssSafe, setCssSafe] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const win = globalThis as {
      window?: {
        visualViewport?: {
          height: number;
          offsetTop: number;
          addEventListener: (type: string, fn: () => void) => void;
          removeEventListener: (type: string, fn: () => void) => void;
        } | null;
        addEventListener: (type: string, fn: () => void) => void;
        removeEventListener: (type: string, fn: () => void) => void;
      };
      innerHeight?: number;
    };
    if (!win.window) return;

    const read = () => {
      setWebChrome((prev) => {
        const next = readWebChromeInsets(win.window!);
        return prev.top === next.top && prev.bottom === next.bottom ? prev : next;
      });
      if (isMobileWeb()) {
        setCssSafe((prev) => {
          const next = readWebSafeAreaInsets();
          return prev.top === next.top &&
            prev.bottom === next.bottom &&
            prev.left === next.left &&
            prev.right === next.right
            ? prev
            : next;
        });
      }
    };

    read();
    const vv = win.window.visualViewport;
    vv?.addEventListener("resize", read);
    vv?.addEventListener("scroll", read);
    win.window.addEventListener("resize", read);
    win.window.addEventListener("orientationchange", read);
    return () => {
      vv?.removeEventListener("resize", read);
      vv?.removeEventListener("scroll", read);
      win.window?.removeEventListener("resize", read);
      win.window?.removeEventListener("orientationchange", read);
    };
  }, []);

  if (Platform.OS !== "web") {
    return insets;
  }

  const mergedCss = isMobileWeb() ? cssSafe : { top: 0, bottom: 0, left: 0, right: 0 };

  if (isStandaloneWebApp()) {
    // Home-screen PWA: react-native-safe-area-context often reports 0 on web.
    // Merge CSS env(safe-area-inset-*) so bottom bars clear the home indicator.
    return {
      ...insets,
      top: Math.max(insets.top, mergedCss.top),
      bottom: Math.max(insets.bottom, mergedCss.bottom),
      left: Math.max(insets.left, mergedCss.left),
      right: Math.max(insets.right, mergedCss.right),
    };
  }

  // App root height tracks visualViewport — the bottom toolbar gap is already
  // excluded. Merge top chrome (URL bar), CSS safe-area, and native insets.
  return {
    ...insets,
    top: Math.max(insets.top, webChrome.top, mergedCss.top),
    bottom: Math.max(insets.bottom, mergedCss.bottom),
    left: Math.max(insets.left, mergedCss.left),
    right: Math.max(insets.right, mergedCss.right),
  };
}
