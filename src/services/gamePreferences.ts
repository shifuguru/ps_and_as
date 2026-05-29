const STORAGE_SKIP_DEAL_ANIMATIONS = "@ps_and_as_skip_deal_animations";
const STORAGE_DARK_MODE_CARDS = "@ps_and_as_dark_mode_cards";

type Listener = () => void;
const listeners = new Set<Listener>();

type PreferencesCache = {
  skipDealAnimations: boolean;
  darkModeCards: boolean;
  loaded: boolean;
};

let cache: PreferencesCache = {
  skipDealAnimations: false,
  darkModeCards: false,
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

async function readPreferencesFromStorage(): Promise<PreferencesCache> {
  try {
    const AsyncStorage = await storage();
    const [skipVal, darkVal] = await Promise.all([
      AsyncStorage.getItem(STORAGE_SKIP_DEAL_ANIMATIONS),
      AsyncStorage.getItem(STORAGE_DARK_MODE_CARDS),
    ]);
    return {
      skipDealAnimations: skipVal === "1" || skipVal === "true",
      darkModeCards: darkVal === "1" || darkVal === "true",
      loaded: true,
    };
  } catch {
    return { skipDealAnimations: false, darkModeCards: false, loaded: true };
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
