/**
 * Minimum private-room gate: 2 humans, mid-turn reconnect, round complete, next round.
 *
 *   npm run server
 *   node scripts/release-gate/private-room-reconnect-gate.mjs
 */
import { io } from "socket.io-client";
import { createRequire } from "module";
import { assertCurrentPlayerMayAct } from "./lib/turnOwnership.mjs";

const require = createRequire(import.meta.url);
const {
  applyCpuTurn,
  findCPUPlay,
  isRoundCompleteForLiving,
  pickLowestCards,
  playCards,
  passTurn,
} = require("../../server/gameBridge.js");

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const ROOM = "RG" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 5);
const MAX_TURN_STEPS = 700;
const MID_TURN_STEPS = Number(process.env.MID_TURN_STEPS ?? 12);

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function once(socket, event, timeoutMs = 20000) {
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
      nextRound: false,
    };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", reject);
    socket.on("connected", (data) => {
      state.id = data.profileId ?? data.id;
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
    });
    socket.on("startGame", (data) => {
      state.dealSeed = data.dealSeed ?? null;
    });
    socket.on("roundEnded", (data) => {
      state.roundEnded = data;
    });
    socket.on("nextRoundStarting", () => {
      state.nextRound = true;
    });
  });
}

async function joinRoom(client, roomId) {
  client.socket.emit("joinRoom", {
    roomId,
    name: client.name,
    profileId: client.profileId,
    clientBuildId: "release-gate",
  });
  await once(client.socket, "connected");
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

async function requestAllStates(clients, roomId) {
  for (const c of clients) {
    c.socket.emit("requestGameState", { roomId });
  }
  await wait(200);
}

async function resolvePendingTrades(clients, host, roomId) {
  await requestAllStates(clients, roomId);
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

    const hand =
      winnerClient.state.gameState?.players.find((p) => p.id === winnerId)?.hand ??
      [];
    const need = trade.count || 1;
    const selected = pickLowestCards(hand, need);
    winnerClient.socket.emit("playerTradeSelection", {
      roomId,
      selectedCardObjects: selected,
    });
    await wait(350);
    await requestAllStates(clients, roomId);
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
    if (afterPlay !== before) return { type: "play", cards };
  }

  const afterPass = passTurn(before, playerId);
  if (afterPass !== before) return { type: "pass" };

  const afterCpu = applyCpuTurn(before, playerId);
  const playerAfter = afterCpu.players.find((p) => p.id === playerId);
  const played = handBefore.filter(
    (c) =>
      !playerAfter.hand.some((h) => h.suit === c.suit && h.value === c.value),
  );
  if (played.length) return { type: "play", cards: played };
  if (afterCpu.currentPlayerIndex !== before.currentPlayerIndex) {
    return { type: "pass" };
  }

  return null;
}

async function emitAction(client, roomId, action) {
  if (action.type === "play") {
    client.socket.emit("gameAction", {
      roomId,
      action: { type: "play", cards: action.cards },
    });
  } else if (action.type === "pass") {
    client.socket.emit("gameAction", {
      roomId,
      action: { type: "pass" },
    });
  } else if (action.type === "tenRule") {
    client.socket.emit("gameAction", {
      roomId,
      action: { type: "tenRule", direction: action.direction },
    });
  }
  await wait(120);
}

async function playSteps({
  clients,
  host,
  roomId,
  maxSteps,
  label,
  onStep,
}) {
  let steps = 0;
  while (steps++ < maxSteps) {
    await requestAllStates(clients, roomId);
    const gs = host.state.gameState;
    if (!gs?.players?.length) {
      throw new Error(`${label}: missing game state`);
    }

    if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) {
      return { completed: true, steps };
    }

    assertCurrentPlayerMayAct(gs, label);

    if (!allTradesComplete(gs)) {
      await resolvePendingTrades(clients, host, roomId);
      continue;
    }

    const current = gs.players[gs.currentPlayerIndex];
    const actor = clientForPlayer(clients, current.id);
    if (!actor) {
      throw new Error(`${label}: no client for current player ${current.id}`);
    }

    const action = planAction(actor.state.gameState, current.id);
    if (!action) {
      throw new Error(`${label}: ${current.name} stuck — no play or pass`);
    }

    await emitAction(actor, roomId, action);
    if (onStep) await onStep(steps, clients, host);
  }

  return { completed: false, steps };
}

