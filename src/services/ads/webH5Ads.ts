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
  adsbygoogle?: unknown[];
};

/** Max wait for adBreakDone — stub never fires it. */
const AD_BREAK_TIMEOUT_MS = 12_000;
/** Poll for real H5 API to replace the adsbygoogle.push stub. */
const H5_READY_WAIT_MS = 4_000;

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
 * Official head stub is `function(o){adsbygoogle.push(o)}`.
 * Until AdSense/H5 replaces it, adBreakDone never runs → UI hangs.
 */
function isAdBreakStub(): boolean {
  try {
    const fn = (globalThis as H5Window).adBreak;
    if (typeof fn !== "function") return true;
    const src = Function.prototype.toString.call(fn);
    return /adsbygoogle\.push/i.test(src);
  } catch {
    return true;
  }
}

function h5ApiReady(): boolean {
  try {
    return (
      typeof (globalThis as H5Window).adBreak === "function" && !isAdBreakStub()
    );
  } catch {
    return false;
  }
}

function waitForH5Api(maxMs = H5_READY_WAIT_MS): Promise<boolean> {
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

/** Call once after consent — primes interstitial/reward inventory when H5 is live. */
export function configureH5AdsSound(soundOn: boolean): void {
  if (Platform.OS !== "web") return;
  try {
    const w = globalThis as H5Window;
    if (typeof w.adConfig !== "function" || isAdBreakStub()) return;
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

  const ready = await waitForH5Api();
  if (!ready) {
    // Site/H5 not serving yet — fail fast so the UI does not stick on "Loading…".
    if (typeof console !== "undefined" && console.info) {
      console.info(
        "[ads] H5 Ad Placement API still a stub — AdSense review / H5 allowlist pending?",
      );
    }
    return { shown: false, breakStatus: "h5NotReady" };
  }

  const w = globalThis as H5Window;

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
  stub: boolean;
  ready: boolean;
} {
  return {
    client: getAdsClientId(),
    stub: isAdBreakStub(),
    ready: h5ApiReady(),
  };
}

export { getAdsClientId, isAdsTestMode };
