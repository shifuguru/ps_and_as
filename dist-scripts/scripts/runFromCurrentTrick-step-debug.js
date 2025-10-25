const core = require('../src/game/core.js');
function card(suit, value){ return { suit, value }; }
const players = [{id:'1'},{id:'2'},{id:'3'}];
const actions = [
  { type: 'play', playerId: '1', cards: [card('hearts',3)] },
  { type: 'play', playerId: '2', cards: [card('hearts',4)] },
  { type: 'play', playerId: '3', cards: [card('hearts',5)] },
];
const currentTrick = { actions };

const collected = [];
const playerIdxs = [];
for (let i = actions.length -1; i >= 0; i--) {
  const a = actions[i];
  console.log('Inspect action i=', i, 'a=', a);
  if (a.type !== 'play' || !a.cards || a.cards.length !== 1) { console.log('stop: not single play'); break; }
  const card = a.cards[0];
  console.log('card.value=', card.value);
  if (card.value === 10 || core.isJoker(card)) { console.log('stop: ten or joker'); break; }
  const pIndex = players.findIndex((p) => p.id === a.playerId);
  console.log('pIndex found=', pIndex);
  if (pIndex === -1) { console.log('stop: pIndex -1'); break; }
  if (collected.length === 0) { collected.unshift(card); playerIdxs.unshift(pIndex); console.log('collected now', collected.map(c=>c.value)); }
  else {
    const expectedNext = core.nextActiveIndexFromList(players, [], pIndex);
    console.log('expectedNext from pIndex', pIndex, '=>', expectedNext, 'prev playerIdxs last', playerIdxs[playerIdxs.length-1]);
    if (expectedNext !== playerIdxs[playerIdxs.length - 1]) { console.log('stop: expectedNext mismatch'); break; }
    collected.unshift(card); playerIdxs.unshift(pIndex); console.log('collected now', collected.map(c=>c.value));
  }
}
console.log('final collected', collected.map(c=>c.value));
console.log('isRun?', core.isRun(collected));
