import { useCallback, useEffect, useState } from "react";
import {
  areGamePreferencesLoaded,
  getDarkModeCardsSync,
  getKingsNameSync,
  getReduceMotionSync,
  getSkipDealAnimationsSync,
  preloadGamePreferences,
  setDarkModeCards as persistDarkModeCards,
  setKingsName as persistKingsName,
  setReduceMotion as persistReduceMotion,
  setSkipDealAnimations as persistSkipDealAnimations,
  subscribeGamePreferences,
} from "../services/gamePreferences";

function readCachedPreferences() {
  return {
    skipDealAnimations: getSkipDealAnimationsSync(),
    darkModeCards: getDarkModeCardsSync(),
    reduceMotion: getReduceMotionSync(),
    kingsName: getKingsNameSync(),
  };
}

export function useGamePreferences() {
  const [skipDealAnimations, setSkipDealAnimationsState] = useState(
    () => readCachedPreferences().skipDealAnimations,
  );
  const [darkModeCards, setDarkModeCardsState] = useState(
    () => readCachedPreferences().darkModeCards,
  );
  const [reduceMotion, setReduceMotionState] = useState(
    () => readCachedPreferences().reduceMotion,
  );
  const [kingsName, setKingsNameState] = useState(
    () => readCachedPreferences().kingsName,
  );
  const [loaded, setLoaded] = useState(areGamePreferencesLoaded());

  useEffect(() => {
    let cancelled = false;

    const apply = () => {
      const prefs = readCachedPreferences();
      setSkipDealAnimationsState(prefs.skipDealAnimations);
      setDarkModeCardsState(prefs.darkModeCards);
      setReduceMotionState(prefs.reduceMotion);
      setKingsNameState(prefs.kingsName);
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

  const setReduceMotion = useCallback(async (value: boolean) => {
    setReduceMotionState(value);
    setLoaded(true);
    await persistReduceMotion(value);
  }, []);

  const setKingsName = useCallback(async (value: boolean) => {
    await persistKingsName(value);
  }, []);

  return {
    skipDealAnimations,
    setSkipDealAnimations,
    darkModeCards,
    setDarkModeCards,
    reduceMotion,
    setReduceMotion,
    kingsName,
    setKingsName,
    loaded,
  };
}
