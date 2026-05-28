import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ChromeInsets = { top: number; bottom: number };

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
      setWebChrome(readWebChromeInsets(win.window!));
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

  return {
    ...insets,
    top: Math.max(insets.top, webChrome.top),
    bottom: Math.max(insets.bottom, webChrome.bottom),
  };
}
