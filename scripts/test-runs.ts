const core = require('../src/game/core');

function card(v: number, suit = 'spades') { return { value: v, suit } as any; }

const players = [
  { id: '1', name: 'P1', hand: [], role: 'Asshole' },
  { id: '2', name: 'P2', hand: [], role: 'Asshole' },
  { id: '3', name: 'P3', hand: [], role: 'Asshole' },
  { id: '4', name: 'P4', hand: [], role: 'Asshole' },
];

const currentTrick: any = { trickNumber: 1, actions: [
  { type: 'play', playerId: '1', playerName: 'P1', cards: [card(3)], timestamp: Date.now() - 3000 },
  { type: 'play', playerId: '2', playerName: 'P2', cards: [card(4)], timestamp: Date.now() - 2000 },
  { type: 'play', playerId: '3', playerName: 'P3', cards: [card(5)], timestamp: Date.now() - 1000 },
] };

const finishedOrder: string[] = [];
const pile = [ card(5) ];

console.log('\n=== Test: runFromCurrentTrick ===');
const run = core.runFromCurrentTrick(currentTrick, players, finishedOrder);
console.log('runFromCurrentTrick =>', run.map((c:any)=>c.value));

const playByP4 = [ card(4) ];
const validP4 = core.isValidPlay(playByP4, pile, undefined, undefined, undefined, currentTrick, players, finishedOrder);
console.log('Player 4 playing single 4 on [3,4,5] run -> isValidPlay =', validP4);

const play6 = [ card(6) ];
const valid6 = core.isValidPlay(play6, pile, undefined, undefined, undefined, currentTrick, players, finishedOrder);
console.log('Player 4 playing single 6 on [3,4,5] run -> isValidPlay =', valid6);

// Simulate problematic sequence
const seq = [ [3], [4], [5], [4], [5], [7] ];
let ct: any = { trickNumber: 1, actions: [] };
for (let i = 0; i < seq.length; i++) {
  const cards = seq[i].map(v => card(v));
  const player = players[i % players.length];
  const topPile = ct.actions.length ? ct.actions[ct.actions.length-1].cards : [];
  const valid = core.isValidPlay(cards, topPile, undefined, undefined, undefined, ct, players, finishedOrder);
  console.log(`Play ${i+1}: player ${player.name} plays [${cards.map(c=>c.value)}] => isValidPlay=${valid}`);
  if (valid) {
    ct.actions.push({ type: 'play', playerId: player.id, playerName: player.name, cards, timestamp: Date.now() });
  } else {
    ct.actions.push({ type: 'pass', playerId: player.id, playerName: player.name, timestamp: Date.now() });
  }
}

console.log('\nFinal trick actions:', ct.actions.map((a:any) => ({ t: a.type, p: a.playerName, vals: a.cards ? a.cards.map((c:any)=>c.value) : [] })));

console.log('\nDone');
