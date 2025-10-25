const assert = require("assert");
import { createDeck, shuffleDeck } from "../src/game/ruleset";
import { Card } from "../src/game/ruleset";
import { getPlayCount, getHighestValue, isValidPlay, containsTwo, isFourOfAKind } from "../src/game/core";

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
