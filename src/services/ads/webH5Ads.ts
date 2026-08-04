/**
 * Google H5 Games Ad Placement API (web).
 * @see https://developers.google.com/ad-placement/docs/example
 */

import { Platform } from "react-native";
import { canLoadPersonalizedAds } from "./adsConsent";
import { releaseAdsAudio, suppressAdsAudio } from "./adsAudioBridge";

export type AdBreakType = "next" | "reward" | "browse";

export type AdBreakResult = {
  shown: boolean;
  /** H5 breakStatus when available. */
  breakStatus?: string;
  simulated?: boolean;
};

type AdBreakPlacement = {
  type: AdBreakType;
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  adBreakDone?: (info: { breakStatus?: string }) => void;
};

type H5Window = Window & {
  adBreak?: (placement: AdBreakPlacement) => void;
  adConfig?: (config: Record<string, unknown>) => void;
  __PS_AND_AS_ADSENSE_CLIENT__?: string;
  adsbygoogle?: unknown[];
};

function getAdsClientId(): string | null {
  if (Platform.OS !== "web") return null;
  try {
    const fromWindow = (globalThis as H5Window).__PS_AND_AS_ADSENSE_CLIENT__;
    if (typeof fromWindow === "string" && fromWindow.trim()) {
      return fromWindow.trim();
    }
  } catch {
    // ignore
  }
  const fromEnv = process.env.EXPO_PUBLIC_ADSENSE_CLIENT?.trim();
  return fromEnv || null;
}

function isAdsTestMode(): boolean {
  const flag = process.env.EXPO_PUBLIC_ADS_TEST?.trim();
  if (flag === "1" || flag === "true") return true;
  // No publisher id → simulate so UI flows can be tested locally.
  return !getAdsClientId();
}

let scriptLoading: Promise<boolean> | null = null;
let scriptReady = false;

function ensureAdSenseScript(): Promise<boolean> {
  if (Platform.OS !== "web") return Promise.resolve(false);
  if (!canLoadPersonalizedAds()) return Promise.resolve(false);
  if (scriptReady) return Promise.resolve(true);
  if (scriptLoading) return scriptLoading;

  const client = getAdsClientId();
  if (!client) {
    scriptReady = false;
    return Promise.resolve(false);
  }

  scriptLoading = new Promise((resolve) => {
    try {
      const w = globalThis as H5Window;
      if (typeof w.adBreak === "function") {
        scriptReady = true;
        resolve(true);
        return;
      }
      const doc = globalThis.document;
      if (!doc) {
        resolve(false);
        return;
      }
      const existing = doc.querySelector('script[data-ps-adsense="1"]');
      if (existing) {
        scriptReady = typeof w.adBreak === "function";
        resolve(scriptReady);
        return;
      }
      const s = doc.createElement("script");
      s.async = true;
      s.dataset.psAdsense = "1";
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      s.crossOrigin = "anonymous";
      const init = doc.createElement("script");
      init.dataset.psAdsenseInit = "1";
      init.text = `
        window.adsbygoogle = window.adsbygoogle || [];
        var adBreak = adConfig = function(){};
        (adsbygoogle=window.adsbygoogle||[]).push({
          google_ad_client: ${JSON.stringify(client)},
          enable_page_level_ads: true,
          overlays: {bottom: true}
        });
      `;
      // H5 Games snippet: load API then init adBreak/adConfig from adsbygoogle channel.
      // Official pattern uses data-ad-frequency-hint on the adsbygoogle.js tag.
      s.setAttribute("data-ad-client", client);
      s.setAttribute("data-ad-frequency-hint", "120s");
      if (isAdsTestMode() || process.env.EXPO_PUBLIC_ADS_TEST === "1") {
        s.setAttribute("data-ad-channel", "H5_Games");
        s.setAttribute("data-ad-test", "on");
      }
      s.onload = () => {
        try {
          // Ad Placement API attaches adBreak after the channel loads.
          const channel = doc.createElement("script");
          channel.text = `
            window.adConfig = window.adConfig || function(o){};
            window.adBreak = window.adBreak || function(o){ if(o&&o.adBreakDone) o.adBreakDone({breakStatus:'notReady'}); };
          `;
          doc.head.appendChild(channel);
          // Prefer official afs/ads loader when available via adsbygoogle push.
          (w.adsbygoogle = w.adsbygoogle || []).push({});
        } catch {
          // ignore
        }
        scriptReady = true;
        resolve(true);
      };
      s.onerror = () => {
        scriptReady = false;
        resolve(false);
      };
      doc.head.appendChild(init);
      doc.head.appendChild(s);
    } catch {
      resolve(false);
    }
  });

  return scriptLoading;
}

async function simulateBreak(
  type: AdBreakType,
  name: string,
): Promise<AdBreakResult> {
  suppressAdsAudio();
  await new Promise((r) => setTimeout(r, type === "reward" ? 900 : 600));
  releaseAdsAudio();
  if (typeof console !== "undefined" && console.info) {
    console.info(`[ads] simulated ${type} break: ${name}`);
  }
  return { shown: true, breakStatus: "simulated", simulated: true };
}

export async function showH5AdBreak(
  type: AdBreakType,
  name: string,
): Promise<AdBreakResult> {
  if (Platform.OS !== "web") {
    return { shown: false, breakStatus: "unsupported" };
  }
  if (!canLoadPersonalizedAds()) {
    return { shown: false, breakStatus: "noConsent" };
  }

  const ready = await ensureAdSenseScript();
  const w = globalThis as H5Window;

  if (!ready || typeof w.adBreak !== "function" || isAdsTestMode()) {
    // Dev / missing publisher: simulate so rewarded XP + cadence can be tested.
    if (isAdsTestMode() || !getAdsClientId()) {
      return simulateBreak(type, name);
    }
    return { shown: false, breakStatus: "notReady" };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: AdBreakResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      w.adBreak!({
        type,
        name,
        beforeAd: () => {
          suppressAdsAudio();
        },
        afterAd: () => {
          releaseAdsAudio();
        },
        adBreakDone: (info) => {
          releaseAdsAudio();
          const status = info?.breakStatus || "done";
          if (type === "reward") {
            const ok =
              status === "viewed" ||
              status === "rewarded" ||
              status === "dismissed";
            finish({ shown: ok, breakStatus: status });
          } else {
            const shown =
              status === "viewed" ||
              status === "dismissed" ||
              status === "simulated";
            finish({ shown, breakStatus: status });
          }
        },
      });
      // Safety timeout if adBreakNever calls back
      setTimeout(() => {
        releaseAdsAudio();
        finish({ shown: false, breakStatus: "timeout" });
      }, 120_000);
    } catch {
      releaseAdsAudio();
      finish({ shown: false, breakStatus: "error" });
    }
  });
}

export function isH5AdsConfigured(): boolean {
  return Platform.OS === "web" && !!getAdsClientId();
}

export { getAdsClientId, isAdsTestMode };
