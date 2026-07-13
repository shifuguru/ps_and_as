import { Platform } from "react-native";
import { Asset } from "expo-asset";
import {
  DEFAULT_FELT_COLOR,
  FELT_WALLPAPER,
} from "../services/wallpaper";
import {
  WEB_FELT_FIXED_CLASS,
  WEB_FELT_LAYER_ID,
  applyMobileWebShellHeight,
} from "../utils/webViewport";

export { WEB_FELT_FIXED_CLASS } from "../utils/webViewport";

/** Fixed layer that paints edge-to-edge on mobile Safari / standalone PWA. */
export const WEB_FULL_BLEED_FIXED =
  Platform.OS === "web"
    ? ({
        position: "fixed",
        zIndex: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
      } as object)
    : null;

export const WEB_SPLASH_OVERLAY =
  Platform.OS === "web"
    ? ({
        position: "fixed",
        zIndex: 10000,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        backgroundColor: "#000000",
      } as object)
    : null;

/** Full-viewport fixed root for crash/update UI rendered outside AppContent. */
export const WEB_OVERLAY_ROOT_FIXED =
  Platform.OS === "web"
    ? ({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        zIndex: 10001,
        elevation: 10001,
      } as object)
    : null;

type WebDocument = {
  getElementById: (id: string) => any;
  body: any;
  createElement: (tag: string) => any;
  documentElement: any;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;
  const n = parseInt(normalized, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function getOrCreateFeltLayer(doc: WebDocument): any {
  let layer = doc.getElementById(WEB_FELT_LAYER_ID);
  if (layer) return layer;

  layer = doc.createElement("div");
  layer.id = WEB_FELT_LAYER_ID;
  layer.setAttribute("aria-hidden", "true");

  const texture = doc.createElement("div");
  texture.className = "ps-felt-layer-texture";
  layer.appendChild(texture);

  const tint = doc.createElement("div");
  tint.className = "ps-felt-layer-tint";
  layer.appendChild(tint);

  const root = doc.getElementById("root");
  if (root?.parentNode) {
    root.parentNode.insertBefore(layer, root);
  } else {
    doc.body.insertBefore(layer, doc.body.firstChild);
  }

  return layer;
}

/**
 * Dedicated fixed felt layer — avoids iOS background-attachment:fixed clipping.
 * Height is synced to --app-shell-h via applyMobileWebShellHeight().
 */
export function ensureWebFeltBackdrop(tint = DEFAULT_FELT_COLOR): void {
  if (Platform.OS !== "web") return;

  const doc = (globalThis as { document?: WebDocument }).document;
  if (!doc?.body) return;

  let url: string | undefined;
  try {
    url = Asset.fromModule(FELT_WALLPAPER).uri;
  } catch {
    return;
  }
  if (!url) return;

  const layer = getOrCreateFeltLayer(doc);
  const tintRgb = hexToRgb(tint) ?? { r: 15, g: 93, b: 47 };

  const texture = layer.querySelector(".ps-felt-layer-texture");
  const tintEl = layer.querySelector(".ps-felt-layer-tint");

  const staleDepth = layer.querySelector(".ps-felt-layer-depth");
  if (staleDepth) staleDepth.remove();

  if (texture) {
    texture.style.backgroundImage = `url("${url}")`;
    texture.style.backgroundSize = "cover";
    texture.style.backgroundPosition = "center center";
    texture.style.backgroundRepeat = "no-repeat";
    texture.style.filter = "";
  }

  if (tintEl) {
    tintEl.style.backgroundColor = `rgba(${tintRgb.r}, ${tintRgb.g}, ${tintRgb.b}, 0.82)`;
  }

  doc.documentElement.style.setProperty("--ps-felt-tint", tint);

  const win = (globalThis as {
    window?: Parameters<typeof applyMobileWebShellHeight>[0];
  }).window;
  if (win) {
    applyMobileWebShellHeight(win);
  }
}
