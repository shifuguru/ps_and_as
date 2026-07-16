import { PS_THEMED_SCROLLBAR_CSS } from "./themedScrollbar";
import { PS_SHIMMER_TEXT_CSS } from "./shimmerTextCss";

/**
 * Runtime shell CSS (dev + production fallback). Keep in sync with web-shell.css.
 *
 * Ownership split (do not reunify):
 * - Document (html): permanent felt wallpaper + tint — fills the browser paint surface
 * - Environment layer (#ps-felt-layer): enhancement only (lighting / vignette / crest / decor)
 * - Application shell (#root / portals): --app-height / --app-shell-top for layout
 *
 * Edge-to-edge rule:
 * - Shell height tracks the viewport (never viewport minus safe-area).
 * - Safe-area is applied only as padding on interactive chrome (e.g. .ps-bottom-bar-shell).
 * - Do not shrink #root / screens with env(safe-area-inset-*) — that invents a footer.
 * - html uses min-height: calc(100% + safe-area-inset-top) so iOS black-translucent
 *   PWAs do not leave an empty bottom bar (dev.to/karmasakshi PWA iOS guide).
 */
export function getWebShellCssText(feltTint: string): string {
  return `
    :root {
      --ps-felt-tint: ${feltTint};
      --ps-felt-tint-overlay: transparent;
      --ps-felt-texture: none;
      --app-shell-h: 100lvh;
      --app-height: var(--app-shell-h);
      --app-shell-top: 0px;
    }
    html {
      position: relative !important;
      width: 100% !important;
      margin: 0 !important;
      padding: constant(safe-area-inset-top) constant(safe-area-inset-right)
        constant(safe-area-inset-bottom) constant(safe-area-inset-left) !important;
      padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
        env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px) !important;
      box-sizing: border-box !important;
      overflow-x: hidden !important;
      overflow-y: hidden !important;
      overscroll-behavior: none !important;
      touch-action: manipulation !important;
      height: auto !important;
      max-height: none !important;
      min-height: 100% !important;
      min-height: 100dvh !important;
      min-height: 100lvh !important;
      min-height: -webkit-fill-available !important;
      min-height: calc(100% + constant(safe-area-inset-top)) !important;
      min-height: calc(100% + env(safe-area-inset-top, 0px)) !important;
      background-color: var(--ps-felt-tint) !important;
      background-image: none !important;
    }
    html::before {
      content: "" !important;
      position: fixed !important;
      left: 0 !important;
      right: 0 !important;
      top: 0 !important;
      width: 100% !important;
      height: 100% !important;
      height: 100dvh !important;
      height: 100lvh !important;
      min-height: 100% !important;
      min-height: 100dvh !important;
      min-height: 100lvh !important;
      min-height: -webkit-fill-available !important;
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
    }
    body {
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
      height: 100dvh !important;
      height: 100lvh !important;
      max-height: none !important;
      min-height: 100% !important;
      min-height: 100dvh !important;
      min-height: 100lvh !important;
      min-height: -webkit-fill-available !important;
      background-color: transparent !important;
      background-image: none !important;
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
    /* Legacy wallpaper planes — document owns wallpaper; keep nodes inert if present. */
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
      bottom: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      /* Standalone boot sets 100%; Safari tab JS may override with a pixel height. */
      height: var(--app-height, auto) !important;
      max-height: var(--app-height, none) !important;
      min-height: 0 !important;
      background-color: transparent !important;
      z-index: 1 !important;
    }
    #ps-body-portal {
      position: fixed !important;
      top: var(--app-shell-top, 0px) !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: var(--app-height, auto) !important;
      max-height: var(--app-height, none) !important;
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
      bottom: 0 !important;
      width: 100% !important;
      height: var(--app-height, auto) !important;
      max-height: var(--app-height, none) !important;
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
