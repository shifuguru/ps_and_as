const core = require('../dist-scripts/src/game/core');
const rules = require('../dist-scripts/src/game/ruleset');

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

function rankIndex(value) {
  const RANK_ORDER = [3,4,5,6,7,8,9,10,11,12,13,14,2,15];
  const idx = RANK_ORDER.indexOf(value);
  return idx >= 0 ? idx : -1;
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

function findAiPlay(state, player) {
  const hand = player.hand.slice();
  const pile = state.pile || [];
  const pileCount = pile.length;
  const grouped = groupByValue(hand);
  if (pileCount === 0) {
    // lowest single by rankIndex
    let best = null;
    for (const c of hand) {
      if (!best || rankIndex(c.value) < rankIndex(best.value)) best = c;
    }
    return best ? [best] : null;
  }
  const pileTopRank = rankIndex(pile[0]?.value ?? -1);
  const candidates = [];
  for (const [val, items] of grouped.entries()) {
    if (items.length >= pileCount) {
      const rank = rankIndex(val);
      if (rank > pileTopRank) candidates.push({ rank, val });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a,b) => a.rank - b.rank);
  const chosenVal = candidates[0].val;
  const play = hand.filter((c) => c.value === chosenVal).slice(0, pileCount);
  return play.length ? play : null;
}

function printHand(player) {
  return player.hand.map((c) => `${c.suit[0]}:${c.value}`).join(', ');
}

function run(seed = 12345, playerCount = 3, maxSteps = 200) {
  console.log('Tracing seed', seed);
  const names = Array.from({ length: playerCount }).map((_, i) => `CPU${i+1}`);
  let state = createGameSeeded(names, seed);
  console.log('Starter index', state.currentPlayerIndex, 'mustPlay', state.mustPlay);
  let steps = 0;
  while (state.finishedOrder.length < state.players.length && steps < maxSteps) {
    steps++;
    const pIndex = state.currentPlayerIndex;
    const player = state.players[pIndex];
    console.log(`Step ${steps} - Player ${pIndex} (${player.name}) hand:`, printHand(player));
    const play = findAiPlay(state, player);
    if (play) {
      console.log('  Plays:', JSON.stringify(play));
      const next = core.playCards(state, player.id, play);
      console.log('  After play, player hand:', printHand(next.players[pIndex]));
      console.log('  Pile length', (next.pile || []).length, 'pileHistory len', (next.pileHistory||[]).length, 'mustPlay', next.mustPlay);
      state = next;
    } else {
      console.log('  Pass');
      const next = core.passTurn(state, player.id);
      if (next === state) {
        console.log('  Pass rejected (mustPlay?), mustPlay=', state.mustPlay);
        break;
      }
      state = next;
    }
  }
  console.log('Finished after steps', steps, 'finish order', state.finishedOrder);
}

if (require.main === module) {
  const s = parseInt(process.argv[2] || '12345', 10);
  run(s, 3);
}
