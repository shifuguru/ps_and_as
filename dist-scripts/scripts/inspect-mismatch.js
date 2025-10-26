const fs = require('fs');
const path = require('path');

const TRACE_FILE = path.resolve(__dirname, '../simulation-traces/failure-1761457625165-i0.json');
if (!fs.existsSync(TRACE_FILE)) {
  console.error('Trace file not found:', TRACE_FILE);
  process.exit(2);
}
const traceFile = JSON.parse(fs.readFileSync(TRACE_FILE, 'utf8'));
const trace = traceFile.trace || traceFile;

function printContext(idx, before=2, after=4) {
  const start = Math.max(0, idx - before);
  const end = Math.min(trace.length - 1, idx + after);
  console.log('--- Context for index', idx, 'steps', start, 'to', end);
  for (let i = start; i <= end; i++) {
    console.log('INDEX', i, JSON.stringify(trace[i].step ? { step: trace[i].step, action: trace[i].action } : { action: trace[i].action }));
  }
  console.log('Full snapshot at index', idx, JSON.stringify(trace[idx].fullState || {}, null, 2));
}

// mismatches found in prior run
function printSummary(idx) {
  const entry = trace[idx];
  const next = trace[idx+1] || {};
  console.log('\n--- SUMMARY for index', idx, 'step', entry.step);
  console.log('currentPlayerIndex:', entry.fullState ? entry.fullState.currentPlayerIndex : 'N/A');
  console.log('next action:', next.action, 'player:', next.player, 'cards:', JSON.stringify(next.cards || next.attempted || []));
  if (entry.fullState) {
    const pIndex = entry.fullState.players.findIndex(p => p.id === next.player);
    console.log('player index in players array:', pIndex);
    if (pIndex !== -1) {
      console.log('player hand before:', entry.fullState.players[pIndex].hand.map(c=>c.value));
    }
  }
}

printContext(75);
printSummary(75);
printContext(77);
printSummary(77);
