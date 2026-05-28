import { Platform } from "react-native";
import { RefObject, useLayoutEffect } from "react";
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

function hostElement(ref: RefObject<View | null>): any {
  return (ref.current as unknown as any) ?? null;
}

/** Prevent parent ScrollViews from scrolling while dragging inside a touch target. */
export function useWebTouchScrollLock(
  ref: RefObject<View | null>,
  active = true,
): void {
  useLayoutEffect(() => {
    if (Platform.OS !== "web" || !active) return;

    const node = hostElement(ref);
    if (!node || typeof node.addEventListener !== "function") return;

    node.style.touchAction = "none";
    node.style.overscrollBehavior = "contain";

    const blockTouchMove = (event: Event) => {
      event.preventDefault();
    };
    node.addEventListener("touchmove", blockTouchMove, { passive: false });

    return () => {
      node.removeEventListener("touchmove", blockTouchMove);
      node.style.touchAction = "";
      node.style.overscrollBehavior = "";
    };
  }, [ref, active]);
}
