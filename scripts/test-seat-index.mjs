/**
 * Offline unit checks for seat-index remapping after mid-round removal.
 *   node scripts/test-seat-index.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { adjustSeatIndexAfterRemoval } = require("../server/seatIndex.js");

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

console.log("PASS seat-index remapping");
