const core = require('../src/game/core.js');

function card(suit,value){return {suit,value};}

function snapshotMin(state){
  return {
    currentPlayerIndex: state.currentPlayerIndex,
    lastPlayPlayerIndex: state.lastPlayPlayerIndex,
    pile: state.pile,
    pileHistoryLen: state.pileHistory?.length||0,
    pileHistory: state.pileHistory?.slice(-8) || [],
    passCount: state.passCount,
    mustPlay: !!state.mustPlay,
    tenRule: state.tenRule,
    fourOfAKindChallenge: state.fourOfAKindChallenge,
    finishedOrder: state.finishedOrder,
    players: state.players.map(p=>({id:p.id,name:p.name,handCount:p.hand.length}))
  };
}

function simulateOneVerbose(seedPlayers=4, maxSteps=5000){
  const names = Array.from({length: seedPlayers}, (_,i)=>`CPU${i+1}`);
  let state = core.createGame(names);
  const trace = [];
  let steps = 0;
  const seen = new Map();

  while((state.finishedOrder?.length||0) < state.players.length && steps < maxSteps){
    steps++;
  // Use a fuller snapshot for loop detection (include hand counts and recent pileHistory)
  const snapKey = JSON.stringify(snapshotMin(state));
    trace.push({step: steps, key: snapKey, snapshot: snapshotMin(state)});
    if (seen.has(snapKey)){
      // repeating
      return { ok:false, reason:'repeating-state', steps, seenAt: seen.get(snapKey), now: steps, trace };
    }
    seen.set(snapKey, steps);

    const current = state.players[state.currentPlayerIndex];
    if (state.finishedOrder.includes(current.id)){
      state.currentPlayerIndex = core.nextActivePlayerIndex(state, state.currentPlayerIndex);
      continue;
    }

    const cpuPlay = core.findCPUPlay(current.hand, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder);
    if (cpuPlay && cpuPlay.length>0){
      const next = core.playCards(state, current.id, cpuPlay);
      trace[trace.length-1].action = { type:'play', player: current.id, attempted: cpuPlay.map(c=>c.value) };
      if (next === state){
        trace[trace.length-1].result = 'rejected-play';
        // fallback to pass
        state = core.passTurn(state, current.id);
      } else {
        state = next;
        trace[trace.length-1].result = 'played';
        if (state.tenRulePending){
          state = core.setTenRuleDirection(state, Math.random()<0.5?'higher':'lower');
        }
      }
      continue;
    } else {
      trace[trace.length-1].action = { type:'pass', player: current.id };
      const next = core.passTurn(state, current.id);
      if (next === state){
        trace[trace.length-1].result = 'pass-rejected';
        return { ok:false, reason:'pass-rejected', steps, trace, state: snapshotMin(state) };
      }
      state = next;
      trace[trace.length-1].result = 'passed';
      continue;
    }
  }

  if ((state.finishedOrder?.length||0) === state.players.length) return { ok:true, steps, trace };
  return { ok:false, reason:'max-steps', steps, trace };
}

console.log('Running debug simulator until first failure...');
const res = simulateOneVerbose(4, 2000);
if (res.ok) {
  console.log('Completed game ok in', res.steps, 'steps');
  process.exit(0);
} else {
  console.error('Simulation failed:', res.reason, 'steps:', res.steps, 'seenAt:', res.seenAt, 'now:', res.now);
  console.error('Last snapshot:', JSON.stringify(res.trace.slice(-8), null, 2));
  // print compact trace length
  console.error('Trace length:', res.trace.length);
  // write full trace to file for inspection
  const fs = require('fs');
  fs.writeFileSync('simulate-debug-trace.json', JSON.stringify(res, null, 2));
  console.error('Full trace written to simulate-debug-trace.json');
  process.exit(1);
}
