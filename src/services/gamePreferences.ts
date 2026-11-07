const STORAGE_SKIP_DEAL_ANIMATIONS = "@ps_and_as_skip_deal_animations";
const STORAGE_DARK_MODE_CARDS = "@ps_and_as_dark_mode_cards";
const STORAGE_REDUCE_MOTION = "@ps_and_as_reduce_motion";
const STORAGE_KINGS_NAME = "@ps_and_as_kings_name";

type Listener = () => void;
const listeners = new Set<Listener>();

type PreferencesCache = {
  skipDealAnimations: boolean;
  darkModeCards: boolean;
  reduceMotion: boolean;
  kingsName: boolean;
  loaded: boolean;
};

let cache: PreferencesCache = {
  skipDealAnimations: true,
  darkModeCards: false,
  reduceMotion: false,
  kingsName: false,
  loaded: false,
};

let preloadPromise: Promise<void> | null = null;

async function storage() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@react-native-async-storage/async-storage").default;
}

export function subscribeGamePreferences(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyGamePreferences(): void {
  listeners.forEach((listener) => listener());
}

function updateCache(partial: Partial<PreferencesCache>): void {
  cache = { ...cache, ...partial, loaded: true };
}

export function areGamePreferencesLoaded(): boolean {
  return cache.loaded;
}

/** Synchronous read — valid after preload or any get/set. */
export function getSkipDealAnimationsSync(): boolean {
  return cache.skipDealAnimations;
}

export function getDarkModeCardsSync(): boolean {
  return cache.darkModeCards;
}

export function getReduceMotionSync(): boolean {
  return cache.reduceMotion;
}

export function getKingsNameSync(): boolean {
  return cache.kingsName;
}

async function readPreferencesFromStorage(): Promise<PreferencesCache> {
  try {
    const AsyncStorage = await storage();
    const [skipVal, darkVal, motionVal, kingsVal] = await Promise.all([
      AsyncStorage.getItem(STORAGE_SKIP_DEAL_ANIMATIONS),
      AsyncStorage.getItem(STORAGE_DARK_MODE_CARDS),
      AsyncStorage.getItem(STORAGE_REDUCE_MOTION),
      AsyncStorage.getItem(STORAGE_KINGS_NAME),
    ]);
    return {
      // Default ON until deal animations are out of beta (unset storage → skip).
      skipDealAnimations:
        skipVal == null ? true : skipVal === "1" || skipVal === "true",
      darkModeCards: darkVal === "1" || darkVal === "true",
      reduceMotion: motionVal === "1" || motionVal === "true",
      kingsName: kingsVal === "1" || kingsVal === "true",
      loaded: true,
    };
  } catch (error) {
    console.warn("[GamePreferences] Failed to load preferences:", error);
    return {
      skipDealAnimations: true,
      darkModeCards: false,
      reduceMotion: false,
      kingsName: false,
      loaded: true,
    };
  }
}

/** Load preferences once at app start so offline games see the saved toggle. */
export function preloadGamePreferences(): Promise<void> {
  if (cache.loaded) return Promise.resolve();
  if (preloadPromise) return preloadPromise;
  preloadPromise = readPreferencesFromStorage().then((prefs) => {
    updateCache(prefs);
    notifyGamePreferences();
  });
  return preloadPromise;
}

export async function getSkipDealAnimations(): Promise<boolean> {
  if (!cache.loaded) {
    const prefs = await readPreferencesFromStorage();
    updateCache(prefs);
  }
  return cache.skipDealAnimations;
}

export async function setSkipDealAnimations(skip: boolean): Promise<void> {
  updateCache({ skipDealAnimations: skip });
  notifyGamePreferences();
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(STORAGE_SKIP_DEAL_ANIMATIONS, skip ? "1" : "0");
  } catch {
    // ignore
  }
}

export async function getDarkModeCards(): Promise<boolean> {
  if (!cache.loaded) {
    const prefs = await readPreferencesFromStorage();
    updateCache(prefs);
  }
  return cache.darkModeCards;
}

export async function setDarkModeCards(enabled: boolean): Promise<void> {
  updateCache({ darkModeCards: enabled });
  notifyGamePreferences();
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(STORAGE_DARK_MODE_CARDS, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

export async function setReduceMotion(enabled: boolean): Promise<void> {
  updateCache({ reduceMotion: enabled });
  notifyGamePreferences();
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(STORAGE_REDUCE_MOTION, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

export async function setKingsName(enabled: boolean): Promise<void> {
  await preloadGamePreferences();
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(STORAGE_KINGS_NAME, enabled ? "1" : "0");
  } catch (error) {
    console.error("[GamePreferences] Failed to save Kings & Assholes preference:", error);
    throw error;
  }
  updateCache({ kingsName: enabled });
  notifyGamePreferences();
}
