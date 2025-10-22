let core, rules;
try {
  // prefer running against latest TypeScript source if ts-node is installed
  require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
  core = require('../src/game/core');
  rules = require('../src/game/ruleset');
} catch (e) {
  // fallback to precompiled JS bundle
  core = require('../dist-scripts/src/game/core');
  rules = require('../dist-scripts/src/game/ruleset');
}

// Simple seedable RNG (LCG)
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function shuffleWithRng(deck, rng) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createGameSeeded(names, seed) {
  const players = names.map((n, i) => ({ id: String(i + 1), name: n, hand: [], role: 'Neutral' }));
  const deck = rules.createDeck();
  const rng = makeRng(seed);
  const shuffled = shuffleWithRng(deck, rng);
  rules.dealCards(shuffled, players);
  // find starter
  const threeIndex = players.findIndex((p) => p.hand.some((c) => c.suit === 'clubs' && c.value === 3));
  const start = threeIndex >= 0 ? threeIndex : 0;
  return {
    id: 'sim-' + seed,
    players,
    currentPlayerIndex: start,
    pile: [],
    pileHistory: [],
    passCount: 0,
    finishedOrder: [],
    started: true,
    lastPlayPlayerIndex: null,
    mustPlay: threeIndex >= 0 ? true : false,
  };
}

function groupByValue(hand) {
  const map = new Map();
  hand.forEach((c, i) => {
    const key = c.value;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ card: c, idx: i });
  });
  return map;
}

// local rank order to mirror game rules
const RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 2, 15];

function rankIndex(value) {
  const idx = RANK_ORDER.indexOf(value);
  return idx >= 0 ? idx : -1;
}

function allSameValue(cards) {
  if (!cards || cards.length === 0) return false;
  const v = cards[0].value;
  return cards.every((c) => c.value === v);
}

function isValidPlayLocal(cards, pile) {
  if (!cards || cards.length === 0) return false;
  const playCount = cards.length;
  const pileCount = (pile || []).length;
  if (!allSameValue(cards)) return false;
  if (pileCount === 0) return true;
  if (playCount !== pileCount) return false;
  if (!allSameValue(pile)) return false;
  const top = rankIndex(pile[0].value);
  const plTop = rankIndex(cards[0].value);
  return plTop > top;
}

// ensure core's isValidPlay uses our rank-aware version (for compiled dist fallback)
if (!core.isValidPlay || core.isValidPlay === undefined) {
  core.isValidPlay = isValidPlayLocal;
} else {
  // override to ensure proper rank comparison
  core.isValidPlay = isValidPlayLocal;
}

// AI policy: prefer single lowest valid; if pileCount>0, must match that count with lowest rank > pileTop
function findAiPlay(state, player) {
  const hand = player.hand.slice();
  const pile = state.pile || [];
  const pileCount = pile.length;
  const grouped = groupByValue(hand);
  if (pileCount === 0) {
    // play lowest single
    let best = null;
    for (const c of hand) {
    if (!best || rankIndex(c.value) < rankIndex(best.value)) best = c;
    }
    return best ? [best] : null;
  }
  // pile has cards, need groups of size pileCount
  const pileTopRank = rankIndex(pile[0]?.value ?? -1);
  const candidates = [];
  for (const [val, items] of grouped.entries()) {
    if (items.length >= pileCount) {
  const rank = rankIndex(val);
      if (rank > pileTopRank) {
        candidates.push({ rank, val });
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.rank - b.rank);
  const chosenVal = candidates[0].val;
  // pick pileCount cards of chosenVal
  const play = hand.filter((c) => c.value === chosenVal).slice(0, pileCount);
  return play.length ? play : null;
}

function validateInvariantBeforePlay(state, pIndex, play) {
  // play must be allowed by isValidPlay
  if (!core.isValidPlay(play, state.pile)) return `Invalid play by player ${pIndex}: ${JSON.stringify(play)}`;
  // player must have the cards
  const player = state.players[pIndex];
  for (const card of play) {
    const found = player.hand.findIndex((h) => h.suit === card.suit && h.value === card.value);
    if (found === -1) return `Player ${pIndex} tried to play card they don't have: ${JSON.stringify(card)}`;
  }
  return null;
}

function simulateOne(seed, playerCount = 3, maxSteps = 1000) {
  const names = Array.from({ length: playerCount }).map((_, i) => `CPU${i + 1}`);
  let state = createGameSeeded(names, seed);
  let steps = 0;
  while (state.finishedOrder.length < state.players.length && steps < maxSteps) {
    steps++;
    const pIndex = state.currentPlayerIndex;
    const player = state.players[pIndex];
    const play = findAiPlay(state, player);
    if (play) {
      // validate
      const err = validateInvariantBeforePlay(state, pIndex, play);
      if (err) return { ok: false, seed, reason: err, state };
      const next = core.playCards(state, player.id, play);
      // ensure cards removed
      for (const c of play) {
        if (next.players[pIndex].hand.some((h) => h.suit === c.suit && h.value === c.value)) {
          return { ok: false, seed, reason: `Card not removed after play: ${JSON.stringify(c)}`, state };
        }
      }
      // check special clears
      if (core.containsTwo(play) || core.isFourOfAKind(play)) {
        if ((next.pile || []).length !== 0) return { ok: false, seed, reason: 'Pile not cleared after special play', state };
        if (next.lastPlayPlayerIndex !== pIndex) return { ok: false, seed, reason: 'lastPlayPlayerIndex incorrect after special clear', state };
        if (!next.mustPlay) return { ok: false, seed, reason: 'mustPlay not set after special clear', state };
      }
      state = next;
    } else {
      // attempt to pass
      if (state.mustPlay) return { ok: false, seed, reason: `Player ${pIndex} attempted to pass when mustPlay`, state };
      const next = core.passTurn(state, player.id);
      // ensure pass advanced
      if (next === state) return { ok: false, seed, reason: `Pass rejected unexpectedly by player ${pIndex}`, state };
      state = next;
    }
  }
  if (steps >= maxSteps) return { ok: false, seed, reason: 'Max steps reached (possible infinite loop)', state };
  return { ok: true, seed, steps, finish: state.finishedOrder };
}

function runBatch(count = 100, playerCount = 3) {
  const failures = [];
  for (let i = 0; i < count; i++) {
    const seed = 12345 + i;
    const res = simulateOne(seed, playerCount);
    if (!res.ok) failures.push(res);
  }
  console.log(`Ran ${count} games (${playerCount} players). Failures: ${failures.length}`);
  if (failures.length) {
    console.error('First failure:', failures[0]);
  } else {
    console.log('No failures detected in batch.');
  }
  return failures;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const count = argv[0] ? parseInt(argv[0], 10) : 200;
  const playerCount = argv[1] ? parseInt(argv[1], 10) : 3;
  const failures = runBatch(count, playerCount);
  if (failures.length) process.exitCode = 2;
}
