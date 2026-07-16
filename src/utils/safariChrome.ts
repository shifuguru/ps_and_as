import { Platform } from "react-native";

/**
 * Best-effort nudge for mobile Safari to collapse the URL bar.
 * Apple does not expose a supported API to hide browser chrome in a normal tab.
 * This often no-ops when overflow is hidden or on recent iOS versions.
 *
 * Product target: installed Home Screen (standalone) — no Safari toolbar.
 * Design for the full display with the home indicator over the felt; do not
 * invent Safari-toolbar "safe space" footers in the PWA.
 */
export function tryCollapseSafariChrome(): void {
  if (Platform.OS !== "web") return;

  const g = globalThis as {
    window?: {
      scrollTo: (x: number, y: number) => void;
      visualViewport?: { height: number };
    };
    document?: {
      documentElement?: { scrollTop: number; style: { scrollBehavior: string } };
      body?: { style: { minHeight?: string; overflow?: string } };
    };
  };

  const win = g.window;
  const doc = g.document;
  if (!win || !doc?.body) return;

  const run = () => {
    const prevOverflow = doc.body!.style.overflow;
    const prevMinHeight = doc.body!.style.minHeight;
    doc.body!.style.overflow = "auto";
    doc.body!.style.minHeight = "calc(100dvh + 2px)";
    win.scrollTo(0, 1);
    requestAnimationFrame(() => {
      win.scrollTo(0, 0);
      doc.body!.style.overflow = prevOverflow;
      doc.body!.style.minHeight = prevMinHeight;
    });
  };

  requestAnimationFrame(run);
}

/** True when launched from the home screen (no Safari URL bar). */
export function isStandaloneWebApp(): boolean {
  if (Platform.OS !== "web") return false;
  const nav = (globalThis as { navigator?: { standalone?: boolean } }).navigator;
  if (nav?.standalone) return true;
  const match = (globalThis as { matchMedia?: (q: string) => { matches: boolean } })
    .matchMedia?.("(display-mode: standalone)");
  return !!match?.matches;
}
