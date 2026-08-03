/**
 * Core regression: while tenRulePending, playCards must no-op so Higher/Lower
 * cannot be skipped (which also leaves the next seat unable to pass).
 *
 *   node scripts/test-ten-rule-pending-play.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { playCards, passTurn, setTenRuleDirection } = require("../server/gameBridge.js");

function mk(hand) {
  return hand.map(([s, v]) => ({ suit: s, value: v }));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let state = {
  players: [
    {
      id: "a",
      name: "A",
      hand: mk([
        ["h", 3],
        ["d", 3],
        ["h", 10],
        ["d", 10],
        ["c", 11],
        ["s", 11],
        ["h", 12],
        ["d", 7],
      ]),
    },
    {
      id: "b",
      name: "B",
      hand: mk([
        ["c", 4],
        ["s", 4],
        ["h", 5],
        ["d", 5],
        ["c", 6],
        ["s", 8],
        ["h", 9],
        ["d", 12],
      ]),
    },
  ],
  currentPlayerIndex: 0,
  pile: [],
  pileHistory: [],
  pileOwners: [],
  finishedOrder: [],
  lastRoundOrder: [],
  trickHistory: [],
  currentTrick: null,
  tenRule: { active: false, direction: null },
  tenRulePending: false,
  mustPlay: true,
  passCount: 0,
};

state = playCards(
  state,
  "a",
  state.players[0].hand.filter((c) => c.value === 3),
);
state = playCards(
  state,
  "b",
  state.players[1].hand.filter((c) => c.value === 4),
);
state = playCards(
  state,
  "a",
  state.players[0].hand.filter((c) => c.value === 10),
);
assert(state.tenRulePending === true, "expected tenRulePending after undirected 10s");

const before = state;
const jacks = state.players[0].hand.filter((c) => c.value === 11);
state = playCards(state, "a", jacks);
assert(state === before, "play while tenRulePending must be rejected");
assert(state.tenRulePending === true, "pending must remain until direction chosen");
assert(
  state.pile.every((c) => c.value === 10),
  "pile must still be the 10s",
);

const passBefore = state;
const afterPass = passTurn(state, "b");
assert(afterPass === passBefore, "pass while pending must still be blocked");

state = setTenRuleDirection(state, "higher");
assert(state.tenRulePending === false, "direction clears pending");
assert(state.tenRule?.direction === "higher", "direction committed");

console.log("PASS ten-rule pending play rejected");
