import { Platform } from "react-native";
import { RefObject, useCallback, useLayoutEffect, useRef } from "react";
import type { View } from "react-native";

export const WEB_VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, viewport-fit=cover, user-scalable=no, shrink-to-fit=no";

let noZoomInstalled = false;

/** Lock mobile web viewport scaling (pinch, focus-zoom, double-tap). */
export function ensureWebNoZoom(): void {
  if (Platform.OS !== "web" || noZoomInstalled) return;
  const doc = (globalThis as { document?: any }).document;
  if (!doc) return;
  noZoomInstalled = true;

  let meta = doc.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.name = "viewport";
    doc.head.appendChild(meta);
  }
  meta.content = WEB_VIEWPORT_CONTENT;

  const blockGesture = (event: Event) => {
    event.preventDefault();
  };
  doc.addEventListener("gesturestart", blockGesture, { passive: false });
  doc.addEventListener("gesturechange", blockGesture, { passive: false });
  doc.addEventListener("gestureend", blockGesture, { passive: false });

  doc.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) event.preventDefault();
    },
    { passive: false },
  );

  doc.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false },
  );
}

/** RN Web View ref → DOM element (when available). */
export function resolveWebDomNode(target: unknown): HTMLElement | null {
  if (!target || typeof target !== "object") return null;
  const node = target as HTMLElement;
  if (
    typeof node.addEventListener === "function" &&
    typeof node.getBoundingClientRect === "function"
  ) {
    return node;
  }
  return null;
}

function hostElement(ref: RefObject<View | null>): HTMLElement | null {
  return resolveWebDomNode(ref.current);
}

/** Stop the browser from scrolling/zooming while dragging inside a touch target. */
export function bindWebTouchScrollLock(node: HTMLElement): () => void {
  node.style.touchAction = "none";
  node.style.overscrollBehavior = "contain";
  node.style.userSelect = "none";
  (node.style as { webkitUserSelect?: string }).webkitUserSelect = "none";

  const blockMove = (event: Event) => {
    event.preventDefault();
  };
  node.addEventListener("touchmove", blockMove, { passive: false });
  node.addEventListener("pointermove", blockMove, { passive: false });

  return () => {
    node.removeEventListener("touchmove", blockMove);
    node.removeEventListener("pointermove", blockMove);
    node.style.touchAction = "";
    node.style.overscrollBehavior = "";
    node.style.userSelect = "";
    (node.style as { webkitUserSelect?: string }).webkitUserSelect = "";
  };
}

/** Prevent parent ScrollViews from scrolling while dragging inside a touch target. */
export function useWebTouchScrollLock(
  ref: RefObject<View | null>,
  active = true,
  /** Re-bind after layout (e.g. conditional mount or width change). */
  layoutKey?: number | string,
): void {
  useLayoutEffect(() => {
    if (Platform.OS !== "web" || !active) return;

    const node = hostElement(ref);
    if (!node) return;

    return bindWebTouchScrollLock(node);
  }, [ref, active, layoutKey]);
}

/** Callback ref variant — binds as soon as the host mounts. */
export function useWebTouchScrollLockRef(active = true) {
  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback(
    (node: View | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (Platform.OS !== "web" || !active || !node) return;
      const el = resolveWebDomNode(node);
      if (!el) return;
      cleanupRef.current = bindWebTouchScrollLock(el);
    },
    [active],
  );
}
