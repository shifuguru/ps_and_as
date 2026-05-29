import { useCallback, useEffect, useState } from "react";
import {
  getSkipDealAnimations,
  setSkipDealAnimations as persistSkipDealAnimations,
  subscribeGamePreferences,
} from "../services/gamePreferences";

export function useGamePreferences() {
  const [skipDealAnimations, setSkipDealAnimationsState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSkipDealAnimations().then((value) => {
      if (cancelled) return;
      setSkipDealAnimationsState(value);
      setLoaded(true);
    });
    const unsubscribe = subscribeGamePreferences(() => {
      void getSkipDealAnimations().then((value) => {
        if (!cancelled) setSkipDealAnimationsState(value);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setSkipDealAnimations = useCallback(async (value: boolean) => {
    setSkipDealAnimationsState(value);
    await persistSkipDealAnimations(value);
  }, []);

  return { skipDealAnimations, setSkipDealAnimations, loaded };
}
