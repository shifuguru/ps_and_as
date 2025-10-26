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

const mismatches = [];

for (let i = 0; i < trace.length - 1; i++) {
  const entry = trace[i];
  if (!entry.fullState) continue;
  const next = trace[i+1];
  if (!next || !next.action) continue;
  if (next.action !== 'play' && next.action !== 'play-rejected') continue;

  const attempted = next.cards || next.attempted || [];
  const player = next.player;

  let state = deepClone(entry.fullState);
  const playerHasPassedIn = (s) => s && s.currentTrick && Array.isArray(s.currentTrick.actions) && s.currentTrick.actions.some(a => a.type === 'pass' && a.playerId === player);
  let usedFallbackIndex = null;
  if (playerHasPassedIn(state)) {
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
    if (usedFallbackIndex === null) continue; // skip inconsistent
  }

  const isValid = core.isValidPlay(attempted, state.pile, state.tenRule, state.pileHistory, state.fourOfAKindChallenge, state.currentTrick, state.players, state.finishedOrder);
  const out = core.playCards(deepClone(state), player, attempted);
  const pIndex = out.players.findIndex(p => p.id === player);
  const afterHand = pIndex >= 0 ? out.players[pIndex].hand : null;
  const stillHasAttempted = attempted.every(ac => (afterHand || []).some(h => h.suit === ac.suit && h.value === ac.value));

  let traceRejected = false;
  if (next.action === 'play-rejected') traceRejected = true;
  if (trace[i+2] && trace[i+2].action === 'play-rejected') traceRejected = true;

  const engineRejected = stillHasAttempted;
  if (engineRejected !== traceRejected) {
    mismatches.push({ i, step: entry.step, player, attempted, usedFallbackIndex, state, isValid, engineRejected, traceRejected });
  }
}

if (mismatches.length === 0) {
  console.log('No remaining mismatches after fallback logic.');
  process.exit(0);
}

for (const m of mismatches) {
  console.log('\n===== MISMATCH at trace index', m.i, 'step', m.step, 'player', m.player, 'usedFallbackIndex', m.usedFallbackIndex, '=====');
  console.log('Attempted cards:', JSON.stringify(m.attempted));
  console.log('pile:', m.state.pile && m.state.pile.map(c=>c.value));
  console.log('pileHistory length:', m.state.pileHistory ? m.state.pileHistory.length : 0);
  console.log('pileHistory last entries:', (m.state.pileHistory || []).slice(-3).map(ph => ph.map(c=>c.value)));
  console.log('tenRule:', JSON.stringify(m.state.tenRule));
  console.log('fourOfAKindChallenge:', JSON.stringify(m.state.fourOfAKindChallenge));
  console.log('currentTrick.actions tail:', (m.state.currentTrick && m.state.currentTrick.actions ? m.state.currentTrick.actions.slice(-6).map(a => ({type:a.type, playerId:a.playerId, cards: a.cards ? a.cards.map(c=>c.value) : null})) : []));
  console.log('player hand:', m.state.players.find(p=>p.id===m.player).hand.map(c=>c.value));
  console.log('core.isValidPlay =>', m.isValid);
  console.log('engineRejected =>', m.engineRejected, 'traceRejected =>', m.traceRejected);
}

process.exit(1);
