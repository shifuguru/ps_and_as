/**
 * Pure-unit smoke for daily challenge progress + claim math (no AsyncStorage).
 * Run: npx tsx ./scripts/test-daily-challenge.ts
 */
import assert from "assert";
import {
  dailyChallengeProgress,
  resolveDailyChallengeClaim,
  resolveDailyChallengeCompletion,
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

  const doneStats = stats({ roundsPlayed: 7 });
  const done = dailyChallengeProgress(def, state, doneStats);
  assert.strictEqual(done.current, 2);
  assert.strictEqual(done.done, true);

  // Hub load: mark complete without claiming XP.
  const marked = resolveDailyChallengeCompletion(def, state, doneStats);
  assert.strictEqual(marked.completed, true);
  assert.strictEqual(marked.rewardClaimed, false);

  // Idempotent mark when already completed.
  const markedAgain = resolveDailyChallengeCompletion(def, marked, doneStats);
  assert.strictEqual(markedAgain, marked);

  // Tap to claim grants XP once.
  const claimed = resolveDailyChallengeClaim(def, marked, doneStats);
  assert.strictEqual(claimed.grantedXp, 40);
  assert.strictEqual(claimed.state.completed, true);
  assert.strictEqual(claimed.state.rewardClaimed, true);

  // Second claim is a no-op (no double XP). Hub hides the card once claimed.
  const claimedAgain = resolveDailyChallengeClaim(def, claimed.state, doneStats);
  assert.strictEqual(claimedAgain.grantedXp, 0);
  assert.strictEqual(claimedAgain.state, claimed.state);
  assert.strictEqual(claimedAgain.state.rewardClaimed, true);

  // Incomplete challenge cannot be claimed.
  const early = resolveDailyChallengeClaim(
    def,
    state,
    stats({ roundsPlayed: 6 }),
  );
  assert.strictEqual(early.grantedXp, 0);
  assert.strictEqual(early.state.rewardClaimed, false);

  console.log("test-daily-challenge: ok");
}

run();
