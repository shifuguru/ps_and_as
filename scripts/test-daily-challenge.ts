/**
 * Pure-unit smoke for daily challenge progress math (no AsyncStorage).
 * Run: npx tsx ./scripts/test-daily-challenge.ts
 */
import assert from "assert";
import {
  dailyChallengeProgress,
  utcDayKey,
  type DailyChallengeDef,
  type DailyChallengeState,
} from "../src/services/dailyChallenge";
import type { PlayerStats } from "../src/services/playerStats";

// Avoid importing playerStats runtime (RN); build a minimal stats shape.
function stats(partial: Partial<PlayerStats>): PlayerStats {
  return {
    roundsPlayed: 0,
    timesPresident: 0,
    timesVicePresident: 0,
    timesViceAsshole: 0,
    timesAsshole: 0,
    presidentStreak: 0,
    bestPresidentStreak: 0,
    xp: 0,
    tricksWon: 0,
    ...partial,
  };
}

function run() {
  const day = utcDayKey(new Date("2026-07-15T12:00:00.000Z"));
  assert.strictEqual(day, "2026-07-15");

  const def: DailyChallengeDef = {
    id: "rounds_2",
    title: "Settle In",
    description: "Complete 2 rounds",
    rewardXp: 40,
    field: "roundsPlayed",
    delta: 2,
  };
  const state: DailyChallengeState = {
    dayKey: day,
    challengeId: def.id,
    baseline: { roundsPlayed: 5 },
    completed: false,
    rewardClaimed: false,
  };

  const mid = dailyChallengeProgress(def, state, stats({ roundsPlayed: 6 }));
  assert.strictEqual(mid.current, 1);
  assert.strictEqual(mid.target, 2);
  assert.strictEqual(mid.done, false);

  const done = dailyChallengeProgress(def, state, stats({ roundsPlayed: 7 }));
  assert.strictEqual(done.current, 2);
  assert.strictEqual(done.done, true);

  console.log("test-daily-challenge: ok");
}

run();
