/**
 * Gating checks for hand guidance — opening-3 must not leak mid-round.
 */
import assert from "assert";
import { resolveHandGuidance } from "../src/gameplayPresentation/resolveHandGuidance";
import {
  isRoundOpeningLead,
  isTrickOpeningLead,
  type GameState,
} from "../src/game/core";

function emptyLeadState(overrides: Partial<GameState> = {}): GameState {
  return {
    players: [],
    pile: [],
    pileHistory: [],
    pileOwners: [],
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [] },
    currentPlayerIndex: 0,
    mustPlay: true,
    finishedOrder: [],
    lastRoundOrder: [],
    ...overrides,
  } as GameState;
}

// Mid-round after a trick: empty pile looks like a "trick opening" but not round opening.
const midRound = emptyLeadState({
  trickHistory: [
    {
      trickNumber: 1,
      actions: [],
      winnerId: "p1",
      winnerName: "A",
    },
  ],
  currentTrick: { trickNumber: 2, actions: [] },
});

assert.strictEqual(isTrickOpeningLead(midRound), true, "empty pile = trick opening");
assert.strictEqual(
  isRoundOpeningLead(midRound),
  false,
  "prior tricks ≠ round opening",
);

const midHint = resolveHandGuidance({
  isHumanTurn: true,
  mustLeadOpening: false, // caller must exclude when !isRoundOpeningLead
  openingLeadCard: null,
  noValidPlays: false,
  onTopTurn: false,
  selectedCount: 0,
  pileTop: null,
  pileCount: 0,
});
assert.strictEqual(midHint, "Lead any rank");

const openingHint = resolveHandGuidance({
  isHumanTurn: true,
  mustLeadOpening: true,
  openingLeadCard: { suit: "clubs", value: 3 },
  noValidPlays: false,
  onTopTurn: false,
  selectedCount: 0,
  pileTop: null,
  pileCount: 0,
});
assert.strictEqual(openingHint, "Lead with your 3♣");

const bogusOpeningWithoutCard = resolveHandGuidance({
  isHumanTurn: true,
  mustLeadOpening: true,
  openingLeadCard: null,
  noValidPlays: false,
  onTopTurn: false,
  selectedCount: 0,
  pileTop: null,
  pileCount: 0,
});
assert.strictEqual(
  bogusOpeningWithoutCard,
  "Lead any rank",
  "never fall back to 'opening 3' without a held card",
);

console.log("test-hand-guidance: ok");
