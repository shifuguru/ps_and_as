const core = require('../src/game/core.js');

function card(suit,value){return {suit,value};}
function randChoice(arr){return arr[Math.floor(Math.random()*arr.length)];}

// Simulate a full game using engine heuristics (findCPUPlay) to ensure no deadlocks
function simulateOneGame(seedPlayers=4, maxTurns=1000){
  const names = Array.from({length: seedPlayers}, (_,i)=>`CPU${i+1}`);
  let state = core.createGame(names);
  // populate hands are already dealt by createGame
  let steps = 0;
  const seenStates = new Set();

  while((state.finishedOrder?.length || 0) < state.players.length && steps < maxTurns){
    steps++;
    // Safety: detect infinite loops by serializing minimal state snapshot
    // Create a slightly richer snapshot for loop detection to avoid false positives.
    const snapObj = {
      cur: state.currentPlayerIndex,
      last: state.lastPlayPlayerIndex,
      pileTop: state.pile[0]?.value ?? null,
      passCount: state.passCount,
      mustPlay: !!state.mustPlay,
      pileHistoryLen: state.pileHistory?.length || 0,
      // include hand counts so progress (cards played) prevents spurious repeats
      hands: state.players.map(p => p.hand.length),
      finished: state.finishedOrder || []
    };
    const snap = JSON.stringify(snapObj);
    if (seenStates.has(snap) && steps > 200) {
      return { ok: false, reason: 'repeating-state', steps };
    }
    seenStates.add(snap);

    const current = state.players[state.currentPlayerIndex];
    if (state.finishedOrder.includes(current.id)){
      // advance
      state.currentPlayerIndex = core.nextActivePlayerIndex(state, state.currentPlayerIndex);
      continue;
    }

    // Mitigation: per-player consecutive rejected-play counter to avoid
    // infinite retry loops in the simulator. After 3 repeated rejected
    // attempts we force a pass for that player.
    state._rejectedAttempts = state._rejectedAttempts || {};
    const incRejected = (id) => { state._rejectedAttempts[id] = (state._rejectedAttempts[id] || 0) + 1; return state._rejectedAttempts[id]; };
    const resetRejected = (id) => { state._rejectedAttempts[id] = 0; };

    // If mustPlay, try to find a CPU play; if none, allow pass
    const cpuPlay = core.findCPUPlay(current.hand, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder);
    if (cpuPlay && cpuPlay.length > 0){
      // attempt to play
      const next = core.playCards(state, current.id, cpuPlay);
      if (next === state){
        // engine rejected play - increment counter and possibly force pass
        const attempts = incRejected(current.id);
        if (attempts >= 3){
          // force pass
          const pNext = core.passTurn(state, current.id);
          resetRejected(current.id);
          state = pNext;
          continue;
        }
        const pNext = core.passTurn(state, current.id);
        state = pNext;
        continue;
      } else {
        // successful play -> reset counter
        resetRejected(current.id);
        state = next;
        // Handle tenRulePending randomly if present
        if (state.tenRulePending){
          state = core.setTenRuleDirection(state, Math.random() < 0.5 ? 'higher' : 'lower');
        }
        continue;
      }
    } else {
      // no cpu play found - normal pass -> reset rejected counter
      if (state._rejectedAttempts) state._rejectedAttempts[current.id] = 0;
      const next = core.passTurn(state, current.id);
      if (next === state){
        // If the engine refused the pass (rare), try to force a play with findValidSingleCard
        const single = core.findValidSingleCard(current.hand, state.pile);
        if (single){
          const attempted = core.playCards(state, current.id, [single]);
          if (attempted === state) {
            return { ok: false, reason: 'deadlock', steps, stateSnapshot: state };
          }
          state = attempted;
          continue;
        }
        return { ok: false, reason: 'pass-rejected', steps, stateSnapshot: state };
      }
      state = next;
      continue;
    }
  }

  if ((state.finishedOrder?.length || 0) === state.players.length) {
    return { ok: true, steps };
  }
  return { ok: false, reason: 'max-steps', steps };
}

// Run multiple simulations and report
const N = parseInt(process.argv[2] || '200', 10);
let failures = [];
for (let i=0;i<N;i++){
  const res = simulateOneGame(4, 2000);
  if (!res.ok) failures.push({i,res});
  if (i % 25 === 0) console.log(`[simulate] ${i}/${N} done`);
}

console.log('Simulate done.');
console.log('Total:',N,'Failures:',failures.length);
if (failures.length>0) console.log('Failures detail:', JSON.stringify(failures.slice(0,5), null, 2));
process.exit(failures.length>0?1:0);
