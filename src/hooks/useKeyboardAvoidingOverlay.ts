import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { keyboardLikelyOpen } from "../utils/webViewport";

export type KeyboardAvoidingOverlayInsets = {
  paddingTop: number;
  paddingBottom: number;
  keyboardOpen: boolean;
  /** Prefer bottom-justifying the card above the keyboard when open. */
  justifyContent: "center" | "flex-end";
};

/**
 * Overlay padding that tracks the visible viewport on mobile web so a
 * centered modal can sit above the virtual keyboard instead of behind it.
 *
 * Does not resize the app shell — callers keep full-bleed layout; only the
 * modal’s flex band shrinks to the visual viewport.
 */
export function useKeyboardAvoidingOverlay(
  baseTop: number,
  baseBottom: number,
): KeyboardAvoidingOverlayInsets {
  const [insets, setInsets] = useState<KeyboardAvoidingOverlayInsets>({
    paddingTop: baseTop,
    paddingBottom: baseBottom,
    keyboardOpen: false,
    justifyContent: "center",
  });

  useEffect(() => {
    if (Platform.OS !== "web") {
      setInsets({
        paddingTop: baseTop,
        paddingBottom: baseBottom,
        keyboardOpen: false,
        justifyContent: "center",
      });
      return;
    }

    const win = globalThis as {
      window?: {
        innerHeight?: number;
        visualViewport?: {
          height: number;
          offsetTop: number;
          addEventListener: (type: string, fn: () => void) => void;
          removeEventListener: (type: string, fn: () => void) => void;
        } | null;
        addEventListener: (type: string, fn: () => void) => void;
        removeEventListener: (type: string, fn: () => void) => void;
      };
    };
    if (!win.window) return;

    const sync = () => {
      const w = win.window!;
      const vv = w.visualViewport;
      if (!vv || !keyboardLikelyOpen(w)) {
        setInsets({
          paddingTop: baseTop,
          paddingBottom: baseBottom,
          keyboardOpen: false,
          justifyContent: "center",
        });
        return;
      }

      const layoutH = w.innerHeight ?? vv.height;
      const offsetTop = Math.max(0, Math.round(vv.offsetTop ?? 0));
      const keyboardInset = Math.max(
        0,
        Math.round(layoutH - vv.height - offsetTop),
      );

      setInsets({
        // Keep the card in the visible band; small gap above the keyboard.
        paddingTop: Math.max(baseTop, offsetTop + 12),
        paddingBottom: Math.max(12, keyboardInset + 12),
        keyboardOpen: true,
        justifyContent: "flex-end",
      });
    };

    sync();
    const vv = win.window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    win.window.addEventListener("resize", sync);
    win.window.addEventListener("orientationchange", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      win.window?.removeEventListener("resize", sync);
      win.window?.removeEventListener("orientationchange", sync);
    };
  }, [baseTop, baseBottom]);

  return insets;
}
