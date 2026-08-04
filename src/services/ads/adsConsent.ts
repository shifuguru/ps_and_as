/**
 * Web ad / cookie consent before loading AdSense.
 */

const STORAGE_KEY = "@ps_and_as_ads_consent_v1";

export type AdsConsentState = "unknown" | "accepted" | "declined";

type Listener = () => void;
const listeners = new Set<Listener>();

let cache: AdsConsentState = "unknown";
let loaded = false;
let preloadPromise: Promise<void> | null = null;

async function storage() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@react-native-async-storage/async-storage").default;
}

function notify(): void {
  listeners.forEach((l) => l());
}

export function subscribeAdsConsent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAdsConsentSync(): AdsConsentState {
  return cache;
}

export function isAdsConsentLoaded(): boolean {
  return loaded;
}

async function read(): Promise<AdsConsentState> {
  try {
    const AsyncStorage = await storage();
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === "accepted" || raw === "declined") return raw;
  } catch {
    // ignore
  }
  return "unknown";
}

export function preloadAdsConsent(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (preloadPromise) return preloadPromise;
  preloadPromise = read().then((state) => {
    cache = state;
    loaded = true;
    notify();
  });
  return preloadPromise;
}

export async function getAdsConsent(): Promise<AdsConsentState> {
  if (!loaded) {
    cache = await read();
    loaded = true;
  }
  return cache;
}

export async function setAdsConsent(state: "accepted" | "declined"): Promise<void> {
  cache = state;
  loaded = true;
  notify();
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(STORAGE_KEY, state);
  } catch {
    // ignore
  }
}

/** Ads may load only after explicit accept. */
export function canLoadPersonalizedAds(): boolean {
  return cache === "accepted";
}
