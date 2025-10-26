const fs = require('fs');
const path = require('path');
const core = require('../src/game/core');

if (process.argv.length < 3) {
  console.error('Usage: node replay-trace.js <failure-trace.json>');
  process.exit(2);
}

const tracePath = path.resolve(process.argv[2]);
const data = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
const trace = data.trace || [];
// Prefer a fullState present in the trace (added by the verbose simulator) so
// we can replay from an exact engine snapshot. Fall back to top-level
// stateSnapshot if needed.
let state = null;
const firstFull = (trace.find(t => t.fullState));
if (firstFull && firstFull.fullState) {
  state = JSON.parse(JSON.stringify(firstFull.fullState));
} else {
  state = data.stateSnapshot ? JSON.parse(JSON.stringify(data.stateSnapshot)) : null;
}

if (!state) {
  console.error('Trace must include a stateSnapshot');
  process.exit(1);
}

function idForPlayerName(name){
  const p = state.players.find(p=>p.name===name || p.id===name);
  return p ? p.id : null;
}

console.log('Replaying trace with', trace.length, 'entries');

for (let i=0;i<trace.length;i++){
  const entry = trace[i];
  if (!entry.action) continue;
  console.log('\nStep', entry.step, 'action', entry.action, 'player', entry.player || entry.playerId || '');
  if (entry.action === 'play'){
    const playerId = entry.player || entry.playerId;
    const next = core.playCards(JSON.parse(JSON.stringify(state)), playerId, entry.cards);
    const accepted = JSON.stringify(next) !== JSON.stringify(state);
    console.log('Engine play accepted?', accepted);
    if (entry['played'] === 'rejected' || entry.action === 'play-rejected'){
      if (accepted){
        console.error('DIVERGENCE at step', entry.step, "trace expected rejected but engine accepted");
        process.exit(1);
      }
    } else if (!accepted && entry.action === 'play'){
      console.error('DIVERGENCE at step', entry.step, "trace recorded play but engine rejected it");
      console.error('Attempted cards:', entry.cards);
      process.exit(1);
    }
    state = next;
  } else if (entry.action === 'play-rejected'){
    const playerId = entry.player || entry.playerId;
    const next = core.playCards(JSON.parse(JSON.stringify(state)), playerId, entry.attempted);
    const accepted = JSON.stringify(next) !== JSON.stringify(state);
    console.log('Engine play accepted?', accepted);
    if (accepted){
      console.error('DIVERGENCE at step', entry.step, 'trace shows play-rejected but engine accepted');
      process.exit(1);
    }
    // Also simulate the pass fallback if present in later trace entries
  } else if (entry.action === 'pass' || entry.action === 'forced-pass-after-rejects'){
    const playerId = entry.player || entry.playerId;
    const next = core.passTurn(JSON.parse(JSON.stringify(state)), playerId);
    const advanced = JSON.stringify(next) !== JSON.stringify(state);
    console.log('Engine pass accepted?', advanced);
    if (!advanced){
      console.error('DIVERGENCE at step', entry.step, 'trace shows pass but engine did not advance');
      process.exit(1);
    }
    state = next;
  } else if (entry.action === 'tenRuleChoice'){
    const playerId = entry.player || entry.playerId;
    const dir = entry.direction;
    const next = core.setTenRuleDirection(JSON.parse(JSON.stringify(state)), dir);
    console.log('setTenRuleDirection applied');
    state = next;
  } else {
    // ignore other actions for now
    console.log('Skipping action type', entry.action);
  }
}

console.log('\nReplay completed without divergence (engine matched trace actions)');
process.exit(0);
