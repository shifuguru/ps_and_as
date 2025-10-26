const fs = require('fs');
const path = require('path');
const core = require('../src/game/core.js');

function findStepWithFullState(trace, step) {
  for (let i = 0; i < trace.length; i++) {
    if (trace[i].step === step && trace[i].fullState) return i;
  }
  return -1;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const TRACE_FILE = path.resolve(__dirname, '../simulation-traces/failure-1761457625165-i0.json');
if (!fs.existsSync(TRACE_FILE)) {
  console.error('Trace file not found:', TRACE_FILE);
  process.exit(2);
}

const traceFile = JSON.parse(fs.readFileSync(TRACE_FILE, 'utf8'));
const trace = traceFile.trace || traceFile;
const idx = findStepWithFullState(trace, 15);
if (idx === -1) {
  console.error('Could not find step 15 fullState in trace');
  process.exit(2);
}

const snapshotEntry = trace[idx];
const actionEntry = trace[idx + 1];
if (!actionEntry || !actionEntry.action) {
  console.error('No action found after snapshot for step 15');
  process.exit(2);
}

const fullState = deepClone(snapshotEntry.fullState);
const attempted = actionEntry.cards || actionEntry.attempted || [];
const player = actionEntry.player;

console.log('Repro: step=15 player=', player, 'attempted=', attempted);

// Map player id to index inside state.players
const pIndex = fullState.players.findIndex(p => p.id === player);
if (pIndex === -1) {
  console.error('Player id not found in fullState.players:', player);
  process.exit(2);
}

// Check isValidPlay using the engine helper
const isValid = core.isValidPlay(attempted, fullState.pile, fullState.tenRule, fullState.pileHistory, fullState.fourOfAKindChallenge, fullState.currentTrick, fullState.players, fullState.finishedOrder);
console.log('core.isValidPlay =>', isValid);

// Snapshot player's hand before
const beforeHand = deepClone(fullState.players[pIndex].hand);
console.log('player hand before length=', beforeHand.length, 'containsJoker=', beforeHand.some(c=>c.suit==='joker'&&c.value===15));

// Run playCards on a cloned state
const stateClone = deepClone(fullState);
const out = core.playCards(stateClone, player, attempted);

// Snapshot player's hand after
const afterEntry = out.players.find(p => p.id === player);
const afterHand = afterEntry ? afterEntry.hand : null;
console.log('player hand after length=', afterHand ? afterHand.length : 'N/A', 'containsJoker=', afterHand ? afterHand.some(c=>c.suit==='joker'&&c.value===15) : 'N/A');

// Compare pile and pileHistory changes
console.log('pile before top:', fullState.pile && fullState.pile.length ? fullState.pile.map(c=>c.value) : '[]');
console.log('pile after top:', out.pile && out.pile.length ? out.pile.map(c=>c.value) : '[]');
console.log('pileHistory before len:', fullState.pileHistory ? fullState.pileHistory.length : 0);
console.log('pileHistory after len:', out.pileHistory ? out.pileHistory.length : 0);

// Inspect if the action was recorded in currentTrick.actions
const recorded = out.currentTrick && out.currentTrick.actions && out.currentTrick.actions.length ? out.currentTrick.actions[out.currentTrick.actions.length-1] : null;
console.log('last currentTrick action (type/player):', recorded ? { type: recorded.type, playerId: recorded.playerId, cards: recorded.cards } : null);

// Determine whether the engine accepted or rejected the play by checking whether
// the player's hand still contains the attempted cards (simple indicator)
const stillHasAttempted = attempted.every(ac => (afterHand || []).some(h => h.suit === ac.suit && h.value === ac.value));
console.log('after-hand still has attempted cards? =>', stillHasAttempted);

// Exit with code 0 if engine outcome matches trace 'play-rejected' vs 'play' expectation
// If trace shows a play-rejected immediately after, expect rejection (i.e., attempted cards still in hand)
const nextEntry = actionEntry; // this is the action we inspected
let traceRejected = false;
// Check if there's an explicit play-rejected entry immediately following the play
if (trace[idx + 2] && trace[idx + 2].action === 'play-rejected') {
  traceRejected = true;
}
// Some traces include a play then play-rejected at same step; handle both
if (actionEntry.action === 'play-rejected' || traceRejected) {
  if (stillHasAttempted) {
    console.log('TRACE expects rejection and engine also rejected -> OK');
    process.exit(0);
  }
  else {
    console.error('TRACE expects rejection but engine accepted the play -> FAIL');
    process.exit(1);
  }
}
else {
  // Trace expected acceptance (no immediate play-rejected). Then we expect attempted cards removed.
  if (!stillHasAttempted) {
    console.log('TRACE expects acceptance and engine accepted -> OK');
    process.exit(0);
  }
  else {
    console.error('TRACE expects acceptance but engine rejected -> FAIL');
    process.exit(1);
  }
}
