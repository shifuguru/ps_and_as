/**
 * Google H5 Games Ad Placement API (web).
 * Loader + adBreak/adConfig stubs are injected into index.html at build time
 * (see scripts/fix-web-build-paths.js). This module only requests breaks.
 *
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
  return flag === "1" || flag === "true";
}

/** True when head inject (or runtime) exposed adBreak. */
function h5ApiReady(): boolean {
  try {
    return typeof (globalThis as H5Window).adBreak === "function";
  } catch {
    return false;
  }
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

  const client = getAdsClientId();
  // Local / missing publisher: simulate so UI + XP can be tested.
  if (!client || isAdsTestMode()) {
    return simulateBreak(type, name);
  }

  const w = globalThis as H5Window;
  if (!h5ApiReady()) {
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
