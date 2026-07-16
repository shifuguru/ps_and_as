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
 * Fixed full-viewport box for RN Web wallpaper (non-fullBleed path).
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
  querySelector?: (selector: string) => any;
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
 * Environment Layer under `#root` — enhancement planes only.
 * Wallpaper lives on `html`. Geometry is viewport-owned; never shell height.
 */
function getOrCreateEnvironmentLayer(doc: WebDocument): any {
  let layer = doc.getElementById(WEB_FELT_LAYER_ID);
  if (!layer) {
    layer = doc.createElement("div");
    layer.id = WEB_FELT_LAYER_ID;

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

  // Retire any legacy wallpaper planes from earlier architecture.
  for (const sel of [
    ".ps-felt-layer-texture",
    ".ps-felt-layer-tint",
    ".ps-felt-layer-depth",
  ]) {
    const stale = layer.querySelector(sel);
    if (!stale) continue;
    stale.style.backgroundImage = "none";
    stale.style.backgroundColor = "transparent";
    stale.style.filter = "none";
    stale.style.display = "none";
  }

  return layer;
}

function markEnvironmentReady(doc: WebDocument): void {
  doc.documentElement?.classList?.add(WEB_ENV_READY_CLASS);
}

/**
 * Paint felt wallpaper on the document and refresh enhancement planes.
 *
 * Document (html) permanently owns texture + tint — Safari composites from here.
 * #ps-felt-layer owns ambient lighting / future effects only.
 */
export function ensureWebFeltBackdrop(
  tint = DEFAULT_FELT_COLOR,
  mode: ThemeMode = "dark",
): void {
  if (Platform.OS !== "web") return;

  const doc = (globalThis as { document?: WebDocument }).document;
  if (!doc?.body || !doc.documentElement) return;

  let url: string | undefined;
  try {
    url = Asset.fromModule(FELT_WALLPAPER).uri;
  } catch {
    return;
  }
  if (!url) return;

  const env = resolveFeltEnvironment(tint, mode);
  const tintRgb = hexToRgb(env.displayTint) ?? { r: 15, g: 93, b: 47 };
  const tintOverlay = `rgba(${tintRgb.r}, ${tintRgb.g}, ${tintRgb.b}, ${env.tintOpacity})`;

  // Document wallpaper — permanent; never cleared by ps-env-ready.
  const rootStyle = doc.documentElement.style;
  rootStyle.setProperty("--ps-felt-tint", env.displayTint);
  rootStyle.setProperty("--ps-felt-tint-overlay", tintOverlay);
  rootStyle.setProperty("--ps-felt-texture", `url("${url}")`);
  rootStyle.setProperty("--ps-theme-mode", mode);

  const layer = getOrCreateEnvironmentLayer(doc);
  const lighting = layer.querySelector(".ps-env-lighting");

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

  markEnvironmentReady(doc);

  // Shell layout only — wallpaper does not depend on this.
  const win = (globalThis as {
    window?: Parameters<typeof applyMobileWebShellHeight>[0];
  }).window;
  if (win) {
    applyMobileWebShellHeight(win, "ensureWebFeltBackdrop");
  }
}

/** @deprecated Prefer ensureWebFeltBackdrop — identical entry for Environment Layer. */
export const ensureEnvironmentLayer = ensureWebFeltBackdrop;
