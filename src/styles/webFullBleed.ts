import { Platform } from "react-native";
import { Asset } from "expo-asset";
import {
  DEFAULT_FELT_COLOR,
  FELT_WALLPAPER,
} from "../services/wallpaper";
import { resolveFeltEnvironment } from "./feltPalette";
import type { ThemeMode } from "./themeColors";
import {
  WEB_ENVIRONMENT_LAYER_CLASS,
  WEB_ENV_READY_CLASS,
  WEB_FELT_FIXED_CLASS,
  WEB_FELT_LAYER_ID,
  applyMobileWebShellHeight,
} from "../utils/webViewport";

export { WEB_FELT_FIXED_CLASS } from "../utils/webViewport";

/**
 * Fixed full-viewport box for RN Web wallpaper (desktop / non-mobile path).
 * Uses inset:0 — never shell height.
 */
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
        height: "100%",
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

function clearShellInlineGeometry(el: any): void {
  if (!el?.style) return;
  el.style.removeProperty("height");
  el.style.removeProperty("max-height");
  el.style.removeProperty("min-height");
  el.style.removeProperty("top");
  el.style.removeProperty("bottom");
}

/**
 * Permanent Environment Layer under `#root`.
 * Planes: texture → tint → (future lighting / vignette / crest / decor).
 * Geometry is always viewport-owned; never mirrored to --app-height.
 */
function getOrCreateEnvironmentLayer(doc: WebDocument): any {
  let layer = doc.getElementById(WEB_FELT_LAYER_ID);
  if (!layer) {
    layer = doc.createElement("div");
    layer.id = WEB_FELT_LAYER_ID;

    const texture = doc.createElement("div");
    texture.className = "ps-felt-layer-texture ps-env-plane";
    texture.setAttribute("data-env", "texture");
    layer.appendChild(texture);

    const tint = doc.createElement("div");
    tint.className = "ps-felt-layer-tint ps-env-plane";
    tint.setAttribute("data-env", "tint");
    layer.appendChild(tint);

    // Reserved planes — empty until ambience content ships.
    for (const name of ["lighting", "vignette", "crest", "decor"] as const) {
      const plane = doc.createElement("div");
      plane.className = `ps-env-${name}`;
      plane.setAttribute("data-env", name);
      layer.appendChild(plane);
    }

    const root = doc.getElementById("root");
    if (root?.parentNode) {
      root.parentNode.insertBefore(layer, root);
    } else {
      doc.body.insertBefore(layer, doc.body.firstChild);
    }
  }

  layer.classList.add(WEB_ENVIRONMENT_LAYER_CLASS);
  layer.setAttribute("aria-hidden", "true");
  clearShellInlineGeometry(layer);
  return layer;
}

function markEnvironmentReady(doc: WebDocument): void {
  doc.documentElement?.classList?.add(WEB_ENV_READY_CLASS);
}

/**
 * Mount / refresh the Environment Layer (felt texture + tint + ambient lighting).
 * Mode brightens the table — glass stays translucent elsewhere.
 */
export function ensureWebFeltBackdrop(
  tint = DEFAULT_FELT_COLOR,
  mode: ThemeMode = "dark",
): void {
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

  const layer = getOrCreateEnvironmentLayer(doc);
  const env = resolveFeltEnvironment(tint, mode);
  const tintRgb = hexToRgb(env.displayTint) ?? { r: 15, g: 93, b: 47 };

  const texture = layer.querySelector(".ps-felt-layer-texture");
  const tintEl = layer.querySelector(".ps-felt-layer-tint");
  const lighting = layer.querySelector(".ps-env-lighting");

  const staleDepth = layer.querySelector(".ps-felt-layer-depth");
  if (staleDepth) staleDepth.remove();

  if (texture) {
    texture.style.backgroundImage = `url("${url}")`;
    texture.style.backgroundSize = "cover";
    texture.style.backgroundPosition = "center center";
    texture.style.backgroundRepeat = "no-repeat";
    const ts = env.textureStrength;
    texture.style.filter =
      mode === "light"
        ? `brightness(${(1.04 + (ts - 1) * 0.35).toFixed(3)}) contrast(${(1.02 + (ts - 1) * 0.2).toFixed(3)})`
        : `contrast(${(1 + (ts - 1) * 0.1).toFixed(3)}) saturate(${(1 + (ts - 1) * 0.25).toFixed(3)})`;
  }

  if (tintEl) {
    tintEl.style.backgroundColor = `rgba(${tintRgb.r}, ${tintRgb.g}, ${tintRgb.b}, ${env.tintOpacity})`;
  }

  if (lighting) {
    if (env.ambientWashOpacity > 0) {
      const wash = env.ambientWashRgb;
      const mid = Math.max(env.ambientWashOpacity * 0.35, 0.02);
      lighting.style.background =
        `radial-gradient(ellipse 85% 70% at 50% 42%, rgba(${wash},${env.ambientWashOpacity}) 0%, rgba(${wash},${mid}) 55%, transparent 78%)`;
      lighting.style.opacity = "1";
    } else {
      lighting.style.background = "transparent";
      lighting.style.opacity = "0";
    }
  }

  doc.documentElement.style.setProperty("--ps-felt-tint", env.displayTint);
  doc.documentElement.style.setProperty("--ps-theme-mode", mode);
  markEnvironmentReady(doc);

  // Shell layout only — never pass height to the environment layer.
  const win = (globalThis as {
    window?: Parameters<typeof applyMobileWebShellHeight>[0];
  }).window;
  if (win) {
    applyMobileWebShellHeight(win, "ensureWebFeltBackdrop");
  }
}

/** @deprecated Prefer ensureWebFeltBackdrop — identical entry for Environment Layer. */
export const ensureEnvironmentLayer = ensureWebFeltBackdrop;
