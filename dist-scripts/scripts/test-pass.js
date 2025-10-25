// Simple node test for passTurn behavior using compiled core in dist-scripts
const core = require('../src/game/core');

function card(v, suit = 'spades') { return { value: v, suit }; }

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

console.log('Running passTurn tests...');

// Test 1: trick ends when all other active players pass -> pile cleared and leader leads
(function test_trick_end_on_all_passes() {
  const players = [
    { id: '1', name: 'P1', hand: [card(9)] },
    { id: '2', name: 'P2', hand: [card(10)] },
    { id: '3', name: 'P3', hand: [card(11)] },
    { id: '4', name: 'P4', hand: [card(12)] },
  ];

  const state = {
    id: 'g1',
    players,
    currentPlayerIndex: 1, // P2 to act
    pile: [ card(8) ],
    pileHistory: [ [ card(8) ] ],
    passCount: 0,
    finishedOrder: [],
    started: true,
    lastPlayPlayerIndex: 0, // P1 was last to play and is leader
    mustPlay: false,
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [ { type: 'play', playerId: '1', playerName: 'P1', cards: [card(8)], timestamp: Date.now() } ] }
  };

  let s = deepClone(state);
  s = core.passTurn(s, '2'); // P2 passes
  s = core.passTurn(s, '3'); // P3 passes
  s = core.passTurn(s, '4'); // P4 passes -> should end trick and set P1 as leader

  const cond1 = Array.isArray(s.pile) && s.pile.length === 0;
  const cond2 = s.currentPlayerIndex === 0;
  const cond3 = s.currentTrick && s.currentTrick.trickNumber === 2; // new trick created

  if (cond1 && cond2 && cond3) {
    console.log('PASS: trick end on all passes');
  } else {
    console.error('FAIL: trick end on all passes', { pileLen: s.pile.length, currentPlayerIndex: s.currentPlayerIndex, trickNumber: s.currentTrick && s.currentTrick.trickNumber });
    process.exitCode = 2;
  }
})();

// Test 2: mustPlay true but player has no valid play -> allow pass to avoid deadlock
(function test_mustplay_allow_pass_when_no_valid() {
  const players = [
    { id: '1', name: 'P1', hand: [card(3)] },
    { id: '2', name: 'P2', hand: [card(4)] },
  ];

  // pile requires a card higher than Ace (simulate with Ace so small hand cannot beat it)
  const state = {
    id: 'g2',
    players,
    currentPlayerIndex: 0,
    pile: [ card(14) ], // Ace
    pileHistory: [ [ card(14) ] ],
    passCount: 0,
    finishedOrder: [],
    started: true,
    lastPlayPlayerIndex: 1, // P2 last played
    mustPlay: true,
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [ { type: 'play', playerId: '2', playerName: 'P2', cards: [card(14)], timestamp: Date.now() } ] }
  };

  const before = deepClone(state);
  const after = core.passTurn(state, '1');

  // passTurn should allow the pass because P1 has no valid play; currentPlayerIndex should advance
  if (after !== before && after.currentPlayerIndex !== before.currentPlayerIndex) {
    console.log('PASS: mustPlay allowed pass when no valid play');
  } else {
    console.error('FAIL: mustPlay did not allow pass when no valid play', { beforeCurrent: before.currentPlayerIndex, afterCurrent: after.currentPlayerIndex });
    process.exitCode = 3;
  }
})();

console.log('passTurn tests completed');
