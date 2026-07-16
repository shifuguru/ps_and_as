/**
 * Reversible, query-gated Safari compositing experiments.
 *
 * Enable with `?viewportExperiment=N` (1–5). Absent → no effect, zero cost.
 * These experiments TEMPORARILY mutate runtime styles to prove which layer
 * Safari's translucent toolbar composites from. They do NOT change the shipped
 * wallpaper architecture; everything is applied via a single injected <style>
 * tag plus inline overrides that are removed on teardown.
 *
 * Run on a real iPhone (Safari toolbar visible + hidden, and installed PWA),
 * then read results from the diagnostics overlay / window.__PS_VIEWPORT_DUMP__.
 */
import { Platform } from "react-native";
import { getViewportExperiment } from "./viewportDebug";
import { WEB_FELT_LAYER_ID } from "../utils/webViewport";

const EXPERIMENT_STYLE_ID = "ps-viewport-experiment";
const MAGENTA = "#ff00ff";
const BRIGHT_BLUE = "#0000ff";

type Doc = any;

function getFeltTextureUrl(doc: Doc): string | null {
  // Prefer document wallpaper var (current architecture).
  const fromVar = doc.documentElement?.style?.getPropertyValue?.("--ps-felt-texture")?.trim();
  if (fromVar && fromVar !== "none") return fromVar;

  const texture = doc.querySelector?.(
    `#${WEB_FELT_LAYER_ID} .ps-felt-layer-texture`,
  );
  if (!texture) return null;
  const bg = texture.style?.backgroundImage || "";
  return bg && bg !== "none" ? bg : null;
}

function injectStyle(doc: Doc, css: string): void {
  let style = doc.getElementById(EXPERIMENT_STYLE_ID);
  if (!style) {
    style = doc.createElement("style");
    style.id = EXPERIMENT_STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = css;
}

function markActive(doc: Doc, experiment: number, label: string): void {
  doc.documentElement.setAttribute(
    "data-ps-viewport-experiment",
    String(experiment),
  );
  (globalThis as { __PS_VIEWPORT_EXPERIMENT__?: string }).__PS_VIEWPORT_EXPERIMENT__ =
    `#${experiment} ${label}`;
  console.log(`[viewport-experiment] #${experiment} ${label}`);
}

/**
 * EXPERIMENT 1 — felt texture on the document (html/body), felt layer disabled.
 * Q: does the toolbar band show textured felt instead of flat green?
 */
function experiment1(doc: Doc): void {
  const url = getFeltTextureUrl(doc);
  const image = url ? `background-image: ${url} !important;` : "";
  injectStyle(
    doc,
    `
    #${WEB_FELT_LAYER_ID} { display: none !important; }
    html, body {
      background-color: #0f5132 !important;
      ${image}
      background-size: cover !important;
      background-position: center center !important;
      background-repeat: no-repeat !important;
    }
    `,
  );
  markActive(
    doc,
    1,
    url ? "felt texture on html/body, #ps-felt-layer hidden" : "NO felt url found — texture unavailable",
  );
}

/**
 * EXPERIMENT 2 — flat magenta on html/body, felt layer disabled.
 * Q: does the toolbar band become magenta? (yes ⇒ Safari samples document bg)
 */
function experiment2(doc: Doc): void {
  injectStyle(
    doc,
    `
    #${WEB_FELT_LAYER_ID} { display: none !important; }
    html, body {
      background-image: none !important;
      background-color: ${MAGENTA} !important;
    }
    `,
  );
  markActive(doc, 2, "html/body = magenta, #ps-felt-layer hidden");
}

/**
 * EXPERIMENT 3 — felt layer restored + forced bright blue (children hidden).
 * Q: does the toolbar band become blue? (no ⇒ Safari does NOT sample the layer)
 */
function experiment3(doc: Doc): void {
  injectStyle(
    doc,
    `
    html.ps-env-ready, html.ps-env-ready body {
      background-color: transparent !important;
      background-image: none !important;
    }
    #${WEB_FELT_LAYER_ID} {
      display: block !important;
      background-color: ${BRIGHT_BLUE} !important;
    }
    #${WEB_FELT_LAYER_ID} .ps-env-plane,
    #${WEB_FELT_LAYER_ID} .ps-felt-layer-texture,
    #${WEB_FELT_LAYER_ID} .ps-felt-layer-tint {
      opacity: 0 !important;
    }
    `,
  );
  markActive(doc, 3, "#ps-felt-layer = blue, document transparent");
}

/**
 * EXPERIMENT 4 — measure safe-area insets via real padding on a fixed element.
 * Reads used padding (not getComputedStyle(env())), the reliable method.
 */
export type SafeAreaProbe = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  method: string;
};

