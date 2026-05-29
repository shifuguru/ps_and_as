import { Platform } from "react-native";
import { useEffect } from "react";

/** Web only — call `onEscape` when the user presses Escape. */
export function useWebEscapeKey(onEscape: () => void, enabled: boolean): void {
  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onEscape();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape, enabled]);
}
