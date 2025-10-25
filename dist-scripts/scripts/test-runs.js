const core = require('../src/game/core');

function card(v, suit='spades') { return { value: v, suit }; }

// Build players
const players = [
  { id: '1', name: 'P1', hand: [] },
  { id: '2', name: 'P2', hand: [] },
  { id: '3', name: 'P3', hand: [] },
  { id: '4', name: 'P4', hand: [] },
];

// Simulate current trick: consecutive single-card plays 3,4,5 by players 1,2,3
const currentTrick = { trickNumber: 1, actions: [
  { type: 'play', playerId: '1', playerName: 'P1', cards: [card(3)], timestamp: Date.now() - 3000 },
  { type: 'play', playerId: '2', playerName: 'P2', cards: [card(4)], timestamp: Date.now() - 2000 },
  { type: 'play', playerId: '3', playerName: 'P3', cards: [card(5)], timestamp: Date.now() - 1000 },
] };

const finishedOrder = [];

const pile = [ card(5) ];

console.log('\n=== Test: run formed by consecutive single-card plays [3,4,5] ===');
const run = core.runFromCurrentTrick(currentTrick, players, finishedOrder);
console.log('runFromCurrentTrick =>', run.map(c=>c.value));

// Now: check if player 4 (next player) can play a single 4 (which is 1 below 5)
const playByP4 = [ card(4) ];
const validP4 = core.isValidPlay(playByP4, pile, undefined, undefined, undefined, currentTrick, players, finishedOrder);
console.log('Player 4 playing single 4 on [3,4,5] run -> isValidPlay =', validP4);

// Check if player 4 playing single 6 (not adjacent) is allowed
const play6 = [ card(6) ];
const valid6 = core.isValidPlay(play6, pile, undefined, undefined, undefined, currentTrick, players, finishedOrder);
console.log('Player 4 playing single 6 on [3,4,5] run -> isValidPlay =', valid6);

// Now simulate the problematic sequence: after 3,4,5 someone plays 4 then 5 then 7 —
// We'll test if those plays would be allowed in sequence by validation (ignoring turn advancement)
const seq = [ [3], [4], [5], [4], [5], [7] ].map(arr => arr.map(v => card(v)));

// Build a running currentTrick and test each next play's validity using that trick as history
let ct = { trickNumber: 1, actions: [] };
for (let i = 0; i < seq.length; i++) {
  const cards = seq[i];
  // pretend player rotates among players 1..4
  const player = players[i % players.length];
  const valid = core.isValidPlay(cards, ct.actions.length ? ct.actions[ct.actions.length-1].cards : [], undefined, undefined, undefined, ct, players, finishedOrder);
  console.log(`Play ${i+1}: player ${player.name} plays [${cards.map(c=>c.value)}] => isValidPlay=${valid}`);
  // append if valid
  if (valid) {
    ct.actions.push({ type: 'play', playerId: player.id, playerName: player.name, cards, timestamp: Date.now() });
  } else {
    ct.actions.push({ type: 'pass', playerId: player.id, playerName: player.name, timestamp: Date.now() });
  }
}

console.log('\nFinal trick actions:', ct.actions.map(a => ({ t: a.type, p: a.playerName, vals: a.cards ? a.cards.map(c=>c.value) : [] })));

console.log('\nDone');
