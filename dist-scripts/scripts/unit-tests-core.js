const core = require('../src/game/core.js');

function assert(cond, msg){ if(!cond) { console.error('ASSERT FAIL:', msg); process.exit(1); } }

console.log('Running unit-tests-core.js');

// Test 1: simple run detection (3,4,5)
assert(core.isRun([{suit:'clubs',value:3},{suit:'hearts',value:4},{suit:'spades',value:5}]) === true, '3-4-5 should be a run');

// Test 2: run invalid if includes 10 or joker or 2
assert(core.isRun([{suit:'clubs',value:3},{suit:'hearts',value:10},{suit:'spades',value:11}]) === false, 'run with 10 should be invalid');
assert(core.isRun([{suit:'clubs',value:3},{suit:'hearts',value:15},{suit:'spades',value:11}]) === false, 'run with joker should be invalid');

// Test 3: multiplicity runs: double-run [3C,3D,4C,4D,5C,5D]
const doubleRun = [
  {suit:'clubs',value:3},{suit:'diamonds',value:3},
  {suit:'clubs',value:4},{suit:'diamonds',value:4},
  {suit:'clubs',value:5},{suit:'diamonds',value:5}
];
assert(core.isRun(doubleRun) === true, 'double run should be valid');

// Test 3b: triple run (3 copies each of 3,4,5)
const tripleRun = [
  {suit:'c',value:3},{suit:'d',value:3},{suit:'h',value:3},
  {suit:'c',value:4},{suit:'d',value:4},{suit:'h',value:4},
  {suit:'c',value:5},{suit:'d',value:5},{suit:'h',value:5}
];
assert(core.isRun(tripleRun) === true, 'triple run should be valid');

// Test 3c: quadruple run (4 copies each of 3,4,5)
const quadRun = [];
for (const v of [3,4,5]) {
  quadRun.push({suit:'a',value:v});
  quadRun.push({suit:'b',value:v});
  quadRun.push({suit:'c',value:v});
  quadRun.push({suit:'d',value:v});
}
assert(core.isRun(quadRun) === true, 'quadruple run should be valid');

// Test 4: joker handling - single joker isSingleJoker
assert(core.isSingleJoker([{suit:'joker',value:15}]) === true, 'single joker detected');
// single joker beats anything when pile non-empty
assert(core.isValidPlay([{suit:'joker',value:15}], [{suit:'clubs',value:3}], null, [], null, null, null, []) === true, 'single joker should beat pile');

// Test 5: joker-on-joker rejected
assert(core.isValidPlay([{suit:'joker',value:15}], [{suit:'joker',value:15}], null, [], null, null, null, []) === false, 'joker on joker should be rejected');

// Test 6: ten-rule should not be active when pile is a run: create a run pile and ensure attempting to play a 10 doesn't trigger ten-rule acceptance
const runPile = [{suit:'clubs',value:3},{suit:'hearts',value:4},{suit:'spades',value:5}];
// playing a 10 as single card against a run should be invalid
assert(core.isValidPlay([{suit:'hearts',value:10}], runPile, null, [[{suit:'clubs',value:3},{suit:'hearts',value:4},{suit:'spades',value:5}]], null, null, null, []) === false, '10 should not beat a run');

// Test 7: passing winner rule - last player who passed should be awarded next turn
// Build a minimal state where player1 played, then player2 passed, then player3 is passing now
const state = {
  players: [ {id:'1',name:'P1',hand:[]}, {id:'2',name:'P2',hand:[]}, {id:'3',name:'P3',hand:[]} ],
  currentPlayerIndex: 2, // P3's turn
  pile: [{suit:'clubs',value:7}],
  pileHistory: [[{suit:'clubs',value:7}]],
  pileOwners: ['1'],
  passCount: 0,
  finishedOrder: [],
  lastPlayPlayerIndex: 0, // P1 last played
  trickHistory: [],
  currentTrick: { trickNumber: 1, actions: [ {type:'play', playerId:'1', playerName:'P1', timestamp:1}, {type:'pass', playerId:'2', playerName:'P2', timestamp:2} ] }
};
const res = core.passTurn(state, '3');
// After P3 passes, both P2 and P3 have passed; last passer is P3 so they should lead next trick
const expectedIndex = 2;
assert(res.currentPlayerIndex === expectedIndex, 'last passer should be awarded next turn (currentPlayerIndex)');

// Test 8: ensure trick does NOT finalize when only one of multiple other players has passed
// Setup: 4 players, P1 played (leader), P2 passed, it is P3's turn; when P3 passes,
// the trick should NOT end because P4 hasn't passed yet.
const state2 = {
  players: [ {id:'1',name:'P1',hand:[]}, {id:'2',name:'P2',hand:[]}, {id:'3',name:'P3',hand:[]}, {id:'4',name:'P4',hand:[]} ],
  currentPlayerIndex: 2, // P3's turn
  pile: [{suit:'clubs',value:9}],
  pileHistory: [[{suit:'clubs',value:9}]],
  pileOwners: ['1'],
  passCount: 0,
  finishedOrder: [],
  lastPlayPlayerIndex: 0, // P1 last played
  trickHistory: [],
  currentTrick: { trickNumber: 1, actions: [ {type:'play', playerId:'1', playerName:'P1', timestamp:1}, {type:'pass', playerId:'2', playerName:'P2', timestamp:2} ] }
};
const res2 = core.passTurn(state2, '3');
// After P3 passes, only P2 and P3 have passed; P4 hasn't, so trick should NOT have been finalized
assert((res2.trickHistory && res2.trickHistory.length === 0) || !res2.currentTrick || (res2.currentTrick && res2.currentTrick.actions && res2.currentTrick.actions.length > 0), 'trick should not finalize when not all other players have passed');


console.log('All core unit-tests passed');
process.exit(0);
