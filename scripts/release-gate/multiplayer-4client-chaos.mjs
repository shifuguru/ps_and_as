#!/usr/bin/env node
/**
 * Multiplayer chaos — 4 clients, random legal moves, disconnect/reconnect,
 * spectator promotion, 20 rounds.
 *
 *   npm run server
 *   node scripts/release-gate/multiplayer-4client-chaos.mjs
 *
 * Env:
 *   SERVER_URL              default http://localhost:4000
 *   ROUNDS                  default 20
 *   CHAOS_SEED              RNG seed (default Date-based stable in run)
 *   RELEASE_GATE_SPAWN_SERVER=1  auto-start server if down
 */
import { io } from "socket.io-client";
import { createRequire } from "module";
import { assertCurrentPlayerMayAct } from "./lib/turnOwnership.mjs";
import { ensureServer, stopSpawnedServer } from "./lib/server.mjs";

const require = createRequire(import.meta.url);
const {
  applyCpuTurn,
  findCPUPlay,
  isValidPlay,
  isRoundCompleteForLiving,
  pickLowestCards,
  playCards,
  passTurn,
  resolveEffectiveTenRule,
} = require("../../server/gameBridge.js");
const { isDeadHandPlayer } = require("../../src/game/deadHand.ts");

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const ROUNDS = Number(process.env.ROUNDS ?? 20);
const DEAD_HAND_ID = "__dead_hand__";
const CPU_ID_RE = /^cpu-\d+$/i;

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const SEED =
  process.env.CHAOS_SEED != null
    ? Number(process.env.CHAOS_SEED)
    : (Date.now() & 0x7fffffff);
const rng = makeRng(SEED);

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function roomCode() {
  return "C" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 5);
}

function cloneState(gs) {
  return JSON.parse(JSON.stringify(gs));
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
    const socket = io(SERVER, { transports: ["websocket"], timeout: 10000 });
    const state = {
      id: null,
      gameState: null,
      dealSeed: null,
      errors: [],
      roundEnded: null,
      isSpectator: false,
      promoted: false,
    };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", reject);
    socket.on("error", (data) => state.errors.push(data?.message ?? String(data)));
    socket.on("connected", (data) => {
      state.id = data.profileId ?? data.id;
      state.isSpectator = !!data.isSpectator;
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
      if (typeof data.spectator === "boolean") state.isSpectator = data.spectator;
    });
    socket.on("startGame", (data) => {
      state.dealSeed = data.dealSeed ?? null;
      if (typeof data.spectator === "boolean") state.isSpectator = data.spectator;
    });
    socket.on("roundEnded", (data) => {
      state.roundEnded = data;
    });
    socket.on("nextRoundStarting", (data) => {
      if (data?.promotedPlayerIds?.length) {
        for (const pid of data.promotedPlayerIds) {
          if (pid === state.id) state.promoted = true;
        }
      } else if (data?.promotedPlayerId === state.id) {
        state.promoted = true;
      }
      if (typeof data?.spectator === "boolean") state.isSpectator = data.spectator;
    });
  });
}

async function joinRoom(client, roomId) {
  client.socket.emit("joinRoom", {
    roomId,
    name: client.name,
    profileId: client.profileId,
    clientBuildId: "mp-chaos-gate",
  });
  await once(client.socket, "connected");
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
  await wait(220);
}

function isBotOrDead(p) {
  return (
    isDeadHandPlayer(p) ||
    p?.id === DEAD_HAND_ID ||
    !!(p?.id && CPU_ID_RE.test(String(p.id)))
  );
}

function enumerateLegalPlays(gs, playerId) {
  const idx = gs.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return [];
  const player = gs.players[idx];
  const runOnTop =
    !!gs.runOnTop?.active && gs.runOnTop.playerIndex === idx;
  const tenRule = resolveEffectiveTenRule(gs);
  const plays = [];
  const hand = player.hand ?? [];

  const tryPlay = (cards) => {
    if (!cards?.length) return;
    if (
      isValidPlay(
        cards,
        gs.pile ?? [],
        tenRule,
        gs.pileHistory,
        gs.trickHistory,
        gs.fourOfAKindChallenge,
        gs.currentTrick,
        gs.players,
        gs.finishedOrder,
        gs.lastRoundOrder,
        playerId,
        runOnTop,
      )
    ) {
      plays.push(cards);
    }
  };

  for (const c of hand) tryPlay([c]);

  const byVal = new Map();
  for (const c of hand) {
    const k = c.value;
    if (!byVal.has(k)) byVal.set(k, []);
    byVal.get(k).push(c);
  }
  for (const cards of byVal.values()) {
    for (let n = 2; n <= Math.min(4, cards.length); n++) {
      tryPlay(cards.slice(0, n));
    }
  }

  return plays;
}

