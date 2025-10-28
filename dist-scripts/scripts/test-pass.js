const assert = require('assert');
const core = require('../src/game/core.js');

function makeEmptyGame(names) {
  const g = core.createGame(names);
  // wipe dealt hands to remove randomness
  g.players.forEach(p => (p.hand = []));
  g.pile = [];
  g.pileHistory = [];
  g.pileOwners = [];
  // Add a dummy prior trick to bypass the strict first-play rule (3♣ only)
  g.trickHistory = [ { trickNumber: 0, actions: [] } ];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.finishedOrder = [];
  g.passCount = 0;
  g.lastPlayPlayerIndex = null;
  g.mustPlay = false;
  g.tenRule = { active: false, direction: null };
  return g;
}

// 1) Joker must not reset passes; previously passed players remain locked until trick ends
{
  const g = makeEmptyGame(['P1','P2','P3','P4']);
  const fiveH = { suit: 'hearts', value: 5 };
  const sixH = { suit: 'hearts', value: 6 };
  const sevenH = { suit: 'hearts', value: 7 };
  const joker = { suit: 'joker', value: 15 };
  g.players[0].hand = [fiveH];
  g.players[1].hand = [sixH];
  g.players[2].hand = [sevenH];
  g.players[3].hand = [joker];
  g.currentPlayerIndex = 0;

  let s = core.playCards(g, g.players[0].id, [fiveH]);
  assert.notStrictEqual(s, g, 'P1 play should be accepted');
  s = core.passTurn(s, g.players[1].id);
  s = core.passTurn(s, g.players[2].id);
  s = core.playCards(s, g.players[3].id, [joker]);

  const hasP2Pass = s.currentTrick && s.currentTrick.actions.some(a=>a.type==='pass' && a.playerId===g.players[1].id);
  const hasP3Pass = s.currentTrick && s.currentTrick.actions.some(a=>a.type==='pass' && a.playerId===g.players[2].id);
  assert.ok(hasP2Pass, 'Pass by P2 should still be recorded after Joker');
  assert.ok(hasP3Pass, 'Pass by P3 should still be recorded after Joker');

  // Force P2's turn and attempt to play; expect conversion to pass
  s.currentPlayerIndex = 1;
  const beforeLen = s.players[1].hand.length;
  const s2 = core.playCards(s, g.players[1].id, [sixH]);
  assert.strictEqual(s2.players[1].hand.length, beforeLen, 'P2 hand unchanged when trying to play after passing');
  // The engine may finalize the trick immediately if all others have passed
  // (in which case the currentTrick will be reset and the completed trick will
  // live in trickHistory). Count P2 passes across the current trick or the
  // most recent completed trick to be robust to either behavior.
  const currentActions = (s2.currentTrick && s2.currentTrick.actions) ? s2.currentTrick.actions : [];
  let p2PassCount = currentActions.filter(a=>a.type==='pass' && a.playerId===g.players[1].id).length;
  if (p2PassCount < 2 && s2.trickHistory && s2.trickHistory.length > 0) {
    const last = s2.trickHistory[s2.trickHistory.length - 1];
    const histCount = (last.actions || []).filter(a=>a.type==='pass' && a.playerId===g.players[1].id).length;
    p2PassCount += histCount;
    console.log('P2 pass count in trickHistory last:', histCount);
  }
  console.log('P2 total pass count (current+lastHistory):', p2PassCount);
  assert.ok(p2PassCount >= 2, 'P2 should have an additional pass recorded');
}

// 2) A 2 clears and starts a fresh trick; previous passes no longer block
{
  const g = makeEmptyGame(['P1','P2','P3']);
  const fiveH = { suit: 'hearts', value: 5 };
  const twoC = { suit: 'clubs', value: 2 };
  const sixH = { suit: 'hearts', value: 6 };
  g.players[0].hand = [fiveH];
  g.players[1].hand = [sixH];
  g.players[2].hand = [twoC];
  g.currentPlayerIndex = 0;

  let s = core.playCards(g, g.players[0].id, [fiveH]);
  s = core.passTurn(s, g.players[1].id);
  s = core.playCards(s, g.players[2].id, [twoC]);
  assert.ok(s.currentTrick && s.currentTrick.actions.length === 0, 'After 2, currentTrick should reset');
  s.currentPlayerIndex = 1;
  const s2 = core.playCards(s, g.players[1].id, [sixH]);
  assert.notStrictEqual(s2, s, 'P2 can play again in new trick');
}

// 3) 8-player trick resolution: leader wins when all others pass
{
  const names = ['A','B','C','D','E','F','G','H'];
  const g = makeEmptyGame(names);
  const fiveH = { suit: 'hearts', value: 5 };
  g.players[0].hand = [fiveH];
  g.currentPlayerIndex = 0;
  let s = core.playCards(g, g.players[0].id, [fiveH]);
  for (let i = 1; i < names.length; i++) {
    s = core.passTurn(s, g.players[i].id);
  }
  assert.strictEqual(s.currentTrick.actions.length, 0, 'New trick should start after all others pass');
  assert.strictEqual(s.currentPlayerIndex, 0, 'Leader should lead next trick');
}

console.log('Pass-lock and 8-player tests passed');

// 4) Joker vs Ten-Rule direction: Joker invalid on 'lower', valid on 'higher'
{
  const g = makeEmptyGame(['P1','P2']);
  const nineH = { suit: 'hearts', value: 9 };
  const joker = { suit: 'joker', value: 15 };
  g.players[0].hand = [nineH];
  g.players[1].hand = [joker];
  g.currentPlayerIndex = 0;
  let s = core.playCards(g, g.players[0].id, [nineH]);
  // Activate 10-rule with 'lower' direction
  s.tenRule = { active: true, direction: 'lower' };
  const sAttemptLower = core.playCards(s, g.players[1].id, [joker]);
  assert.strictEqual(sAttemptLower, s, 'Joker should be rejected when ten-rule is lower');
  // Switch to 'higher' direction
  s.tenRule = { active: true, direction: 'higher' };
  const sHigher = core.playCards(s, g.players[1].id, [joker]);
  assert.notStrictEqual(sHigher, s, 'Joker should be allowed when ten-rule is higher');
  const lastAction = sHigher.currentTrick.actions[sHigher.currentTrick.actions.length - 1];
  assert.strictEqual(lastAction.type, 'play');
  assert.ok(lastAction.cards && lastAction.cards.length === 1 && lastAction.cards[0].suit === 'joker', 'Last play should be the Joker');
}
