import { useEffect } from "react";
import { preloadGamePreferences } from "../../services/gamePreferences";
import { ensurePlayerStatsRestored } from "../../services/playerStats";
import { preloadAdsConsent } from "../../services/ads/adsConsent";
import { preloadAdsEntitlement } from "../../services/ads/adsEntitlement";

export const useAssetAndAdsPreload = () => {
  useEffect(() => {
    void preloadGamePreferences();
    void ensurePlayerStatsRestored();
    void preloadAdsConsent().then(async () => {
      try {
        const { getAdsConsentSync, canLoadPersonalizedAds } = await import(
          "../../services/ads/adsConsent"
        );
        if (canLoadPersonalizedAds() || getAdsConsentSync() === "accepted") {
          const { configureH5AdsSound } = await import(
            "../../services/ads/webH5Ads"
          );
          configureH5AdsSound(true);
        }
      } catch {
        /* ignore */
      }
    });
    void preloadAdsEntitlement();
    // Stripe return: refresh Remove Ads entitlement from cloud.
  }, []);
};
