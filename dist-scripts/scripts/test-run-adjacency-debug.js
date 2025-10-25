const core = require('../src/game/core.js');
function card(suit, value){ return { suit, value }; }
const game = core.createGame(['A','B','C']);
const actions = [
  { type: 'play', playerId: '1', playerName: 'A', cards: [card('hearts',3)], timestamp: Date.now() },
  { type: 'play', playerId: '2', playerName: 'B', cards: [card('hearts',4)], timestamp: Date.now() },
  { type: 'play', playerId: '3', playerName: 'C', cards: [card('hearts',5)], timestamp: Date.now() },
];
const currentTrick = { trickNumber: 1, actions };
console.log('game.players ids:', game.players.map(p=>p.id));
console.log('calling runFromCurrentTrick with game.players');
console.log(core.runFromCurrentTrick(currentTrick, game.players, game.finishedOrder));
console.log('calling runFromCurrentTrick with simplePlayers');
console.log(core.runFromCurrentTrick(currentTrick, [{id:'1'},{id:'2'},{id:'3'}], []));
