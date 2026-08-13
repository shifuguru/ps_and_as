/**
 * Ad monetization constants (web H5 first; native AdMob later).
 * Forced interstitials every N rounds; rewarded XP is opt-in.
 */

/** Forced interstitial cadence (completed rounds since last forced ad). */
export const FORCED_AD_EVERY_N_ROUNDS = 3;

/** XP granted after a successful rewarded ad. */
export const REWARDED_AD_XP = 75;

/** Max successful rewarded claims per UTC calendar day. */
export const REWARDED_AD_DAILY_CAP = 3;

/** Hide Stripe Remove Ads checkout until billing link is fixed. Ko-fi stays on Player Hub. */
export const SHOW_REMOVE_ADS_PURCHASE = false;

/** Remove Ads one-time price shown in UI (NZD). */
export const REMOVE_ADS_PRICE_NZD = 19;

/** Stripe Price id env is server-side; client only needs the label. */
export const REMOVE_ADS_PRODUCT_LABEL = "Remove forced ads";

/** Build-time: force simulated / placeholder ads (no live AdSense calls). */
export function isAdsTestModeEnv(): boolean {
  const flag = process.env.EXPO_PUBLIC_ADS_TEST?.trim();
  return flag === "1" || flag === "true";
}

/** Build-time: visible placeholder UI instead of live AdSense (pre-approval QA). */
export function isAdsPlaceholderEnv(): boolean {
  const flag = process.env.EXPO_PUBLIC_ADS_PLACEHOLDER?.trim();
  return flag === "1" || flag === "true";
}

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
