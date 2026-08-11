/**
 * Regression: between rounds, if all Ready votes latch while a seat is away
 * (start blocked by pause), reclaiming that seat must call
 * tryStartNextRoundIfReady so the table is not soft-locked.
 *
 *   PORT=4000 npm run server
 *   node scripts/test-ready-reconnect-next-round.mjs
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
const ROOM =
  "RR" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 6);
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
      reconnectSecret: null,
      gameState: null,
      readyUpdate: null,
      nextRoundCount: 0,
      errors: [],
    };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", (err) => reject(err));
    socket.on("error", (data) => {
      state.errors.push(data?.message ?? String(data));
    });
    socket.on("connected", (data) => {
      state.id = data.id;
      state.reconnectSecret = data.reconnectSecret ?? null;
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
    });
    socket.on("playerReadyUpdate", (data) => {
      state.readyUpdate = data?.readyForNextRound ?? null;
    });
    socket.on("nextRoundStarting", () => {
      state.nextRoundCount += 1;
    });
  });
}

async function joinPlayer(name, profileId, reconnectSecret) {
  const client = await connectClient(name, profileId);
  client.socket.emit("joinRoom", {
    roomId: ROOM,
    name,
    profileId,
    clientBuildId: "dev",
    ...(reconnectSecret ? { reconnectSecret } : {}),
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
      winnerId = Object.keys(roles).find(
        (id) => roles[id] === "vice_president",
      );
    }
    if (!winnerId) continue;

    const winnerClient = clientForPlayer(clients, winnerId);
    if (!winnerClient) continue;

    winnerClient.socket.emit("requestGameState", { roomId: ROOM });
    await wait(150);
    const hand =
      winnerClient.state.gameState?.players.find((p) => p.id === winnerId)
        ?.hand ?? [];
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
    return { type: "tenRule", direction: "higher" };
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
  for (let step = 0; step < MAX_TURN_STEPS; step++) {
    await resolvePendingTrades(clients, host);
    await requestAllStates(clients);
    const gs = host.state.gameState;
    if (!gs) throw new Error("no game state");
    if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) return;

    const current = gs.players[gs.currentPlayerIndex];
    if (!current) throw new Error("no current player");
    const actor = clientForPlayer(clients, current.id);
    if (!actor) throw new Error(`no client for ${current.id}`);

    // Plan from the actor's own sync — only that client has real hand faces.
    const actorGs = actor.state.gameState || gs;
    const action = planAction(actorGs, current.id);
    if (!action) {
      actor.socket.emit("gameAction", {
        roomId: ROOM,
        action: { type: "pass" },
      });
      await wait(120);
      continue;
    }
    await emitAction(actor, action);
  }
  throw new Error("exceeded turn steps");
}

async function main() {
  console.log(`Ready-reconnect next-round → ${SERVER} room ${ROOM}`);
  const host = await connectClient("Host", "profile-rr-host");
  host.socket.emit("createRoom", {
    roomId: ROOM,
    name: "Host",
    profileId: "profile-rr-host",
    isPublic: false,
  });
  await once(host.socket, "connected");

  const guest = await joinPlayer("Guest", "profile-rr-guest");
  const third = await joinPlayer("Third", "profile-rr-third");
  const clients = [host, guest, third];

  for (const c of [guest, third]) {
    c.socket.emit("toggleReady", { roomId: ROOM, ready: true });
  }
  await wait(200);
  host.socket.emit("startGame", { roomId: ROOM });
  await Promise.all(clients.map((c) => once(c.socket, "startGame", 15000)));
  await wait(400);

  await playToRoundComplete(clients, host);
  console.log("  round complete");

  host.socket.emit("playerReadyForNextRound", { roomId: ROOM });
  await wait(200);
  const hostSecret = host.state.reconnectSecret;
  if (!hostSecret) throw new Error("missing host reconnectSecret");
  if (!host.state.readyUpdate?.[host.state.id]) {
    throw new Error("host ready not latched before disconnect");
  }

  const nextBefore = host.state.nextRoundCount;
  host.socket.disconnect();
  await wait(500);

  guest.socket.emit("playerReadyForNextRound", { roomId: ROOM });
  third.socket.emit("playerReadyForNextRound", { roomId: ROOM });
  await wait(600);

  if (guest.state.nextRoundCount !== nextBefore) {
    throw new Error("next round started while host was away (unexpected)");
  }
  const readyMap = guest.state.readyUpdate || {};
  const allReady = [host.state.id, guest.state.id, third.state.id].every(
    (id) => readyMap[id] === true,
  );
  if (!allReady) {
    throw new Error(
      `expected all ready during pause, got ${JSON.stringify(readyMap)}`,
    );
  }
  console.log("  all ready latched during pause; next round blocked");

  const rejoin = await joinPlayer("Host", "profile-rr-host", hostSecret);
  await wait(1000);

  const started =
    rejoin.state.nextRoundCount > 0 || guest.state.nextRoundCount > nextBefore;
  if (!started) {
    throw new Error(
      "soft-lock: reconnect with all ready did not start next round",
    );
  }

  console.log("PASS: next round started after reclaim with all Ready");
  for (const c of [...clients, rejoin]) {
    try {
      c.socket.disconnect();
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL", err?.message || err);
  process.exit(1);
});
