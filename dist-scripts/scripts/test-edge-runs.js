// Tests: run-from-consecutive-players, 10/Joker exclusion from runs, four-of-a-kind vs joker precedence
const core = require('../src/game/core');

function card(v, suit = 'spades') { return { value: v, suit }; }

console.log('Running edge-case run tests...');

(function test_run_from_pileHistory() {
  // effectivePile should recognize a run formed by recent single-card pileHistory entries [3],[4],[5]
  const pile = [ card(5) ];
  const pileHistory = [ [ card(3) ], [ card(4) ], [ card(5) ] ];
  const eff = core.effectivePile(pile, pileHistory);
  const vals = eff.map(c => c.value);
  if (vals.length === 3 && vals[0] === 3 && vals[1] === 4 && vals[2] === 5) {
    console.log('PASS: effectivePile recognized run [3,4,5] from pileHistory');
  } else {
    console.error('FAIL: effectivePile', vals);
    process.exitCode = 2;
  }
})();

(function test_ten_joker_exclusion_from_runs() {
  // If a run contains a 10 or Joker within recent single plays, it should not be considered
  const ct1 = { trickNumber: 1, actions: [
    { type: 'play', playerId: '1', playerName: 'P1', cards: [card(8)], timestamp: Date.now() - 3000 },
    { type: 'play', playerId: '2', playerName: 'P2', cards: [card(9)], timestamp: Date.now() - 2000 },
    { type: 'play', playerId: '3', playerName: 'P3', cards: [card(10)], timestamp: Date.now() - 1000 },
  ] };
  const players = [ { id: '1' }, { id: '2' }, { id: '3' } ];
  const run1 = core.runFromCurrentTrick(ct1, players, []);
  if (run1.length === 0) console.log('PASS: 10 excluded from run detection');
  else { console.error('FAIL: 10 was included in run detection', run1.map(c=>c.value)); process.exitCode = 3; }

  const ct2 = { trickNumber: 1, actions: [
    { type: 'play', playerId: '1', playerName: 'P1', cards: [card(11)], timestamp: Date.now() - 3000 },
    { type: 'play', playerId: '2', playerName: 'P2', cards: [ { value: 15, suit: 'joker' } ], timestamp: Date.now() - 2000 },
    { type: 'play', playerId: '3', playerName: 'P3', cards: [card(13)], timestamp: Date.now() - 1000 },
  ] };
  const run2 = core.runFromCurrentTrick(ct2, players, []);
  if (run2.length === 0) console.log('PASS: Joker excluded from run detection');
  else { console.error('FAIL: Joker was included in run detection', run2.map(c=>c.value)); process.exitCode = 4; }
})();

(function test_four_of_a_kind_and_joker_precedence() {
  // Create a state where a four-of-a-kind was played and then a joker clears it
  const state = {
    id: 'g-edge',
    players: [ { id: '1', name: 'P1', hand: [] }, { id: '2', name: 'P2', hand: [] } ],
    currentPlayerIndex: 0,
    pile: [],
    pileHistory: [],
    passCount: 0,
    finishedOrder: [],
    started: true,
    lastPlayPlayerIndex: null,
    mustPlay: false,
    trickHistory: [],
    currentTrick: { trickNumber: 1, actions: [] },
    fourOfAKindChallenge: undefined,
  };

  // Verify four-of-a-kind detection and that a single joker is considered valid to beat an active challenge
  const four6 = [ card(6), card(6), card(6), card(6) ];
  const jok = [ { value: 15, suit: 'joker' } ];

  if (!core.isFourOfAKind(four6)) {
    console.error('FAIL: isFourOfAKind returned false for four6');
    process.exitCode = 5;
    return;
  }

  // Simulate an active four-of-a-kind challenge and check if a joker is a valid response
  const fourChallenge = { active: true, value: 6, starterIndex: 0 };
  const pileWithFour = four6.slice();
  const jokerValid = core.isValidPlay(jok, pileWithFour, undefined, undefined, fourChallenge);
  if (jokerValid) {
    console.log('PASS: single Joker beats active four-of-a-kind challenge via isValidPlay');
  } else {
    console.error('FAIL: single Joker did not beat four-of-a-kind via isValidPlay');
    process.exitCode = 5;
  }
})();

console.log('edge-case run tests completed');
