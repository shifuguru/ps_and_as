/**
 * Verifies seated reconnect replay during ROUND_COMPLETE (private room).
 * Uses the same play loop as test-multiplayer-rounds.mjs but does NOT ready-up
 * (so the table stays between rounds).
 *
 *   node server/index.js
 *   node scripts/test-reconnect-round-complete.mjs
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
const ROOM = "RC" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 6);
const MAX_TURN_STEPS = 600;

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

function connectClient(name, profileId) {
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
    });
    socket.on("startGame", (data) => {
      state.dealSeed = data.dealSeed ?? null;
    });
    socket.on("roundEnded", (data) => {
      state.roundEnded = data;
    });
  });
}

async function joinPlayer(name, profileId) {
  const client = await connectClient(name, profileId);
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

/** Play until round complete — does NOT ready-up for next round. */
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
  if (!host.state.roundEnded) {
    await once(host.socket, "roundEnded", 8000).catch(() => null);
  }
}

async function main() {
  console.log(`Reconnect round-complete tests → ${SERVER} room ${ROOM}`);

  const host = await connectClient("Host", "profile-rc-replay-host");
  host.socket.emit("createRoom", {
    roomId: ROOM,
    name: "Host",
    profileId: "profile-rc-replay-host",
    isPublic: false,
  });
  await once(host.socket, "connected");

  const guest = await joinPlayer("Guest", "profile-rc-replay-guest");
  const third = await joinPlayer("Third", "profile-rc-replay-third");
  const clients = [host, guest, third];

  for (const c of [guest, third]) {
    c.socket.emit("toggleReady", { roomId: ROOM, ready: true });
  }
  await wait(200);

  host.socket.emit("startGame", { roomId: ROOM });
  await Promise.all(clients.map((c) => once(c.socket, "startGame", 15000)));
  await wait(500);

  await playToRoundComplete(clients, host);

  const guestClient = clients[1];
  guestClient.state.roundEnded = null;
  guestClient.socket.emit("requestGameState", { roomId: ROOM });
  await wait(400);

  if (guestClient.state.phase !== "ROUND_COMPLETE") {
    throw new Error(
      `requestGameState replay: expected ROUND_COMPLETE, got ${guestClient.state.phase}`,
    );
  }
  if (!guestClient.state.roundEnded) {
    throw new Error(
      "requestGameState replay: seated client did not receive roundEnded",
    );
  }
  console.log("  PASS Test 3b — seated requestGameState replay receives roundEnded");

  guestClient.state.roundEnded = null;
  guestClient.socket.disconnect();
  await wait(300);

  const rejoin = await connectClient("Guest", "profile-rc-replay-guest");
  rejoin.socket.emit("joinRoom", {
    roomId: ROOM,
    name: "Guest",
    profileId: "profile-rc-replay-guest",
    clientBuildId: "dev",
  });
  await once(rejoin.socket, "connected");
  await wait(400);

  if (rejoin.state.phase !== "ROUND_COMPLETE") {
    throw new Error(
      `joinRoom replay: expected ROUND_COMPLETE, got ${rejoin.state.phase}`,
    );
  }
  if (!rejoin.state.roundEnded) {
    throw new Error("joinRoom replay: seated reconnect did not receive roundEnded");
  }
  console.log("  PASS Test 3a — seated joinRoom replay receives roundEnded");

  for (const c of clients) c.socket.disconnect();
  rejoin.socket.disconnect();
  console.log("All reconnect replay checks passed.");
}

main().catch((err) => {
  console.error("FAIL", err.message ?? err);
  process.exit(1);
});