function pickRandomLegalAction(gs, playerId) {
  if (gs.tenRulePending) {
    const chooser = gs.players[gs.currentPlayerIndex];
    if (chooser?.id === playerId) {
      return { type: "tenRule", direction: rng() < 0.5 ? "higher" : "lower" };
    }
    return null;
  }

  const before = cloneState(gs);
  const legalPlays = enumerateLegalPlays(before, playerId);
  const canPass = passTurn(before, playerId) !== before;

  const options = [];
  if (canPass) options.push({ type: "pass" });
  for (const cards of legalPlays) {
    options.push({ type: "play", cards });
  }

  if (options.length === 0) {
    return planFallbackAction(before, playerId);
  }

  const pick = options[Math.floor(rng() * options.length)];
  if (pick.type === "pass") return { type: "pass" };
  return { type: "play", cards: pick.cards };
}

function planFallbackAction(gs, playerId) {
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
  await wait(100 + Math.floor(rng() * 80));
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

    winnerClient.socket.emit("requestGameState", { roomId });
    await wait(120);
    const hand =
      winnerClient.state.gameState?.players.find((p) => p.id === winnerId)?.hand ??
      [];
    const need = trade.count || 1;
    const selected = pickLowestCards(hand, need);
    if (selected.length !== need) {
      throw new Error(`${winnerClient.name} could not pick ${need} trade cards`);
    }

    winnerClient.socket.emit("playerTradeSelection", {
      roomId,
      selectedCardObjects: selected,
    });
    await wait(350);
    await requestAllStates(clients, roomId);
  }
}

async function reconnectClient(client, roomId) {
  const { name, profileId } = client;
  client.socket.disconnect();
  await wait(400 + Math.floor(rng() * 400));
  const fresh = await connectClient(name, profileId);
  await joinRoom(fresh, roomId);
  fresh.socket.emit("requestGameState", { roomId });
  await wait(200);
  return fresh;
}

function replaceClient(clients, oldRef, fresh) {
  const i = clients.indexOf(oldRef);
  if (i >= 0) clients[i] = fresh;
}

async function playRound({
  round,
  roomId,
  clients,
  hostProfileId,
  stats,
  spectatorsJoined,
  prefix,
}) {
  const host =
    clients.find((c) => c.profileId === hostProfileId) ?? clients[0];
  host.state.roundEnded = null;
  let steps = 0;
  const maxSteps = 900;

  while (steps++ < maxSteps) {
    await requestAllStates(clients, roomId);
    const host =
      clients.find((c) => c.profileId === hostProfileId) ?? clients[0];
    const gs = host.state.gameState;
    if (!gs?.players?.length) {
      throw new Error(`round ${round}: missing game state`);
    }

    if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) break;

    if (!allTradesComplete(gs)) {
      await resolvePendingTrades(clients, host, roomId);
      continue;
    }

    try {
      assertCurrentPlayerMayAct(gs, `round ${round} step ${steps}`);
    } catch (err) {
      stats.turnOwnershipFails++;
      throw err;
    }

    if (
      round === 1 &&
      !spectatorsJoined.value &&
      steps >= 6 &&
      steps <= 12
    ) {
      spectatorsJoined.value = true;
      const spec1 = await connectClient("SpectatorA", `${prefix}-spec-a`);
      await joinRoom(spec1, roomId);
      if (!spec1.state.isSpectator) {
        throw new Error("SpectatorA should join as spectator");
      }
      clients.push(spec1);
      stats.spectatorsJoined++;

      const spec2 = await connectClient("SpectatorB", `${prefix}-spec-b`);
      await joinRoom(spec2, roomId);
      if (!spec2.state.isSpectator) {
        throw new Error("SpectatorB should join as spectator");
      }
      clients.push(spec2);
      stats.spectatorsJoined++;
    }

    if (rng() < 0.04 && steps > 4) {
      const candidates = clients.filter((c) => c.socket.connected);
      if (candidates.length) {
        const victim = candidates[Math.floor(rng() * candidates.length)];
        const fresh = await reconnectClient(victim, roomId);
        replaceClient(clients, victim, fresh);
        stats.reconnects++;
      }
    }

    const current = gs.players[gs.currentPlayerIndex];
    if (!current) throw new Error(`round ${round}: no current player`);

    if (isBotOrDead(current)) {
      await wait(280);
      continue;
    }

    const actor = clientForPlayer(clients, current.id);
    if (!actor || actor.state.isSpectator) {
      await wait(280);
      continue;
    }

    actor.socket.emit("requestGameState", { roomId });
    await wait(80);
    const action = pickRandomLegalAction(actor.state.gameState, current.id);
    if (!action) {
      stats.stuckTurns++;
      throw new Error(
        `round ${round} step ${steps}: ${current.name} stuck — no legal move`,
      );
    }

    await emitAction(actor, roomId, action);
    if (actor.state.errors.length) {
      throw new Error(
        `round ${round} ${actor.name}: ${actor.state.errors.pop()}`,
      );
    }
    stats.actions++;
  }

  if (steps >= maxSteps) {
    throw new Error(`round ${round}: exceeded ${maxSteps} steps`);
  }

  await wait(250);
  const host =
    clients.find((c) => c.profileId === hostProfileId) ?? clients[0];
  if (!host.state.roundEnded) {
    await once(host.socket, "roundEnded", 15000).catch(() => null);
  }
  if (!host.state.roundEnded) {
    throw new Error(`round ${round}: roundEnded not received`);
  }

  const finishOrder =
    host.state.roundEnded?.finishOrder ?? host.state.gameState?.finishedOrder ?? [];
  if (finishOrder.length < 2) {
    throw new Error(`round ${round}: finishOrder too short`);
  }
  stats.roundsCompleted++;
}

