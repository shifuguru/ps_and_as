const core = require('../src/game/core.js');
function card(suit, value){ return { suit, value }; }
function J(){ return { suit:'joker', value:15 }; }
function assert(cond, msg){ if(!cond) { console.error('FAIL:', msg); process.exit(1); } }

console.log('Running turn-advancement tests...');

// Helper: create minimal game state with 3 players and controlled hands
function makeGameWithHands(hands) {
  const names = hands.map((_,i)=>`P${i+1}`);
  const g = core.createGame(names);
  // overwrite hands
  for (let i=0;i<hands.length;i++) {
    g.players[i].hand = hands[i].slice();
  }
  // Ensure this is not treated as the game's very first play (3♣ rule)
  // by adding a harmless placeholder action to currentTrick so isFirstPlay is false.
  if (!g.currentTrick) g.currentTrick = { trickNumber: 1, actions: [] };
  g.currentTrick.actions.push({ type: 'play', playerId: 'init', playerName: 'init', timestamp: Date.now(), cards: [{ suit: 'spades', value: 3 }] });
  return g;
}

// Test 1: Simple trick - leader should lead next trick and not get an extra free extra turn
(() => {
  const g = makeGameWithHands([
  [card('h',5), card('h',8)], // P1 (keep one extra so winner doesn't finish)
    [card('h',7)], // P2
    [card('h',9)], // P3
  ]);
  // Set current player to P1
  g.currentPlayerIndex = 0;
  // P1 plays single 5
  let s = core.playCards(g, g.players[0].id, [card('h',5)]);
  assert(s !== g, 'play should change state');
  // P2 passes
  s = core.passTurn(s, s.players[1].id);
  // P3 passes -> trick should finalize with P1 as winner and lead next
  s = core.passTurn(s, s.players[2].id);
  assert(s.currentPlayerIndex === 0, 'Winner P1 should lead next trick (currentPlayerIndex=0)');
  // Now P1 plays again
  s = core.playCards(s, s.players[0].id, [card('h',3)]); // invalid (not in hand) -> should be rejected
  // Provide a valid play by adding a card
  s.players[0].hand.push(card('h',6));
  s = core.playCards(s, s.players[0].id, [card('h',6)]);
  assert(s.currentPlayerIndex !== 0 || s.mustPlay === false, 'After leading, play should advance to next player (P1 should not get two turns in a row)');
})();

// Test 2: If winner finished (no cards), next active player leads
(() => {
  const g = makeGameWithHands([
    [], // P1 already finished
    [card('h',7)], // P2
    [card('h',9)], // P3
  ]);
  // set lastPlayPlayerIndex to P1 and treat as leader - simulate trick finalization
  g.lastPlayPlayerIndex = 0;
  g.currentTrick = { trickNumber: 1, actions: [] };
  // simulate two passes from others
  let s = core.passTurn(g, g.players[1].id);
  s = core.passTurn(s, s.players[2].id);
  // since winner P1 is finished, next active player after winner should lead
  const expected = core.nextActivePlayerIndex(s, 0);
  assert(s.currentPlayerIndex === expected, `Expected next active player to lead when winner finished (expected ${expected}, got ${s.currentPlayerIndex})`);
})();

// Test 3: four-of-a-kind challenge - if player mustPlay but no valid play, passTurn allows pass (no deadlock)
(() => {
  const g = makeGameWithHands([
    [card('h',5),card('d',5),card('s',5),card('c',5)], // P1 quad
    [card('h',3)], // P2 cannot beat quad
    [card('h',9)]  // P3
  ]);
  g.currentPlayerIndex = 0;
  // P1 plays quad
  let s = core.playCards(g, g.players[0].id, g.players[0].hand.slice(0,4));
  // Now P2 must play but has no valid play
  // Attempt pass - engine should allow if no valid play
  const before = JSON.stringify(s);
  s = core.passTurn(s, s.players[1].id);
  assert(JSON.stringify(s) !== before, 'passTurn should change state when allowing pass on mustPlay with no valid play');
})();

// Test 4: CPU deadlock prevention: findCPUPlay returns null and passTurn allows pass
(() => {
  const g = makeGameWithHands([
    [card('h',3)], // P1
    [card('h',2)], // P2 - only 2s which cannot be played over some piles
    [card('h',9)]  // P3
  ]);
  g.currentPlayerIndex = 0;
  // P1 plays single 5 (not in hand) -> instead add card and play
  g.players[0].hand.push(card('h',5));
  let s = core.playCards(g, g.players[0].id, [card('h',5)]);
  // Now P2 has only 2 which may be blocked by some clear state; ensure pass allowed
  const before = JSON.stringify(s);
  s = core.passTurn(s, s.players[1].id);
  assert(JSON.stringify(s) !== before, 'CPU/pass fallback should allow pass when no valid play exists');
})();

console.log('All turn-advancement tests passed');
