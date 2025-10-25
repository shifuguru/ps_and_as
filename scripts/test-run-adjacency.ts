import assert from 'assert';
import { GameState, runFromCurrentTrick, isValidPlay, createGame } from '../src/game/core';
import { Card } from '../src/game/ruleset';

// Helper to build a fake currentTrick with actions
function makeTrickWithActions(actions: any[]) {
  return { trickNumber: 1, actions };
}

function card(suit: string, value: number): Card { return { suit: suit as any, value }; }

// Build a scenario where three consecutive single-card plays formed a run: 3,4,5
const game = createGame(['A','B','C']);

// Simulate actions in currentTrick: player A played 3, player B played 4, player C played 5
const actions = [
  { type: 'play', playerId: game.players[0].id, playerName: game.players[0].name, cards: [card('hearts', 3)], timestamp: Date.now() },
  { type: 'play', playerId: game.players[1].id, playerName: game.players[1].name, cards: [card('hearts', 4)], timestamp: Date.now() },
  { type: 'play', playerId: game.players[2].id, playerName: game.players[2].name, cards: [card('hearts', 5)], timestamp: Date.now() },
];
const currentTrick = makeTrickWithActions(actions);

// Effective run derived from currentTrick should be [3,4,5]
const run = runFromCurrentTrick(currentTrick, game.players, game.finishedOrder);
assert.strictEqual(run.length, 3, 'runFromCurrentTrick should detect a 3-card run');
assert.strictEqual(run[0].value, 3);
assert.strictEqual(run[1].value, 4);
assert.strictEqual(run[2].value, 5);

// Now test single-card adjacency: allowed plays are 4 or 6
const play4: Card[] = [card('spades', 4)];
const play6: Card[] = [card('spades', 6)];
const play7: Card[] = [card('spades', 7)];

// pile passed as the last actual pile (simulate pile currently contains [5])
const pile: Card[] = [card('hearts', 5)];

// isValidPlay should accept 4 and 6 (adjacent) but reject 7 (non-adjacent)
assert.strictEqual(isValidPlay(play4, pile, undefined, undefined, undefined, currentTrick, game.players, game.finishedOrder), true, 'single 4 should be allowed against run [3,4,5]');
assert.strictEqual(isValidPlay(play6, pile, undefined, undefined, undefined, currentTrick, game.players, game.finishedOrder), true, 'single 6 should be allowed against run [3,4,5]');
assert.strictEqual(isValidPlay(play7, pile, undefined, undefined, undefined, currentTrick, game.players, game.finishedOrder), false, 'single 7 should NOT be allowed against run [3,4,5]');

console.log('run adjacency tests passed');
