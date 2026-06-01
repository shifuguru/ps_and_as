import * as assert from "assert";
import { createDeck, shuffleDeck } from "../src/game/ruleset";
import type { Card, Player } from "../src/game/ruleset";
import type { GameState } from "../src/game/core";
import {
  createDeadHandPlayer,
  DEAD_HAND_ID,
  applyDeadHandAfterDeal,
  livingFinishedOrder,
  deadHandHoldsAllThrees,
  needsRoundOneDealerReshuffle,
} from "../src/game/deadHand";
import {
  createGame,
  playCards,
  passTurn,
  getPlayCount,
  getHighestValue,
  isValidPlay,
  containsTwo,
  isFourOfAKind,
  effectivePile,
  isRunContextSequence,
  nextActivePlayerIndex,
  isPlayerStillIn,
  createGameFromLobby,
  syncFinishedFromEmptyHands,
  isRoundCompleteForLiving,
  setTenRuleDirection,
  resolveEffectiveTenRule,
} from "../src/game/core";
import {
  applyMandatoryTrades,
  advanceAssholeStreakAfterRound,
  shouldSkipPresidentAssholeTrade,
  assignPlayerRoles,
  buildFreshRoundState,
  clonePlayersForRound,
  completeWinnerReturn,
  pickHighestCards,
  resolveCeremonyTrades,
  buildTradesFromServerPending,
} from "../src/game/roundPrep";
import { applyFinishOrderRoles, roleForPlacement, supportsViceRoles } from "../src/utils/roundRoles";
import {
  resolveFirstRoundLeadPlayerIndex,
  resolveLeadPlayerIndexAfterTrades,
  resolveOpeningPlayerIndex,
} from "../src/utils/tableSeats";

// Basic deck tests
const deck = createDeck();
// Deck includes two jokers by design -> 54 cards total
assert.strictEqual(deck.length, 54, "Deck should have 54 cards (includes 2 jokers)");

const shuffled = shuffleDeck(createDeck());
assert.strictEqual(shuffled.length, 54, "Shuffled deck should have 54 cards (includes 2 jokers)");

// isValidPlay tests
const single: Card[] = [{ suit: "hearts", value: 10 }];
const pileEmpty: Card[] = [];
assert.strictEqual(isValidPlay(single, pileEmpty, undefined, undefined, [{ trickNumber: 0, actions: [] }]), true, "Single on empty pile allowed");

const pile: Card[] = [{ suit: "spades", value: 9 }];
assert.strictEqual(isValidPlay(single, pile, undefined, undefined, [{ trickNumber: 0, actions: [] }]), true, "10 > 9 should be valid");

const equalPile: Card[] = [{ suit: "spades", value: 10 }];
assert.strictEqual(isValidPlay(single, equalPile, undefined, undefined, [{ trickNumber: 0, actions: [] }]), false, "equal value not allowed");

// two clear
const twoCard: Card[] = [{ suit: "clubs", value: 2 }];
assert.strictEqual(containsTwo(twoCard), true, "containsTwo should detect 2");

// four of a kind
const four: Card[] = [
  { suit: "hearts", value: 5 },
  { suit: "spades", value: 5 },
  { suit: "clubs", value: 5 },
  { suit: "diamonds", value: 5 },
];
assert.strictEqual(isFourOfAKind(four), true, "four of a kind detected");

console.log("All core tests passed");

// --- Additional tests for runs with 10s (context sequences) ---

// Build a run context from pileHistory: [7],[8],[9]
const seven: Card = { suit: "hearts", value: 7 };
const eight: Card = { suit: "spades", value: 8 };
const nine: Card = { suit: "clubs", value: 9 };
const ten: Card = { suit: "diamonds", value: 10 };
const jack: Card = { suit: "hearts", value: 11 };

const pileAfterNine: Card[] = [nine];
const history789: Card[][] = [[seven], [eight], [nine]];

// 10 should be valid as an adjacency play during an active run context
assert.strictEqual(
  isValidPlay([ten], pileAfterNine, undefined, history789, [{ trickNumber: 0, actions: [] }]),
  true,
  "10 should be allowed as adjacency during run context"
);

// effectivePile should continue the run context when 10 is appended
const history78910: Card[][] = [[seven], [eight], [nine], [ten]];
const eff1 = effectivePile([ten], history78910);
assert.strictEqual(
  isRunContextSequence(eff1),
  true,
  "effectivePile + isRunContextSequence should treat 7,8,9,10 as a continuing run context"
);

// From 10, both 9 and J should be valid adjacency responses in the run context
assert.strictEqual(
  isValidPlay([jack], [ten], undefined, history78910, [{ trickNumber: 0, actions: [] }]),
  true,
  "Jack should be allowed after 10 in run context"
);
assert.strictEqual(
  isValidPlay([nine], [ten], undefined, history78910, [{ trickNumber: 0, actions: [] }]),
  true,
  "9 should be allowed after 10 in run context"
);

// 10-rule must not block run continuation even if it was previously activated
const tenRuleHigher = { active: true, direction: "higher" as const };
assert.strictEqual(
  isValidPlay([jack], [ten], tenRuleHigher, history78910, [{ trickNumber: 0, actions: [] }]),
  true,
  "Jack should be allowed after 10 in run context even with 10-rule higher active"
);
assert.strictEqual(
  isValidPlay([nine], [ten], tenRuleHigher, history78910, [{ trickNumber: 0, actions: [] }]),
  true,
  "9 should be allowed after 10 in run context even with 10-rule higher active"
);

// 2-card sequence 9-10: not yet a run — normal beat-the-pile with 10-rule
const history910: Card[][] = [[nine], [ten]];
assert.strictEqual(
  isValidPlay([jack], [ten], tenRuleHigher, history910, [{ trickNumber: 0, actions: [] }]),
  true,
  "Jack should beat 10 via normal 10-rule (not run adjacency) on a 2-card 9-10 sequence"
);
assert.strictEqual(
  isValidPlay([nine], [ten], tenRuleHigher, history910, [{ trickNumber: 0, actions: [] }]),
  false,
  "9 should NOT be allowed on 10 when only 9-10 played — not yet a run"
);

// Non-adjacent beats must not slip through via 10-rule / beat-the-pile during a run
assert.strictEqual(
  isValidPlay(
    [{ suit: "spades", value: 12 }],
    [ten],
    tenRuleHigher,
    history78910,
    [{ trickNumber: 0, actions: [] }],
  ),
  false,
  "Queen cannot beat 10 via 10-rule when 7-8-9-10 is an active run",
);

// K-A-2 consecutive singles form a run; Ace is valid adjacency on 2
const ka2King: Card = { suit: "hearts", value: 13 };
const ka2Ace: Card = { suit: "diamonds", value: 14 };
const ka2Two: Card = { suit: "clubs", value: 15 };
const trickKA2 = {
  trickNumber: 0,
  actions: [
    { type: "play" as const, playerId: "1", playerName: "P1", cards: [ka2King], timestamp: 1 },
    { type: "play" as const, playerId: "2", playerName: "P2", cards: [ka2Ace], timestamp: 2 },
    { type: "play" as const, playerId: "3", playerName: "P3", cards: [ka2Two], timestamp: 3 },
  ],
};
assert.strictEqual(
  isRunContextSequence([ka2King, ka2Ace, ka2Two]),
  true,
  "K-A-2 should be a run context sequence"
);
assert.strictEqual(
  isValidPlay(
    [ka2Ace],
    [ka2Two],
    undefined,
    undefined,
    undefined,
    undefined,
    trickKA2,
    createGame(["P1", "P2", "P3", "P4"]).players,
  ),
  true,
  "Ace should be valid adjacency on 2 after K-A-2 run",
);

