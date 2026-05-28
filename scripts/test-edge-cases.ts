const assert = require('assert');
import { createGame } from "../src/game/core";
import { createDeck } from "../src/game/ruleset";
import { playCards, passTurn, findCPUPlay, isValidPlay, isSingleJoker, isFourOfAKind, containsTen } from "../src/game/core";
import { Card } from "../src/game/ruleset";

console.log('Running edge-case tests...');

// 1) Human-pass scenario: mustPlay but no valid play -> pass allowed
(function humanPassScenario() {
  const g = createGame(['P1','P2','P3']);
  // set a pile that is high (Ace), so P1 cannot beat it with low cards
  g.pile = [{ suit: 'spades', value: 14 }];
  g.pileHistory = g.pileHistory || [];
  g.currentPlayerIndex = 0; // P1
  g.mustPlay = true;
  // give P1 low cards only
  g.players[0].hand = [{ suit: 'hearts', value: 3 }, { suit: 'clubs', value: 4 }];

  const possible = findCPUPlay(g.players[0].hand, g.pile, g.tenRule, g.pileHistory, g.fourOfAKindChallenge, g.currentTrick, g.players, g.finishedOrder);
  assert.strictEqual(possible, null, 'No valid play should be available when mustPlay and cannot beat pile');

  const next = passTurn(g, g.players[0].id);
  assert.notStrictEqual(next, g, 'passTurn should return a new state when pass is accepted');
  console.log('PASS: human-pass scenario');
})();

// 2) Single-play four-of-a-kind bomb beaten by joker
(function singlePlayBombJokerScenario() {
  const g = createGame(['A','B','C']);
  const four5s: Card[] = [
    { suit: 'hearts', value: 5 },
    { suit: 'diamonds', value: 5 },
    { suit: 'clubs', value: 5 },
    { suit: 'spades', value: 5 }
  ];
  g.currentPlayerIndex = 0;
  g.players[0].hand = four5s.slice();
  g.trickHistory = [{ trickNumber: 0, actions: [{ type: 'play', playerId: '0', playerName: 'init', cards: [{ suit: 'clubs', value: 3 }], timestamp: Date.now() }], winnerId: '0', winnerName: 'init' }];
  const s1 = playCards(g, g.players[0].id, four5s);
  assert(s1.fourOfAKindChallenge && s1.fourOfAKindChallenge.active, 'Four-of-a-kind challenge should be active after playing 4 of a kind');
  assert.strictEqual(s1.fourOfAKindChallenge.completedAcrossTurns, false, 'Single-play bomb should not be marked cross-turn');

  const joker: Card[] = [{ suit: 'joker', value: 16 }];
  const nextIdx = s1.currentPlayerIndex;
  const nextPlayerId = s1.players[nextIdx].id;
  s1.players[nextIdx].hand = joker.slice();
  const s2 = playCards(s1, nextPlayerId, joker);
  assert.notStrictEqual(s2, s1, 'Joker should beat a single-play quad bomb');
  assert(!s2.fourOfAKindChallenge || !s2.fourOfAKindChallenge.active, 'Challenge cleared by joker');
  console.log('PASS: single-play bomb beaten by joker');
})();

// 3) Cross-turn quad completion is unbeatable
(function crossTurnQuadScenario() {
  const g = createGame(['A','B','C']);
  g.trickHistory = [{ trickNumber: 0, actions: [{ type: 'play', playerId: '1', playerName: 'init', cards: [{ suit: 'clubs', value: 3 }], timestamp: Date.now() }], winnerId: '1', winnerName: 'init' }];
  g.pile = [{ suit: 'hearts', value: 5 }];
  g.pileHistory = [[{ suit: 'hearts', value: 5 }]];
  g.currentPlayerIndex = 1;
  g.players[1].hand = [
    { suit: 'diamonds', value: 5 },
    { suit: 'clubs', value: 5 },
    { suit: 'spades', value: 5 },
  ];
  g.players[0].hand = [{ suit: 'joker', value: 16 }];

  const s1 = playCards(g, g.players[1].id, g.players[1].hand.slice());
  assert(s1.fourOfAKindChallenge?.completedAcrossTurns, 'Cross-turn completion should be marked unbeatable');

  const joker: Card[] = [{ suit: 'joker', value: 16 }];
  const nextIdx = s1.currentPlayerIndex;
  const nextPlayerId = s1.players[nextIdx].id;
  s1.players[nextIdx].hand = joker.slice();
  const blocked = playCards(s1, nextPlayerId, joker);
  assert.strictEqual(blocked, s1, 'Joker should not beat cross-turn completed quad');

  s1.players[nextIdx].hand = joker.slice();
  const afterPass = passTurn(s1, nextPlayerId);
  assert.notStrictEqual(afterPass, s1, 'Player should pass on cross-turn completed quad');
  console.log('PASS: cross-turn quad unbeatable');
})();

// 4) 10-rule should NOT activate when pile is a run
(function tenRuleDuringRun() {
  const g = createGame(['X','Y','Z']);
  g.pileHistory = [[{ suit: 'hearts', value: 3 }], [{ suit: 'hearts', value: 4 }], [{ suit: 'hearts', value: 5 }]];
  g.pile = [{ suit: 'hearts', value: 5 }];
  g.currentPlayerIndex = 0;

  const tens: Card[] = [{ suit: 'hearts', value: 10 }];
  const s = playCards(g, g.players[0].id, tens);
  assert(!s.tenRulePending, '10-rule should not be pending when playing on a run');
  console.log('PASS: 10-rule not activated during run');
})();

console.log('All edge-case tests passed');
