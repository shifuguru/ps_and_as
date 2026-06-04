#!/usr/bin/env node
/**
 * Targeted BOTOPN repro: human passes during a run → CPU should act.
 *
 *   npm run server
 *   node scripts/test-cpu-stall-botopn.mjs
 *
 * Headless path (no server):
 *   node scripts/test-cpu-stall-botopn.mjs --headless
 */
import { io } from "socket.io-client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const core = require("../server/gameBridge.js");
const { advancePastInactiveSeats } = require("../server/turnAdvance.js");
const botHosted = require("../server/botHostedRooms.js");
const { BOT_ROOM_CODE } = botHosted;

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const HUMAN_ID = "stall-human-1";
const STALL_MS = 18_000;
const POLL_MS = 400;

const {
  playCards,
  passTurn,
  runFromCurrentTrick,
  hasPassedInCurrentTrick,
  repairStuckTurnPointer,
  resolveDisplayTurnPlayerIndex,
  playerCanActInCurrentTrick,
  cloneGameState: cloneGs,
} = core;

function cloneGameState(gs) {
  return JSON.parse(JSON.stringify(gs));
}

function traceLine(label, gs, room, extra = {}) {
  const idx = gs?.currentPlayerIndex;
  const cur = gs?.players?.[idx];
  const disp = gs ? resolveDisplayTurnPlayerIndex(gs) : null;
  const dispP = gs?.players?.[disp];
  const runCtx =
    gs?.currentTrick &&
    runFromCurrentTrick(
      gs.currentTrick,
      gs.players,
      gs.finishedOrder ?? [],
      gs.pile ?? [],
    );
  console.log(
    JSON.stringify({
      label,
      currentPlayerIndex: idx,
      currentId: cur?.id ?? null,
      currentName: cur?.name ?? null,
      displayIndex: disp,
      displayId: dispP?.id ?? null,
      passed: cur ? hasPassedInCurrentTrick(gs, cur.id) : null,
      canAct: cur ? playerCanActInCurrentTrick(gs, idx) : null,
      isCpu: cur ? /^cpu-\d+$/i.test(cur.id) : null,
      stateVersion: gs?.stateVersion,
      pileLen: gs?.pile?.length,
      runLen: runCtx?.length ?? 0,
      phase: gs?.phase,
      botTimer: !!room?._botTurnTimer,
      ...extra,
    }),
  );
}

function makeBotRoom(humanSeated = true) {
  const room = {
    players: [
      {
        id: "cpu-1",
        name: "Amy",
        isBot: true,
        ready: true,
        isSpectator: false,
        disconnectedAt: null,
      },
      {
        id: "cpu-2",
        name: "Ben",
        isBot: true,
        ready: true,
        isSpectator: false,
        disconnectedAt: null,
      },
      {
        id: HUMAN_ID,
        name: "StallHuman",
        ready: true,
        isSpectator: !humanSeated,
        disconnectedAt: null,
      },
    ],
    isBotHosted: true,
    inGame: true,
    host: "cpu-1",
    gameState: null,
    _botTurnTimer: null,
  };
  return room;
}