export function measureSafeAreaByPadding(): SafeAreaProbe {
  const doc = (globalThis as { document?: Doc }).document;
  if (!doc?.body) {
    return { top: 0, bottom: 0, left: 0, right: 0, method: "no-document" };
  }
  const probe = doc.createElement("div");
  probe.style.position = "fixed";
  probe.style.left = "0";
  probe.style.top = "0";
  probe.style.width = "0";
  probe.style.height = "0";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.paddingTop = "env(safe-area-inset-top, 0px)";
  probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
  probe.style.paddingLeft = "env(safe-area-inset-left, 0px)";
  probe.style.paddingRight = "env(safe-area-inset-right, 0px)";
  doc.body.appendChild(probe);
  const cs = (globalThis as any).getComputedStyle(probe);
  const read = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
  };
  const result: SafeAreaProbe = {
    top: read(cs.paddingTop),
    bottom: read(cs.paddingBottom),
    left: read(cs.paddingLeft),
    right: read(cs.paddingRight),
    method: "fixed element padding: env(safe-area-inset-*)",
  };
  doc.body.removeChild(probe);
  return result;
}

function experiment4(doc: Doc): void {
  const probe = measureSafeAreaByPadding();
  (globalThis as { __PS_SAFE_AREA_PROBE__?: SafeAreaProbe }).__PS_SAFE_AREA_PROBE__ =
    probe;
  markActive(
    doc,
    4,
    `safe-area padding probe: top=${probe.top} bottom=${probe.bottom} left=${probe.left} right=${probe.right}`,
  );
  console.log("[viewport-experiment] safe-area (padding probe)", probe);
}

/**
 * EXPERIMENT 5 — compositing ownership audit (no visual change).
 * Dumps the sampled-relevant properties for each candidate layer.
 */
export type LayerAudit = {
  selector: string;
  exists: boolean;
  background: string | null;
  backgroundImage: string | null;
  backgroundColor: string | null;
  position: string | null;
  zIndex: string | null;
  overflow: string | null;
  transform: string | null;
  contain: string | null;
  willChange: string | null;
  filter: string | null;
  createsStackingContext: boolean;
  clippingAncestor: string | null;
  rectBottom: number | null;
};

function describeClippingAncestor(doc: Doc, el: any): string | null {
  let node = el?.parentElement;
  while (node && node !== doc.documentElement) {
    const cs = (globalThis as any).getComputedStyle(node);
    if (cs.overflow !== "visible" || cs.clip !== "auto" || cs.contain?.includes("paint")) {
      const id = node.id ? `#${node.id}` : node.tagName?.toLowerCase();
      return `${id} (overflow:${cs.overflow}, contain:${cs.contain})`;
    }
    node = node.parentElement;
  }
  const rootCs = (globalThis as any).getComputedStyle(doc.documentElement);
  return `html (overflow:${rootCs.overflow})`;
}