// Two singles 3-4: normal play — must beat 4, not wrap back to 3
const history34: Card[][] = [[{ suit: "hearts", value: 3 }], [{ suit: "hearts", value: 4 }]];
const threeAgain: Card[] = [{ suit: "spades", value: 3 }];
const five: Card[] = [{ suit: "spades", value: 5 }];
const fourOnPile: Card[] = [{ suit: "hearts", value: 4 }];
assert.strictEqual(
  isValidPlay(threeAgain, fourOnPile, undefined, history34, [{ trickNumber: 0, actions: [] }]),
  false,
  "3 should NOT be allowed on pile 4 after 3-4 — not yet a run"
);
assert.strictEqual(
  isValidPlay(five, fourOnPile, undefined, history34, [{ trickNumber: 0, actions: [] }]),
  true,
  "5 should beat 4 after 3-4 — normal play until 3rd consecutive card"
);

// Step-back run: 4-5-6-5 on table — extend from pile top (5), not run tail (6)
{
  const runPlayers: Player[] = [
    { id: "1", name: "P1", hand: [], role: "Neutral" },
    { id: "2", name: "P2", hand: [], role: "Neutral" },
    { id: "3", name: "P3", hand: [], role: "Neutral" },
    { id: "4", name: "P4", hand: [], role: "Neutral" },
  ];
  const trick4565 = {
    trickNumber: 1,
    actions: [
      { type: "play" as const, playerId: "1", playerName: "P1", cards: [{ suit: "hearts", value: 4 }], timestamp: 1 },
      { type: "play" as const, playerId: "2", playerName: "P2", cards: [{ suit: "diamonds", value: 5 }], timestamp: 2 },
      { type: "play" as const, playerId: "3", playerName: "P3", cards: [{ suit: "clubs", value: 6 }], timestamp: 3 },
      { type: "play" as const, playerId: "4", playerName: "P4", cards: [{ suit: "spades", value: 5 }], timestamp: 4 },
    ],
  };
  const pileFive: Card[] = [{ suit: "spades", value: 5 }];
  const history4565: Card[][] = [
    [{ suit: "hearts", value: 4 }],
    [{ suit: "diamonds", value: 5 }],
    [{ suit: "clubs", value: 6 }],
  ];
  assert.strictEqual(
    isValidPlay(
      [{ suit: "hearts", value: 6 }],
      pileFive,
      undefined,
      history4565,
      undefined,
      undefined,
      trick4565,
      runPlayers,
      [],
    ),
    true,
    "6 should extend 4-5-6-5 run from pile top 5",
  );
  assert.strictEqual(
    isValidPlay(
      [{ suit: "hearts", value: 7 }],
      pileFive,
      undefined,
      history4565,
      undefined,
      undefined,
      trick4565,
      runPlayers,
      [],
    ),
    false,
    "7 should not extend 4-5-6-5 — not adjacent to pile top 5",
  );
}

// Quad close on 10s must work even when 10-rule is active
const twoTens: Card[] = [
  { suit: "hearts", value: 10 },
  { suit: "diamonds", value: 10 },
];
const pileTwoTens: Card[] = [
  { suit: "spades", value: 10 },
  { suit: "clubs", value: 10 },
];
assert.strictEqual(
  isValidPlay(twoTens, pileTwoTens, { active: true, direction: "higher" }),
  true,
  "2 tens on 2 tens should close quad with 10-rule higher active",
);
assert.strictEqual(
  isValidPlay(twoTens, pileTwoTens, { active: true, direction: "lower" }),
  true,
  "2 tens on 2 tens should close quad with 10-rule lower active",
);

console.log("Run-with-10 context tests passed");

// --- Pass-lock tests and 8-player coverage ---

