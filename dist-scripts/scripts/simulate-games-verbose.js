const fs = require('fs');
const path = require('path');
const core = require('../src/game/core.js');

function card(suit,value){return {suit,value};}

function simulateOneGameVerbose(seedPlayers=4, maxTurns=2000){
  const names = Array.from({length: seedPlayers}, (_,i)=>`CPU${i+1}`);
  let state = core.createGame(names);
  let steps = 0;
  const seenStates = new Set();
  const trace = [];

  while((state.finishedOrder?.length || 0) < state.players.length && steps < maxTurns){
    steps++;
    const snapObj = {
      cur: state.currentPlayerIndex,
      last: state.lastPlayPlayerIndex,
      pileTop: state.pile[0]?.value ?? null,
      passCount: state.passCount,
      mustPlay: !!state.mustPlay,
      pileHistoryLen: state.pileHistory?.length || 0,
      hands: state.players.map(p => p.hand.length),
      finished: state.finishedOrder || []
    };
    const snap = JSON.stringify(snapObj);
    // Also include a deep copy of the full engine state for precise replay
  const fullState = JSON.parse(JSON.stringify(state));
  trace.push({ step: steps, snapshot: snapObj, fullState });
    if (seenStates.has(snap) && steps > 120) {
      return { ok: false, reason: 'repeating-state', steps, stateSnapshot: state, trace };
    }
    seenStates.add(snap);

    const current = state.players[state.currentPlayerIndex];
    if (state.finishedOrder.includes(current.id)){
      state.currentPlayerIndex = core.nextActivePlayerIndex(state, state.currentPlayerIndex);
      continue;
    }

    // Per-player consecutive rejected-play counter to avoid noisy infinite retries
    state._rejectedAttempts = state._rejectedAttempts || {};
    const rejectedAttempts = (id) => state._rejectedAttempts[id] || 0;
    const resetRejected = (id) => { state._rejectedAttempts[id] = 0; };
    const incRejected = (id) => { state._rejectedAttempts[id] = (state._rejectedAttempts[id] || 0) + 1; return state._rejectedAttempts[id]; };

    const cpuPlay = core.findCPUPlay(current.hand, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder);
    if (cpuPlay && cpuPlay.length > 0){
      // attach the pre-action fullState to the action so replays are deterministic
      trace.push({ step: steps, action: 'play', player: current.id, cards: cpuPlay, preState: JSON.parse(JSON.stringify(fullState)) });
      const next = core.playCards(state, current.id, cpuPlay);
      if (next === state){
        trace.push({ step: steps, action: 'play-rejected', player: current.id, attempted: cpuPlay, preState: JSON.parse(JSON.stringify(fullState)) });
        const attempts = incRejected(current.id);
        // If this player has attempted the same invalid play several times, force a pass
        if (attempts >= 3) {
          trace.push({ step: steps, action: 'forced-pass-after-rejects', player: current.id, attempts, preState: JSON.parse(JSON.stringify(fullState)) });
          resetRejected(current.id);
          const pNext = core.passTurn(state, current.id);
          state = pNext;
          continue;
        }
        // otherwise, record a normal pass to move on
        const pNext = core.passTurn(state, current.id);
        // record the preState for the pass as well
        trace[trace.length-1].preState = JSON.parse(JSON.stringify(fullState));
        state = pNext;
        continue;
      } else {
        // successful play -> reset rejected counter
        resetRejected(current.id);
        state = next;
        if (state.tenRulePending){
          const dir = Math.random() < 0.5 ? 'higher' : 'lower';
            trace.push({ step: steps, action: 'tenRuleChoice', player: current.id, direction: dir, preState: JSON.parse(JSON.stringify(fullState)) });
          state = core.setTenRuleDirection(state, dir);
        }
        continue;
      }
    } else {
        trace.push({ step: steps, action: 'pass', player: current.id, preState: JSON.parse(JSON.stringify(fullState)) });
      // normal pass -> reset rejected counter for this player
      if (state._rejectedAttempts) state._rejectedAttempts[current.id] = 0;
      const next = core.passTurn(state, current.id);
      if (next === state){
          trace.push({ step: steps, action: 'pass-rejected', player: current.id, preState: JSON.parse(JSON.stringify(fullState)) });
        const single = core.findValidSingleCard(current.hand, state.pile);
        if (single){
            trace.push({ step: steps, action: 'force-play', player: current.id, card: single, preState: JSON.parse(JSON.stringify(fullState)) });
            const attempted = core.playCards(state, current.id, [single]);
          if (attempted === state) {
            return { ok: false, reason: 'deadlock', steps, stateSnapshot: state, trace };
          }
          state = attempted;
          continue;
        }
        return { ok: false, reason: 'pass-rejected', steps, stateSnapshot: state, trace };
      }
      state = next;
      continue;
    }
  }

  if ((state.finishedOrder?.length || 0) === state.players.length) return { ok: true, steps, trace };
  return { ok: false, reason: 'max-steps', steps, stateSnapshot: state, trace };
}

const outDir = path.join(__dirname, '..', 'simulation-traces');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const N = parseInt(process.argv[2] || '50', 10);
for (let i=0;i<N;i++){
  console.log(`[simv] running ${i+1}/${N}`);
  const r = simulateOneGameVerbose(4, 3000);
  if (!r.ok){
    const fname = path.join(outDir, `failure-${Date.now()}-i${i}.json`);
    fs.writeFileSync(fname, JSON.stringify(r, null, 2));
    console.log('Found failure, wrote trace to', fname);
    process.exit(1);
  }
}
console.log('All simulations passed');
process.exit(0);
