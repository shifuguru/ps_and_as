/**
 * Connected round-end overlay order (Rankings gap — Test 1).
 *
 * Simulates GameScreen overlay FSM on a connected client while a 3-player
 * private room plays to round complete. Asserts:
 *   - roundOver stays false until roundEnded (Fix #1 — not from gameStateSync)
 *   - rankings never visible before lastHandReveal when lastPlayerHand present
 *
 *   node server/index.js
 *   node scripts/test-connected-round-end-order.mjs
 *
 * Test 2 (BOTOPN) is not run here — blocked on bot-table lifecycle stall (RC2).
 */
import { io } from "socket.io-client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  applyCpuTurn,
  isRoundCompleteForLiving,
  findCPUPlay,
  pickLowestCards,
  playCards,
  passTurn,
} = require("../server/gameBridge.js");

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const ROOM = "CO" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 6);
const MAX_TURN_STEPS = 600;
const ROUND_ENDED_TIMEOUT_MS = 8000;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function once(socket, event, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Timeout waiting for ${event}`)),
      timeoutMs,
    );
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

/**
 * Mirrors online GameScreen overlay gating (no React):
 *   roundOver — only set true on roundEnded (Fix #1)
 *   lastHandReveal — set from roundEnded.lastPlayerHand when cards present
 *   rankingsVisible — roundOver && !lastHandReveal && !ceremonyPrep && !tradePhase
 */
function createOverlayFsm() {
  const state = {
    roundOver: false,
    lastHandReveal: null,
    ceremonyPrep: null,
    tradePhase: null,
    roundEndedReceived: false,
    firstRoundCompleteSyncAt: null,
    roundEndedAt: null,
    violations: [],
    timeline: [],
  };

  const stamp = (event, detail = {}) => {
    state.timeline.push({ t: Date.now(), event, ...detail });
  };

  const rankingsVisible = () =>
    state.roundOver &&
    !state.lastHandReveal &&
    !state.ceremonyPrep &&
    !state.tradePhase;

  const checkRankingsInvariant = (context) => {
    if (rankingsVisible()) {
      state.violations.push(
        `rankings visible at ${context} (roundOver=${state.roundOver}, lastHandReveal=${state.lastHandReveal ? "set" : "null"})`,
      );
    }
  };

  return {
    state,
    onGameStateSync(data) {
      const gs = data?.gameState;
      if (!gs) return;

      const betweenRounds =
        isRoundCompleteForLiving(gs) && !gs.tenRulePending;
      const phaseRoundComplete = gs.phase === "ROUND_COMPLETE";

      if (betweenRounds || phaseRoundComplete) {
        if (state.firstRoundCompleteSyncAt == null) {
          state.firstRoundCompleteSyncAt = Date.now();
          stamp("gameStateSync_ROUND_COMPLETE", {
            stateVersion: gs.stateVersion ?? null,
          });
        }
        // Fix #1: online gameStateSync must not set roundOver.
        if (state.roundOver && !state.roundEndedReceived) {
          state.violations.push(
            "roundOver true before roundEnded after gameStateSync round complete",
          );
        }
        checkRankingsInvariant("gameStateSync while round complete, pre-roundEnded");
      }
    },

    onRoundEnded(data) {
      stamp("roundEnded", {
        lastHandCards: data?.lastPlayerHand?.cards?.length ?? 0,
        finishOrderLen: data?.finishOrder?.length ?? 0,
      });
      state.roundEndedReceived = true;
      state.roundEndedAt = Date.now();

      const lph = data?.lastPlayerHand;
      if (lph?.playerId && lph.cards?.length) {
        state.lastHandReveal = {
          playerId: lph.playerId,
          playerName: lph.playerName || "Player",
          cards: lph.cards,
        };
      } else {
        state.lastHandReveal = null;
      }

      // Same handler order as GameScreen: lastHandReveal first, then roundOver.
      state.roundOver = true;
      stamp("setRoundOver_true", { source: "roundEnded" });

      if (lph?.cards?.length) {
        checkRankingsInvariant("roundEnded with lastPlayerHand");
      }
    },

    rankingsVisible,
    checkRankingsInvariant,
  };
}

function connectClient(name, profileId, overlayFsm = null) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER, { transports: ["websocket"], timeout: 8000 });
    const state = {
      id: null,
      gameState: null,
      dealSeed: null,
      roundEnded: null,
      phase: null,
    };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", (err) => reject(err));
    socket.on("connected", (data) => {
      state.id = data.profileId ?? data.id;
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
      state.phase = data.gameState?.phase ?? null;
      overlayFsm?.onGameStateSync(data);
    });
    socket.on("startGame", (data) => {
      state.dealSeed = data.dealSeed ?? null;
    });
    socket.on("roundEnded", (data) => {
      state.roundEnded = data;
      overlayFsm?.onRoundEnded(data);
    });
  });
}

async function joinPlayer(name, profileId, overlayFsm = null) {
  const client = await connectClient(name, profileId, overlayFsm);
  client.socket.emit("joinRoom", {
    roomId: ROOM,
    name,
    profileId,
    clientBuildId: "dev",
  });
  await once(client.socket, "connected");
  return client;
}

function cloneState(gs) {
  return JSON.parse(JSON.stringify(gs));
}

function clientForPlayer(clients, playerId) {
  return clients.find((c) => c.state.id === playerId) ?? null;
}

function allTradesComplete(gs) {
  const pending = gs?.pendingTrades || {};
  const keys = Object.keys(pending);
  if (keys.length === 0) return true;
  return keys.every((k) => !!pending[k]?.selected);
}

async function requestAllStates(clients) {
  for (const c of clients) {
    c.socket.emit("requestGameState", { roomId: ROOM });
  }
  await wait(250);
}

async function resolvePendingTrades(clients, host) {
  await requestAllStates(clients);
  const gs = host.state.gameState;
  if (!gs || allTradesComplete(gs)) return;

  const pending = gs.pendingTrades || {};
  const roles = gs.roles || {};

  for (const key of Object.keys(pending)) {
    const trade = pending[key];
    if (trade?.selected) continue;

    let winnerId = null;
    if (key === "president") {
      winnerId = Object.keys(roles).find((id) => roles[id] === "president");
    } else if (key === "vicePresident") {
      winnerId = Object.keys(roles).find((id) => roles[id] === "vice_president");
    }
    if (!winnerId) continue;

    const winnerClient = clientForPlayer(clients, winnerId);
    if (!winnerClient) continue;

    winnerClient.socket.emit("requestGameState", { roomId: ROOM });
    await wait(150);
    const hand =
      winnerClient.state.gameState?.players.find((p) => p.id === winnerId)?.hand ??
      [];
    const need = trade.count || 1;
    const selected = pickLowestCards(hand, need);
    winnerClient.socket.emit("playerTradeSelection", {
      roomId: ROOM,
      selectedCardObjects: selected,
    });
    await wait(400);
    await requestAllStates(clients);
  }
}

function planAction(gs, playerId) {
  if (gs.tenRulePending) {
    const chooser = gs.players[gs.currentPlayerIndex];
    if (chooser?.id === playerId) {
      return { type: "tenRule", direction: "higher" };
    }
    return null;
  }

  const before = cloneState(gs);
  const idx = before.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return null;
  const player = before.players[idx];
  const handBefore = [...player.hand];
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
    if (afterPlay !== before) {
      return { type: "play", cards };
    }
  }

  const afterPass = passTurn(before, playerId);
  if (afterPass !== before) {
    return { type: "pass" };
  }

  const afterCpu = applyCpuTurn(before, playerId);
  const playerAfter = afterCpu.players.find((p) => p.id === playerId);
  const played = handBefore.filter(
    (c) =>
      !playerAfter.hand.some((h) => h.suit === c.suit && h.value === c.value),
  );
  if (played.length) {
    return { type: "play", cards: played };
  }
  if (afterCpu.currentPlayerIndex !== before.currentPlayerIndex) {
    return { type: "pass" };
  }

  return null;
}

async function emitAction(client, action) {
  if (action.type === "play") {
    client.socket.emit("gameAction", {
      roomId: ROOM,
      action: { type: "play", cards: action.cards },
    });
  } else if (action.type === "pass") {
    client.socket.emit("gameAction", {
      roomId: ROOM,
      action: { type: "pass" },
    });
  } else if (action.type === "tenRule") {
    client.socket.emit("gameAction", {
      roomId: ROOM,
      action: { type: "tenRule", direction: action.direction },
    });
  }
  await wait(120);
}

async function playToRoundComplete(clients, host) {
  await requestAllStates(clients);
  await resolvePendingTrades(clients, host);

  let steps = 0;
  while (steps++ < MAX_TURN_STEPS) {
    await requestAllStates(clients);
    const gs = host.state.gameState;
    if (!gs?.players?.length) {
      throw new Error("missing game state");
    }

    if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) {
      break;
    }

    if (!allTradesComplete(gs)) {
      await resolvePendingTrades(clients, host);
      continue;
    }

    const current = gs.players[gs.currentPlayerIndex];
    if (!current) throw new Error("no current player");

    const actor = clientForPlayer(clients, current.id);
    if (!actor) throw new Error(`no client for ${current.name}`);

    actor.socket.emit("requestGameState", { roomId: ROOM });
    await wait(120);
    const actorState = actor.state.gameState;
    if (!actorState) throw new Error(`${actor.name} missing game state`);

    const action = planAction(actorState, current.id);
    if (!action) {
      throw new Error(`${current.name} stuck — no valid play or pass`);
    }

    await emitAction(actor, action);
  }

  if (steps >= MAX_TURN_STEPS) {
    throw new Error(`exceeded ${MAX_TURN_STEPS} turn steps`);
  }

  await wait(300);
}

function assertTest1(overlayFsm, observer) {
  const { state } = overlayFsm;
  const errors = [...state.violations];

  if (!state.roundEndedReceived && !observer.state.roundEnded) {
    errors.push("roundEnded never received on connected observer");
  }

  if (state.firstRoundCompleteSyncAt != null && !state.roundEndedReceived) {
    errors.push(
      "gameStateSync ROUND_COMPLETE seen but roundEnded not received before timeout",
    );
  }

  if (state.roundOver && !state.roundEndedReceived) {
    errors.push("roundOver true without roundEnded");
  }

  if (!state.roundOver && state.roundEndedReceived) {
    errors.push("roundEnded received but roundOver still false in FSM");
  }

  const endedEvent = state.timeline.find((e) => e.event === "roundEnded");
  const lastHandCards = endedEvent?.lastHandCards ?? 0;

  if (lastHandCards > 0) {
    if (!state.lastHandReveal) {
      errors.push("lastPlayerHand present but lastHandReveal not set in FSM");
    }
    if (overlayFsm.rankingsVisible()) {
      errors.push(
        "rankings visible after roundEnded despite lastPlayerHand (lastHandReveal should block)",
      );
    }

    const syncIdx = state.timeline.findIndex(
      (e) => e.event === "gameStateSync_ROUND_COMPLETE",
    );
    const endedIdx = state.timeline.findIndex((e) => e.event === "roundEnded");
    if (syncIdx >= 0 && endedIdx >= 0 && endedIdx < syncIdx) {
      errors.push("roundEnded arrived before gameStateSync ROUND_COMPLETE");
    }
  }

  const syncIdx = state.timeline.findIndex(
    (e) => e.event === "gameStateSync_ROUND_COMPLETE",
  );
  const endedIdx = state.timeline.findIndex((e) => e.event === "roundEnded");
  if (syncIdx >= 0 && endedIdx < 0) {
    errors.push("stuck table: ROUND_COMPLETE sync without roundEnded");
  }

  return errors;
}

async function runTest1() {
  const overlayFsm = createOverlayFsm();

  const host = await connectClient("Host", "profile-co-order-host");
  host.socket.emit("createRoom", {
    roomId: ROOM,
    name: "Host",
    profileId: "profile-co-order-host",
    isPublic: false,
  });
  await once(host.socket, "connected");

  const guest = await joinPlayer("Guest", "profile-co-order-guest", overlayFsm);
  const third = await joinPlayer("Third", "profile-co-order-third");
  const clients = [host, guest, third];

  for (const c of [guest, third]) {
    c.socket.emit("toggleReady", { roomId: ROOM, ready: true });
  }
  await wait(200);

  host.socket.emit("startGame", { roomId: ROOM });
  await Promise.all(clients.map((c) => once(c.socket, "startGame", 15000)));
  await wait(500);

  await playToRoundComplete(clients, host);

  if (!guest.state.roundEnded) {
    await once(guest.socket, "roundEnded", ROUND_ENDED_TIMEOUT_MS).catch(() => null);
  }
  await wait(200);

  const errors = assertTest1(overlayFsm, guest);
  if (errors.length) {
    console.error("  FAIL Test 1 — connected round-end overlay order");
    for (const e of errors) console.error(`    • ${e}`);
    console.error("  timeline:", JSON.stringify(overlayFsm.state.timeline));
    for (const c of clients) c.socket.disconnect();
    return false;
  }

  const ended = overlayFsm.state.timeline.find((e) => e.event === "roundEnded");
  console.log("  PASS Test 1 — connected round-end overlay order");
  console.log(
    `    roundOver gated on roundEnded; lastHand=${ended?.lastHandCards ?? 0} cards; rankings never early`,
  );

  for (const c of clients) c.socket.disconnect();
  return true;
}

async function main() {
  console.log(`Connected round-end order tests → ${SERVER} room ${ROOM}`);

  const test1Ok = await runTest1();
  if (!test1Ok) {
    console.error("\nFAIL connected round-end order");
    process.exit(1);
  }

  console.log("\nAll connected round-end order checks passed.");
}

main().catch((err) => {
  console.error("FAIL", err.message ?? err);
  process.exit(1);
});
