import { PS_THEMED_SCROLLBAR_CSS } from "./themedScrollbar";
import { PS_SHIMMER_TEXT_CSS } from "./shimmerTextCss";

/**
 * Runtime shell CSS (dev + production fallback). Keep in sync with web-shell.css.
 *
 * Chin-gap root cause (Reddit r/PWA "fighting the chin gap"):
 *   standalone + viewport-fit=cover + black-translucent + height:100%
 *   → body offset behind status bar without height expanding → bottom gap.
 * Confirmed fix: height:100vh on html/body/#root. Keep black-translucent.
 *
 * Status bar “no band”: black-translucent makes the chrome transparent; icons
 * float over html’s felt. html background-color stays var(--ps-felt-tint)
 * (transparent → dark frost). body stays transparent (opaque body → solid band).
 *
 * Safe-area pads interactive chrome only (.ps-bottom-bar-shell) — never the shell.
 * Do not ship theme-color meta (frosted status-bar band on iOS).
 */
export function getWebShellCssText(feltTint: string): string {
  return `
    :root {
      --ps-felt-tint: ${feltTint};
      --ps-felt-tint-overlay: transparent;
      --ps-felt-texture: none;
      --app-shell-h: 100vh;
      --app-height: 100vh;
      --app-shell-top: 0px;
    }
    html {
      position: relative !important;
      width: 100% !important;
      height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      overscroll-behavior: none !important;
      touch-action: manipulation !important;
      max-height: none !important;
      min-height: 100vh !important;
      background-color: var(--ps-felt-tint) !important;
      background-image:
        linear-gradient(
          var(--ps-felt-tint-overlay),
          var(--ps-felt-tint-overlay)
        ),
        var(--ps-felt-texture) !important;
      background-size: 100% 100%, cover !important;
      background-position: center center, center center !important;
      background-repeat: no-repeat, no-repeat !important;
      background-attachment: scroll, scroll !important;
    }
    html::before {
      content: "" !important;
      position: fixed !important;
      left: 0 !important;
      right: 0 !important;
      top: calc(0px - constant(safe-area-inset-top)) !important;
      top: calc(0px - env(safe-area-inset-top, 0px)) !important;
      width: 100% !important;
      height: calc(
        100vh + constant(safe-area-inset-top) + constant(safe-area-inset-bottom) + 2px
      ) !important;
      height: calc(
        100vh + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px) + 2px
      ) !important;
      min-height: 100vh !important;
      z-index: -1 !important;
      pointer-events: none !important;
      background-color: var(--ps-felt-tint) !important;
      background-image:
        linear-gradient(
          var(--ps-felt-tint-overlay),
          var(--ps-felt-tint-overlay)
        ),
        var(--ps-felt-texture) !important;
      background-size: 100% 100%, cover !important;
      background-position: center center, center center !important;
      background-repeat: no-repeat, no-repeat !important;
      background-attachment: scroll, scroll !important;
    }
    body {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: auto !important;
      width: 100% !important;
      height: 100vh !important;
      min-height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      overscroll-behavior: none !important;
      touch-action: manipulation !important;
      max-height: none !important;
      background-color: transparent !important;
      background-image: none !important;
    }
    #ps-felt-layer,
    .ps-environment-layer {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: auto !important;
      width: 100% !important;
      height: 100vh !important;
      max-height: none !important;
      min-height: 100vh !important;
      z-index: 0 !important;
      pointer-events: none !important;
      overflow: hidden !important;
      background: transparent !important;
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
    #ps-felt-layer .ps-felt-layer-texture,
    #ps-felt-layer .ps-felt-layer-tint {
      display: none !important;
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
      bottom: auto !important;
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      height: var(--app-height, 100vh) !important;
      max-height: none !important;
      min-height: 0 !important;
      background-color: transparent !important;
      z-index: 1 !important;
    }
    #ps-body-portal {
      position: fixed !important;
      top: var(--app-shell-top, 0px) !important;
      left: 0 !important;
      right: 0 !important;
      bottom: auto !important;
      width: 100% !important;
      height: var(--app-height, 100vh) !important;
      max-height: none !important;
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
      bottom: auto !important;
      width: 100% !important;
      height: var(--app-height, 100vh) !important;
      max-height: none !important;
      min-height: 0 !important;
      pointer-events: none !important;
      z-index: 300 !important;
      overflow: hidden !important;
    }
    #ps-overlay-portal > * { pointer-events: auto; }
    .ps-felt-fixed {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: auto !important;
      width: 100% !important;
      height: 100vh !important;
      max-height: none !important;
      min-height: 100vh !important;
      z-index: 0 !important;
      pointer-events: none !important;
    }
    .ps-safe-area-h {
      margin-left: constant(safe-area-inset-left) !important;
      margin-left: env(safe-area-inset-left, 0px) !important;
      margin-right: constant(safe-area-inset-right) !important;
      margin-right: env(safe-area-inset-right, 0px) !important;
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
