/**
 * Pure-unit smoke for daily login claim math (no AsyncStorage).
 * Run: npx tsx ./scripts/test-daily-login.ts
 */
import assert from "assert";
import {
  DAILY_LOGIN_XP,
  resolveDailyLoginClaim,
} from "../src/services/dailyLoginReward";
import { utcDayKey } from "../src/services/dailyChallenge";

function run() {
  const day = utcDayKey(new Date("2026-07-15T12:00:00.000Z"));
  assert.strictEqual(day, "2026-07-15");

  const fresh = { dayKey: day, claimed: false };
  const claimed = resolveDailyLoginClaim(fresh, day);
  assert.strictEqual(claimed.grantedXp, DAILY_LOGIN_XP);
  assert.strictEqual(claimed.state.claimed, true);

  const again = resolveDailyLoginClaim(claimed.state, day);
  assert.strictEqual(again.grantedXp, 0);
  assert.strictEqual(again.state, claimed.state);

  const stale = resolveDailyLoginClaim(
    { dayKey: "2026-07-14", claimed: true },
    day,
  );
  assert.strictEqual(stale.grantedXp, 0);
  assert.strictEqual(stale.state.dayKey, day);
  assert.strictEqual(stale.state.claimed, false);

  console.log("test-daily-login: ok");
}

run();
