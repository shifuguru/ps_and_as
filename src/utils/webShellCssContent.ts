import { PS_THEMED_SCROLLBAR_CSS } from "./themedScrollbar";
import { PS_SHIMMER_TEXT_CSS } from "./shimmerTextCss";

/**
 * Runtime shell CSS (dev + production fallback). Keep in sync with web-shell.css.
 *
 * Environment layer fills the viewport forever.
 * Application shell (#root / portals) alone uses --app-height / --app-shell-top.
 */
export function getWebShellCssText(feltTint: string): string {
  return `
    :root {
      --ps-felt-tint: ${feltTint};
      --app-shell-h: 100dvh;
      --app-height: var(--app-shell-h);
      --app-shell-top: 0px;
    }
    html, body {
      position: fixed !important;
      inset: 0 !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      overscroll-behavior: none !important;
      touch-action: manipulation !important;
      height: 100% !important;
      max-height: none !important;
      min-height: 100% !important;
      min-height: 100dvh !important;
      min-height: -webkit-fill-available !important;
      background-color: var(--ps-felt-tint) !important;
    }
    html.ps-env-ready,
    html.ps-env-ready body {
      background-color: transparent !important;
    }
    #ps-felt-layer,
    .ps-environment-layer {
      position: fixed !important;
      inset: 0 !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      max-height: none !important;
      min-height: 100% !important;
      min-height: 100dvh !important;
      min-height: -webkit-fill-available !important;
      z-index: 0 !important;
      pointer-events: none !important;
      overflow: hidden !important;
    }
    #ps-felt-layer .ps-env-plane,
    #ps-felt-layer .ps-felt-layer-texture,
    #ps-felt-layer .ps-felt-layer-tint,
    .ps-environment-layer .ps-env-plane {
      position: absolute;
      inset: 0;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
    }
    #ps-felt-layer .ps-env-lighting,
    #ps-felt-layer .ps-env-vignette,
    #ps-felt-layer .ps-env-crest,
    #ps-felt-layer .ps-env-decor {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    #root {
      position: fixed !important;
      top: var(--app-shell-top, 0px) !important;
      left: 0 !important;
      right: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      height: var(--app-height, var(--app-shell-h, 100dvh)) !important;
      max-height: var(--app-height, var(--app-shell-h, 100dvh)) !important;
      min-height: 0 !important;
      background-color: transparent !important;
      z-index: 1 !important;
    }
    #ps-body-portal {
      position: fixed !important;
      top: var(--app-shell-top, 0px) !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: var(--app-height, var(--app-shell-h, 100dvh)) !important;
      max-height: var(--app-height, var(--app-shell-h, 100dvh)) !important;
      min-height: 0 !important;
      pointer-events: none !important;
      z-index: 50 !important;
      overflow: hidden !important;
    }
    #ps-body-portal > * { pointer-events: auto; }
    #ps-overlay-portal {
      position: fixed !important;
      top: var(--app-shell-top, 0px) !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: var(--app-height, var(--app-shell-h, 100dvh)) !important;
      max-height: var(--app-height, var(--app-shell-h, 100dvh)) !important;
      min-height: 0 !important;
      pointer-events: none !important;
      z-index: 300 !important;
      overflow: hidden !important;
    }
    #ps-overlay-portal > * { pointer-events: auto; }
    .ps-felt-fixed {
      position: fixed !important;
      inset: 0 !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      max-height: none !important;
      min-height: 100% !important;
      z-index: 0 !important;
      pointer-events: none !important;
    }
    .ps-bottom-bar-shell {
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      bottom: 0 !important;
      box-sizing: border-box !important;
      background: transparent !important;
      overflow: visible !important;
      padding-bottom: constant(safe-area-inset-bottom) !important;
      padding-bottom: env(safe-area-inset-bottom, 0px) !important;
    }
    ${PS_THEMED_SCROLLBAR_CSS}
    ${PS_SHIMMER_TEXT_CSS}
  `;
}
