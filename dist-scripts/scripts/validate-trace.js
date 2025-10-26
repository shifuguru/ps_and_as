const fs = require('fs');
const path = require('path');
const core = require('../src/game/core.js');

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

const TRACE_FILE = path.resolve(__dirname, '../simulation-traces/failure-1761457625165-i0.json');
if (!fs.existsSync(TRACE_FILE)) {
  console.error('Trace file not found:', TRACE_FILE);
  process.exit(2);
}

const traceFile = JSON.parse(fs.readFileSync(TRACE_FILE, 'utf8'));
const trace = traceFile.trace || traceFile;

let mismatches = [];

for (let i = 0; i < trace.length - 1; i++) {
  const entry = trace[i];
  // We're interested in snapshot/fullState entries followed by an action
  if (!entry.fullState) continue;
  const next = trace[i+1];
  if (!next || !next.action) continue;
  // Only analyze play attempts
  if (next.action !== 'play' && next.action !== 'play-rejected') continue;
  const attempted = next.cards || next.attempted || [];
  const player = next.player;

  // Choose a pre-action snapshot to validate against. Some traces may have
  // recorded a fullState that already includes subsequent pass actions which
  // would make the attempted play impossible. In that case try to find an
  // earlier fullState that does not include the player's pass; otherwise
  // mark as inconsistent and skip
  let state = deepClone(entry.fullState);
  let usedFallbackIndex = null;
  const playerHasPassedIn = (s) => s && s.currentTrick && Array.isArray(s.currentTrick.actions) && s.currentTrick.actions.some(a => a.type === 'pass' && a.playerId === player);
  if (playerHasPassedIn(state)) {
    // search backward for earlier snapshot without the pass
    for (let j = i - 1; j >= 0; j--) {
      if (trace[j].fullState) {
        const cand = trace[j].fullState;
        if (!playerHasPassedIn(cand)) {
          state = deepClone(cand);
          usedFallbackIndex = j;
          break;
        }
      }
    }
    // if no earlier snapshot found, record and skip this step as inconsistent
    if (usedFallbackIndex === null) {
      // record but don't treat as mismatch
      continue;
    }
  }

  // run validator using the chosen pre-action snapshot
  const isValid = core.isValidPlay(attempted, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder);
  const out = core.playCards(deepClone(state), player, attempted);
  // determine engine acceptance by checking if attempted cards are removed
  const pIndex = out.players.findIndex(p => p.id === player);
  const afterHand = pIndex >= 0 ? out.players[pIndex].hand : null;
  const stillHasAttempted = attempted.every(ac => (afterHand || []).some(h => h.suit === ac.suit && h.value === ac.value));

  // Trace expectation: rejection if either the action itself is 'play-rejected' or
  // the next entry after the 'play' is a 'play-rejected'.
  let traceRejected = false;
  if (next.action === 'play-rejected') traceRejected = true;
  if (trace[i+2] && trace[i+2].action === 'play-rejected') traceRejected = true;

  const engineRejected = stillHasAttempted;

  if (engineRejected !== traceRejected) {
    mismatches.push({ index: i, step: entry.step, player, attempted, traceRejected, engineRejected, isValid, usedFallbackIndex });
  }
}

if (mismatches.length === 0) {
  console.log('No mismatches found for trace:', TRACE_FILE);
  process.exit(0);
}

console.error('Found mismatches:', mismatches.length);
console.error(JSON.stringify(mismatches, null, 2));
process.exit(1);
