const assert = require('assert');
import { createGame } from "../src/game/core";
import { createDeck } from "../src/game/ruleset";
import {
  playCards,
  passTurn,
  findCPUPlay,
  isValidPlay,
  isSingleJoker,
  isFourOfAKind,
  containsTen,
  hasPassedInCurrentTrick,
  isPlayerStillIn,
  nextActivePlayerIndex,
  isTrickAcknowledgmentPassPhase,
  isTrickOpeningLead,
  resolveCompletedAcknowledgmentTrick,
  nextAcknowledgmentPlayerIndex,
} from "../src/game/core";
import { isDeadHandPlayer } from "../src/game/deadHand";
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

/** Mirrors server advancePastInactiveSeats — skip seats that cannot act. */
function advancePastInactiveSeats(state: ReturnType<typeof createGame>) {
  let working = state;
  let safety = working.players.length + 4;
  while (safety-- > 0) {
    const current = working.players[working.currentPlayerIndex];
    if (!current) break;
    const ackLeaderWait =
      isTrickAcknowledgmentPassPhase(working) &&
      working.lastPlayPlayerIndex === working.currentPlayerIndex;
    const runOnTopTurn =
      working.runOnTop?.active &&
      working.runOnTop.playerIndex === working.currentPlayerIndex;
    const mustOpenTrick =
      working.mustPlay && isTrickOpeningLead(working);
    const inactive =
      isDeadHandPlayer(current) ||
      !isPlayerStillIn(working, current.id) ||
      (hasPassedInCurrentTrick(working, current.id) && !runOnTopTurn) ||
      ackLeaderWait;
    if (!inactive || mustOpenTrick) break;
    if (ackLeaderWait) {
      working.currentPlayerIndex = nextActivePlayerIndex(
        working,
        working.currentPlayerIndex,
      );
      continue;
    }
    if (
      hasPassedInCurrentTrick(working, current.id) &&
      isTrickAcknowledgmentPassPhase(working) &&
      !runOnTopTurn
    ) {
      const pileUp = working.pile.length > 0;
      let resolved = resolveCompletedAcknowledgmentTrick(working);
      if (pileUp && resolved.pile.length === 0) {
        working = resolved;
        continue;
      }
      const nextIdx = nextAcknowledgmentPlayerIndex(
        working,
        working.currentPlayerIndex,
      );
      if (nextIdx !== working.currentPlayerIndex) {
        working.currentPlayerIndex = nextIdx;
        continue;
      }
      resolved = resolveCompletedAcknowledgmentTrick(working);
      if (pileUp && resolved.pile.length === 0) {
        working = resolved;
        continue;
      }
      break;
    }
    const next = passTurn(working, current.id);
    if (next === working) break;
    working = next;
  }
  return working;
}

