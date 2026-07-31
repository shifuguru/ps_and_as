/**
 * Offline unit checks for seat-index remapping after mid-round removal.
 *   node scripts/test-seat-index.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  adjustSeatIndexAfterRemoval,
  lastPlayIndexAfterRemoval,
} = require("../server/seatIndex.js");

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

assertEq(adjustSeatIndexAfterRemoval(2, 0), 1, "decrement after lower removal");
assertEq(adjustSeatIndexAfterRemoval(1, 2), 1, "unchanged when removal is higher");
assertEq(adjustSeatIndexAfterRemoval(1, 1), null, "removed seat clears index");
assertEq(adjustSeatIndexAfterRemoval(null, 1), null, "null stays null");
assertEq(adjustSeatIndexAfterRemoval(-1, 1), -1, "negative sentinel preserved");

// Non-leader removal: remap numeric index (Human@0 leaves, Bot1 was leader@1 → 0)
{
  const gs = {
    lastPlayPlayerIndex: 1,
    players: [
      { id: "bot1" },
      { id: "bot2" },
    ],
    currentTrick: {
      actions: [
        { type: "play", playerId: "bot1" },
      ],
    },
  };
  assertEq(
    lastPlayIndexAfterRemoval(gs, 0, false),
    0,
    "non-leader removal remaps leader index",
  );
}

// Leader removal with prior living play: do NOT alias index 0 to the next seat
{
  const gs = {
    lastPlayPlayerIndex: 1, // stale: pointed at removed human before splice
    players: [
      { id: "bot0" },
      { id: "bot2" },
    ],
    currentTrick: {
      actions: [
        { type: "play", playerId: "bot0" },
        { type: "play", playerId: "human" },
      ],
    },
  };
  assertEq(
    lastPlayIndexAfterRemoval(gs, 1, true),
    0,
    "leader removal falls back to prior living play",
  );
}

// Leader was sole play: clear leader rather than steal seat 0
{
  const gs = {
    lastPlayPlayerIndex: 0,
    players: [
      { id: "bot1" },
      { id: "bot2" },
    ],
    currentTrick: {
      actions: [
        { type: "play", playerId: "human" },
        { type: "pass", playerId: "bot1" },
      ],
    },
  };
  assertEq(
    lastPlayIndexAfterRemoval(gs, 0, true),
    null,
    "sole-leader removal clears lastPlay (no stolen seat)",
  );
}

console.log("PASS seat-index remapping");
