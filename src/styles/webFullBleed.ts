import { Platform } from "react-native";
import { Asset } from "expo-asset";
import {
  DEFAULT_FELT_COLOR,
  FELT_WALLPAPER,
} from "../services/wallpaper";

/** Fixed layer that paints edge-to-edge on mobile Safari / standalone PWA. */
export const WEB_FULL_BLEED_FIXED =
  Platform.OS === "web"
    ? ({
        position: "fixed",
        zIndex: 0,
        top: "calc(-1 * env(safe-area-inset-top, 0px))",
        right: "calc(-1 * env(safe-area-inset-right, 0px))",
        bottom: "calc(-1 * env(safe-area-inset-bottom, 0px))",
        left: "calc(-1 * env(safe-area-inset-left, 0px))",
        width: "auto",
        height: "auto",
        minHeight:
          "calc(100dvh + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))",
      } as object)
    : null;

export const WEB_SPLASH_OVERLAY =
  Platform.OS === "web"
    ? ({
        position: "fixed",
        zIndex: 10000,
        top: "calc(-1 * env(safe-area-inset-top, 0px))",
        right: "calc(-1 * env(safe-area-inset-right, 0px))",
        bottom: "calc(-1 * env(safe-area-inset-bottom, 0px))",
        left: "calc(-1 * env(safe-area-inset-left, 0px))",
        width: "auto",
        height: "auto",
        minHeight:
          "calc(100dvh + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))",
        backgroundColor: "#000000",
      } as object)
    : null;

let backdropStyleEl: HTMLStyleElement | null = null;

/** Paint felt on html/body so it fills under the iOS status bar in standalone PWA. */
export function ensureWebFeltBackdrop(tint = DEFAULT_FELT_COLOR): void {
  if (Platform.OS !== "web") return;

  const doc: any = (globalThis as { document?: any }).document;
  if (!doc) return;

  let url: string | undefined;
  try {
    url = Asset.fromModule(FELT_WALLPAPER).uri;
  } catch {
    return;
  }
  if (!url) return;

  const tintRgb = hexToRgb(tint) ?? { r: 15, g: 93, b: 47 };
  const css = `
    html, body {
      background-color: ${tint};
      background-image:
        linear-gradient(rgba(${tintRgb.r}, ${tintRgb.g}, ${tintRgb.b}, 0.82),
          rgba(${tintRgb.r}, ${tintRgb.g}, ${tintRgb.b}, 0.82)),
        url("${url}");
      background-size: cover;
      background-position: center center;
      background-repeat: no-repeat;
      background-attachment: fixed;
    }
  `;

  if (backdropStyleEl) {
    (backdropStyleEl as { textContent: string }).textContent = css;
    return;
  }

  const style = doc.createElement("style");
  style.setAttribute("data-app", "felt-backdrop");
  style.textContent = css;
  doc.head.appendChild(style);
  backdropStyleEl = style;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;
  const n = parseInt(normalized, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
