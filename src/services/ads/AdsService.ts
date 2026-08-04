/**
 * AdsService — web H5 now; native AdMob stub later.
 */

import { Platform } from "react-native";
import { REWARDED_AD_XP } from "./adsConfig";
import {
  areForcedAdsRemoved,
  canClaimRewardedAd,
  getRewardedClaimsRemaining,
  noteRoundCompleteForForcedAd,
  recordRewardedAdClaim,
} from "./adsEntitlement";
import { canLoadPersonalizedAds } from "./adsConsent";
import { showH5AdBreak, type AdBreakResult } from "./webH5Ads";

export type ForcedAdAttempt = {
  attempted: boolean;
  result: AdBreakResult | null;
};

export type RewardedAdAttempt = {
  ok: boolean;
  xpGranted: number;
  reason?: string;
  result?: AdBreakResult;
};

/**
 * Call when rankings overlay opens after a completed round.
 * Increments cadence; shows interstitial every N rounds unless Remove Ads.
 */
export async function maybeShowForcedInterstitialOnRankings(): Promise<ForcedAdAttempt> {
  if (Platform.OS !== "web") {
    return { attempted: false, result: null };
  }
  const removed = await areForcedAdsRemoved();
  if (removed) return { attempted: false, result: null };

  const shouldShow = await noteRoundCompleteForForcedAd();
  if (!shouldShow) return { attempted: false, result: null };

  if (!canLoadPersonalizedAds()) {
    return {
      attempted: true,
      result: { shown: false, breakStatus: "noConsent" },
    };
  }

  const result = await showH5AdBreak("next", "round_complete");
  return { attempted: true, result };
}

/**
 * Opt-in rewarded ad. Remove Ads does not block this.
 * Caller grants XP via commitRoundXpEarned when ok && xpGranted > 0.
 */
export async function showRewardedAdForXp(): Promise<RewardedAdAttempt> {
  if (Platform.OS !== "web") {
    return { ok: false, xpGranted: 0, reason: "unsupported" };
  }
  if (!canLoadPersonalizedAds()) {
    return { ok: false, xpGranted: 0, reason: "noConsent" };
  }
  if (!(await canClaimRewardedAd())) {
    return { ok: false, xpGranted: 0, reason: "dailyCap" };
  }

  const result = await showH5AdBreak("reward", "rankings_xp_boost");
  const status = result.breakStatus || "";
  const success =
    result.shown ||
    result.simulated === true ||
    status === "viewed" ||
    status === "rewarded" ||
    status === "simulated";

  if (!success) {
    return {
      ok: false,
      xpGranted: 0,
      reason: status || "notShown",
      result,
    };
  }

  await recordRewardedAdClaim();
  return { ok: true, xpGranted: REWARDED_AD_XP, result };
}

/** Player-facing copy when a rewarded break fails. */
export function rewardedAdFailureMessage(reason?: string): string {
  switch (reason) {
    case "h5NotReady":
    case "timeout":
    case "notReady":
      return "Ads are not available yet. AdSense may still be under review, or H5 game ads are not enabled on this account.";
    case "noConsent":
      return "Accept ads in the consent banner to unlock watch-for-XP.";
    case "dailyCap":
      return "Daily watch-for-XP limit reached. Come back tomorrow.";
    case "frequencyCapped":
    case "noAdPreloaded":
    case "other":
      return "No ad ready right now. Try again in a bit.";
    default:
      return "Could not show an ad. Try again later.";
  }
}

export async function getRewardedAdUiState(): Promise<{
  remaining: number;
  xp: number;
  available: boolean;
}> {
  const remaining = await getRewardedClaimsRemaining();
  return {
    remaining,
    xp: REWARDED_AD_XP,
    available:
      remaining > 0 && Platform.OS === "web" && canLoadPersonalizedAds(),
  };
}

export { REWARDED_AD_XP };