async function readyAllForNextRound(clients, roomId, stats) {
  for (const c of clients) {
    c.socket.emit("playerReadyForNextRound", { roomId });
    if (c.state.isSpectator) stats.spectatorReadyClicks++;
  }
  await wait(300);
}

async function main() {
  const roomId = roomCode();
  const prefix = `mp4${Date.now()}`;
  const stats = {
    roundsCompleted: 0,
    actions: 0,
    reconnects: 0,
    spectatorsJoined: 0,
    spectatorReadyClicks: 0,
    promotions: 0,
    stuckTurns: 0,
    turnOwnershipFails: 0,
  };

  console.log("═".repeat(60));
  console.log("Multiplayer 4-client chaos gate");
  console.log(`  server=${SERVER}  room=${roomId}  rounds=${ROUNDS}  seed=${SEED}`);
  console.log("  clients: 2 seated humans + 2 mid-game spectators");
  console.log("═".repeat(60));

  let serverChild = null;
  const serverInfo = await ensureServer(SERVER);
  if (serverInfo.unreachable) {
    throw new Error(
      "Server not reachable. Start: npm run server — or set RELEASE_GATE_SPAWN_SERVER=1",
    );
  }
  serverChild = serverInfo.child;
  if (serverInfo.spawned) console.log("● Spawned local server\n");

  let host = await connectClient("Host", `${prefix}-host`);
  host.socket.emit("createRoom", {
    roomId,
    name: "Host",
    profileId: `${prefix}-host`,
    isPublic: false,
  });
  await once(host.socket, "connected");

  const guest = await connectClient("Guest", `${prefix}-guest`);
  await joinRoom(guest, roomId);

  let clients = [host, guest];
  guest.socket.emit("toggleReady", { roomId, ready: true });
  await wait(180);
  host.socket.emit("startGame", { roomId });

  await Promise.all(
    clients.map((c) => once(c.socket, "startGame", 20000)),
  );
  await wait(450);
  await requestAllStates(clients, roomId);

  const seeds = new Set(clients.map((c) => c.state.dealSeed));
  if (seeds.size !== 1) throw new Error("dealSeed mismatch after start");

  const spectatorsJoined = { value: false };
  const hostProfileId = `${prefix}-host`;
  const promotedIds = new Set();

  try {
    for (let round = 1; round <= ROUNDS; round++) {
      console.log(`▶ Round ${round}/${ROUNDS}`);
      await playRound({
        round,
        roomId,
        clients,
        hostProfileId,
        stats,
        spectatorsJoined,
        prefix,
      });

      await readyAllForNextRound(clients, roomId, stats);

      if (round < ROUNDS) {
        const nextEvt = await Promise.race(
          clients.map((c) =>
            once(c.socket, "nextRoundStarting", 30000).catch(() => null),
          ),
        );
        if (nextEvt?.promotedPlayerIds?.length) {
          for (const pid of nextEvt.promotedPlayerIds) promotedIds.add(pid);
        } else if (nextEvt?.promotedPlayerId) {
          promotedIds.add(nextEvt.promotedPlayerId);
        }
        await wait(450);
        await requestAllStates(clients, roomId);
      }

      for (const c of clients) {
        if (c.state.promoted) promotedIds.add(c.state.id);
        if (!c.state.isSpectator && c.profileId.includes("-spec-")) {
          promotedIds.add(c.state.id);
        }
      }
    }
    stats.promotions = promotedIds.size;
  } finally {
    for (const c of clients) {
      try {
        c.socket.disconnect();
      } catch {
        /* ignore */
      }
    }
    stopSpawnedServer(serverChild);
  }

  console.log("\nWatch summary:");
  console.log(`  rounds completed:     ${stats.roundsCompleted}/${ROUNDS}`);
  console.log(`  random actions:       ${stats.actions}`);
  console.log(`  reconnects:           ${stats.reconnects}`);
  console.log(`  spectators joined:    ${stats.spectatorsJoined}`);
  console.log(`  spectator ready:      ${stats.spectatorReadyClicks}`);
  console.log(`  promotions:           ${stats.promotions}`);
  console.log(`  stuck turns:          ${stats.stuckTurns}`);
  console.log(`  turn ownership fails: ${stats.turnOwnershipFails}`);

  if (stats.spectatorsJoined < 2) {
    throw new Error("expected 2 spectators to join");
  }
  if (stats.promotions < 1) {
    throw new Error("expected at least one spectator promotion over 20 rounds");
  }
  if (stats.reconnects < 1) {
    throw new Error("expected at least one disconnect/reconnect cycle");
  }

  console.log("\nPASS multiplayer 4-client chaos gate");
}

main().catch((err) => {
  console.error("\nFAIL multiplayer 4-client chaos gate:", err.message ?? err);
  process.exit(1);
});
