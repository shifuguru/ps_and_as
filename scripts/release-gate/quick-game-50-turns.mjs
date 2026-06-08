/**
 * Quick Game — 50-turn offline smoke (mirrors GameScreen CPU loop).
 *
 *   node scripts/release-gate/quick-game-50-turns.mjs
 *
 * Env:
 *   QUICK_GAME_TURNS=50   action count target (default 50)
 *   QUICK_GAME_SEED=4242  deal seed (default random-ish stable)
 */
import { createRequire } from "module";
import {
  assertCurrentPlayerMayAct,
  scanTurnOwnership,
} from "./lib/turnOwnership.mjs";

const require = createRequire(import.meta.url);
require("../../server/gameBridge.js");
const core = require("../../server/gameBridge.js");
const { isDeadHandPlayer } = require("../../src/game/deadHand.ts");

const {
  createGameFromLobby,
  playCards,
  passTurn,
  applyCpuTurn,
  findCPUPlay,
  setTenRuleDirection,
  isRoundCompleteForLiving,
  isPlayerStillIn,
  repairStuckTurnPointer,
  advanceOffPriorPasser,
  resolveDisplayTurnPlayerIndex,
  playerCanActInCurrentTrick,
  hasPassedInCurrentTrick,
} = core;

const TURN_TARGET = Number(process.env.QUICK_GAME_TURNS ?? 50);
const DEAL_SEED = Number(process.env.QUICK_GAME_SEED ?? 42_424);
const MAX_MICRO_STEPS = 500;
const HUMAN_ID = "local-human-1";
const CPU_NAMES = ["Amy", "Ben", "Cal"];

function clone(gs) {
  return JSON.parse(JSON.stringify(gs));
}

function isCpuSeat(player, humanId) {
  if (!player) return false;
  if (player.id === humanId) return false;
  return /^cpu-\d+$/i.test(player.id);
}

