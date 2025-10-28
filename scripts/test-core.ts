const assert = require("assert");
import { createDeck, shuffleDeck } from "../src/game/ruleset";
import { Card } from "../src/game/ruleset";
import {
  GameState,
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
  nextActivePlayerIndex
} from "../src/game/core";

// Basic deck tests
const deck = createDeck();
// Deck includes two jokers by design -> 54 cards total
assert.strictEqual(deck.length, 54, "Deck should have 54 cards (includes 2 jokers)");

const shuffled = shuffleDeck(createDeck());
assert.strictEqual(shuffled.length, 54, "Shuffled deck should have 54 cards (includes 2 jokers)");

// isValidPlay tests
const single: Card[] = [{ suit: "hearts", value: 10 }];
const pileEmpty: Card[] = [];
assert.strictEqual(isValidPlay(single, pileEmpty), true, "Single on empty pile allowed");

const pile: Card[] = [{ suit: "spades", value: 9 }];
assert.strictEqual(isValidPlay(single, pile), true, "10 > 9 should be valid");

const equalPile: Card[] = [{ suit: "spades", value: 10 }];
assert.strictEqual(isValidPlay(single, equalPile), false, "equal value not allowed");

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
  isValidPlay([ten], pileAfterNine, undefined, history789),
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
  isValidPlay([jack], [ten], undefined, history78910),
  true,
  "Jack should be allowed after 10 in run context"
);
assert.strictEqual(
  isValidPlay([nine], [ten], undefined, history78910),
  true,
  "9 should be allowed after 10 in run context"
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

  // Force it to be P2's turn and attempt to play (even though they passed earlier this trick)
  s.currentPlayerIndex = 1;
  const beforeHandLen = s.players[1].hand.length;
  const s2 = playCards(s, g.players[1].id, [sixH]);
  // The engine should convert this attempt into a pass (playCards -> passTurn) and not change hand
  assert.strictEqual(s2.players[1].hand.length, beforeHandLen, "P2 hand should be unchanged when attempting to play after passing");
  assert.ok(s2.currentTrick && s2.currentTrick.actions.filter((a:any)=>a.type==='pass' && a.playerId===g.players[1].id).length >= 2, "P2 should now have an additional pass recorded");
}

// 2) A 2 clears the pile and starts a fresh trick; previous passes no longer block
{
  const g = makeEmptyGame(["P1","P2","P3"]);
  const fiveH: Card = { suit: "hearts", value: 5 };
  const twoC: Card = { suit: "clubs", value: 2 };
  const sixH: Card = { suit: "hearts", value: 6 };
  g.players[0].hand = [fiveH];
  g.players[1].hand = [sixH];
  g.players[2].hand = [twoC];
  g.currentPlayerIndex = 0;
  let s = playCards(g, g.players[0].id, [fiveH]); // P1 plays
  s = passTurn(s, g.players[1].id); // P2 passes
  s = playCards(s, g.players[2].id, [twoC]); // P3 plays 2 -> clears & starts fresh trick
  assert.ok(s.currentTrick && s.currentTrick.actions.length === 0, "After 2, currentTrick should reset for fresh passes/plays");
  // Now P2 should be eligible to play again (no pass recorded in the new trick)
  s.currentPlayerIndex = 1;
  const s2 = playCards(s, g.players[1].id, [sixH]);
  assert.notStrictEqual(s2, s, "P2 should be able to play in the new trick after a 2 cleared");
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

console.log("Pass-lock and 8-player tests passed");