function makeEmptyGame(names: string[]): GameState {
  const g = createGame(names);
  // wipe dealt hands to remove randomness
  g.players.forEach(p => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.pileOwners = [];
  g.trickHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.finishedOrder = [];
  g.passCount = 0;
  g.lastPlayPlayerIndex = null;
  g.mustPlay = false;
  g.tenRule = { active: false, direction: null };
  // One completed trick so mid-trick tests can lead with any card (not session-opening 3♣).
  g.trickHistory = [
    {
      trickNumber: 1,
      actions: [],
      winnerName: names[0] ?? "P1",
      winnerId: "1",
    },
  ];
  return g;
}

// 1) Joker must not reset passes; previously passed players remain locked until trick ends
{
  const g = makeEmptyGame(["P1","P2","P3","P4"]);
  // Hands
  const fiveH: Card = { suit: "hearts", value: 5 };
  const sixH: Card = { suit: "hearts", value: 6 };
  const sevenH: Card = { suit: "hearts", value: 7 };
  const joker: Card = { suit: "joker", value: 16 };
  g.players[0].hand = [fiveH];
  g.players[1].hand = [sixH];
  g.players[2].hand = [sevenH];
  g.players[3].hand = [joker];
  g.currentPlayerIndex = 0; // P1 to play

  // P1 plays 5
  let s = playCards(g, g.players[0].id, [fiveH]);
  assert.notStrictEqual(s, g, "P1 play should be accepted");
  // P2 passes
  s = passTurn(s, g.players[1].id);
  // P3 passes
  s = passTurn(s, g.players[2].id);
  // P4 plays Joker
  s = playCards(s, g.players[3].id, [joker]);
  assert.ok(s.currentTrick && s.currentTrick.actions.some((a:any)=>a.type==='pass' && a.playerId===g.players[1].id), "Pass by P2 should still be recorded after Joker");
  assert.ok(s.currentTrick && s.currentTrick.actions.some((a:any)=>a.type==='pass' && a.playerId===g.players[2].id), "Pass by P3 should still be recorded after Joker");
  assert.strictEqual(s.passCount, 2, "passCount should stay 2 after Joker when two players passed");

  // Force it to be P2's turn and attempt to play (even though they passed earlier this trick)
  s.currentPlayerIndex = 1;
  const beforeHandLen = s.players[1].hand.length;
  const s2 = playCards(s, g.players[1].id, [sixH]);
  // The engine should convert this attempt into a pass (playCards -> passTurn) and not change hand
  assert.strictEqual(s2.players[1].hand.length, beforeHandLen, "P2 hand should be unchanged when attempting to play after passing");
  assert.ok(s2.currentTrick && s2.currentTrick.actions.filter((a:any)=>a.type==='pass' && a.playerId===g.players[1].id).length >= 2, "P2 should now have an additional pass recorded");
}

// 2) Playing one joker should remove only that joker when the player holds duplicates
{
  const g = makeEmptyGame(["P1", "P2"]);
  const jokerA: Card = { suit: "joker", value: 16 };
  const jokerB: Card = { suit: "joker", value: 16 };
  g.players[0].hand = [jokerA, jokerB];
  g.currentPlayerIndex = 0;

  const s = playCards(g, g.players[0].id, [jokerA]);
  assert.strictEqual(s.players[0].hand.length, 1, "Playing one joker should leave one joker in hand");
  assert.strictEqual(s.players[0].hand[0].value, 16, "Remaining card should still be a joker");
  assert.strictEqual(s.players[0].hand[0].suit, "joker", "Remaining card should still be a joker");
  assert.strictEqual(s.pile.length, 1, "Pile should show only one joker played");
}

// 1b) passCount survives a normal beat play mid-trick
{
  const g = makeEmptyGame(["P1", "P2", "P3"]);
  const fiveH: Card = { suit: "hearts", value: 5 };
  const sixH: Card = { suit: "hearts", value: 6 };
  const sevenH: Card = { suit: "hearts", value: 7 };
  g.players[0].hand = [fiveH];
  g.players[1].hand = [sixH];
  g.players[2].hand = [sevenH];
  g.currentPlayerIndex = 0;

  let s = playCards(g, g.players[0].id, [fiveH]);
  s = passTurn(s, g.players[1].id);
  assert.strictEqual(s.passCount, 1, "one pass recorded");
  s = playCards(s, g.players[2].id, [sevenH]);
  assert.strictEqual(s.passCount, 1, "passCount should remain 1 after a beat play");
}

// 2) A 2 is a high card — others must pass before the trick ends (not an instant clear)
{
  const g = makeEmptyGame(["P1","P2","P3"]);
  const fiveH: Card = { suit: "hearts", value: 5 };
  const spare: Card = { suit: "spades", value: 3 };
  const twoC: Card = { suit: "clubs", value: 15 };
  const sixH: Card = { suit: "hearts", value: 6 };
  g.players[0].hand = [fiveH, spare];
  g.players[1].hand = [sixH];
  g.players[2].hand = [twoC];
  g.currentPlayerIndex = 0;
  let s = playCards(g, g.players[0].id, [fiveH]);
  s = passTurn(s, g.players[1].id);
  s = playCards(s, g.players[2].id, [twoC]);
  assert.ok(s.pile.length === 1 && s.pile[0].value === 15, "2 stays on pile until others pass");
  s = passTurn(s, g.players[0].id);
  assert.ok(s.pile.length === 0, "Trick clears after all other active players pass on a 2");
}

// 3) 8-player trick resolution: leader wins when all others pass
{
  const names = ["A","B","C","D","E","F","G","H"];
  const g = makeEmptyGame(names);
  const fiveH: Card = { suit: "hearts", value: 5 };
  const passCard: Card = { suit: "spades", value: 3 };
  const spareA: Card = { suit: "diamonds", value: 4 };
  // Give A the 5H plus a spare so they remain in to lead the next trick
  g.players[0].hand = [fiveH, spareA];
  for (let i = 1; i < names.length; i++) {
    g.players[i].hand = [passCard];
  }
  g.currentPlayerIndex = 0;
  let s = playCards(g, g.players[0].id, [fiveH]); // A plays, becomes leader
  // Everyone else passes in order
  for (let i = 1; i < names.length; i++) {
    s = passTurn(s, g.players[i].id);
  }
  // Trick should have ended; winner A leads next
  assert.strictEqual(s.currentTrick.actions.length, 0, "New trick should have started after all others passed");
  assert.strictEqual(s.currentPlayerIndex, 0, "Leader should lead next trick after everyone else passes");
}

// 4) Playing your last card skips your turn — you should not be asked to pass
{
  const names = ["A", "B", "C"];
  const g = makeEmptyGame(names);
  const lastCard: Card = { suit: "hearts", value: 7 };
  g.players[0].hand = [lastCard];
  g.players[1].hand = [{ suit: "spades", value: 8 }];
  g.players[2].hand = [{ suit: "diamonds", value: 9 }];
  g.currentPlayerIndex = 0;
  g.pile = [{ suit: "clubs", value: 6 }];
  g.pileHistory = [[{ suit: "clubs", value: 6 }]];
  g.pileOwners = [g.players[2].id];
  g.lastPlayPlayerIndex = 2;
  g.currentTrick = {
    trickNumber: 1,
    actions: [
      {
        type: "play",
        playerId: g.players[2].id,
        playerName: "C",
        cards: [{ suit: "clubs", value: 6 }],
        timestamp: 1,
      },
    ],
  };

  const after = playCards(g, g.players[0].id, [lastCard]);
  assert.strictEqual(after.players[0].hand.length, 0, "A should have no cards left");
  assert.ok(after.finishedOrder.includes(g.players[0].id), "A should be marked finished");
  assert.notStrictEqual(
    after.currentPlayerIndex,
    0,
    "Turn should advance away from A after their last card",
  );
  assert.ok(isPlayerStillIn(after, g.players[0].id) === false, "A should no longer be active");
}

// Last card is a 10 — must choose higher/lower before going out; round waits for choice
{
  const names = ["A", "B"];
  const g = makeEmptyGame(names);
  const lastTen: Card = { suit: "hearts", value: 10 };
  g.players[0].hand = [lastTen];
  g.players[1].hand = [{ suit: "spades", value: 8 }];
  g.currentPlayerIndex = 0;
  g.pile = [{ suit: "clubs", value: 9 }];
  g.pileHistory = [[{ suit: "clubs", value: 9 }]];
  g.pileOwners = [g.players[1].id];
  g.lastPlayPlayerIndex = 1;
  g.currentTrick = {
    trickNumber: 1,
    actions: [
      {
        type: "play",
        playerId: g.players[1].id,
        playerName: "B",
        cards: [{ suit: "clubs", value: 9 }],
        timestamp: 1,
      },
    ],
  };

  const pending = playCards(g, g.players[0].id, [lastTen]);
  assert.ok(pending.tenRulePending, "Ten rule should be pending on last-card 10");
  assert.strictEqual(pending.players[0].hand.length, 0, "A should have no cards left");
  assert.ok(
    pending.finishedOrder.includes(g.players[0].id),
    "A should be marked finished",
  );
  assert.strictEqual(
    pending.currentPlayerIndex,
    0,
    "Turn should stay with A until they choose higher/lower",
  );
  assert.ok(
    !isRoundCompleteForLiving(pending),
    "Round should not end before ten-rule choice (B still playing)",
  );

  const resolved = setTenRuleDirection(pending, "higher");
  assert.ok(!resolved.tenRulePending, "Ten rule should clear after choice");
  assert.ok(resolved.tenRule?.direction === "higher");
  assert.ok(isPlayerStillIn(resolved, g.players[0].id) === false, "A stays out");
  assert.strictEqual(
    resolved.currentPlayerIndex,
    1,
    "Turn should advance to B after ten-rule choice",
  );
  assert.ok(
    !isRoundCompleteForLiving(resolved),
    "Round should continue for remaining players",
  );
}

// Four 10s + ten-rule response: trick winner must be last beat play, not stuck
{
  const g = makeEmptyGame(["A", "B"]);
  const fourTens: Card[] = [
    { suit: "hearts", value: 10 },
    { suit: "diamonds", value: 10 },
    { suit: "clubs", value: 10 },
    { suit: "spades", value: 10 },
  ];
  const fourNines: Card[] = [
    { suit: "hearts", value: 9 },
    { suit: "diamonds", value: 9 },
    { suit: "clubs", value: 9 },
    { suit: "spades", value: 9 },
  ];
  g.players[0].hand = [...fourTens, { suit: "hearts", value: 5 }];
  g.players[1].hand = [...fourNines];
  g.currentPlayerIndex = 0;

  let s = playCards(g, g.players[0].id, fourTens);
  s = setTenRuleDirection(s, "lower");
  assert.ok(
    !s.finishedOrder.includes(g.players[1].id),
    "Opponent should not be auto-finished while still holding cards after one player goes out",
  );
  s = playCards(s, g.players[1].id, fourNines);
  assert.strictEqual(s.lastPlayPlayerIndex, 1, "Responder should lead the pile");
  s = passTurn(s, g.players[0].id);
  const lastTrick = s.trickHistory[s.trickHistory.length - 1];
  assert.ok(lastTrick, "Trick should finalize after the quad closer passes");
  assert.strictEqual(
    lastTrick.winnerName,
    "B",
    "Ten-rule response play should win the trick when the closer passes",
  );
}

// Single-play four 10s: closer wins when everyone else passes under ten rule
{
  const g = makeEmptyGame(["A", "B", "C"]);
  const fourTens: Card[] = [
    { suit: "hearts", value: 10 },
    { suit: "diamonds", value: 10 },
    { suit: "clubs", value: 10 },
    { suit: "spades", value: 10 },
  ];
  g.players[0].hand = fourTens.slice();
  g.players[1].hand = [{ suit: "hearts", value: 5 }];
  g.players[2].hand = [{ suit: "hearts", value: 6 }];
  g.currentPlayerIndex = 0;

  let s = playCards(g, g.players[0].id, fourTens);
  s = setTenRuleDirection(s, "higher");
  s = passTurn(s, g.players[1].id);
  s = passTurn(s, g.players[2].id);
  const lastTrick = s.trickHistory[s.trickHistory.length - 1];
  assert.ok(lastTrick, "Trick should end once all others pass on four 10s");
  assert.strictEqual(lastTrick.winnerName, "A", "Quad closer should win the trick");
}

{
  const joker: Card = { suit: "joker", value: 16 };
  const double7: Card[] = [
    { suit: "hearts", value: 7 },
    { suit: "diamonds", value: 7 },
  ];
  const pileHistory: Card[][] = [
    [{ suit: "clubs", value: 5 }],
    [{ suit: "spades", value: 6 }],
    [{ suit: "hearts", value: 7 }],
  ];
  assert.ok(
    isValidPlay([joker], double7, undefined, pileHistory),
    "Single joker should beat double 7s when pile is not an active run",
  );
  const doubleJ: Card[] = [
    { suit: "hearts", value: 11 },
    { suit: "diamonds", value: 11 },
  ];
  assert.ok(
    isValidPlay([joker], doubleJ, undefined, pileHistory),
    "Single joker should beat double jacks when pile is not an active run",
  );
}

// Joker cannot be played during an active run
{
  const joker: Card = { suit: "joker", value: 16 };
  const runPile: Card[] = [
    { suit: "hearts", value: 5 },
    { suit: "diamonds", value: 6 },
    { suit: "clubs", value: 7 },
  ];
  assert.ok(
    !isValidPlay([joker], runPile),
    "Joker should not be playable on an active singles run",
  );
}

// Completed four-of-a-kind across turns is unbeatable — everyone must pass
{
  const joker: Card = { suit: "joker", value: 16 };
  const four3s: Card[] = [
    { suit: "hearts", value: 3 },
    { suit: "diamonds", value: 3 },
    { suit: "clubs", value: 3 },
    { suit: "spades", value: 3 },
  ];
  const quadChallenge = { active: true, value: 3, starterIndex: 0, completedAcrossTurns: true };
  assert.ok(
    !isValidPlay([joker], four3s, undefined, undefined, undefined, quadChallenge),
    "Joker cannot beat a cross-turn completed quad",
  );
  const higherPair: Card[] = [
    { suit: "hearts", value: 8 },
    { suit: "diamonds", value: 8 },
  ];
  assert.ok(
    !isValidPlay(higherPair, four3s, undefined, undefined, undefined, quadChallenge),
    "Higher pair cannot beat a cross-turn completed quad",
  );
}

// Cross-turn quad close: opponent must pass, then completer wins the trick
{
  const g = createGame(["Alice", "Bob"]);
  g.players[0].hand = [
    { suit: "clubs", value: 3 },
    { suit: "spades", value: 5 },
  ];
  g.players[1].hand = [
    { suit: "hearts", value: 3 },
    { suit: "diamonds", value: 3 },
    { suit: "clubs", value: 3 },
    { suit: "spades", value: 8 },
  ];
  g.currentPlayerIndex = 0;
  g.pile = [];
  g.currentTrick = { trickNumber: 1, actions: [] };

  let s = playCards(g, g.players[0].id, [{ suit: "clubs", value: 3 }]);
  assert.strictEqual(s.players[s.currentPlayerIndex].id, g.players[1].id);

  s = playCards(s, s.players[1].id, [
    { suit: "hearts", value: 3 },
    { suit: "diamonds", value: 3 },
    { suit: "clubs", value: 3 },
  ]);
  assert.ok(s.fourOfAKindChallenge?.completedAcrossTurns);
  assert.strictEqual(s.lastPlayPlayerIndex, 1);
  assert.strictEqual(
    s.players[s.currentPlayerIndex].id,
    g.players[0].id,
    "After cross-turn quad close, opponent must pass next",
  );
  assert.ok(
    !isValidPlay(
      [{ suit: "spades", value: 5 }],
      s.pile,
      s.tenRule,
      s.pileHistory,
      s.trickHistory,
      s.fourOfAKindChallenge,
      s.currentTrick,
      s.players,
      s.finishedOrder,
    ),
    "Opponent cannot beat a completed cross-turn quad",
  );

  s = passTurn(s, g.players[0].id);
  assert.strictEqual(s.pile.length, 0, "Trick clears after everyone else passes");
  assert.strictEqual(s.trickHistory?.length, 1);
  assert.strictEqual(s.players[s.currentPlayerIndex].id, g.players[1].id);
  assert.strictEqual(s.mustPlay, true, "Quad completer leads the next trick");
}

// Single-play four-of-a-kind bomb is beatable by higher quads or joker
{
  const joker: Card = { suit: "joker", value: 16 };
  const four5s: Card[] = [
    { suit: "hearts", value: 5 },
    { suit: "diamonds", value: 5 },
    { suit: "clubs", value: 5 },
    { suit: "spades", value: 5 },
  ];
  const bombChallenge = { active: true, value: 5, starterIndex: 0, completedAcrossTurns: false };
  const four8s: Card[] = [
    { suit: "hearts", value: 8 },
    { suit: "diamonds", value: 8 },
    { suit: "clubs", value: 8 },
    { suit: "spades", value: 8 },
  ];
  assert.ok(
    isValidPlay(four8s, four5s, undefined, undefined, undefined, bombChallenge),
    "Higher quads should beat a single-play quad bomb",
  );
  assert.ok(
    isValidPlay([joker], four5s, undefined, undefined, undefined, bombChallenge),
    "Joker should beat a single-play quad bomb when not in a quads run",
  );
  assert.ok(
    !isValidPlay(four5s, four5s, undefined, undefined, undefined, bombChallenge),
    "Same-rank quads cannot beat a single-play quad bomb",
  );
}

// Joker blocked during an active quads run
{
  const joker: Card = { suit: "joker", value: 16 };
  const four5s: Card[] = [
    { suit: "hearts", value: 5 },
    { suit: "diamonds", value: 5 },
    { suit: "clubs", value: 5 },
    { suit: "spades", value: 5 },
  ];
  const four6s: Card[] = [
    { suit: "hearts", value: 6 },
    { suit: "diamonds", value: 6 },
    { suit: "clubs", value: 6 },
    { suit: "spades", value: 6 },
  ];
  const four7s: Card[] = [
    { suit: "hearts", value: 7 },
    { suit: "diamonds", value: 7 },
    { suit: "clubs", value: 7 },
    { suit: "spades", value: 7 },
  ];
  const pileHistory: Card[][] = [four5s, four6s];
  assert.ok(
    !isValidPlay([joker], four7s, undefined, pileHistory),
    "Joker should not be playable during an active quads run",
  );
  const four8s: Card[] = [
    { suit: "hearts", value: 8 },
    { suit: "diamonds", value: 8 },
    { suit: "clubs", value: 8 },
    { suit: "spades", value: 8 },
  ];
  assert.ok(
    isValidPlay(four8s, four7s, undefined, pileHistory),
    "Next-rank quads should extend an active quads run",
  );
}

// --- Run "on top!" when everyone else passes ---

{
  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;

  const three: Card = { suit: "clubs", value: 3 };
  const four: Card = { suit: "hearts", value: 4 };
  const five: Card = { suit: "diamonds", value: 5 };
  const six: Card = { suit: "hearts", value: 6 };
  const seven: Card = { suit: "spades", value: 7 };

  g.players[0].hand = [three, { suit: "spades", value: 8 }];
  g.players[1].hand = [four, { suit: "clubs", value: 9 }];
  g.players[2].hand = [five, six, seven];
  g.players[3].hand = [{ suit: "diamonds", value: 6 }];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", [three]);
  s = playCards(s, "2", [four]);
  s = playCards(s, "3", [five]);
  s = passTurn(s, "4");
  s = passTurn(s, "1");
  s = passTurn(s, "2");

  assert.ok(s.runOnTop?.active, "Run leader should get on top! after others pass");
  assert.strictEqual(s.runOnTop?.playerIndex, 2, "On top! goes to last run extender");
  assert.strictEqual(s.currentPlayerIndex, 2, "Turn should return to run leader");
  assert.strictEqual(s.mustPlay, true, "On top! is a must-play turn");
  assert.strictEqual(s.pile.length, 1, "Trick should not clear before on top! play");

  assert.ok(
    isValidPlay(
      [six],
      s.pile,
      s.tenRule,
      s.pileHistory,
      s.trickHistory,
      s.fourOfAKindChallenge,
      s.currentTrick,
      s.players,
      s.finishedOrder,
      undefined,
      "3",
      true,
    ),
    "Consecutive run extension should be valid during on top!",
  );
  assert.ok(
    !isValidPlay(
      [seven],
      s.pile,
      s.tenRule,
      s.pileHistory,
      s.trickHistory,
      s.fourOfAKindChallenge,
      s.currentTrick,
      s.players,
      s.finishedOrder,
      undefined,
      "3",
      true,
    ),
    "Non-consecutive beat should be invalid during on top!",
  );

  s = playCards(s, "3", [six]);
  assert.ok(!s.runOnTop?.active, "On top! clears after a play");
  assert.strictEqual(s.pile.length, 0, "On top! play clears the table");
  assert.strictEqual(s.trickHistory?.length, 1);
  assert.strictEqual(s.trickHistory?.[0]?.winnerId, "3", "On-top play winner is last player who played");
  assert.strictEqual(s.players[s.currentPlayerIndex].id, "3");
  assert.strictEqual(s.mustPlay, true, "On-top winner leads the next trick");
}

{
  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;

  const three: Card = { suit: "clubs", value: 3 };
  const four: Card = { suit: "hearts", value: 4 };
  const five: Card = { suit: "diamonds", value: 5 };

  g.players[0].hand = [three, { suit: "spades", value: 8 }];
  g.players[1].hand = [four, { suit: "clubs", value: 9 }];
  g.players[2].hand = [five];
  g.players[3].hand = [{ suit: "diamonds", value: 6 }];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", [three]);
  s = playCards(s, "2", [four]);
  s = playCards(s, "3", [five]);
  s = passTurn(s, "4");
  s = passTurn(s, "1");
  s = passTurn(s, "2");

  s = passTurn(s, "3");
  assert.ok(!s.runOnTop?.active, "Passing on top! clears the state");
  assert.strictEqual(s.pile.length, 0, "Trick clears when leader passes on top!");
  assert.strictEqual((s.trickHistory?.length ?? 0), 1, "Trick should be recorded");
  assert.strictEqual(s.trickHistory?.[0]?.winnerId, "3", "On-top pass winner is last player who played");
}

{
  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;

  const three: Card = { suit: "clubs", value: 3 };
  const four: Card = { suit: "hearts", value: 4 };
  const five: Card = { suit: "diamonds", value: 5 };

  g.players[0].hand = [three, { suit: "spades", value: 8 }];
  g.players[1].hand = [four, { suit: "clubs", value: 9 }];
  g.players[2].hand = [five];
  g.players[3].hand = [{ suit: "diamonds", value: 6 }];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", [three]);
  s = playCards(s, "2", [four]);
  s = playCards(s, "3", [five]);
  s = passTurn(s, "4");
  s = passTurn(s, "1");
  s = passTurn(s, "2");

  assert.ok(!s.runOnTop?.active, "No on-top when run leader is out of cards");
  assert.strictEqual(s.pile.length, 0, "Trick clears when out-of-cards leader would get on top");
  assert.strictEqual(s.trickHistory?.[0]?.winnerId, "3", "Last player who played wins the trick");
}

// --- Double 10s "on top!" when everyone else passes ---

{
  const tenH: Card = { suit: "hearts", value: 10 };
  const tenD: Card = { suit: "diamonds", value: 10 };
  const jackH: Card = { suit: "hearts", value: 11 };
  const jackD: Card = { suit: "diamonds", value: 11 };
  const nineH: Card = { suit: "hearts", value: 9 };
  const nineD: Card = { suit: "diamonds", value: 9 };

  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;
  g.lastRoundOrder = ["1", "2", "3", "4"];

  g.players[0].hand = [tenH, tenD, jackH, jackD, { suit: "clubs", value: 3 }];
  g.players[1].hand = [{ suit: "clubs", value: 3 }];
  g.players[2].hand = [{ suit: "spades", value: 4 }];
  g.players[3].hand = [{ suit: "clubs", value: 5 }];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", [tenH, tenD]);
  assert.ok(s.tenRulePending, "Double 10s should prompt 10-rule direction");
  s = setTenRuleDirection(s, "higher");
  s = passTurn(s, "2");
  s = passTurn(s, "3");
  s = passTurn(s, "4");

  assert.ok(s.runOnTop?.active, "10-rule leader should get on top!");
  assert.strictEqual(s.runOnTop?.playerIndex, 0);

  assert.ok(
    !isValidPlay(
      [nineH, nineD],
      s.pile,
      s.tenRule,
      s.pileHistory,
      s.trickHistory,
      s.fourOfAKindChallenge,
      s.currentTrick,
      s.players,
      s.finishedOrder,
      undefined,
      "1",
      true,
    ),
    "Lower pair cannot beat pair of 10s during higher on top!",
  );
  assert.ok(
    isValidPlay(
      [jackH, jackD],
      s.pile,
      s.tenRule,
      s.pileHistory,
      s.trickHistory,
      s.fourOfAKindChallenge,
      s.currentTrick,
      s.players,
      s.finishedOrder,
      undefined,
      "1",
      true,
    ),
    "Higher pair beats pair of 10s during higher on top!",
  );

  s = playCards(s, "1", [jackH, jackD]);
  assert.ok(!s.runOnTop?.active);
  assert.strictEqual(s.pile.length, 0, "On top! play clears the table");
  assert.strictEqual(s.trickHistory?.length, 1);
  assert.strictEqual(s.players[s.currentPlayerIndex].id, "1");
  assert.strictEqual(s.mustPlay, true);
}

{
  const tenH: Card = { suit: "hearts", value: 10 };
  const nineH: Card = { suit: "hearts", value: 9 };
  const nineD: Card = { suit: "diamonds", value: 9 };
  const eightH: Card = { suit: "hearts", value: 8 };
  const eightD: Card = { suit: "diamonds", value: 8 };

  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;
  g.lastRoundOrder = ["1", "2", "3", "4"];

  g.players[0].hand = [tenH, nineH, nineD, { suit: "clubs", value: 3 }];
  g.players[1].hand = [{ suit: "clubs", value: 4 }];
  g.players[2].hand = [{ suit: "spades", value: 5 }];
  g.players[3].hand = [{ suit: "clubs", value: 6 }];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", [tenH]);
  s = setTenRuleDirection(s, "lower");
  s = passTurn(s, "2");
  s = passTurn(s, "3");
  s = passTurn(s, "4");

  assert.ok(s.runOnTop?.active, "Single 10 with lower rule should grant on top!");
  assert.ok(
    isValidPlay(
      [nineH, nineD],
      s.pile,
      s.tenRule,
      s.pileHistory,
      s.trickHistory,
      s.fourOfAKindChallenge,
      s.currentTrick,
      s.players,
      s.finishedOrder,
      undefined,
      "1",
      true,
    ),
    "Lower pair should beat single 10 during lower on top!",
  );
  assert.ok(
    !isValidPlay(
      [eightH, eightD],
      s.pile,
      s.tenRule,
      s.pileHistory,
      s.trickHistory,
      s.fourOfAKindChallenge,
      s.currentTrick,
      s.players,
      s.finishedOrder,
      undefined,
      "1",
      true,
    ),
    "Pair below 9 cannot beat single 10 during lower on top!",
  );
}

{
  const tenH: Card = { suit: "hearts", value: 10 };
  const nineH: Card = { suit: "hearts", value: 9 };
  const nineD: Card = { suit: "diamonds", value: 9 };

  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;
  g.lastRoundOrder = ["1", "2", "3", "4"];

  g.players[0].hand = [tenH, nineH, nineD, { suit: "clubs", value: 3 }];
  g.players[1].hand = [{ suit: "clubs", value: 4 }];
  g.players[2].hand = [{ suit: "spades", value: 5 }];
  g.players[3].hand = [{ suit: "clubs", value: 6 }];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", [tenH]);
  s = setTenRuleDirection(s, "lower");
  s = passTurn(s, "2");
  s = passTurn(s, "3");
  s = passTurn(s, "4");

  assert.ok(s.runOnTop?.active, "Lower 10 should grant on top!");
  s.tenRule = { active: false, direction: null };

  assert.ok(
    isValidPlay(
      [nineH, nineD],
      s.pile,
      resolveEffectiveTenRule(s),
      s.pileHistory,
      s.trickHistory,
      s.fourOfAKindChallenge,
      s.currentTrick,
      s.players,
      s.finishedOrder,
      undefined,
      "1",
      true,
    ),
    "On-top validation should recover lower direction from the trick",
  );

  s = playCards(s, "1", [nineH, nineD]);
  assert.strictEqual(s.pile.length, 0, "On-top play should win the trick");
  assert.strictEqual(s.trickHistory?.length, 1);
}

{
  const tenH: Card = { suit: "hearts", value: 10 };
  const tenD: Card = { suit: "diamonds", value: 10 };

  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [tenH, tenD];
  g.pileHistory = [[tenH, tenD]];
  g.currentTrick = {
    trickNumber: 1,
    actions: [{ type: "play", playerId: "1", playerName: "P1", cards: [tenH, tenD], timestamp: 1 }],
  };
  g.mustPlay = false;
  g.lastRoundOrder = ["1", "2", "3", "4"];
  g.lastPlayPlayerIndex = 0;
  g.tenRule = { active: false, direction: null };
  g.players[0].hand = [{ suit: "clubs", value: 3 }];
  g.players[1].hand = [{ suit: "clubs", value: 4 }];
  g.players[2].hand = [{ suit: "spades", value: 5 }];
  g.players[3].hand = [{ suit: "clubs", value: 6 }];
  g.currentPlayerIndex = 1;

  let s = passTurn(g, "2");
  s = passTurn(s, "3");
  s = passTurn(s, "4");

  assert.ok(!s.runOnTop?.active, "Pair of 10s without an active 10 rule should not grant on top!");
  assert.strictEqual(s.pile.length, 0, "Trick should clear normally");
}

{
  const tenH: Card = { suit: "hearts", value: 10 };
  const tenD: Card = { suit: "diamonds", value: 10 };

  const g = createGame(["P1", "P2", "P3", "P4"]);
  g.players.forEach((p) => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.mustPlay = false;
  g.lastRoundOrder = ["1", "2", "3", "4"];

  g.players[0].hand = [tenH, tenD, { suit: "clubs", value: 3 }];
  g.players[1].hand = [{ suit: "clubs", value: 4 }];
  g.players[2].hand = [{ suit: "spades", value: 5 }];
  g.players[3].hand = [{ suit: "clubs", value: 6 }];
  g.currentPlayerIndex = 0;

  let s = playCards(g, "1", [tenH, tenD]);
  s = setTenRuleDirection(s, "higher");
  s = passTurn(s, "2");
  s = passTurn(s, "3");
  s = passTurn(s, "4");

  assert.ok(s.runOnTop?.active);
  s = passTurn(s, "1");
  assert.strictEqual(s.pile.length, 0, "Leader wins trick after passing on top!");
  assert.strictEqual((s.trickHistory?.length ?? 0), 1);
  assert.strictEqual(s.trickHistory?.[0]?.winnerId, "1", "10-rule on-top pass winner is last player who played");
}

console.log("Pass-lock and 8-player tests passed");

// --- Dead hand round-1 opening ---

function makeTwoPlayerDeadHandGame(
  hands: Record<string, Card[]>,
  sidelinedDead: Card[] = [],
): Player[] {
  const dead = createDeadHandPlayer();
  dead.hand = hands[DEAD_HAND_ID] ?? [];
  dead.sidelinedHand = sidelinedDead.length ? sidelinedDead : undefined;
  return [
    { id: "host", name: "Host", hand: hands.host ?? [], role: "Neutral" },
    { id: "guest", name: "Guest", hand: hands.guest ?? [], role: "Neutral" },
    dead,
  ];
}

{
  const players = makeTwoPlayerDeadHandGame(
    {
      host: [{ suit: "hearts", value: 5 }],
      guest: [{ suit: "spades", value: 3 }],
      [DEAD_HAND_ID]: [],
    },
    [{ suit: "clubs", value: 3 }],
  );
  const leadIdx = resolveFirstRoundLeadPlayerIndex(players, { hostId: "host" });
  assert.strictEqual(
    leadIdx,
    1,
    "Dead hand holds 3♣ — guest with 3♠ should lead",
  );
}

{
  const players = makeTwoPlayerDeadHandGame(
    {
      host: [{ suit: "hearts", value: 3 }],
      guest: [{ suit: "diamonds", value: 3 }],
      [DEAD_HAND_ID]: [],
    },
    [{ suit: "clubs", value: 3 }],
  );
  const leadIdx = resolveFirstRoundLeadPlayerIndex(players, { hostId: "host" });
  assert.strictEqual(
    leadIdx,
    1,
    "Dead hand holds 3♣ — guest is first in deal order with any 3",
  );
}

{
  const players = makeTwoPlayerDeadHandGame(
    {
      host: [{ suit: "hearts", value: 5 }],
      guest: [{ suit: "diamonds", value: 4 }],
      [DEAD_HAND_ID]: [{ suit: "clubs", value: 3 }, { suit: "spades", value: 3 }],
    },
  );
  assert.strictEqual(
    resolveFirstRoundLeadPlayerIndex(players, { hostId: "host" }),
    -1,
    "All 3s on dead hand — no living lead",
  );
  assert.strictEqual(
    resolveOpeningPlayerIndex(players, { hostId: "host" }),
    -1,
    "Round 1 must not fall back to dealer's left when no living 3",
  );
}

{
  const players = makeTwoPlayerDeadHandGame(
    {
      host: [{ suit: "hearts", value: 5 }],
      guest: [{ suit: "diamonds", value: 4 }],
      [DEAD_HAND_ID]: [
        { suit: "clubs", value: 3 },
        { suit: "spades", value: 3 },
        { suit: "hearts", value: 3 },
        { suit: "diamonds", value: 3 },
      ],
    },
  );
  const dead = players.find((p) => p.id === DEAD_HAND_ID);
  if (dead) {
    dead.sidelinedHand = [...dead.hand];
    dead.hand = [];
  }
  assert.strictEqual(
    deadHandHoldsAllThrees(players),
    true,
    "Dead hand holds all four 3s after sideline",
  );
  assert.strictEqual(
    needsRoundOneDealerReshuffle(players, { hostId: "host" }),
    true,
    "Dealer must reshuffle when all four 3s are on the dead hand",
  );
}

{
  const threeSpades: Card[] = [{ suit: "spades", value: 3 }];
  const fourHearts: Card[] = [{ suit: "hearts", value: 4 }];
  const players = makeTwoPlayerDeadHandGame(
    {
      host: [{ suit: "hearts", value: 5 }],
      guest: threeSpades,
      [DEAD_HAND_ID]: [],
    },
    [{ suit: "clubs", value: 3 }],
  );
  assert.strictEqual(
    isValidPlay(
      threeSpades,
      pileEmpty,
      undefined,
      [],
      [],
      undefined,
      { trickNumber: 1, actions: [] },
      players,
      [DEAD_HAND_ID],
      undefined,
      "guest",
    ),
    true,
    "Opener with 3♠ may open with 3s when dead hand holds 3♣",
  );
  assert.strictEqual(
    isValidPlay(
      fourHearts,
      pileEmpty,
      undefined,
      [],
      [],
      undefined,
      { trickNumber: 1, actions: [] },
      players,
      [DEAD_HAND_ID],
      undefined,
      "guest",
    ),
    false,
    "Round-1 opener must lead 3s when any living player holds a 3",
  );
}

console.log("Dead hand round-1 opening tests passed");

// Dead hand must never pollute finish order or receive placement roles.
{
  const g = createGameFromLobby(
    [
      { id: "host", name: "Host" },
      { id: "guest", name: "Guest" },
    ],
    42,
    { deadHand: true },
  );
  assert.ok(
    !g.finishedOrder.includes(DEAD_HAND_ID),
    "Dead hand should not be in finishedOrder after deal",
  );

  g.players.find((p) => p.id === "host")!.hand = [];
  g.players.find((p) => p.id === "guest")!.hand = [{ suit: "hearts", value: 14 }];
  syncFinishedFromEmptyHands(g);
  assert.deepStrictEqual(
    livingFinishedOrder(g.players, g.finishedOrder),
    ["host"],
    "Only living finishers belong in finish order",
  );
  assert.strictEqual(
    g.players.find((p) => p.id === "host")!.role,
    "President",
    "First living player out should be President",
  );
  assert.strictEqual(
    g.players.find((p) => p.id === DEAD_HAND_ID)!.role,
    "Neutral",
    "Dead hand must stay Neutral",
  );

  g.players.find((p) => p.id === "guest")!.hand = [];
  syncFinishedFromEmptyHands(g);
  const order = livingFinishedOrder(g.players, g.finishedOrder);
  assert.deepStrictEqual(order, ["host", "guest"]);
  assert.strictEqual(g.players.find((p) => p.id === "guest")!.role, "Asshole");

  const ceremonyPlayers = g.players.map((p) => ({
    ...p,
    hand: [{ suit: "clubs" as const, value: 3 }],
  }));
  applyFinishOrderRoles(ceremonyPlayers, order);
  const trades = applyMandatoryTrades(ceremonyPlayers);
  assert.strictEqual(trades.length, 1);
  assert.notStrictEqual(trades[0].winnerId, DEAD_HAND_ID);
  assert.strictEqual(trades[0].winnerId, "host");
}

console.log("Dead hand role/trade tests passed");

// After role trades, opener is whoever holds 3♣ (not dealer's left).
{
  const base = createGame(["Pres", "Mid", "Ass"]);
  const lastOrder = ["1", "2", "3"];
  base.lastRoundOrder = lastOrder;
  const players = clonePlayersForRound(base.players);
  applyFinishOrderRoles(players, lastOrder);
  players[0].hand = [{ suit: "hearts", value: 14 }];
  players[1].hand = [{ suit: "diamonds", value: 8 }];
  players[2].hand = [
    { suit: "clubs", value: 3 },
    { suit: "spades", value: 5 },
  ];

  const dealerLeftIdx = resolveOpeningPlayerIndex(players, {
    lastRoundOrder: lastOrder,
  });
  assert.notStrictEqual(
    dealerLeftIdx,
    2,
    "Dealer's-left opener should differ from 3♣ holder in this layout",
  );

  assert.strictEqual(
    resolveLeadPlayerIndexAfterTrades(players, { lastRoundOrder: lastOrder }),
    2,
    "Living 3♣ holder leads after trades",
  );

  const next = buildFreshRoundState(base, players, { lastRoundOrder: lastOrder });
  assert.strictEqual(
    next.currentPlayerIndex,
    2,
    "buildFreshRoundState should open on 3♣ after prior-round trades",
  );
}

{
  const base = createGame(["Pres", "Ass"]);
  const lastOrder = ["1", "2"];
  base.lastRoundOrder = lastOrder;
  const players = clonePlayersForRound(base.players);
  applyFinishOrderRoles(players, lastOrder);
  players[0].hand = [{ suit: "hearts", value: 14 }, { suit: "clubs", value: 3 }];
  players[1].hand = [{ suit: "diamonds", value: 4 }];
  const trades = applyMandatoryTrades(players);
  assert.strictEqual(trades.length, 1);
  completeWinnerReturn(players, trades[0], [{ suit: "clubs", value: 3 }]);
  assert.ok(
    players[1].hand.some((c) => c.suit === "clubs" && c.value === 3),
    "Asshole receives 3♣ when president returns it",
  );
  assert.strictEqual(
    resolveLeadPlayerIndexAfterTrades(players, { lastRoundOrder: lastOrder }),
    1,
    "Asshole leads when 3♣ was traded back to them",
  );
  const next = buildFreshRoundState(base, players, { lastRoundOrder: lastOrder });
  assert.strictEqual(
    next.currentPlayerIndex,
    1,
    "buildFreshRoundState opens on asshole after 3♣ trade return",
  );
}

{
  const base = createGame(["Pres", "Ass"]);
  const lastOrder = ["1", "2"];
  base.lastRoundOrder = lastOrder;
  const players = clonePlayersForRound(base.players);
  applyFinishOrderRoles(players, lastOrder);
  players[0].hand = [{ suit: "hearts", value: 14 }, { suit: "diamonds", value: 4 }];
  players[1].hand = [{ suit: "clubs", value: 3 }];
  const trades = applyMandatoryTrades(players);
  assert.strictEqual(trades.length, 1);
  completeWinnerReturn(players, trades[0], [{ suit: "diamonds", value: 4 }]);
  assert.ok(
    players[1].hand.some((c) => c.suit === "clubs" && c.value === 3),
    "Asshole keeps or receives 3♣ through trade returns",
  );
  assert.strictEqual(
    resolveLeadPlayerIndexAfterTrades(players, { lastRoundOrder: lastOrder }),
    1,
    "Asshole leads when holding 3♣ after president trade return",
  );
}

console.log("Post-trade 3♣ opener tests passed");

// Last remaining player finishes the round even with cards left in hand.
{
  const g = createGame(["A", "B", "C"]);
  g.players[0].hand = [];
  g.players[1].hand = [];
  g.players[2].hand = [
    { suit: "hearts" as const, value: 14 },
    { suit: "spades" as const, value: 13 },
    { suit: "clubs" as const, value: 12 },
  ];
  g.finishedOrder = [g.players[0].id, g.players[1].id];
  syncFinishedFromEmptyHands(g);
  assert.ok(
    isRoundCompleteForLiving(g),
    "Round should end when only one living player remains",
  );
  assert.ok(
    g.finishedOrder.includes(g.players[2].id),
    "Last player should be placed even with cards left",
  );
  assert.strictEqual(g.players[2].role, "Asshole");
  assert.strictEqual(g.players[2].hand.length, 3, "Cards stay in hand");
}

console.log("Lone remaining player tests passed");

// Mandatory trade: asshole gives joker over 2 when both are held
{
  const hand: Card[] = [
    { suit: "joker", value: 16 },
    { suit: "hearts", value: 15 },
    { suit: "spades", value: 14 },
  ];
  const given = pickHighestCards(hand, 1);
  assert.strictEqual(given.length, 1);
  assert.strictEqual(given[0].suit, "joker");
  assert.strictEqual(given[0].value, 16);
}

console.log("Mandatory trade rank tests passed");

// Fresh round: same Asshole three times → skip President trade on round 4
{
  let streak = advanceAssholeStreakAfterRound(
    { consecutiveAssholeId: null, consecutiveAssholeCount: 0, freshRound: false },
    ["1", "2", "3"],
    createGame(["P1", "P2", "P3"]).players,
  );
  assert.strictEqual(streak.consecutiveAssholeId, "3");
  assert.strictEqual(streak.consecutiveAssholeCount, 1);
  assert.ok(!shouldSkipPresidentAssholeTrade(streak));

  streak = advanceAssholeStreakAfterRound(streak, ["1", "2", "3"], createGame(["P1", "P2", "P3"]).players);
  assert.strictEqual(streak.consecutiveAssholeCount, 2);
  assert.ok(!shouldSkipPresidentAssholeTrade(streak));

  streak = advanceAssholeStreakAfterRound(streak, ["1", "2", "3"], createGame(["P1", "P2", "P3"]).players);
  assert.strictEqual(streak.consecutiveAssholeCount, 3);
  assert.ok(shouldSkipPresidentAssholeTrade(streak));

  const players = createGame(["P1", "P2", "P3"]).players;
  assignPlayerRoles(players, ["1", "2", "3"]);
  const trades = applyMandatoryTrades(players, { skipPresidentTrade: true });
  assert.strictEqual(trades.length, 0, "Fresh round skips President trade in 3-player game");

  streak = advanceAssholeStreakAfterRound(
    { ...streak, freshRound: true },
    ["1", "2", "3"],
    createGame(["P1", "P2", "P3"]).players,
  );
  assert.strictEqual(streak.consecutiveAssholeCount, 1, "Streak resets after fresh round");
  assert.ok(!shouldSkipPresidentAssholeTrade(streak));

  streak = advanceAssholeStreakAfterRound(streak, ["1", "2", "3"], createGame(["P1", "P2", "P3"]).players);
  assert.strictEqual(streak.consecutiveAssholeCount, 2, "Same Asshole again after fresh round");

  streak = advanceAssholeStreakAfterRound(
    { consecutiveAssholeId: "3", consecutiveAssholeCount: 2, freshRound: false },
    ["1", "3", "2"],
    createGame(["P1", "P2", "P3"]).players,
  );
  assert.strictEqual(streak.consecutiveAssholeId, "2");
  assert.strictEqual(streak.consecutiveAssholeCount, 1, "New Asshole resets streak");
}

{
  const players = createGame(["P1", "P2", "P3", "P4", "P5"]).players;
  players.forEach((p, i) => {
    p.hand = [{ suit: "spades", value: 5 + i }];
  });
  assignPlayerRoles(players, ["1", "2", "3", "4", "5"]);
  const trades = applyMandatoryTrades(players, { skipPresidentTrade: true });
  assert.strictEqual(trades.length, 1, "Fresh round still runs VP trade in 5-player game");
  assert.strictEqual(trades[0].key, "vicePresident");
}

{
  assert.ok(!supportsViceRoles(4));
  assert.ok(supportsViceRoles(5));

  const four = createGame(["P1", "P2", "P3", "P4"]).players;
  assignPlayerRoles(four, ["1", "2", "3", "4"]);
  assert.strictEqual(four.find((p) => p.id === "1")!.role, "President");
  assert.strictEqual(four.find((p) => p.id === "2")!.role, "Neutral");
  assert.strictEqual(four.find((p) => p.id === "4")!.role, "Asshole");
  assert.strictEqual(roleForPlacement(1, 4), "Middle Man");
  four.forEach((p) => {
    p.hand = [{ suit: "spades", value: 10 }];
  });
  assert.strictEqual(applyMandatoryTrades(four).length, 1);

  const five = createGame(["P1", "P2", "P3", "P4", "P5"]).players;
  assignPlayerRoles(five, ["1", "2", "3", "4", "5"]);
  assert.strictEqual(five.find((p) => p.id === "2")!.role, "Vice President");
  assert.strictEqual(five.find((p) => p.id === "3")!.role, "Neutral");
  assert.strictEqual(five.find((p) => p.id === "4")!.role, "Vice Asshole");
  assert.strictEqual(five.find((p) => p.id === "5")!.role, "Asshole");
  assert.strictEqual(roleForPlacement(2, 5), "Middle Man");
  five.forEach((p) => {
    p.hand = [{ suit: "spades", value: 10 }, { suit: "hearts", value: 11 }];
  });
  const fiveTrades = applyMandatoryTrades(five);
  assert.strictEqual(fiveTrades.length, 2);
  assert.deepStrictEqual(
    fiveTrades.map((t) => t.key).sort(),
    ["president", "vicePresident"],
  );

  const six = createGame(["P1", "P2", "P3", "P4", "P5", "P6"]).players;
  assignPlayerRoles(six, ["1", "2", "3", "4", "5", "6"]);
  assert.strictEqual(six.find((p) => p.id === "3")!.role, "Neutral");
  assert.strictEqual(six.find((p) => p.id === "4")!.role, "Neutral");
  assert.strictEqual(roleForPlacement(2, 6), "Middle Man");
  assert.strictEqual(roleForPlacement(3, 6), "Middle Man");
  assert.strictEqual(six.find((p) => p.id === "5")!.role, "Vice Asshole");

  const midRound = createGame(["P1", "P2", "P3", "P4", "P5"]).players;
  applyFinishOrderRoles(midRound, ["1", "2", "3", "4"]);
  assert.strictEqual(midRound.find((p) => p.id === "4")!.role, "Neutral");
  assert.strictEqual(
    midRound.find((p) => p.id === "3")!.role,
    "Neutral",
    "Vice Asshole waits until the round is fully ranked",
  );
}

{
  const players = createGame(["P1", "P2", "P3", "P4"]).players;
  assignPlayerRoles(players, ["1", "2", "3", "4"]);
  players.forEach((p) => {
    p.hand = [
      { suit: "spades", value: 15 },
      { suit: "hearts", value: 14 },
      { suit: "clubs", value: 5 },
    ];
  });
  const localTrades = applyMandatoryTrades(players);
  assert.strictEqual(localTrades.length, 1);

  const incoming = [{ suit: "spades" as const, value: 15 }];
  const serverPending = {
    president: {
      fromId: "4",
      count: 1,
      incoming,
      selected: null,
    },
  };
  const serverRoles = {
    "1": "president",
    "4": "asshole",
  };

  const merged = resolveCeremonyTrades(
    localTrades,
    serverPending,
    serverRoles,
    players,
  );
  assert.strictEqual(
    merged.length,
    1,
    "server pending trades must not duplicate local mandatory trades",
  );
  assert.strictEqual(merged[0]?.key, "president");
  assert.strictEqual(merged[0]?.incoming.length, 1);

  const fromServer = buildTradesFromServerPending(
    players,
    serverRoles,
    serverPending,
  );
  assert.strictEqual(fromServer.length, 1);
}

console.log("Ceremony trade merge tests passed");

console.log("Fresh round tests passed");
