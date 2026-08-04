/**
 * Regression: after ROUND_COMPLETE, gameAction play/pass must not re-run
 * handleRoundFinished and wipe Ready votes.
 *
 *   npm run server
 *   node scripts/test-post-round-game-action.mjs
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
  "PR" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 6);
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
      roundEnded: null,
      roundEndedCount: 0,
      readyUpdate: null,
      errors: [],
    };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", (err) => reject(err));
    socket.on("error", (data) => {
      state.errors.push(data?.message ?? String(data));
    });
    socket.on("connected", (data) => {
      state.id = data.profileId ?? data.id;
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
    });
    socket.on("roundEnded", (data) => {
      state.roundEnded = data;
      state.roundEndedCount += 1;
    });
    socket.on("playerReadyUpdate", (data) => {
      state.readyUpdate = data?.readyForNextRound ?? null;
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
  if (!host.state.roundEnded) {
    await once(host.socket, "roundEnded", 8000).catch(() => null);
  }
}

async function main() {
  console.log(`Post-round gameAction tests → ${SERVER} room ${ROOM}`);

  const host = await connectClient("Host", "profile-pr-host");
  host.socket.emit("createRoom", {
    roomId: ROOM,
    name: "Host",
    profileId: "profile-pr-host",
    isPublic: false,
  });
  await once(host.socket, "connected");

  const guest = await joinPlayer("Guest", "profile-pr-guest");
  const third = await joinPlayer("Third", "profile-pr-third");
  const clients = [host, guest, third];

  for (const c of [guest, third]) {
    c.socket.emit("toggleReady", { roomId: ROOM, ready: true });
  }
  await wait(200);

  host.socket.emit("startGame", { roomId: ROOM });
  await Promise.all(clients.map((c) => once(c.socket, "startGame", 15000)));
  await wait(500);

  await playToRoundComplete(clients, host);
  if (!host.state.roundEnded) {
    throw new Error("expected roundEnded after play loop");
  }

  // Latch Ready on two seats only — all three would start the next deal.
  for (const c of [host, guest]) {
    c.socket.emit("playerReadyForNextRound", { roomId: ROOM });
  }
  await wait(500);
  // Prefer playerReadyUpdate over requestGameState (which replays roundEnded).
  await wait(200);

  const readyBefore = {
    ...(host.state.readyUpdate || host.state.gameState?.readyForNextRound || {}),
  };
  const readyTrueCount = Object.values(readyBefore).filter(Boolean).length;
  if (readyTrueCount < 1) {
    await requestAllStates(clients);
    Object.assign(
      readyBefore,
      host.state.gameState?.readyForNextRound || {},
    );
  }
  if (Object.values(readyBefore).filter(Boolean).length < 1) {
    throw new Error(
      `expected at least one Ready latch before post-round action, got ${JSON.stringify(readyBefore)}`,
    );
  }
  if (
    host.state.gameState?.phase &&
    host.state.gameState.phase !== "ROUND_COMPLETE"
  ) {
    throw new Error(
      `expected to stay between rounds, got phase=${host.state.gameState.phase}`,
    );
  }

  // Stale/forged pass from whoever currentPlayerIndex still points at.
  const idx = host.state.gameState?.currentPlayerIndex ?? 0;
  const actorId = host.state.gameState?.players?.[idx]?.id;
  const actor = clientForPlayer(clients, actorId) || host;
  actor.state.errors = [];
  const awardedAtBefore = host.state.gameState?.roundXpAwardedAt;
  actor.socket.emit("gameAction", {
    roomId: ROOM,
    action: { type: "pass" },
  });
  await wait(600);

  if (!actor.state.errors.some((m) => /round already complete/i.test(m))) {
    throw new Error(
      `expected Round already complete error, got ${JSON.stringify(actor.state.errors)}`,
    );
  }

  const readyAfter = {
    ...(host.state.readyUpdate || {}),
  };
  // Ready update should still show latched votes (not wiped to all false).
  for (const id of Object.keys(readyBefore)) {
    if (readyBefore[id] === true && readyAfter[id] === false) {
      throw new Error(
        `post-round pass wiped Ready for ${id}: before=${JSON.stringify(readyBefore)} after=${JSON.stringify(readyAfter)}`,
      );
    }
  }

  await requestAllStates(clients);
  const readySynced = host.state.gameState?.readyForNextRound || {};
  for (const id of Object.keys(readyBefore)) {
    if (readyBefore[id] === true && readySynced[id] !== true) {
      throw new Error(
        `post-round pass cleared Ready in sync for ${id}: before=${JSON.stringify(readyBefore)} after=${JSON.stringify(readySynced)}`,
      );
    }
  }
  if (
    awardedAtBefore &&
    host.state.gameState?.roundXpAwardedAt !== awardedAtBefore
  ) {
    throw new Error("post-round pass re-finalized round XP timestamp");
  }

  for (const c of clients) c.socket.disconnect();
  console.log("  PASS post-round gameAction does not reset Ready / re-emit roundEnded");
  console.log("All post-round gameAction checks passed.");
}

main().catch((err) => {
  console.error("FAIL", err.message ?? err);
  process.exit(1);
});