// 3b) Cross-turn quad with a prior pass — trick clears when the last living opponent passes
(function crossTurnQuadWithPriorPass() {
  const g = createGame(['A', 'B', 'C']);
  g.trickHistory = [{
    trickNumber: 0,
    actions: [{ type: 'play', playerId: '1', playerName: 'init', cards: [{ suit: 'clubs', value: 3 }], timestamp: Date.now() }],
    winnerId: '1',
    winnerName: 'init',
  }];
  const tricksBefore = g.trickHistory.length;
  g.pile = [];
  g.pileHistory = [];
  g.currentPlayerIndex = 0;
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.players[0].hand = [{ suit: 'spades', value: 5 }, { suit: 'clubs', value: 7 }];
  g.players[1].hand = [{ suit: 'diamonds', value: 8 }];
  g.players[2].hand = [
    { suit: 'diamonds', value: 5 },
    { suit: 'clubs', value: 5 },
    { suit: 'spades', value: 5 },
    { suit: 'hearts', value: 9 },
  ];

  let s = playCards(g, g.players[0].id, [{ suit: 'spades', value: 5 }]);
  assert.strictEqual(s.players[s.currentPlayerIndex].id, g.players[1].id);

  s = passTurn(s, g.players[1].id);
  assert.ok(hasPassedInCurrentTrick(s, g.players[1].id), 'B should have passed before the quad close');

  s = playCards(s, g.players[2].id, [
    { suit: 'diamonds', value: 5 },
    { suit: 'clubs', value: 5 },
    { suit: 'spades', value: 5 },
  ]);
  assert.ok(s.fourOfAKindChallenge?.completedAcrossTurns);
  assert.strictEqual(
    s.players[s.currentPlayerIndex].id,
    g.players[0].id,
    'After cross-turn quad close, first living opponent must act',
  );

  s = passTurn(s, g.players[0].id);
  assert.strictEqual(s.pile.length, 0, 'Trick clears once remaining opponents have passed');
  assert.strictEqual(s.trickHistory?.length, tricksBefore + 1);
  assert.strictEqual(s.players[s.currentPlayerIndex].id, g.players[2].id);
  assert.strictEqual(s.mustPlay, true, 'Quad completer leads the next trick');

  // Mid-trick desync: turn wrongly lands on B who already passed this trick.
  const stuck = createGame(['A', 'B', 'C']);
  stuck.trickHistory = [{ trickNumber: 0, actions: [], winnerId: '1', winnerName: 'init' }];
  stuck.pile = [{ suit: 'spades', value: 5 }, { suit: 'diamonds', value: 5 }, { suit: 'clubs', value: 5 }, { suit: 'hearts', value: 5 }];
  stuck.pileHistory = [[{ suit: 'spades', value: 5 }], [{ suit: 'diamonds', value: 5 }, { suit: 'clubs', value: 5 }, { suit: 'hearts', value: 5 }]];
  stuck.currentTrick = {
    trickNumber: 1,
    actions: [
      { type: 'play', playerId: stuck.players[0].id, playerName: 'A', cards: [{ suit: 'spades', value: 5 }], timestamp: 1 },
      { type: 'pass', playerId: stuck.players[1].id, playerName: 'B', timestamp: 2 },
      { type: 'play', playerId: stuck.players[2].id, playerName: 'C', cards: [{ suit: 'diamonds', value: 5 }, { suit: 'clubs', value: 5 }, { suit: 'hearts', value: 5 }], timestamp: 3 },
    ],
  };
  stuck.fourOfAKindChallenge = { active: true, value: 5, starterIndex: 2, completedAcrossTurns: true };
  stuck.lastPlayPlayerIndex = 2;
  stuck.currentPlayerIndex = 1;
  stuck.passCount = 1;

  const fixed = advancePastInactiveSeats(stuck);
  assert.strictEqual(
    fixed.players[fixed.currentPlayerIndex].id,
    stuck.players[0].id,
    'Inactive-seat advance should skip a prior passer and land on the next living opponent',
  );
  assert.ok(fixed.fourOfAKindChallenge?.completedAcrossTurns);
  assert.strictEqual(fixed.pile.length, 4, 'Trick should stay open until the remaining opponent passes');
  console.log('PASS: cross-turn quad with prior pass + inactive seat advance');
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

// 5) 10 completing a 3-card run (8-9-10) must not trigger higher/lower
(function tenRuleWhenCompletingRun() {
  const eight: Card = { suit: 'hearts', value: 8 };
  const nine: Card = { suit: 'clubs', value: 9 };
  const ten: Card = { suit: 'diamonds', value: 10 };
  const g = createGame(['A', 'B', 'C']);
  g.pile = [nine];
  g.pileHistory = [[eight], [nine]];
  g.pileOwners = ['1', '2'];
  g.currentTrick = {
    trickNumber: 1,
    actions: [
      { type: 'play', playerId: '1', playerName: 'A', cards: [eight], timestamp: 1 },
      { type: 'play', playerId: '2', playerName: 'B', cards: [nine], timestamp: 2 },
    ],
  };
  g.currentPlayerIndex = 2;
  g.players[2].hand = [ten, { suit: 'spades', value: 5 }];
  g.trickHistory = [{ trickNumber: 0, actions: [{ type: 'play', playerId: '1', playerName: 'A', cards: [{ suit: 'spades', value: 3 }], timestamp: 0 }] }];
  g.started = true;
  g.mustPlay = false;

  const s = playCards(g, g.players[2].id, [ten]);
  assert(!s.tenRulePending, '10-rule must not activate when 10 completes 8-9-10 run');
  assert.strictEqual(s.pile[0].value, 10, '10 should land on the pile');
  assert(!s.tenRule?.active, 'tenRule should stay inactive during run');
  console.log('PASS: 10-rule not activated when 10 completes run');
})();

// 6) Triple aces as last cards — trick winner out, next player must open
(function tripleAcesWinnerOutNextMustPlay() {
  function triple(v: number): Card[] {
    return [
      { suit: 'hearts', value: v },
      { suit: 'diamonds', value: v },
      { suit: 'clubs', value: v },
    ];
  }

  const g = createGame(['A', 'B', 'C', 'D']);
  g.trickHistory = [{ trickNumber: 0, actions: [] }];
  g.currentTrick = {
    trickNumber: 1,
    actions: [
      { type: 'play', playerId: '1', playerName: 'A', cards: triple(5), timestamp: 1 },
      { type: 'play', playerId: '2', playerName: 'B', cards: triple(6), timestamp: 2 },
      { type: 'play', playerId: '3', playerName: 'C', cards: triple(13), timestamp: 3 },
    ],
  };
  g.pile = triple(13);
  g.pileHistory = [triple(5), triple(6), triple(13)];
  g.pileOwners = ['1', '2', '3'];
  g.lastPlayPlayerIndex = 2;
  g.currentPlayerIndex = 3;
  g.players[3].hand = triple(14);
  g.players[0].hand = [{ suit: 'spades', value: 4 }];
  g.players[1].hand = [{ suit: 'spades', value: 7 }];
  g.players[2].hand = [{ suit: 'spades', value: 8 }];

  let s = playCards(g, g.players[3].id, triple(14));
  assert(s.finishedOrder.includes('4'), 'AAA player should be out');

  // Turn advances to A; remaining players pass in order.
  s = passTurn(s, '1');
  s = passTurn(s, '2');
  s = passTurn(s, '3');

  assert.strictEqual(s.pile.length, 0, 'trick pile should clear after passes');
  assert((s.trickHistory?.length ?? 0) >= 2, 'trick should be recorded');
  assert(s.mustPlay, 'next living player must open after out winner');
  assert(
    isPlayerStillIn(s, s.players[s.currentPlayerIndex].id),
    'turn should be on a living player',
  );
  console.log('PASS: triple aces winner out — next player mustPlay to open');
})();

console.log('All edge-case tests passed');