function auditLayer(doc: Doc, selector: string): LayerAudit {
  const el =
    selector === "html"
      ? doc.documentElement
      : selector === "body"
        ? doc.body
        : selector.startsWith("#")
          ? doc.getElementById(selector.slice(1))
          : doc.querySelector(selector);

  if (!el) {
    return {
      selector,
      exists: false,
      background: null,
      backgroundImage: null,
      backgroundColor: null,
      position: null,
      zIndex: null,
      overflow: null,
      transform: null,
      contain: null,
      willChange: null,
      filter: null,
      createsStackingContext: false,
      clippingAncestor: null,
      rectBottom: null,
    };
  }

  const cs = (globalThis as any).getComputedStyle(el);
  const transform = cs.transform && cs.transform !== "none" ? cs.transform : null;
  const filter = cs.filter && cs.filter !== "none" ? cs.filter : null;
  const willChange =
    cs.willChange && cs.willChange !== "auto" ? cs.willChange : null;
  const zIndex = cs.zIndex && cs.zIndex !== "auto" ? cs.zIndex : null;
  const opacity = parseFloat(cs.opacity);
  const createsStackingContext =
    (cs.position === "fixed" || cs.position === "sticky") ||
    (zIndex != null && cs.position !== "static") ||
    !!transform ||
    !!filter ||
    !!willChange ||
    (Number.isFinite(opacity) && opacity < 1);

  return {
    selector,
    exists: true,
    background: cs.background?.slice(0, 80) ?? null,
    backgroundImage:
      cs.backgroundImage && cs.backgroundImage !== "none"
        ? cs.backgroundImage.slice(0, 80)
        : null,
    backgroundColor: cs.backgroundColor ?? null,
    position: cs.position ?? null,
    zIndex,
    overflow: cs.overflow ?? null,
    transform,
    contain: cs.contain && cs.contain !== "none" ? cs.contain : null,
    willChange,
    filter,
    createsStackingContext,
    clippingAncestor: describeClippingAncestor(doc, el),
    rectBottom: el.getBoundingClientRect
      ? Math.round(el.getBoundingClientRect().bottom)
      : null,
  };
}

export function auditCompositingLayers(): LayerAudit[] {
  const doc = (globalThis as { document?: Doc }).document;
  if (!doc) return [];
  return [
    "html",
    "body",
    "#root",
    `#${WEB_FELT_LAYER_ID}`,
    ".ps-felt-layer-texture",
    ".ps-felt-layer-tint",
  ].map((selector) => auditLayer(doc, selector));
}

function experiment5(doc: Doc): void {
  const audit = auditCompositingLayers();
  (globalThis as { __PS_LAYER_AUDIT__?: LayerAudit[] }).__PS_LAYER_AUDIT__ = audit;
  markActive(doc, 5, "compositing audit (no visual change) — see console.table");
  console.table(
    audit.map((a) => ({
      selector: a.selector,
      bgColor: a.backgroundColor,
      bgImage: a.backgroundImage ? "yes" : "no",
      position: a.position,
      z: a.zIndex,
      overflow: a.overflow,
      transform: a.transform ? "yes" : "no",
      filter: a.filter ? "yes" : "no",
      stackingCtx: a.createsStackingContext,
      clipAncestor: a.clippingAncestor,
    })),
  );
}

export function teardownViewportExperiment(): void {
  const doc = (globalThis as { document?: Doc }).document;
  if (!doc) return;
  doc.getElementById(EXPERIMENT_STYLE_ID)?.remove();
  doc.documentElement.removeAttribute("data-ps-viewport-experiment");
}

/**
 * Apply the experiment named by `?viewportExperiment=N`. Returns a teardown fn.
 * No-op (zero cost) when the query param is absent.
 */
export function applyViewportExperimentFromQuery(): () => void {
  if (Platform.OS !== "web") return () => undefined;
  const experiment = getViewportExperiment();
  if (!experiment) return () => undefined;

  const doc = (globalThis as { document?: Doc }).document;
  if (!doc?.documentElement) return () => undefined;

  // Re-apply after felt refresh cycles that could overwrite inline styles.
  const run = () => {
    switch (experiment) {
      case 1:
        return experiment1(doc);
      case 2:
        return experiment2(doc);
      case 3:
        return experiment3(doc);
      case 4:
        return experiment4(doc);
      case 5:
        return experiment5(doc);
      default:
        return undefined;
    }
  };

  run();
  // Felt/shell sync can re-run on resize; keep visual experiments pinned.
  const win = (globalThis as { window?: any }).window;
  const reapply = experiment <= 3 ? () => run() : undefined;
  if (reapply) {
    win?.addEventListener?.("resize", reapply);
    win?.visualViewport?.addEventListener?.("resize", reapply);
  }

  return () => {
    if (reapply) {
      win?.removeEventListener?.("resize", reapply);
      win?.visualViewport?.removeEventListener?.("resize", reapply);
    }
    teardownViewportExperiment();
  };
}
