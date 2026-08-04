/**
 * Unit tests for forced-ad cadence + rewarded daily helpers.
 * Run: npx tsx ./scripts/test-ads-entitlement.ts
 */
import assert from "assert";
import { shouldShowForcedAdAfterRounds } from "../src/services/ads/adsEntitlement";
import {
  FORCED_AD_EVERY_N_ROUNDS,
  REWARDED_AD_DAILY_CAP,
  REWARDED_AD_XP,
} from "../src/services/ads/adsConfig";

assert.strictEqual(FORCED_AD_EVERY_N_ROUNDS, 3);
assert.strictEqual(REWARDED_AD_XP, 75);
assert.strictEqual(REWARDED_AD_DAILY_CAP, 3);

assert.strictEqual(shouldShowForcedAdAfterRounds(0, false), false);
assert.strictEqual(shouldShowForcedAdAfterRounds(1, false), false);
assert.strictEqual(shouldShowForcedAdAfterRounds(2, false), true);
assert.strictEqual(shouldShowForcedAdAfterRounds(2, true), false);
assert.strictEqual(shouldShowForcedAdAfterRounds(99, true), false);

console.log("test-ads-entitlement: ok");
