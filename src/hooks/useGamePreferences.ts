import { useCallback, useEffect, useState } from "react";
import {
  areGamePreferencesLoaded,
  getDarkModeCardsSync,
  getSkipDealAnimationsSync,
  preloadGamePreferences,
  setDarkModeCards as persistDarkModeCards,
  setSkipDealAnimations as persistSkipDealAnimations,
  subscribeGamePreferences,
} from "../services/gamePreferences";

function readCachedPreferences() {
  return {
    skipDealAnimations: getSkipDealAnimationsSync(),
    darkModeCards: getDarkModeCardsSync(),
  };
}

export function useGamePreferences() {
  const [skipDealAnimations, setSkipDealAnimationsState] = useState(
    () => readCachedPreferences().skipDealAnimations,
  );
  const [darkModeCards, setDarkModeCardsState] = useState(
    () => readCachedPreferences().darkModeCards,
  );
  const [loaded, setLoaded] = useState(areGamePreferencesLoaded());

  useEffect(() => {
    let cancelled = false;

    const apply = () => {
      const prefs = readCachedPreferences();
      setSkipDealAnimationsState(prefs.skipDealAnimations);
      setDarkModeCardsState(prefs.darkModeCards);
      setLoaded(true);
    };

    void preloadGamePreferences().then(() => {
      if (!cancelled) apply();
    });

    const unsubscribe = subscribeGamePreferences(() => {
      if (!cancelled) apply();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setSkipDealAnimations = useCallback(async (value: boolean) => {
    setSkipDealAnimationsState(value);
    setLoaded(true);
    await persistSkipDealAnimations(value);
  }, []);

  const setDarkModeCards = useCallback(async (value: boolean) => {
    setDarkModeCardsState(value);
    setLoaded(true);
    await persistDarkModeCards(value);
  }, []);

  return {
    skipDealAnimations,
    setSkipDealAnimations,
    darkModeCards,
    setDarkModeCards,
    loaded,
  };
}
