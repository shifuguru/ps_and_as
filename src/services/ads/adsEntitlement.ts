/**
 * Local ads entitlement + forced-ad round counter + rewarded daily cap.
 * Cloud `adsRemoved` is source of truth when Google-linked; local cache for UX.
 */

import {
  FORCED_AD_EVERY_N_ROUNDS,
  REWARDED_AD_DAILY_CAP,
  utcDayKey,
} from "./adsConfig";

const STORAGE_ADS_REMOVED = "@ps_and_as_ads_removed_v1";
const STORAGE_FORCED_ROUNDS = "@ps_and_as_forced_ad_rounds_v1";
const STORAGE_REWARDED_DAY = "@ps_and_as_rewarded_ad_day_v1";

type Listener = () => void;
const listeners = new Set<Listener>();

type Cache = {
  adsRemoved: boolean;
  roundsSinceForcedAd: number;
  rewardedDayKey: string;
  rewardedClaimsToday: number;
  loaded: boolean;
};

let cache: Cache = {
  adsRemoved: false,
  roundsSinceForcedAd: 0,
  rewardedDayKey: utcDayKey(),
  rewardedClaimsToday: 0,
  loaded: false,
};

let preloadPromise: Promise<void> | null = null;

async function storage() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@react-native-async-storage/async-storage").default;
}

function notify(): void {
  listeners.forEach((l) => l());
}

export function subscribeAdsEntitlement(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function rollRewardedDay(c: Cache, now = new Date()): Cache {
  const key = utcDayKey(now);
  if (c.rewardedDayKey === key) return c;
  return {
    ...c,
    rewardedDayKey: key,
    rewardedClaimsToday: 0,
  };
}

async function readFromStorage(): Promise<Cache> {
  try {
    const AsyncStorage = await storage();
    const [removed, rounds, rewardedRaw] = await Promise.all([
      AsyncStorage.getItem(STORAGE_ADS_REMOVED),
      AsyncStorage.getItem(STORAGE_FORCED_ROUNDS),
      AsyncStorage.getItem(STORAGE_REWARDED_DAY),
    ]);
    let rewardedDayKey = utcDayKey();
    let rewardedClaimsToday = 0;
    if (rewardedRaw) {
      try {
        const parsed = JSON.parse(rewardedRaw) as {
          day?: string;
          claims?: number;
        };
        if (typeof parsed.day === "string") rewardedDayKey = parsed.day;
        if (Number.isFinite(parsed.claims)) {
          rewardedClaimsToday = Math.max(0, Math.floor(Number(parsed.claims)));
        }
      } catch {
        // ignore
      }
    }
    const base: Cache = {
      adsRemoved: removed === "1" || removed === "true",
      roundsSinceForcedAd: Math.max(0, Math.floor(Number(rounds) || 0)),
      rewardedDayKey,
      rewardedClaimsToday,
      loaded: true,
    };
    return rollRewardedDay(base);
  } catch {
    return {
      adsRemoved: false,
      roundsSinceForcedAd: 0,
      rewardedDayKey: utcDayKey(),
      rewardedClaimsToday: 0,
      loaded: true,
    };
  }
}

async function persist(): Promise<void> {
  try {
    const AsyncStorage = await storage();
    await Promise.all([
      AsyncStorage.setItem(STORAGE_ADS_REMOVED, cache.adsRemoved ? "1" : "0"),
      AsyncStorage.setItem(
        STORAGE_FORCED_ROUNDS,
        String(cache.roundsSinceForcedAd),
      ),
      AsyncStorage.setItem(
        STORAGE_REWARDED_DAY,
        JSON.stringify({
          day: cache.rewardedDayKey,
          claims: cache.rewardedClaimsToday,
        }),
      ),
    ]);
  } catch {
    // ignore
  }
}

export function preloadAdsEntitlement(): Promise<void> {
  if (cache.loaded) return Promise.resolve();
  if (preloadPromise) return preloadPromise;
  preloadPromise = readFromStorage().then((next) => {
    cache = next;
    notify();
  });
  return preloadPromise;
}

export function areForcedAdsRemovedSync(): boolean {
  return cache.adsRemoved;
}

export async function areForcedAdsRemoved(): Promise<boolean> {
  if (!cache.loaded) {
    cache = await readFromStorage();
  }
  return cache.adsRemoved;
}

/** Apply server-verified entitlement (never call from untrusted UI alone). */
export async function setAdsRemovedLocal(removed: boolean): Promise<void> {
  if (!cache.loaded) cache = await readFromStorage();
  if (cache.adsRemoved === removed) return;
  cache = { ...cache, adsRemoved: removed, loaded: true };
  notify();
  await persist();
}

export function getRoundsSinceForcedAdSync(): number {
  return cache.roundsSinceForcedAd;
}

/**
 * Record a completed round for forced-ad cadence.
 * Returns true when a forced interstitial should be requested this rankings open.
 */
export async function noteRoundCompleteForForcedAd(): Promise<boolean> {
  if (!cache.loaded) cache = await readFromStorage();
  if (cache.adsRemoved) return false;
  const next = cache.roundsSinceForcedAd + 1;
  const shouldShow = next >= FORCED_AD_EVERY_N_ROUNDS;
  cache = {
    ...cache,
    roundsSinceForcedAd: shouldShow ? 0 : next,
    loaded: true,
  };
  notify();
  await persist();
  return shouldShow;
}

/** Reset cadence after purchase so buyers aren't mid-counter. */
export async function resetForcedAdCounter(): Promise<void> {
  if (!cache.loaded) cache = await readFromStorage();
  cache = { ...cache, roundsSinceForcedAd: 0, loaded: true };
  notify();
  await persist();
}

export function getRewardedClaimsRemainingSync(): number {
  const rolled = rollRewardedDay(cache);
  if (rolled !== cache) {
    cache = { ...rolled, loaded: true };
  }
  return Math.max(0, REWARDED_AD_DAILY_CAP - cache.rewardedClaimsToday);
}

export async function getRewardedClaimsRemaining(): Promise<number> {
  if (!cache.loaded) cache = await readFromStorage();
  cache = { ...rollRewardedDay(cache), loaded: true };
  return Math.max(0, REWARDED_AD_DAILY_CAP - cache.rewardedClaimsToday);
}

export async function canClaimRewardedAd(): Promise<boolean> {
  return (await getRewardedClaimsRemaining()) > 0;
}

/** Call only after a rewarded ad completed successfully. */
export async function recordRewardedAdClaim(): Promise<void> {
  if (!cache.loaded) cache = await readFromStorage();
  cache = rollRewardedDay(cache);
  cache = {
    ...cache,
    rewardedClaimsToday: cache.rewardedClaimsToday + 1,
    loaded: true,
  };
  notify();
  await persist();
}

/** Sync cloud profile.adsRemoved → local (OR with local true so we never drop a grant). */
export async function applyCloudAdsRemoved(
  adsRemoved: boolean | undefined | null,
): Promise<void> {
  if (adsRemoved !== true) return;
  await setAdsRemovedLocal(true);
  await resetForcedAdCounter();
}

/** Pure helpers for tests. */
export function shouldShowForcedAdAfterRounds(
  roundsSinceLast: number,
  adsRemoved: boolean,
  everyN = FORCED_AD_EVERY_N_ROUNDS,
): boolean {
  if (adsRemoved) return false;
  return roundsSinceLast + 1 >= everyN;
}
