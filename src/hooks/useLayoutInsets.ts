import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ChromeInsets = { top: number; bottom: number };

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
      const vv = win.window!.visualViewport;
      if (!vv) {
        setWebChrome({ top: 0, bottom: 0 });
        return;
      }
      const top = Math.max(0, Math.round(vv.offsetTop));
      const bottom = Math.max(
        0,
        Math.round((win.innerHeight ?? vv.height) - vv.height - vv.offsetTop),
      );
      setWebChrome({ top, bottom });
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
