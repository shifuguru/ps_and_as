/**
 * Evidence-only: On Top grant after 3→4→5→6→5 then all others pass.
 * Run: npx tsx ./scripts/investigate-run-on-top-grant.ts
 */
import {
  createGame,
  playCards,
  passTurn,
  resolveRunContext,
  isOnTopEligiblePile,
  resolveEffectiveTenRule,
  isValidPlay,
  type Card,
} from "../src/game/core";

function c(value: number, suit: Card["suit"]): Card {
  return { value, suit };
}

const g = createGame(["P1", "P2", "P3", "P4"]);
g.players.forEach((p) => (p.hand = []));
g.pile = [];
g.pileHistory = [];
g.currentTrick = { trickNumber: 1, actions: [] };
g.mustPlay = false;

const cards = {
  three: c(3, "clubs"),
  four: c(4, "hearts"),
  five: c(5, "diamonds"),
  six: c(6, "clubs"),
  fiveB: c(5, "hearts"),
  fourOpt: c(4, "spades"),
  sixOpt: c(6, "spades"),
};

// Seat rotation so each play is a different player; P1 plays the step-back 5.
g.players[0].hand = [cards.three, cards.fiveB, cards.fourOpt, cards.sixOpt, c(12, "clubs")];
g.players[1].hand = [cards.four, c(12, "hearts"), c(13, "hearts")];
g.players[2].hand = [cards.five, c(12, "diamonds"), c(13, "diamonds")];
g.players[3].hand = [cards.six, c(12, "spades"), c(13, "spades")];
g.currentPlayerIndex = 0;

let s = playCards(g, "1", [cards.three]);
s = playCards(s, "2", [cards.four]);
s = playCards(s, "3", [cards.five]);
s = playCards(s, "4", [cards.six]);
s = playCards(s, "1", [cards.fiveB]);

const ctx = resolveRunContext(
  s.pile,
  s.pileHistory,
  s.currentTrick,
  s.players,
  s.finishedOrder || [],
);
const ten = resolveEffectiveTenRule(s);
const eligible = isOnTopEligiblePile(
  s.pile,
  s.pileHistory,
  s.currentTrick,
  s.players,
  s.finishedOrder || [],
  ten,
);

const legal4 = isValidPlay(
  [cards.fourOpt],
  s.pile,
  ten,
  s.pileHistory,
  s.trickHistory,
  s.fourOfAKindChallenge,
  s.currentTrick,
  s.players,
  s.finishedOrder,
  undefined,
  "1",
  false,
);
const legal6 = isValidPlay(
  [cards.sixOpt],
  s.pile,
  ten,
  s.pileHistory,
  s.trickHistory,
  s.fourOfAKindChallenge,
  s.currentTrick,
  s.players,
  s.finishedOrder,
  undefined,
  "1",
  false,
);

console.log("--- after 3-4-5-6-5 ---");
console.log({
  pile: s.pile.map((x) => x.value),
  hist: s.pileHistory?.map((h) => h.map((x) => x.value)),
  runSeq: ctx.runSeq.map((x) => x.value),
  inRunContext: ctx.inRunContext,
  pileEndsRun:
    ctx.runSeq.length > 0 &&
    ctx.runSeq[ctx.runSeq.length - 1].value === s.pile[0]?.value,
  isOnTopEligiblePile: eligible,
  legal4,
  legal6,
});

s = passTurn(s, "2");
s = passTurn(s, "3");
s = passTurn(s, "4");

console.log("--- after others pass ---");
console.log({
  onTop: s.runOnTop,
  pile: s.pile.map((x) => x.value),
  turn: s.currentPlayerIndex,
  mustPlay: s.mustPlay,
  trickCleared: s.pile.length === 0,
});