/** Run trick with P0 opening run 3-4-5; P0 passes on run; mirror server post-pass pipeline. */
async function headlessPassOnRunScenario() {
  console.log("\n=== HEADLESS: pass during run + bot loop trace ===\n");

  const g = core.createGame([HUMAN_ID, "cpu-1", "cpu-2"]);
  g.players[0].id = HUMAN_ID;
  g.players[1].id = "cpu-1";
  g.players[2].id = "cpu-2";
  g.players[0].name = "StallHuman";
  g.players[1].name = "Amy";
  g.players[2].name = "Ben";

  g.players[0].hand = [
    { suit: "hearts", value: 3 },
    { suit: "hearts", value: 9 },
  ];
  g.players[1].hand = [
    { suit: "hearts", value: 4 },
    { suit: "hearts", value: 10 },
  ];
  g.players[2].hand = [
    { suit: "hearts", value: 5 },
    { suit: "hearts", value: 11 },
  ];
  g.currentPlayerIndex = 0;
  g.currentTrick = { trickNumber: 1, actions: [] };

  let s = playCards(g, HUMAN_ID, [{ suit: "hearts", value: 3 }]);
  s = playCards(s, "cpu-1", [{ suit: "hearts", value: 4 }]);
  s = playCards(s, "cpu-2", [{ suit: "hearts", value: 5 }]);
  const runLen = runFromCurrentTrick(
    s.currentTrick,
    s.players,
    s.finishedOrder ?? [],
    s.pile ?? [],
  ).length;
  if (runLen < 3) {
    throw new Error(`Expected run context, got length ${runLen}`);
  }

  traceLine("after_run_built", s, null);

  const idxBefore = s.currentPlayerIndex;
  const idBefore = s.players[idxBefore].id;
  console.log(`Leader to act: ${idBefore} (index ${idxBefore})`);

  s = passTurn(s, idBefore);
  traceLine("after_passTurn", s, null);

  const room = makeBotRoom(true);
  room.gameState = cloneGameState(s);
  room.stateVersion = 1;

  traceLine("before_advancePastInactiveSeats", room.gameState, room);
  advancePastInactiveSeats(room, cloneGameState);
  room.gameState = repairStuckTurnPointer(room.gameState);
  traceLine("after_server_pass_pipeline", room.gameState, room);

  const inv = botHosted.__investigation;
  if (!inv) {
    throw new Error("botHosted.__investigation exports missing");
  }

  const ctx = makeMinimalBotCtx(room);
  const advanced = inv.advanceUntilBotTurnOrHuman(room, ctx);
  const cpuAct = inv.shouldBotCpuAct(room);
  traceLine("after_advanceUntilBotTurnOrHuman", room.gameState, room, {
    advanceReturned: advanced,
    shouldBotCpuAct: cpuAct,
  });

  let acted = inv.processBotTurnStep(room, ctx);
  traceLine("after_processBotTurnStep", room.gameState, room, {
    processBotTurnStepReturned: acted,
    shouldBotCpuAct: inv.shouldBotCpuAct(room),
  });

  // Desync: passTurn advanced index to CPU, but authoritative index still on passed human
  const desyncRoom = makeBotRoom(true);
  const afterPass = cloneGameState(s);
  const humanIdx = afterPass.players.findIndex((p) => p.id === HUMAN_ID);
  afterPass.currentPlayerIndex = humanIdx;
  desyncRoom.gameState = afterPass;
  const desyncCtx = makeMinimalBotCtx(desyncRoom);
  console.log("\n--- Desync: index on passed human (display may show CPU) ---\n");
  traceLine("desync_state", desyncRoom.gameState, desyncRoom, {
    displayShowsCpu: /^cpu-\d+$/i.test(
      desyncRoom.gameState.players[
        resolveDisplayTurnPlayerIndex(desyncRoom.gameState)
      ]?.id ?? "",
    ),
  });
  // RC-1: repair helper must schedule bot timer (old line 788 path had no schedule)
  let rc1TimerScheduled = false;
  const loopRoom = makeBotRoom(true);
  loopRoom.gameState = cloneGameState(afterPass);
  loopRoom.gameState.currentPlayerIndex = humanIdx;
  const loopCtx = makeMinimalBotCtx(loopRoom);
  const noopStep = () => {};
  const origSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms) => {
    rc1TimerScheduled = true;
    return origSetTimeout(fn, 0);
  };
  inv.repairTurnPointerAndReschedule(loopRoom, loopCtx, noopStep);
  global.setTimeout = origSetTimeout;
  if (!rc1TimerScheduled) {
    throw new Error("RC-1: repairTurnPointerAndReschedule did not schedule bot timer");
  }
  console.log(
    JSON.stringify({
      rc1_timer_scheduled: rc1TimerScheduled,
      after_repair_current:
        loopRoom.gameState.players[loopRoom.gameState.currentPlayerIndex]?.id,
      shouldBotCpuAct: inv.shouldBotCpuAct(loopRoom),
    }),
  );

  const advOnly = inv.advanceUntilBotTurnOrHuman(desyncRoom, desyncCtx);
  traceLine("desync_after_advance_only", desyncRoom.gameState, desyncRoom, {
    advanceReturned: advOnly,
    shouldBotCpuAct: inv.shouldBotCpuAct(desyncRoom),
  });
  const actedD = inv.processBotTurnStep(desyncRoom, desyncCtx);
  const advanceAgainD = inv.advanceUntilBotTurnOrHuman(desyncRoom, desyncCtx);
  const gsD = desyncRoom.gameState;
  const loop788OldStall =
    !actedD &&
    advanceAgainD &&
    !inv.shouldBotCpuAct(desyncRoom) &&
    !desyncCtx.isRoundComplete(gsD);
  console.log(
    JSON.stringify(
      {
        processBotTurnStepReturned: actedD,
        shouldBotCpuAct: inv.shouldBotCpuAct(desyncRoom),
        advanceUntilBotTurnOrHuman_after_no_act: advanceAgainD,
        pre_fix_would_stall_at_788: loop788OldStall,
        currentId: gsD.players[gsD.currentPlayerIndex]?.id,
        displayId:
          gsD.players[resolveDisplayTurnPlayerIndex(gsD)]?.id,
      },
      null,
      2,
    ),
  );

  // Simulate RC-1 repair path (same as runBotTurnLoop after fix)
  if (loop788OldStall) {
    advancePastInactiveSeats(desyncRoom, cloneGameState);
    desyncRoom.gameState = repairStuckTurnPointer(desyncRoom.gameState);
    const afterRepair = inv.shouldBotCpuAct(desyncRoom);
    traceLine("after_rc1_repair_sim", desyncRoom.gameState, desyncRoom, {
      shouldBotCpuAct: afterRepair,
    });
    if (!afterRepair) {
      console.warn(
        "WARN: after repair sim, shouldBotCpuAct still false — live loop will retry via timer",
      );
    }
  }

  // Simulate runBotTurnLoop branch when processBotTurnStep returns false (normal room state)
  const gs = room.gameState;
  const cur = gs.players[gs.currentPlayerIndex];
  const runOnTop =
    gs.runOnTop?.active && gs.runOnTop.playerIndex === gs.currentPlayerIndex;
  const rcHWouldRun =
    cur &&
    hasPassedInCurrentTrick(gs, cur.id) &&
    !runOnTop &&
    !ctx.isRoundComplete(gs);
  const advanceAgain = inv.advanceUntilBotTurnOrHuman(room, ctx);
  const cpuAfterAdvance = inv.shouldBotCpuAct(room);
  const loopWouldSchedule =
    advanceAgain && cpuAfterAdvance && !ctx.isRoundComplete(gs);
  const loopEarlyReturnNoTimer =
    advanceAgain && !cpuAfterAdvance && !ctx.isRoundComplete(gs);
  const rcHReachable = !advanceAgain && rcHWouldRun;

  console.log("\n--- runBotTurnLoop branch prediction (after acted=false) ---");
  console.log(
    JSON.stringify(
      {
        advanceUntilBotTurnOrHuman_returns: advanceAgain,
        shouldBotCpuAct: cpuAfterAdvance,
        loop_schedules_timer_line_785: loopWouldSchedule,
        loop_early_return_NO_timer_line_788: loopEarlyReturnNoTimer,
        rcH_condition_met: rcHWouldRun,
        rcH_reachable_only_if_advance_returns_false: rcHReachable,
      },
      null,
      2,
    ),
  );

  if (loopEarlyReturnNoTimer) {
    console.log(
      "\n*** STALL PREDICTED: advanceUntilBotTurnOrHuman returned true but shouldBotCpuAct is false → runBotTurnLoop returns at line 788 without scheduling; RC-H skipped ***\n",
    );
  }
}

