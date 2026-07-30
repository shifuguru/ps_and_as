import {
  playCards,
  wouldActivateTenRule,
  resolveRunContext,
  isValidPlay,
  resolveEffectiveTenRule,
} from "../src/game/core.ts";

const C = (value, suit = "hearts") => ({ value, suit });

function base() {
  return {
    id: "t",
    players: [
      { id: "p1", name: "H", hand: [C(8), C(10, "spades"), C(3, "clubs")], role: "Neutral" },
      { id: "p2", name: "C", hand: [C(9), C(8, "diamonds"), C(11)], role: "Neutral" },
      { id: "p3", name: "C2", hand: [C(10), C(7), C(12)], role: "Neutral" },
      { id: "p4", name: "C3", hand: [C(6), C(5), C(13)], role: "Neutral" },
    ],
    currentPlayerIndex: 0,
    pile: [],
    pileHistory: [],
    pileOwners: [],
    passCount: 0,
    finishedOrder: [],
    started: true,
    mustPlay: true,
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [] },
    lastRoundOrder: ["p1", "p2", "p3", "p4"],
  };
}

let s = base();
s = playCards(s, "p1", [C(8)]);
s.currentPlayerIndex = 1;
s = playCards(s, "p2", [C(9)]);
s.currentPlayerIndex = 0;
const ten = [C(10, "spades")];
const would = wouldActivateTenRule(s, "p1", ten);
const ctx = resolveRunContext(
  s.pile,
  s.pileHistory,
  s.currentTrick,
  s.players,
  s.finishedOrder,
);
console.log(
  "before 10:",
  JSON.stringify({
    pile: s.pile.map((c) => c.value),
    inRun: ctx.inRunContext,
    wouldActivateTenRule: would,
  }),
);

s = playCards(s, "p1", ten, { tenRuleDirection: "lower" });
const ctxAfter = resolveRunContext(
  s.pile,
  s.pileHistory,
  s.currentTrick,
  s.players,
  s.finishedOrder,
);
console.log(
  "after 10:",
  JSON.stringify({
    tenRule: s.tenRule,
    pending: s.tenRulePending,
    pile: s.pile.map((c) => c.value),
    inRun: ctxAfter.inRunContext,
    runSeq: ctxAfter.runSeq.map((c) => c.value),
  }),
);

s.currentPlayerIndex = 1;
const tenEff = resolveEffectiveTenRule(s);
const v8 = isValidPlay(
  [C(8, "diamonds")],
  s.pile,
  tenEff,
  s.pileHistory,
  s.trickHistory,
  undefined,
  s.currentTrick,
  s.players,
  s.finishedOrder,
  s.lastRoundOrder,
  "p2",
  false,
);
const v9 = isValidPlay(
  [C(9, "clubs")],
  s.pile,
  tenEff,
  s.pileHistory,
  s.trickHistory,
  undefined,
  s.currentTrick,
  s.players,
  s.finishedOrder,
  s.lastRoundOrder,
  "p2",
  false,
);
const vJ = isValidPlay(
  [C(11)],
  s.pile,
  tenEff,
  s.pileHistory,
  s.trickHistory,
  undefined,
  s.currentTrick,
  s.players,
  s.finishedOrder,
  s.lastRoundOrder,
  "p2",
  false,
);
console.log(
  "next play legality:",
  JSON.stringify({ tenEff, v8, v9, vJ }),
);

// Case: already in run 7-8-9, play 10 as extension
s = base();
s.players[0].hand = [C(7), C(10, "spades"), C(3, "clubs")];
s.players[1].hand = [C(8), C(8, "diamonds"), C(11)];
s.players[2].hand = [C(9), C(7, "diamonds"), C(12)];
s = playCards(s, "p1", [C(7)]);
s.currentPlayerIndex = 1;
s = playCards(s, "p2", [C(8)]);
s.currentPlayerIndex = 2;
s = playCards(s, "p3", [C(9)]);
s.currentPlayerIndex = 0;
const would2 = wouldActivateTenRule(s, "p1", [C(10, "spades")]);
const ctx2 = resolveRunContext(
  s.pile,
  s.pileHistory,
  s.currentTrick,
  s.players,
  s.finishedOrder,
);
console.log(
  "run 7-8-9 then 10:",
  JSON.stringify({
    inRun: ctx2.inRunContext,
    wouldActivateTenRule: would2,
  }),
);
