const assert = require("assert");
import { createDeck, shuffleDeck } from "../src/game/ruleset";
import { Card } from "../src/game/ruleset";
import { getPlayCount, getHighestValue, isValidPlay, containsTwo, isFourOfAKind } from "../src/game/core";

// Basic deck tests
const deck = createDeck();
assert.strictEqual(deck.length, 52, "Deck should have 52 cards");

const shuffled = shuffleDeck(createDeck());
assert.strictEqual(shuffled.length, 52, "Shuffled deck should have 52 cards");

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