function makeMinimalBotCtx(room) {
  const noop = () => {};
  return {
    rooms: { [BOT_ROOM_CODE]: room },
    roomId: BOT_ROOM_CODE,
    io: { to: () => ({ emit: noop }) },
    cloneGameState,
    advancePastInactiveSeats: (r) => advancePastInactiveSeats(r, cloneGameState),
    broadcastGameState: noop,
    emitTradesCompleteIfReady: noop,
    allTradesComplete: () => true,
    isRoundComplete: (gs) => core.isRoundCompleteForLiving(gs) && !gs.tenRulePending,
    isGamePausedForAway: () => false,
  };
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function livePassOnRunScenario() {
  console.log("\n=== LIVE SOCKET: BOTOPN pass-on-run ===\n");

  const socket = io(SERVER, { transports: ["websocket"], timeout: 10_000 });
  const state = { gs: null, version: 0, seated: false };

  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
  });

  socket.on("gameStateSync", (data) => {
    state.gs = data.gameState;
    state.version = data.gameState?.stateVersion ?? state.version;
  });

  socket.emit("joinRoom", {
    roomId: BOT_ROOM_CODE,
    name: "StallHuman",
    profileId: HUMAN_ID,
    clientBuildId: "dev",
  });
  await new Promise((r) => socket.once("connected", r));
  await wait(800);

  const readyDeadline = Date.now() + 120_000;
  while (Date.now() < readyDeadline) {
    socket.emit("requestGameState", { roomId: BOT_ROOM_CODE });
    await wait(500);
    const me = state.gs?.players?.find((p) => p.id === HUMAN_ID);
    if (me && state.gs.players.some((p) => p.id === HUMAN_ID && !p.hand?.length === undefined)) {
      const seated = state.gs.players.some(
        (p) => p.id === HUMAN_ID && (p.hand?.length ?? 0) > 0,
      );
      if (seated) {
        state.seated = true;
        break;
      }
    }
    socket.emit("playerReadyForNextRound", { roomId: BOT_ROOM_CODE });
    await wait(2000);
  }
  if (!state.seated) {
    throw new Error("Could not get seated at BOTOPN within 120s — ready for promotion");
  }

  console.log("Seated. Waiting for run context + human turn…");
  const playDeadline = Date.now() + 180_000;
  let passed = false;

  while (Date.now() < playDeadline) {
    socket.emit("requestGameState", { roomId: BOT_ROOM_CODE });
    await wait(500);
    const gs = state.gs;
    if (!gs?.players?.length) continue;

    const runLen =
      gs.currentTrick &&
      runFromCurrentTrick(
        gs.currentTrick,
        gs.players,
        gs.finishedOrder ?? [],
        gs.pile ?? [],
      ).length;

    const idx = gs.currentPlayerIndex;
    const cur = gs.players[idx];
    const myTurn = cur?.id === HUMAN_ID;
    const canAct = playerCanActInCurrentTrick(gs, idx);

    if (!passed && runLen >= 3 && myTurn && canAct) {
      console.log("Passing on run…");
      traceLine("before_pass", gs, null);
      socket.emit("gameAction", {
        roomId: BOT_ROOM_CODE,
        action: { type: "pass" },
      });
      passed = true;
      await wait(600);
      traceLine("after_pass", state.gs, null);
      break;
    }
  }

  if (!passed) {
    throw new Error("Never got human turn to pass on a run within 180s");
  }

  console.log("\nWatching for CPU stall…\n");
  let lastV = state.version;
  let lastChange = Date.now();
  const watchUntil = Date.now() + 45_000;

  while (Date.now() < watchUntil) {
    socket.emit("requestGameState", { roomId: BOT_ROOM_CODE });
    await wait(POLL_MS);
    const gs = state.gs;
    if (!gs) continue;

    const v = gs.stateVersion ?? 0;
    if (v !== lastV) {
      lastV = v;
      lastChange = Date.now();
    }

    const idx = gs.currentPlayerIndex;
    const cur = gs.players[idx];
    const disp = resolveDisplayTurnPlayerIndex(gs);
    const dispId = gs.players[disp]?.id;
    const cpuToAct = /^cpu-\d+$/i.test(dispId ?? "") || /^cpu-\d+$/i.test(cur?.id ?? "");
    const stalled = cpuToAct && Date.now() - lastChange > STALL_MS;

    if (stalled || Date.now() - lastChange > 5000) {
      traceLine(stalled ? "STALL_DETECTED" : "tick", gs, null, {
        msSinceStateVersion: Date.now() - lastChange,
        cpuToAct,
      });
    }

    if (stalled) {
      console.error(`\nFAIL: CPU stall — no stateVersion change for ${STALL_MS}ms while CPU should act`);
      socket.disconnect();
      process.exit(1);
    }
  }

  console.log("\nPASS: state kept advancing (no CPU stall in 45s watch window)");
  socket.disconnect();
}

async function main() {
  const headless = process.argv.includes("--headless");
  await headlessPassOnRunScenario();
  if (!headless) {
    try {
      await livePassOnRunScenario();
    } catch (e) {
      console.warn("Live scenario skipped or failed:", e.message);
      console.warn("Use --headless for deterministic branch trace without server.");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
