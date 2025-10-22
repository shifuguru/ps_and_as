const assert = require('assert');
const core = require('../dist-scripts/src/game/core');
const rules = require('../dist-scripts/src/game/ruleset');

function simpleSimulation() {
  console.log('Running simple CPU simulation...');
  const names = ['CPU A', 'CPU B', 'CPU C', 'CPU D'];
  let state = core.createGame(names);

  const starter = state.players[state.currentPlayerIndex];
  const hasThreeClubs = starter.hand.some((c) => c.suit === 'clubs' && c.value === 3);
  console.log(`Starter player: ${starter.name} (index ${state.currentPlayerIndex}) - has 3♣? ${hasThreeClubs}`);

  let steps = 0;
  const maxSteps = 2000;
  while (state.finishedOrder.length < state.players.length && steps < maxSteps) {
    steps++;
    const current = state.players[state.currentPlayerIndex];
    const play = core.findValidSingleCard(current.hand, state.pile);
    if (play) {
      const next = core.playCards(state, current.id, [play]);
      if (next === state) {
        console.error(`Unexpected: play rejected for ${current.name} when playing ${play.suit}-${play.value}`);
        break;
      }
      if (play.value === 2 && next.pile.length !== 0) {
        console.error('Rule violation: playing a 2 should clear the pile but it did not');
        break;
      }
      state = next;
    } else {
      const next = core.passTurn(state, current.id);
      if (next === state) {
        console.error(`Unexpected: pass rejected for ${current.name}`);
        break;
      }
      state = next;
    }
  }

  if (steps >= maxSteps) {
    console.warn('Simulation aborted: reached max steps');
  }

  console.log(`Simulation finished in ${steps} steps. Finish order: ${state.finishedOrder.join(',')}`);
}

function testFourOfAKindClears() {
  console.log('Testing four-of-a-kind clearing rule...');
  const names = ['P1', 'P2', 'P3', 'P4'];
  let state = core.createGame(names);
  state.players[0].hand = [
    { suit: 'hearts', value: 5 },
    { suit: 'spades', value: 5 },
    { suit: 'clubs', value: 5 },
    { suit: 'diamonds', value: 5 },
  ];
  state.currentPlayerIndex = 0;
  const next = core.playCards(state, state.players[0].id, state.players[0].hand.slice(0, 4));
  if (next.pile.length !== 0) throw new Error('Four of a kind did not clear the pile');
  console.log('Four-of-a-kind clearing test passed');
}

function testPassClearsPile() {
  console.log('Testing pass clear behavior...');
  const names = ['A', 'B', 'C'];
  let state = core.createGame(names);
  state.pile = [{ suit: 'hearts', value: 9 }];
  state.currentPlayerIndex = 0;
  state = core.passTurn(state, state.players[0].id);
  state = core.passTurn(state, state.players[1].id);
  if (state.pile.length !== 0) throw new Error('Pile was not cleared after all players passed');
  console.log('Pass-clear behavior test passed');
}

function runAll() {
  try {
    simpleSimulation();
    testFourOfAKindClears();
    testPassClearsPile();
    console.log('All CPU tests completed successfully');
  } catch (e) {
    console.error('CPU tests failed:', e);
    process.exitCode = 2;
  }
}

if (require.main === module) runAll();
