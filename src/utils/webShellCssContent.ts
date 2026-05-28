/** Runtime shell CSS (dev + production fallback). Keep in sync with web-shell.css */
export function getWebShellCssText(feltTint: string): string {
  return `
    :root { --ps-felt-tint: ${feltTint}; }
    html, body {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      overscroll-behavior: none !important;
      touch-action: manipulation !important;
      height: auto !important;
      min-height: 100dvh !important;
      min-height: -webkit-fill-available !important;
      background-color: var(--ps-felt-tint) !important;
    }
    html::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -1;
      background-color: var(--ps-felt-tint);
      pointer-events: none;
    }
    #root {
      position: fixed !important;
      inset: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      height: auto !important;
      min-height: 100dvh !important;
      min-height: -webkit-fill-available !important;
      background-color: transparent !important;
    }
    #ps-body-portal {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      height: auto !important;
      min-height: 100dvh !important;
      min-height: -webkit-fill-available !important;
      pointer-events: none !important;
      z-index: 50 !important;
      overflow: visible !important;
    }
    #ps-body-portal > * { pointer-events: auto; }
    @media (display-mode: standalone) {
      html, body, #root, #ps-body-portal {
        min-height: 100dvh !important;
        min-height: -webkit-fill-available !important;
      }
    }
    .ps-felt-fixed {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      min-height: 100dvh !important;
      min-height: -webkit-fill-available !important;
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
