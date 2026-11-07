import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { createDecorativeMotionStore } from "../utils/decorativeMotionStore";
import {
  getReduceMotionSync,
  preloadGamePreferences,
  subscribeGamePreferences,
} from "../services/gamePreferences";

const activeSource = {
  readActive: () =>
    Platform.OS === "web" && typeof document !== "undefined"
      ? document.visibilityState !== "hidden"
      : AppState.currentState !== "background" && AppState.currentState !== "inactive",
  subscribeActive: (listener: (active: boolean) => void) => {
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
};

const store = createDecorativeMotionStore({
  ...activeSource,
  readReducedMotion: async () => {
    await preloadGamePreferences();
    return getReduceMotionSync();
  },
  subscribeReducedMotion: (listener) =>
    subscribeGamePreferences(() => listener(getReduceMotionSync())),
}, getReduceMotionSync());

// Turn indicators ignore reduced motion; only backgrounding pauses them.
const turnIndicatorStore = createDecorativeMotionStore({
  ...activeSource,
  readReducedMotion: () => Promise.resolve(false),
  subscribeReducedMotion: () => () => {},
}, false);

/** False for reduced motion or while the application is backgrounded. */
export function useDecorativeMotion(): boolean {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => false);
}

/** In-app reduce-motion preference, disabled by default. */
export function useReduceMotionEnabled(): boolean {
  useDecorativeMotion();
  return useSyncExternalStore(
    subscribeGamePreferences,
    getReduceMotionSync,
    () => false,
  );
}

/** Motion for "your turn" cues: stays on under reduced motion, off only while backgrounded. */
export function useTurnIndicatorMotion(): boolean {
  return useSyncExternalStore(turnIndicatorStore.subscribe, turnIndicatorStore.getSnapshot, () => false);
}
