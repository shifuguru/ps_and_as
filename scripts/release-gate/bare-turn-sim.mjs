/**
 * Bare turn-ownership sim — NO preprocessTurn / repairStuckTurnPointer.
 * Measures latent core defects masked by production repair layers.
 *
 *   node scripts/release-gate/bare-turn-sim.mjs
 *   OFFLINE_BARE_SIM_GAMES=500 OFFLINE_BARE_SIM_START=42000 node scripts/release-gate/bare-turn-sim.mjs
 *   OFFLINE_BARE_SIM_JSON=1 node scripts/release-gate/bare-turn-sim.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const realLog = console.log;
console.log = () => {};
require("../../server/gameBridge.js");
console.log = realLog;
const core = require("../../server/gameBridge.js");
const {
  playCards,
  passTurn,
  applyCpuTurn,
  findCPUPlay,
  isPlayerStillIn,
  isRoundCompleteForLiving,
  setTenRuleDirection,
} = core;
const { createDeck, dealCards } = require("../../src/game/ruleset.ts");

const GAMES = Number(process.env.OFFLINE_BARE_SIM_GAMES ?? 100);
const START = Number(process.env.OFFLINE_BARE_SIM_START ?? 42_000);
const PLAYERS = Number(process.env.OFFLINE_BARE_SIM_PLAYERS ?? 4);
const MAX_STEPS = 1200;
const JSON_OUT = process.env.OFFLINE_BARE_SIM_JSON === "1";

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
  const players = names.map((n, i) => ({
    id: String(i + 1),
    name: n,
    hand: [],
    role: "Neutral",
  }));
  const deck = createDeck();
  const shuffled = shuffleWithRng(deck, makeRng(seed));
  dealCards(shuffled, players);
  const threeIndex = players.findIndex((p) =>
    p.hand.some((c) => c.suit === "clubs" && c.value === 3),
  );
  const start = threeIndex >= 0 ? threeIndex : 0;
  return {
    id: "sim-" + seed,
    players,
    currentPlayerIndex: start,
    pile: [],
    pileHistory: [],
    passCount: 0,
    finishedOrder: [],
    started: true,
    lastPlayPlayerIndex: null,
    mustPlay: threeIndex >= 0,
    currentTrick: { trickNumber: 1, actions: [] },
    trickHistory: [],
  };
}

function planCpuAction(state, playerId) {
  if (state.tenRulePending) {
    const chooser = state.players[state.currentPlayerIndex];
    if (chooser?.id === playerId) {
      return { kind: "tenRule", next: state };
    }
    return null;
  }

  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return null;
  const player = state.players[idx];
  const runOnTop =
    !!state.runOnTop?.active && state.runOnTop.playerIndex === idx;

  const cards = findCPUPlay(
    player.hand,
    state.pile,
    state.tenRule,
    state.pileHistory,
    state.fourOfAKindChallenge,
    state.currentTrick,
    state.players,
    state.finishedOrder,
    state.trickHistory,
    state.lastRoundOrder,
    player.id,
    runOnTop,
  );

  if (cards?.length) {
    const next = playCards(state, playerId, cards);
    if (next !== state) return { kind: "state", next };
  }

  const afterPass = passTurn(state, playerId);
  if (afterPass !== state) return { kind: "state", next: afterPass };

  const afterCpu = applyCpuTurn(state, playerId);
  if (afterCpu !== state) return { kind: "state", next: afterCpu };

  return null;
}

/** Core loop only — intentionally skips all repair / preprocess layers. */
function simulateOne(seed) {
  const names = Array.from({ length: PLAYERS }).map((_, i) => `CPU${i + 1}`);
  let state = createGameSeeded(names, seed);
  let steps = 0;

  while (
    !(isRoundCompleteForLiving(state) && !state.tenRulePending) &&
    steps < MAX_STEPS
  ) {
    steps++;

    if (isRoundCompleteForLiving(state) && !state.tenRulePending) continue;

    const cur = state.players[state.currentPlayerIndex];
    if (!cur) {
      return { ok: false, seed, reason: "no current player", steps };
    }
    if (!isPlayerStillIn(state, cur.id)) {
      return {
        ok: false,
        seed,
        reason: `turn on out player ${cur.id}`,
        steps,
      };
    }

    const planned = planCpuAction(state, cur.id);
    if (!planned) {
      return { ok: false, seed, reason: `stuck at ${cur.id}`, steps };
    }
    if (planned.kind === "tenRule") {
      state = setTenRuleDirection(state, "higher");
    } else {
      state = planned.next;
    }
  }

  if (steps >= MAX_STEPS) {
    return { ok: false, seed, reason: "max steps", steps };
  }
  if (!isRoundCompleteForLiving(state) || state.tenRulePending) {
    return {
      ok: false,
      seed,
      reason: "round incomplete after loop",
      steps,
    };
  }
  return { ok: true, seed, steps };
}

const signatures = new Map();
const failures = [];
console.log = () => {};
for (let i = 0; i < GAMES; i++) {
  const seed = START + i;
  const res = simulateOne(seed);
  if (!res.ok) {
    signatures.set(res.reason, (signatures.get(res.reason) ?? 0) + 1);
    failures.push({ seed: res.seed, reason: res.reason, steps: res.steps });
  }
}

console.log = realLog;

const report = {
  games: GAMES,
  startSeed: START,
  players: PLAYERS,
  failures: failures.length,
  rate: failures.length / GAMES,
  signatures: Object.fromEntries(
    [...signatures.entries()].sort((a, b) => b[1] - a[1]),
  ),
  failingSeeds: failures,
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Bare turn sim (no repair): ${GAMES} games × ${PLAYERS} players — failures: ${failures.length} (${(report.rate * 100).toFixed(1)}%)`,
  );
  for (const [reason, count] of [...signatures.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${count}x ${reason}`);
  }
}

if (failures.length > 0) process.exit(1);
