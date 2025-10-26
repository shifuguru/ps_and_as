const fs = require('fs');
const path = require('path');
const core = require('../src/game/core');

if (process.argv.length < 3) {
  console.error('Usage: node repro-from-trace.js <trace.json>');
  process.exit(2);
}

const tracePath = path.resolve(process.argv[2]);
const data = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
const trace = data.trace || [];
const stateSnapshot = data.stateSnapshot;

// Find first play-rejected entry
const rej = trace.find(t => t['action'] === 'play-rejected');
if (!rej) {
  console.error('No play-rejected action found in trace');
  process.exit(1);
}

const player = rej.player;
const attempted = rej.attempted;

console.log('Reproducer: player', player, 'attempted', attempted);

// Prepare a shallow copy of the snapshot to feed into core functions
const state = JSON.parse(JSON.stringify(stateSnapshot));

// Check isValidPlay
const valid = core.isValidPlay(attempted, state.pile || [], state.tenRule || { active: false, direction: null }, state.pileHistory || [], state.fourOfAKindChallenge || undefined, state.currentTrick, state.players, state.finishedOrder || []);
console.log('isValidPlay =>', valid);

// Check what the CPU thinks is a possible play for that player
const p = state.players.find(p => p.id === player);
const cpu = core.findCPUPlay(p.hand || [], state.pile || [], state.tenRule || { active: false, direction: null }, state.pileHistory || [], state.fourOfAKindChallenge || undefined, state.currentTrick, state.players, state.finishedOrder || []);
console.log('findCPUPlay =>', cpu);

// Run playCards and detect whether it returns changed state
const next = core.playCards(JSON.parse(JSON.stringify(state)), player, attempted);
console.log('playCards returned object. Did state change?', JSON.stringify(next) !== JSON.stringify(state));

// Print some relevant fields for inspection
console.log('state.pile top before:', state.pile && state.pile[0]);
console.log('next.pile top after:', next.pile && next.pile[0]);
console.log('next.currentTrick.actions.length:', next.currentTrick && next.currentTrick.actions && next.currentTrick.actions.length);

// Also check whether an automatic pass would have been triggered by our new logic
const possible = core.findCPUPlay(p.hand || [], state.pile || [], state.tenRule || { active: false, direction: null }, state.pileHistory || [], state.fourOfAKindChallenge || undefined, state.currentTrick, state.players, state.finishedOrder || []);
const possibleValid = possible && core.isValidPlay(possible, state.pile || [], state.tenRule || { active: false, direction: null }, state.pileHistory || [], state.fourOfAKindChallenge || undefined);
console.log('possible candidate from findCPUPlay:', possible, 'valid?', !!possibleValid);

console.log('\nFull state snapshot saved to repro-state.json for manual inspection');
fs.writeFileSync(path.resolve('repro-state.json'), JSON.stringify(state, null, 2));

process.exit(0);
