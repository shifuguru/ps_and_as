const assert = require('assert');
const core = require('../src/game/core.js');
// helper
function card(suit, value){ return { suit, value }; }

// create game
const game = core.createGame(['A','B','C']);
console.log('players:', game.players.map(p => ({ id: p.id, name: p.name })));
// simulate currentTrick actions: 3,4,5 by consecutive players
const actions = [
  { type: 'play', playerId: game.players[0].id, playerName: game.players[0].name, cards: [card('hearts', 3)], timestamp: Date.now() },
  { type: 'play', playerId: game.players[1].id, playerName: game.players[1].name, cards: [card('hearts', 4)], timestamp: Date.now() },
  { type: 'play', playerId: game.players[2].id, playerName: game.players[2].name, cards: [card('hearts', 5)], timestamp: Date.now() },
];
const currentTrick = { trickNumber: 1, actions };
const run = core.runFromCurrentTrick(currentTrick, game.players, game.finishedOrder);
console.log('currentTrick actions:', currentTrick.actions.map(a=>({playerId:a.playerId,cards:a.cards})));
console.log('runFromCurrentTrick returned:', run);
assert.strictEqual(run.length, 3, 'runFromCurrentTrick should detect a 3-card run');
assert.strictEqual(run[0].value, 3);
assert.strictEqual(run[2].value, 5);

const pile = [card('hearts',5)];
const play4 = [card('spades',4)];
const play6 = [card('spades',6)];
const play7 = [card('spades',7)];

// call isValidPlay with currentTrick context
assert.strictEqual(core.isValidPlay(play4, pile, undefined, undefined, undefined, currentTrick, game.players, game.finishedOrder), true, '4 adjacent should be allowed');
assert.strictEqual(core.isValidPlay(play6, pile, undefined, undefined, undefined, currentTrick, game.players, game.finishedOrder), true, '6 adjacent should be allowed');
assert.strictEqual(core.isValidPlay(play7, pile, undefined, undefined, undefined, currentTrick, game.players, game.finishedOrder), false, '7 should NOT be allowed');

console.log('dist-scripts run adjacency test: PASS');
