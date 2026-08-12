/**
 * Regression: dealerReshuffle must only run in the pre-play deal window.
 * After any play, needsRoundOneDealerReshuffle can flip true (opening 3 left
 * living hands) and would wipe an in-progress round without this guard.
 *
 *   node scripts/test-dealer-reshuffle-preplay-window.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isPrePlayDealWindow } = require("../server/dealWindow.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const freshDeal = {
  pile: [],
  pileHistory: [],
  trickHistory: [],
  currentTrick: null,
  finishedOrder: [],
  tenRulePending: false,
};
assert(isPrePlayDealWindow(freshDeal) === true, "fresh deal is pre-play");

assert(
  isPrePlayDealWindow({
    ...freshDeal,
    pile: [{ suit: "clubs", value: 3 }],
  }) === false,
  "pile means play started",
);

assert(
  isPrePlayDealWindow({
    ...freshDeal,
    currentTrick: {
      actions: [{ type: "play", playerId: "a", cards: [{ suit: "s", value: 3 }] }],
    },
  }) === false,
  "currentTrick action means play started",
);

assert(
  isPrePlayDealWindow({
    ...freshDeal,
    trickHistory: [{ actions: [], winnerId: "a" }],
  }) === false,
  "trickHistory means play started",
);

assert(
  isPrePlayDealWindow({
    ...freshDeal,
    finishedOrder: ["a"],
  }) === false,
  "finishedOrder means play started",
);

assert(
  isPrePlayDealWindow({
    ...freshDeal,
    tenRulePending: true,
  }) === false,
  "tenRulePending is not pre-play deal window",
);

assert(isPrePlayDealWindow(null) === false, "null state rejected");

// Document why the guard matters: after the opening 3 leaves living hands,
// needsRoundOneDealerReshuffle can flip true mid-round (dead-hand 3♣ case).
function isDeadHand(p) {
  return !!p.isDeadHand || p.id === "__dead_hand__";
}
function deadHandHoldsThreeClubs(players) {
  const dead = players.find(isDeadHand);
  if (!dead) return false;
  return [...(dead.hand || []), ...(dead.sidelinedHand || [])].some(
    (c) => c.value === 3 && c.suit === "clubs",
  );
}
function resolveFirst(players) {
  const living = players.filter((p) => !isDeadHand(p));
  const deadHas = deadHandHoldsThreeClubs(players);
  const find = (pred) => {
    for (const p of living) {
      if (p.hand.some(pred)) return players.indexOf(p);
    }
    return -1;
  };
  if (deadHas) {
    const i = find((c) => c.value === 3 && c.suit === "spades");
    if (i >= 0) return i;
  } else {
    const i = find((c) => c.value === 3 && c.suit === "clubs");
    if (i >= 0) return i;
  }
  return find((c) => c.value === 3);
}
function needsReshuffle(players) {
  if (!players.some(isDeadHand)) return false;
  return resolveFirst(players) < 0;
}

const before = [
  { id: "a", hand: [{ suit: "spades", value: 3 }, { suit: "hearts", value: 5 }] },
  { id: "b", hand: [{ suit: "hearts", value: 7 }, { suit: "diamonds", value: 8 }] },
  {
    id: "__dead_hand__",
    isDeadHand: true,
    hand: [],
    sidelinedHand: [
      { suit: "clubs", value: 3 },
      { suit: "diamonds", value: 3 },
    ],
  },
];
const after = JSON.parse(JSON.stringify(before));
after[0].hand = after[0].hand.filter(
  (c) => !(c.value === 3 && c.suit === "spades"),
);
assert(needsReshuffle(before) === false, "valid deal before open");
assert(
  needsReshuffle(after) === true,
  "needsRoundOneDealerReshuffle flips after opening 3 left living hands",
);
assert(
  isPrePlayDealWindow({
    ...freshDeal,
    pile: [{ suit: "spades", value: 3 }],
  }) === false,
  "guard blocks reshuffle once pile has the opening play",
);

console.log("PASS dealer-reshuffle pre-play window guard");
