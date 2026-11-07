import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getKingsNameSync,
  preloadGamePreferences,
  subscribeGamePreferences,
} from "../services/gamePreferences";
import { gameTerminology } from "../utils/gameTerminology";

export function useGameTerminology() {
  const kingsName = useSyncExternalStore(
    subscribeGamePreferences,
    getKingsNameSync,
    getKingsNameSync,
  );
  useEffect(() => {
    void preloadGamePreferences();
  }, []);
  return useCallback((text: string) => gameTerminology(text, kingsName), [kingsName]);
}
