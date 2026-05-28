import * as assert from "assert";
import { createDeck, shuffleDeck } from "../src/game/ruleset";
import type { Card, Player } from "../src/game/ruleset";
import type { GameState } from "../src/game/core";
import {
  createDeadHandPlayer,
  DEAD_HAND_ID,
  applyDeadHandAfterDeal,
  livingFinishedOrder,
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
} from "../src/game/core";
import { applyMandatoryTrades } from "../src/game/roundPrep";
import { applyFinishOrderRoles } from "../src/utils/roundRoles";
import {
  resolveFirstRoundLeadPlayerIndex,
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
  isValidPlay([ka2Ace], [ka2Two], undefined, undefined, undefined, undefined, trickKA2),
  true,
  "Ace should be valid adjacency on 2 after K-A-2 run"
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
  return g;
}

// 1) Joker must not reset passes; previously passed players remain locked until trick ends
{
  const g = makeEmptyGame(["P1","P2","P3","P4"]);
  // Hands
  const fiveH: Card = { suit: "hearts", value: 5 };
  const sixH: Card = { suit: "hearts", value: 6 };
  const sevenH: Card = { suit: "hearts", value: 7 };
  const joker: Card = { suit: "joker", value: 15 };
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
  const jokerA: Card = { suit: "joker", value: 15 };
  const jokerB: Card = { suit: "joker", value: 15 };
  g.players[0].hand = [jokerA, jokerB];
  g.currentPlayerIndex = 0;

  const s = playCards(g, g.players[0].id, [jokerA]);
  assert.strictEqual(s.players[0].hand.length, 1, "Playing one joker should leave one joker in hand");
  assert.strictEqual(s.players[0].hand[0].value, 15, "Remaining card should still be a joker");
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
  // Give A the 5H, others empty hands so they can pass
  g.players[0].hand = [fiveH];
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

// Joker beats a pair on the pile when the trick had an earlier run but the pile is not in run context
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
