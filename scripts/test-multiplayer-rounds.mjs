/**
 * Multiplayer integration test — play 5 full rounds (3 human clients).
 *   npm run server
 *   node scripts/test-multiplayer-rounds.mjs
 */
import { io } from "socket.io-client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  applyCpuTurn,
  findCPUPlay,
  isRoundCompleteForLiving,
  pickLowestCards,
  setTenRuleDirection,
  playCards,
  passTurn,
} = require("../server/gameBridge.js");

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const ROOM = "R" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 6);
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const MAX_TURN_STEPS = 600;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cloneState(gs) {
  return JSON.parse(JSON.stringify(gs));
}

function once(socket, event, timeoutMs = 15000) {
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
      errors: [],
      roundEnded: null,
    };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", (err) => reject(err));
    socket.on("error", (data) => state.errors.push(data?.message ?? String(data)));
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
    socket.on("nextRoundStarting", (data) => {
      state.nextRound = data;
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
    if (selected.length !== need) {
      throw new Error(
        `${winnerClient.name} could not pick ${need} trade return cards`,
      );
    }

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

async function playRound(clients, host, roundNum) {
  console.log(`\n--- Round ${roundNum} ---`);
  host.state.roundEnded = null;
  for (const c of clients) c.state.nextRound = null;

  await requestAllStates(clients);
  await resolvePendingTrades(clients, host);

  let steps = 0;
  while (steps++ < MAX_TURN_STEPS) {
    await requestAllStates(clients);
    const gs = host.state.gameState;
    if (!gs?.players?.length) {
      throw new Error(`Round ${roundNum}: missing game state`);
    }

    if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) {
      break;
    }

    if (!allTradesComplete(gs)) {
      await resolvePendingTrades(clients, host);
      continue;
    }

    const current = gs.players[gs.currentPlayerIndex];
    if (!current) throw new Error(`Round ${roundNum}: no current player`);

    const actor = clientForPlayer(clients, current.id);
    if (!actor) {
      throw new Error(`Round ${roundNum}: no client for ${current.name}`);
    }

    actor.socket.emit("requestGameState", { roomId: ROOM });
    await wait(120);
    const actorState = actor.state.gameState;
    if (!actorState) {
      throw new Error(`Round ${roundNum}: ${actor.name} missing game state`);
    }

    const action = planAction(actorState, current.id);
    if (!action) {
      throw new Error(
        `Round ${roundNum}: ${current.name} stuck — no valid play or pass`,
      );
    }

    await emitAction(actor, action);

    if (actor.state.errors.length) {
      const err = actor.state.errors.pop();
      throw new Error(`Round ${roundNum} ${actor.name}: ${err}`);
    }
  }

  if (steps >= MAX_TURN_STEPS) {
    throw new Error(`Round ${roundNum}: exceeded ${MAX_TURN_STEPS} turn steps`);
  }

  await wait(300);
  if (!host.state.roundEnded) {
    await once(host.socket, "roundEnded", 8000).catch(() => null);
  }

  const finishOrder =
    host.state.roundEnded?.finishOrder ?? host.state.gameState?.finishedOrder ?? [];
  console.log(
    `  Round ${roundNum} complete — finish order: ${finishOrder
      .map((id) => clients.find((c) => c.state.id === id)?.name ?? id)
      .join(" → ")}`,
  );

  for (const c of clients) {
    c.socket.emit("playerReadyForNextRound", { roomId: ROOM });
  }

  if (roundNum < ROUNDS) {
    await Promise.race(
      clients.map((c) =>
        once(c.socket, "nextRoundStarting", 20000).catch(() => null),
      ),
    );
    await wait(400);
    await requestAllStates(clients);
  }
}

async function main() {
  console.log(`Connecting to ${SERVER}, room ${ROOM}, ${ROUNDS} rounds`);

  const host = await connectClient("Host", "profile-host-r5");
  host.socket.emit("createRoom", {
    roomId: ROOM,
    name: "Host",
    profileId: "profile-host-r5",
    isPublic: false,
  });
  await once(host.socket, "connected");

  const guest = await joinPlayer("Guest", "profile-guest-r5");
  const third = await joinPlayer("Third", "profile-third-r5");
  const clients = [host, guest, third];

  for (const c of [guest, third]) {
    c.socket.emit("toggleReady", { roomId: ROOM, ready: true });
  }
  await wait(200);

  host.socket.emit("startGame", { roomId: ROOM });
  await Promise.all(clients.map((c) => once(c.socket, "startGame", 15000)));
  await wait(500);
  await requestAllStates(clients);

  const seeds = new Set(clients.map((c) => c.state.dealSeed));
  if (seeds.size !== 1) {
    throw new Error("dealSeed mismatch between clients");
  }
  console.log(`Game started — dealSeed=${host.state.dealSeed}`);

  for (let round = 1; round <= ROUNDS; round++) {
    await playRound(clients, host, round);
  }

  console.log(`\nPASS multiplayer ${ROUNDS}-round test (${clients.length} players)`);
  for (const c of clients) c.socket.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL", err.message ?? err);
  process.exit(1);
});
