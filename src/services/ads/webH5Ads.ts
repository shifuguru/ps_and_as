/**
 * Google H5 Games Ad Placement API (web).
 * Loader + adBreak/adConfig stubs are injected into index.html at build time
 * (see scripts/fix-web-build-paths.js).
 *
 * Rewarded ads use beforeReward(showAdFn) — not a plain interstitial.
 * @see https://developers.google.com/ad-placement/docs/example
 */

import { Platform } from "react-native";
import { isAdsTestModeEnv } from "./adsConfig";
import {
  isAdsPlaceholderMode,
  showWebAdPlaceholder,
} from "./adsPlaceholderWeb";
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

type H5Window = {
  adBreak?: (placement: AdBreakPlacement) => void;
  adConfig?: (config: Record<string, unknown>) => void;
  __PS_AND_AS_ADSENSE_CLIENT__?: string;
  adsbygoogle?: { push: (...args: unknown[]) => unknown } & unknown[];
};

/** Fail fast — empty inventory / stub queue must not stick the UI on Loading. */
const AD_BREAK_TIMEOUT_MS = 5_000;
const ADS_LIBRARY_WAIT_MS = 2_500;

/** Only one adBreak at a time (Google rejects overlapping calls). */
let breakInFlight: Promise<AdBreakResult> | null = null;

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
  return isAdsTestModeEnv();
}

/**
 * Official init is always `adBreak = function(o){ adsbygoogle.push(o) }`.
 * Google replaces `adsbygoogle.push` once adsbygoogle.js loads.
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
      setTimeout(tick, 100);
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
  let viewed = false;
  if (isAdsPlaceholderMode()) {
    viewed = await showWebAdPlaceholder(type === "browse" ? "next" : type);
  } else {
    await new Promise((r) => setTimeout(r, type === "reward" ? 900 : 600));
    viewed = true;
  }
  releaseAdsAudio();
  if (typeof console !== "undefined" && console.info) {
    console.info(`[ads] simulated ${type} break: ${name}`, { viewed });
  }
  if (!viewed) {
    return { shown: false, breakStatus: "dismissed", simulated: true };
  }
  return {
    shown: true,
    breakStatus: type === "reward" ? "rewarded" : "simulated",
    simulated: true,
  };
}

async function runAdBreak(
  type: AdBreakType,
  name: string,
): Promise<AdBreakResult> {
  const w = globalThis as H5Window;
  if (typeof w.adBreak !== "function") {
    return { shown: false, breakStatus: "notReady" };
  }

  const libraryReady = await waitForAdsLibrary();
  if (!libraryReady) {
    if (typeof console !== "undefined" && console.info) {
      console.info(
        "[ads] adsbygoogle.js not active — blocker, network, or H5 not serving",
      );
    }
    return { shown: false, breakStatus: "h5NotReady" };
  }

  configureH5AdsSound(true);

  return new Promise((resolve) => {
    let settled = false;
    let rewardedViewed = false;
    const finish = (result: AdBreakResult) => {
      if (settled) return;
      settled = true;
      releaseAdsAudio();
      if (typeof console !== "undefined" && console.info) {
        console.info(`[ads] ${type}/${name} → ${result.breakStatus}`, result);
      }
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
  if (!client || isAdsTestMode() || isAdsPlaceholderMode()) {
    return simulateBreak(type, name);
  }

  // Serialize — overlapping adBreak calls are rejected by Google.
  if (breakInFlight) {
    if (type === "reward") {
      // Wait briefly for the in-flight break (often a silent forced interstitial).
      try {
        await Promise.race([
          breakInFlight,
          new Promise((r) => setTimeout(r, 1_500)),
        ]);
      } catch {
        // ignore
      }
    } else {
      return { shown: false, breakStatus: "busy" };
    }
  }

  const run = runAdBreak(type, name);
  breakInFlight = run;
  void run.finally(() => {
    if (breakInFlight === run) breakInFlight = null;
  });
  return run;
}

export function isH5AdsConfigured(): boolean {
  return Platform.OS === "web" && !!getAdsClientId();
}

export function getH5AdsDiagnostics(): {
  client: string | null;
  libraryLoaded: boolean;
  ready: boolean;
  breakBusy: boolean;
} {
  return {
    client: getAdsClientId(),
    libraryLoaded: isAdsByGoogleLibraryLoaded(),
    ready: h5ApiReady(),
    breakBusy: breakInFlight != null,
  };
}

export { getAdsClientId, isAdsTestMode, isAdsPlaceholderMode };