/** Pre-turn repair pass — same order as GameScreen offline effect. */
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
  if (!current) {
    throw new Error("no player at currentPlayerIndex");
  }

  if (
    working.finishedOrder.includes(current.id) ||
    current.hand.length === 0 ||
    isDeadHandPlayer(current)
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

function planHumanOrCpuAction(state, playerId) {
  if (state.tenRulePending) {
    const chooser = state.players[state.currentPlayerIndex];
    if (chooser?.id === playerId) {
      return { type: "tenRule", direction: "higher" };
    }
    return null;
  }

  const before = clone(state);
  const player = before.players.find((p) => p.id === playerId);
  if (!player) return null;
  const handBefore = [...player.hand];
  const idx = before.players.findIndex((p) => p.id === playerId);
  const runOnTop =
    !!before.runOnTop?.active && before.runOnTop.playerIndex === idx;

  const cards = findCPUPlay(
    player.hand,
    before.pile,
    before.tenRule,
    before.pileHistory,
    before.fourOfAKindChallenge,
    before.currentTrick,
    before.players,
    before.finishedOrder,
    before.trickHistory,
    before.lastRoundOrder,
    player.id,
    runOnTop,
  );

  if (cards?.length) {
    const afterPlay = playCards(before, playerId, cards);
    if (afterPlay !== before) return { type: "play", cards, after: afterPlay };
  }

  const afterPass = passTurn(before, playerId);
  if (afterPass !== before) return { type: "pass", after: afterPass };

  let next = applyCpuTurn(before, playerId);
  if (next === before) {
    const recovered = repairStuckTurnPointer(advanceOffPriorPasser(before));
    if (recovered !== before) return { type: "recover", after: recovered };
    next = applyCpuTurn(recovered, playerId);
  }

  if (next !== before) {
    const playerAfter = next.players.find((p) => p.id === playerId);
    const played = handBefore.filter(
      (c) =>
        !playerAfter.hand.some((h) => h.suit === c.suit && h.value === c.value),
    );
    if (played.length) return { type: "play", cards: played, after: next };
    return { type: "pass", after: next };
  }

  return null;
}

function applyAction(state, action, playerId) {
  if (action.type === "tenRule") {
    return setTenRuleDirection(state, action.direction);
  }
  if (action.type === "recover") {
    return action.after;
  }
  if (action.type === "play") {
    return playCards(state, playerId, action.cards);
  }
  if (action.type === "pass") {
    return passTurn(state, playerId);
  }
  return state;
}

function assertEmptyHandOwnership(gs, turnNum) {
  const cur = gs.players[gs.currentPlayerIndex];
  if (!cur) return;
  if (cur.hand.length === 0 && isPlayerStillIn(gs, cur.id)) {
    throw new Error(
      `turn ${turnNum}: empty-hand seat still "in" and holds turn (${cur.name ?? cur.id})`,
    );
  }
  if (cur.hand.length === 0 && !gs.finishedOrder.includes(cur.id)) {
    throw new Error(
      `turn ${turnNum}: empty hand but not in finishedOrder (${cur.name ?? cur.id})`,
    );
  }
}

function assertLastHandBeforeRankings(gs) {
  const living = gs.players.filter(
    (p) => !isDeadHandPlayer(p) && isPlayerStillIn(gs, p.id),
  );
  if (living.length > 1) return;
  const lastId = gs.finishedOrder[gs.finishedOrder.length - 1];
  if (!lastId) {
    throw new Error("round complete but finishedOrder empty");
  }
  const lastPlayer = gs.players.find((p) => p.id === lastId);
  if (!lastPlayer) {
    throw new Error(`round complete but last finisher ${lastId} missing`);
  }
}

function runQuickGame50() {
  const lobby = [
    { id: HUMAN_ID, name: "Player" },
    ...CPU_NAMES.map((name, i) => ({ id: `cpu-${i + 1}`, name })),
  ];

  let state = createGameFromLobby(lobby, DEAL_SEED);
  const watch = {
    turns: 0,
    microSteps: 0,
    stuckEvents: 0,
    repairs: 0,
    roundCompleted: false,
    finishOrder: [],
    rankingsOk: null,
    lastHandOk: null,
    cardFlight: "skipped (UI-only — run Playwright for animation gate)",
    crashes: 0,
  };

  const failures = [];

  try {
    while (watch.turns < TURN_TARGET && watch.microSteps < MAX_MICRO_STEPS) {
      watch.microSteps++;

      if (isRoundCompleteForLiving(state) && !state.tenRulePending) {
        watch.roundCompleted = true;
        watch.finishOrder = [...state.finishedOrder];
        try {
          assertLastHandBeforeRankings(state);
          watch.lastHandOk = true;
        } catch (err) {
          watch.lastHandOk = false;
          failures.push(`last hand: ${err.message}`);
        }
        watch.rankingsOk = watch.finishOrder.length >= 2;
        if (!watch.rankingsOk) {
          failures.push(
            `rankings: finishOrder too short (${watch.finishOrder.length})`,
          );
        }
        break;
      }

      let pre;
      try {
        pre = preprocessTurn(state);
      } catch (err) {
        failures.push(`preprocess turn ${watch.turns + 1}: ${err.message}`);
        break;
      }

      state = pre.state;
      if (pre.kind !== "ready" && pre.kind !== "round-complete") {
        watch.repairs++;
        if (pre.kind === "idle-empty") {
          watch.stuckEvents++;
          failures.push(
            `stuck turn ${watch.turns + 1}: empty/out seat could not advance`,
          );
          break;
        }
        continue;
      }

      if (isRoundCompleteForLiving(state) && !state.tenRulePending) {
        continue;
      }

      try {
        scanTurnOwnership(state, `turn ${watch.turns + 1}`);
        assertEmptyHandOwnership(state, watch.turns + 1);
      } catch (err) {
        failures.push(err.message);
        break;
      }

      const current = state.players[state.currentPlayerIndex];
      if (!current) {
        failures.push(`turn ${watch.turns + 1}: missing current player`);
        break;
      }

      const action = planHumanOrCpuAction(state, current.id);
      if (!action) {
        watch.stuckEvents++;
        failures.push(
          `stuck turn ${watch.turns + 1}: ${current.name ?? current.id} — no play or pass`,
        );
        break;
      }

      const beforeKey = JSON.stringify({
        idx: state.currentPlayerIndex,
        pile: state.pile?.length,
        trick: state.trickHistory?.length,
        finished: state.finishedOrder?.length,
        passCount: state.passCount,
      });

      let next;
      try {
        next = applyAction(state, action, current.id);
      } catch (err) {
        watch.crashes++;
        failures.push(`crash turn ${watch.turns + 1}: ${err.message}`);
        break;
      }

      if (next === state) {
        watch.stuckEvents++;
        failures.push(
          `stuck turn ${watch.turns + 1}: action ${action.type} did not advance state`,
        );
        break;
      }

      const afterKey = JSON.stringify({
        idx: next.currentPlayerIndex,
        pile: next.pile?.length,
        trick: next.trickHistory?.length,
        finished: next.finishedOrder?.length,
        passCount: next.passCount,
      });

      if (beforeKey === afterKey && !next.tenRulePending) {
        watch.stuckEvents++;
        failures.push(
          `stuck turn ${watch.turns + 1}: state fingerprint unchanged after ${action.type}`,
        );
        break;
      }

      state = next;
      watch.turns++;
    }
  } catch (err) {
    watch.crashes++;
    failures.push(`uncaught: ${err.message ?? err}`);
  }

  if (watch.turns < TURN_TARGET && !watch.roundCompleted) {
    failures.push(
      `only ${watch.turns}/${TURN_TARGET} turns before stop (microSteps=${watch.microSteps})`,
    );
  }

  return { watch, failures, seed: DEAL_SEED };
}

console.log("═".repeat(60));
console.log(`Quick Game — ${TURN_TARGET} turns (offline engine)`);
console.log(`Seed: ${DEAL_SEED}  Players: 1 human + 3 CPU`);
console.log("═".repeat(60));

const { watch, failures, seed } = runQuickGame50();

console.log("\nWatch summary:");
console.log(`  turns played:     ${watch.turns}`);
console.log(`  stuck events:     ${watch.stuckEvents}`);
console.log(`  repair passes:    ${watch.repairs}`);
console.log(`  round completed:  ${watch.roundCompleted}`);
console.log(`  finish order:     ${watch.finishOrder.join(" → ") || "(n/a)"}`);
console.log(`  rankings ok:      ${watch.rankingsOk ?? "n/a"}`);
console.log(`  last hand ok:     ${watch.lastHandOk ?? "n/a"}`);
console.log(`  card flight:      ${watch.cardFlight}`);
console.log(`  crashes:          ${watch.crashes}`);

if (failures.length) {
  console.log("\nFAIL quick game 50-turn gate:");
  for (const f of failures) console.log(`  • ${f}`);
  console.log(`\nRepro: QUICK_GAME_SEED=${seed} node scripts/release-gate/quick-game-50-turns.mjs`);
  process.exit(1);
}

console.log("\nPASS quick game 50-turn gate");
process.exit(0);
