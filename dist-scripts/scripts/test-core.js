"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const ruleset_1 = require("../src/game/ruleset");
const core_1 = require("../src/game/core");
// Basic deck tests
const deck = (0, ruleset_1.createDeck)();
assert.strictEqual(deck.length, 52, "Deck should have 52 cards");
const shuffled = (0, ruleset_1.shuffleDeck)((0, ruleset_1.createDeck)());
assert.strictEqual(shuffled.length, 52, "Shuffled deck should have 52 cards");
// isValidPlay tests
const single = [{ suit: "hearts", value: 10 }];
const pileEmpty = [];
assert.strictEqual((0, core_1.isValidPlay)(single, pileEmpty), true, "Single on empty pile allowed");
const pile = [{ suit: "spades", value: 9 }];
assert.strictEqual((0, core_1.isValidPlay)(single, pile), true, "10 > 9 should be valid");
const equalPile = [{ suit: "spades", value: 10 }];
assert.strictEqual((0, core_1.isValidPlay)(single, equalPile), false, "equal value not allowed");
// two clear
const twoCard = [{ suit: "clubs", value: 2 }];
assert.strictEqual((0, core_1.containsTwo)(twoCard), true, "containsTwo should detect 2");
// four of a kind
const four = [
    { suit: "hearts", value: 5 },
    { suit: "spades", value: 5 },
    { suit: "clubs", value: 5 },
    { suit: "diamonds", value: 5 },
];
assert.strictEqual((0, core_1.isFourOfAKind)(four), true, "four of a kind detected");
console.log("All core tests passed");
