"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require('assert');
const core_1 = require("../src/game/core");
const ruleset_1 = require("../src/game/ruleset");
console.log('Running edge-case tests...');
(function humanPassScenario() {
    const g = (0, core_1.createGame)(['P1', 'P2', 'P3']);
    g.pile = [{ suit: 'spades', value: 14 }];
    g.pileHistory = g.pileHistory || [];
    g.currentPlayerIndex = 0;
    g.mustPlay = true;
    g.players[0].hand = [{ suit: 'hearts', value: 3 }, { suit: 'clubs', value: 4 }];
    const possible = (0, core_1.findCPUPlay)(g.players[0].hand, g.pile, g.tenRule, g.pileHistory, g.fourOfAKindChallenge, g.currentTrick, g.players, g.finishedOrder);
    assert.strictEqual(possible, null, 'No valid play should be available when mustPlay and cannot beat pile');
    const next = (0, core_1.passTurn)(g, g.players[0].id);
    assert.notStrictEqual(next, g, 'passTurn should return a new state when pass is accepted');
    console.log('PASS: human-pass scenario');
})();
(function twoVsJokerScenario() {
    const g = (0, core_1.createGame)(['A', 'B', 'C']);
    const four5s = [
        { suit: 'hearts', value: 5 },
        { suit: 'diamonds', value: 5 },
        { suit: 'clubs', value: 5 },
        { suit: 'spades', value: 5 }
    ];
    // Ensure it's player 0's turn and they have those cards
    g.currentPlayerIndex = 0;
    g.players[0].hand = four5s.slice();
    // Ensure this is not treated as the game's very first play (bypass 3♣ rule)
    g.trickHistory = [{ trickNumber: 0, actions: [{ type: 'play', playerId: '0', playerName: 'init', cards: [{ suit: 'clubs', value: 3 }], timestamp: Date.now() }], winnerId: '0', winnerName: 'init' }];
    const s1 = (0, core_1.playCards)(g, g.players[0].id, four5s);
    assert(s1.fourOfAKindChallenge && s1.fourOfAKindChallenge.active, 'Four-of-a-kind challenge should be active after playing 4 of a kind');
    const joker = [{ suit: 'joker', value: 15 }];
    // ensure it's the next player's turn and they have the joker
    const nextIdx = s1.currentPlayerIndex;
    const nextPlayerId = s1.players[nextIdx].id;
    s1.currentPlayerIndex = nextIdx;
    s1.players[nextIdx].hand = joker.slice();
    console.log('DEBUG before joker: currentTrick=', JSON.stringify(s1.currentTrick));
    console.log('DEBUG before joker: pile=', JSON.stringify(s1.pile));
    console.log('DEBUG before joker: fourOfAKindChallenge=', JSON.stringify(s1.fourOfAKindChallenge));
    const s2 = (0, core_1.playCards)(s1, nextPlayerId, joker);
    console.log('DEBUG s2.lastClear =', JSON.stringify(s2.lastClear));
    // Joker will conclude the trick; lastClear is cleared when trick finalizes.
    // Instead assert the trickHistory recorded the joker as winner and the four-of-a-kind challenge cleared.
    assert(s2.trickHistory && s2.trickHistory.length > 0 && s2.trickHistory[s2.trickHistory.length - 1].winnerId === nextPlayerId, 'Joker should have ended the trick with joker player as winner');
    assert(!s2.fourOfAKindChallenge || !s2.fourOfAKindChallenge.active, 'Four-of-a-kind challenge should be cleared by Joker');
    console.log('PASS: 4-of-a-kind beaten by Joker');
})();
(function tenRuleDuringRun() {
    const g = (0, core_1.createGame)(['X', 'Y', 'Z']);
    g.pileHistory = [[{ suit: 'hearts', value: 3 }], [{ suit: 'hearts', value: 4 }], [{ suit: 'hearts', value: 5 }]];
    g.pile = [{ suit: 'hearts', value: 5 }];
    g.currentPlayerIndex = 0;
    const tens = [{ suit: 'hearts', value: 10 }];
    const s = (0, core_1.playCards)(g, g.players[0].id, tens);
    assert(!s.tenRulePending, '10-rule should not be pending when playing on a run');
    console.log('PASS: 10-rule not activated during run');
})();
console.log('All edge-case tests passed');
