/**
 * adsbygoogle.js readiness: Google keeps adBreak as adsbygoogle.push forever.
 * Ready = push is no longer native Array.push.
 * Run: npx tsx ./scripts/test-ads-h5-stub.ts
 */
import assert from "assert";

/** Mirror of isAdsByGoogleLibraryLoaded in src/services/ads/webH5Ads.ts */
function isAdsByGoogleLibraryLoaded(
  adsbygoogle: { push: (...args: unknown[]) => unknown } | undefined,
): boolean {
  try {
    if (!adsbygoogle || typeof adsbygoogle.push !== "function") return false;
    const src = Function.prototype.toString.call(adsbygoogle.push);
    return !/\[native code\]/i.test(src);
  } catch {
    return false;
  }
}

const nativeQueue: unknown[] = [];
assert.strictEqual(
  isAdsByGoogleLibraryLoaded(nativeQueue as { push: (...args: unknown[]) => unknown }),
  false,
  "plain array still uses native push",
);

const googleQueue = {
  push(..._args: unknown[]) {
    return 1;
  },
};
assert.strictEqual(
  isAdsByGoogleLibraryLoaded(googleQueue),
  true,
  "replaced push means library loaded",
);

assert.strictEqual(isAdsByGoogleLibraryLoaded(undefined), false);

console.log("test-ads-h5-stub: ok");