async function main() {
  console.log(`Private room reconnect gate → ${SERVER} room ${ROOM}`);

  const prefix = `rg${Date.now()}`;
  const hostProfile = `${prefix}-host`;
  const guestProfile = `${prefix}-guest`;

  const host = await connectClient("Host", hostProfile);
  host.socket.emit("createRoom", {
    roomId: ROOM,
    name: "Host",
    profileId: hostProfile,
    isPublic: false,
  });
  await once(host.socket, "connected");

  const guest = await connectClient("Guest", guestProfile);
  await joinRoom(guest, ROOM);

  guest.socket.emit("toggleReady", { roomId: ROOM, ready: true });
  await wait(200);
  host.socket.emit("startGame", { roomId: ROOM });
  await Promise.all([
    once(host.socket, "startGame", 15000),
    once(guest.socket, "startGame", 15000),
  ]);
  await wait(400);

  const clients = [host, guest];
  await requestAllStates(clients, ROOM);
  await resolvePendingTrades(clients, host, ROOM);

  const seeds = new Set(clients.map((c) => c.state.dealSeed));
  if (seeds.size !== 1) {
    throw new Error("dealSeed mismatch after start");
  }

  let guestDisconnected = false;

  const mid = await playSteps({
    clients,
    host,
    roomId: ROOM,
    maxSteps: MID_TURN_STEPS,
    label: "private-reconnect mid-turn",
    onStep: async (step) => {
      if (!guestDisconnected && step >= Math.floor(MID_TURN_STEPS * 0.6)) {
        guest.socket.disconnect();
        guestDisconnected = true;
        await wait(600);
        const reconnected = await connectClient("Guest", guestProfile);
        await joinRoom(reconnected, ROOM);
        clients[1] = reconnected;
        guest.socket = reconnected.socket;
        guest.state = reconnected.state;
        await wait(400);
      }
    },
  });

  if (!guestDisconnected) {
    guest.socket.disconnect();
    await wait(500);
    const reconnected = await connectClient("Guest", guestProfile);
    await joinRoom(reconnected, ROOM);
    clients[1] = reconnected;
    guest.socket = reconnected.socket;
    guest.state = reconnected.state;
  }

  if (mid.completed) {
    throw new Error("Round completed before reconnect test could run mid-turn");
  }

  const rest = await playSteps({
    clients,
    host,
    roomId: ROOM,
    maxSteps: MAX_TURN_STEPS,
    label: "private-reconnect finish round",
  });

  if (!rest.completed) {
    throw new Error(`Round did not complete within ${MAX_TURN_STEPS} steps`);
  }

  if (!host.state.roundEnded) {
    await once(host.socket, "roundEnded", 10000).catch(() => null);
  }
  if (!host.state.roundEnded) {
    throw new Error("roundEnded not received");
  }

  const finishOrder =
    host.state.roundEnded?.finishOrder ??
    host.state.gameState?.finishedOrder ??
    [];
  if (finishOrder.length < 2) {
    throw new Error(`rankings finishOrder too short: ${finishOrder.length}`);
  }

  for (const c of clients) {
    c.socket.emit("playerReadyForNextRound", { roomId: ROOM });
  }

  await Promise.race([
    once(host.socket, "nextRoundStarting", 25000),
    once(guest.socket, "nextRoundStarting", 25000),
  ]);

  await wait(500);
  await requestAllStates(clients, ROOM);
  const gs = host.state.gameState;
  if (isRoundCompleteForLiving(gs) && !gs?.tenRulePending) {
    throw new Error("still round-complete after nextRoundStarting");
  }
  if (!(gs?.players?.length > 0)) {
    throw new Error("no players after next round start");
  }

  for (const c of clients) c.socket.disconnect();
  console.log("PASS private room reconnect gate");
}

main().catch((err) => {
  console.error("FAIL private room reconnect gate:", err.message ?? err);
  process.exit(1);
});
