/** Runtime shell CSS (dev + production fallback). Keep in sync with web-shell.css */
export function getWebShellCssText(feltTint: string): string {
  return `
    :root {
      --ps-felt-tint: ${feltTint};
      --app-shell-h: 100lvh;
    }
    html, body {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      overscroll-behavior: none !important;
      touch-action: manipulation !important;
      height: var(--app-shell-h, 100lvh) !important;
      min-height: var(--app-shell-h, 100lvh) !important;
      background-color: var(--ps-felt-tint) !important;
    }
    #ps-felt-layer {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: var(--app-shell-h, 100lvh) !important;
      min-height: var(--app-shell-h, 100lvh) !important;
      z-index: -1 !important;
      pointer-events: none !important;
      overflow: hidden !important;
    }
    #ps-felt-layer .ps-felt-layer-texture,
    #ps-felt-layer .ps-felt-layer-tint {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
    }
    #root {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      height: var(--app-shell-h, 100lvh) !important;
      min-height: var(--app-shell-h, 100lvh) !important;
      background-color: transparent !important;
    }
    #ps-body-portal {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: var(--app-shell-h, 100lvh) !important;
      min-height: var(--app-shell-h, 100lvh) !important;
      pointer-events: none !important;
      z-index: 50 !important;
      overflow: visible !important;
    }
    #ps-body-portal > * { pointer-events: auto; }
    .ps-felt-fixed {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: var(--app-shell-h, 100lvh) !important;
      min-height: var(--app-shell-h, 100lvh) !important;
    }
    .ps-bottom-bar-shell {
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      box-sizing: border-box !important;
    }
  `;
}
