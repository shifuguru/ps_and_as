/**
 * Min repro: offline-round-sim seed 42003 @ step 81
 * node scripts/release-gate/offline-seed-42003-min-repro.mjs
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";

const require = createRequire(import.meta.url);
require("../../server/gameBridge.js");
const core = require("../../server/gameBridge.js");
const { createDeck, dealCards } = require("../../src/game/ruleset.ts");

const {
  playCards,
  passTurn,
  applyCpuTurn,
  findCPUPlay,
  isPlayerStillIn,
  isRoundCompleteForLiving,
  setTenRuleDirection,
  repairStuckTurnPointer,
  advanceOffPriorPasser,
  resolveDisplayTurnPlayerIndex,
  playerCanActInCurrentTrick,
  hasPassedInCurrentTrick,
} = core;

const SEED = Number(process.env.REPRO_SEED ?? 42003);
const FAIL_STEP = Number(process.env.REPRO_STEP ?? 81);
const PLAYERS = 4;

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

function preprocessTurn(state) {
  let working = repairStuckTurnPointer(state);
  if (working !== state) return { state: working, kind: "repair-stuck" };

  const displayIdx = resolveDisplayTurnPlayerIndex(working);
  if (
    displayIdx !== working.currentPlayerIndex &&
    playerCanActInCurrentTrick(working, displayIdx)
  ) {
    const repaired = repairStuckTurnPointer(advanceOffPriorPasser(working));
    if (repaired !== state) return { state: repaired, kind: "advance-display" };
    working = repaired;
  }

  const current = working.players[working.currentPlayerIndex];
  if (!current) throw new Error("no player at currentPlayerIndex");

  if (
    working.finishedOrder.includes(current.id) ||
    current.hand.length === 0
  ) {
    if (isRoundCompleteForLiving(working)) return { state: working, kind: "round-complete" };
    const next = passTurn(working, current.id);
    if (
      next.currentPlayerIndex !== working.currentPlayerIndex ||
      next.finishedOrder.length !== working.finishedOrder.length ||
      (next.trickHistory?.length ?? 0) !== (working.trickHistory?.length ?? 0)
    ) {
      return { state: next, kind: "skip-empty-or-out" };
    }
    return { state: working, kind: "idle-empty" };
  }

  const isRunOnTopTurn =
    !!working.runOnTop?.active &&
    working.runOnTop.playerIndex === working.currentPlayerIndex;

  if (hasPassedInCurrentTrick(working, current.id) && !isRunOnTopTurn) {
    const next = advanceOffPriorPasser(working);
    if (
      next.currentPlayerIndex !== working.currentPlayerIndex ||
      (next.trickHistory?.length ?? 0) !== (working.trickHistory?.length ?? 0) ||
      !!next.runOnTop?.active !== !!working.runOnTop?.active
    ) {
      return { state: next, kind: "advance-off-passer" };
    }
  }

  return { state: working, kind: "ready" };
}

function planCpuAction(state, playerId) {
  if (state.tenRulePending) {
    const chooser = state.players[state.currentPlayerIndex];
    if (chooser?.id === playerId) return { kind: "tenRule", next: state };
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
    if (next !== state) return { kind: "playCards", next, detail: { cards } };
  }
  const afterPass = passTurn(state, playerId);
  if (afterPass !== state) return { kind: "passTurn", next: afterPass };
  const afterCpu = applyCpuTurn(state, playerId);
  if (afterCpu !== state) return { kind: "applyCpuTurn", next: afterCpu };
  return null;
}

function snapshot(state) {
  const cur = state.players[state.currentPlayerIndex];
  return {
    currentPlayerIndex: state.currentPlayerIndex,
    currentPlayerId: cur?.id,
    stillIn: cur ? isPlayerStillIn(state, cur.id) : null,
    finishedOrder: [...(state.finishedOrder ?? [])],
    handLens: state.players.map((p) => ({ id: p.id, n: p.hand.length })),
    trickActions: state.currentTrick?.actions?.length ?? 0,
    trickNum: state.currentTrick?.trickNumber,
    pileLen: state.pile?.length ?? 0,
    passCount: state.passCount,
    lastPlayPlayerIndex: state.lastPlayPlayerIndex,
    runOnTop: state.runOnTop ?? null,
  };
}

function simulate({ usePreprocess }) {
  const names = Array.from({ length: PLAYERS }).map((_, i) => `CPU${i + 1}`);
  let state = createGameSeeded(names, SEED);
  let steps = 0;
  let lastMutator = "(initial deal)";
  const log = [];

  while (
    !(isRoundCompleteForLiving(state) && !state.tenRulePending) &&
    steps < 1200
  ) {
    steps++;
    if (usePreprocess) {
      const pre = preprocessTurn(state);
      if (pre.kind !== "ready" && pre.kind !== "round-complete") {
        lastMutator = `preprocessTurn:${pre.kind}`;
        state = pre.state;
        if (pre.kind === "idle-empty") {
          return { ok: false, steps, reason: "idle-empty after preprocess", lastMutator, snap: snapshot(state), log };
        }
        if (isRoundCompleteForLiving(state) && !state.tenRulePending) continue;
        continue;
      }
      state = pre.state;
      if (isRoundCompleteForLiving(state) && !state.tenRulePending) continue;
    }

    const cur = state.players[state.currentPlayerIndex];
    if (!cur) {
      return { ok: false, steps, reason: "no current player", lastMutator, snap: snapshot(state), log };
    }
    if (!isPlayerStillIn(state, cur.id)) {
      return {
        ok: false,
        steps,
        reason: `turn on out player ${cur.id}`,
        lastMutator,
        snap: snapshot(state),
        log,
      };
    }

    const planned = planCpuAction(state, cur.id);
    if (!planned) {
      return { ok: false, steps, reason: `stuck at ${cur.id}`, lastMutator, snap: snapshot(state), log };
    }

    if (steps >= FAIL_STEP - 2 && steps <= FAIL_STEP + 1) {
      log.push({ step: steps, before: snapshot(state), mutator: null });
    }

    if (planned.kind === "tenRule") {
      lastMutator = "setTenRuleDirection(higher)";
      state = setTenRuleDirection(state, "higher");
    } else {
      lastMutator = planned.kind + (planned.detail ? ` ${JSON.stringify(planned.detail.cards?.map(c=>c.value))}` : "");
      state = planned.next;
    }

    if (steps >= FAIL_STEP - 2 && steps <= FAIL_STEP + 1) {
      log[log.length - 1].mutator = lastMutator;
      log[log.length - 1].after = snapshot(state);
    }
  }

  const ok = isRoundCompleteForLiving(state) && !state.tenRulePending;
  return { ok, steps, reason: ok ? "complete" : "loop exit", lastMutator, snap: snapshot(state), log };
}

const bare = simulate({ usePreprocess: false });
const repaired = simulate({ usePreprocess: true });

const report = {
  seed: SEED,
  failStep: FAIL_STEP,
  bareSim: {
    ok: bare.ok,
    steps: bare.steps,
    reason: bare.reason,
    lastMutator: bare.lastMutator,
    stateAtFailure: bare.snap,
    window: bare.log,
  },
  withPreprocessTurn: {
    ok: repaired.ok,
    steps: repaired.steps,
    reason: repaired.reason,
    lastMutator: repaired.lastMutator,
    finalSnap: repaired.snap,
  },
};

console.log(JSON.stringify(report, null, 2));
writeFileSync("scripts/release-gate/offline-seed-42003-min-repro.json", JSON.stringify(report, null, 2));
