import { useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState, Platform } from "react-native";
import { createDecorativeMotionStore } from "../utils/decorativeMotionStore";

const media =
  Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

const store = createDecorativeMotionStore({
  readReducedMotion: () =>
    media ? Promise.resolve(media.matches) : AccessibilityInfo.isReduceMotionEnabled(),
  subscribeReducedMotion: (listener) => {
    if (media) {
      const onChange = (event: MediaQueryListEvent) => listener(event.matches);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", listener);
    return () => subscription.remove();
  },
  readActive: () =>
    Platform.OS === "web" && typeof document !== "undefined"
      ? document.visibilityState !== "hidden"
      : AppState.currentState !== "background" && AppState.currentState !== "inactive",
  subscribeActive: (listener) => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onChange = () => listener(document.visibilityState !== "hidden");
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    }
    const subscription = AppState.addEventListener("change", (state) =>
      listener(state === "active"),
    );
    return () => subscription.remove();
  },
}, media?.matches ?? true);

/** False for reduced motion or while the application is backgrounded. */
export function useDecorativeMotion(): boolean {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => false);
}
