/**
 * Unit tests for display-only XP → level curve.
 * Run: npx tsx ./scripts/test-player-level.ts
 */
import assert from "assert";
import {
  levelFromXp,
  levelProgressFromXp,
  totalXpToReachLevel,
  xpIntoLevel,
  xpRequiredForLevel,
  xpToNextLevel,
} from "../src/services/playerLevel";

function run() {
  assert.strictEqual(xpRequiredForLevel(1), 100);
  assert.strictEqual(xpRequiredForLevel(2), 150);
  assert.strictEqual(totalXpToReachLevel(1), 0);
  assert.strictEqual(totalXpToReachLevel(2), 100);
  assert.strictEqual(totalXpToReachLevel(3), 250);

  assert.strictEqual(levelFromXp(0), 1);
  assert.strictEqual(levelFromXp(99), 1);
  assert.strictEqual(levelFromXp(100), 2);
  assert.strictEqual(levelFromXp(249), 2);
  assert.strictEqual(levelFromXp(250), 3);

  const mid = levelProgressFromXp(50);
  assert.strictEqual(mid.level, 1);
  assert.strictEqual(mid.xpIntoLevel, 50);
  assert.strictEqual(mid.xpForLevel, 100);
  assert.strictEqual(mid.xpToNext, 50);
  assert.ok(Math.abs(mid.fraction - 0.5) < 1e-9);
  assert.strictEqual(xpIntoLevel(50), 50);
  assert.strictEqual(xpToNextLevel(50), 50);

  const exact = levelProgressFromXp(100);
  assert.strictEqual(exact.level, 2);
  assert.strictEqual(exact.xpIntoLevel, 0);

  console.log("test-player-level: ok");
}

run();
