/**
 * Google H5 Games Ad Placement API (web).
 * Loader + adBreak/adConfig stubs are injected into index.html at build time
 * (see scripts/fix-web-build-paths.js).
 *
 * Rewarded ads use beforeReward(showAdFn) — not a plain interstitial.
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
  beforeReward?: (showAdFn: () => void) => void;
  adViewed?: () => void;
  adDismissed?: () => void;
  adBreakDone?: (info: { breakStatus?: string }) => void;
};

type H5Window = Window & {
  adBreak?: (placement: AdBreakPlacement) => void;
  adConfig?: (config: Record<string, unknown>) => void;
  __PS_AND_AS_ADSENSE_CLIENT__?: string;
  adsbygoogle?: { push: (...args: unknown[]) => unknown } & unknown[];
};

/** Max wait for adBreakDone when inventory / network is slow. */
const AD_BREAK_TIMEOUT_MS = 12_000;
/** Wait for adsbygoogle.js to replace Array.push on the queue. */
const ADS_LIBRARY_WAIT_MS = 6_000;

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

/**
 * Official init is always `adBreak = function(o){ adsbygoogle.push(o) }`.
 * Google does **not** replace that wrapper — it replaces `adsbygoogle.push`
 * once adsbygoogle.js loads. Treat native Array.push as "library not loaded".
 */
export function isAdsByGoogleLibraryLoaded(
  adsbygoogle: H5Window["adsbygoogle"] | undefined = (globalThis as H5Window)
    .adsbygoogle,
): boolean {
  try {
    if (!adsbygoogle || typeof adsbygoogle.push !== "function") return false;
    const src = Function.prototype.toString.call(adsbygoogle.push);
    return !/\[native code\]/i.test(src);
  } catch {
    return false;
  }
}

function h5ApiReady(): boolean {
  try {
    const w = globalThis as H5Window;
    return typeof w.adBreak === "function" && isAdsByGoogleLibraryLoaded(w.adsbygoogle);
  } catch {
    return false;
  }
}

function waitForAdsLibrary(maxMs = ADS_LIBRARY_WAIT_MS): Promise<boolean> {
  if (h5ApiReady()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (h5ApiReady()) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= maxMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

/** Call once after consent — primes interstitial/reward inventory. */
export function configureH5AdsSound(soundOn: boolean): void {
  if (Platform.OS !== "web") return;
  try {
    const w = globalThis as H5Window;
    if (typeof w.adConfig !== "function") return;
    // Official adConfig is also adsbygoogle.push — always safe to call.
    w.adConfig({
      sound: soundOn ? "on" : "off",
      preloadAdBreaks: "on",
    });
  } catch {
    // ignore
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
  if (!client || isAdsTestMode()) {
    return simulateBreak(type, name);
  }

  const w = globalThis as H5Window;
  if (typeof w.adBreak !== "function") {
    return { shown: false, breakStatus: "notReady" };
  }

  const libraryReady = await waitForAdsLibrary();
  if (!libraryReady) {
    if (typeof console !== "undefined" && console.info) {
      console.info(
        "[ads] adsbygoogle.js has not taken over the queue yet — check network / ad blockers",
      );
    }
    // Still attempt the break — push queues until the library loads.
  } else {
    // Re-assert preload once the library is live.
    configureH5AdsSound(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    let rewardedViewed = false;
    const finish = (result: AdBreakResult) => {
      if (settled) return;
      settled = true;
      releaseAdsAudio();
      resolve(result);
    };
    const timer = setTimeout(() => {
      finish({ shown: false, breakStatus: "timeout" });
    }, AD_BREAK_TIMEOUT_MS);

    try {
      const placement: AdBreakPlacement = {
        type,
        name,
        beforeAd: () => {
          suppressAdsAudio();
        },
        afterAd: () => {
          releaseAdsAudio();
        },
        adBreakDone: (info) => {
          clearTimeout(timer);
          const status = info?.breakStatus || "done";
          if (type === "reward") {
            finish({
              shown: rewardedViewed,
              breakStatus: rewardedViewed ? "rewarded" : status,
            });
          } else {
            const shown =
              status === "viewed" ||
              status === "dismissed" ||
              status === "simulated";
            finish({ shown, breakStatus: status });
          }
        },
      };

      if (type === "reward") {
        // User already tapped "Watch ad" — show immediately when inventory exists.
        placement.beforeReward = (showAdFn) => {
          try {
            showAdFn();
          } catch {
            // ignore
          }
        };
        placement.adViewed = () => {
          rewardedViewed = true;
        };
        placement.adDismissed = () => {
          rewardedViewed = false;
        };
      }

      w.adBreak!(placement);
    } catch {
      clearTimeout(timer);
      finish({ shown: false, breakStatus: "error" });
    }
  });
}

export function isH5AdsConfigured(): boolean {
  return Platform.OS === "web" && !!getAdsClientId();
}

export function getH5AdsDiagnostics(): {
  client: string | null;
  libraryLoaded: boolean;
  ready: boolean;
} {
  return {
    client: getAdsClientId(),
    libraryLoaded: isAdsByGoogleLibraryLoaded(),
    ready: h5ApiReady(),
  };
}

export { getAdsClientId, isAdsTestMode };
