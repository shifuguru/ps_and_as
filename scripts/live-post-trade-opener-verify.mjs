#!/usr/bin/env node
/**
 * Live multiplayer verification — post-trade 3♣ opener (production repro).
 * One-off gate script; not part of CI unless promoted.
 *
 *   RELEASE_GATE_SPAWN_SERVER=1 node scripts/live-post-trade-opener-verify.mjs
 */
import { io } from "socket.io-client";
import { createRequire } from "module";
import { ensureServer, stopSpawnedServer } from "./release-gate/lib/server.mjs";

const require = createRequire(import.meta.url);
const {
  applyCpuTurn,
  findCPUPlay,
  isRoundCompleteForLiving,
  playCards,
  passTurn,
  resolveOpenerAfterRoleTrades,
} = require("../server/gameBridge.js");

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const MAX_ATTEMPTS = Number(process.env.LIVE_OPENER_ATTEMPTS ?? 50);
const MAX_TURN_STEPS = 500;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
      syncLog: [],
    };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", (err) => reject(err));
    socket.on("error", (data) => state.errors.push(data?.message ?? String(data)));
    socket.on("connected", (data) => {
      state.id = data.profileId ?? data.id;
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
      state.syncLog.push({
        at: Date.now(),
        currentPlayerIndex: data.gameState?.currentPlayerIndex,
        version: data.stateVersion ?? data.version ?? null,
      });
    });
    socket.on("startGame", (data) => {
      state.dealSeed = data.dealSeed ?? null;
    });
    socket.on("roundEnded", (data) => {
      state.roundEnded = data;
    });
  });
}

function rolePlayerId(roles, role) {
  const target = role.toLowerCase();
  return (
    Object.keys(roles || {}).find((id) => {
      const r = roles[id];
      return typeof r === "string" && r.toLowerCase() === target;
    }) ?? null
  );
}

function middlePlayerId(players, roles) {
  const pres = rolePlayerId(roles, "president");
  const ass = rolePlayerId(roles, "asshole");
  return (
    players.find(
      (p) => !p.isDeadHand && p.id !== pres && p.id !== ass,
    )?.id ?? null
  );
}

function hasCard(hand, suit, value) {
  return (hand || []).some((c) => c.suit === suit && c.value === value);
}

function findThreeClubsOwner(playerHands, players) {
  for (const p of players) {
    if (p.isDeadHand) continue;
    const hand = playerHands[p.id] ?? p.hand ?? [];
    if (hasCard(hand, "clubs", 3)) return p.id;
  }
  return null;
}

function cardLabel(c) {
  const suits = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
  return `${c.value}${suits[c.suit] ?? c.suit}`;
}

function formatHands(playerHands, players, roles) {
  const lines = [];
  for (const p of players) {
    if (p.isDeadHand) continue;
    const hand = (playerHands[p.id] ?? []).map(cardLabel).join(", ") || "(empty)";
    const role = roles?.[p.id] ?? p.role ?? "?";
    lines.push(`${p.name} (${p.id}, ${role}): ${hand}`);
  }
  return lines.join("\n");
}

function cloneState(gs) {
  return JSON.parse(JSON.stringify(gs));
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
  await wait(250);
}

function clientForPlayer(clients, playerId) {
  return clients.find((c) => c.state.id === playerId) ?? null;
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
    client.socket.emit("gameAction", { roomId, action: { type: "pass" } });
  } else if (action.type === "tenRule") {
    client.socket.emit("gameAction", {
      roomId,
      action: { type: "tenRule", direction: action.direction },
    });
  }
  await wait(120);
}

async function playRoundOne(clients, host, roomId) {
  let steps = 0;
  while (steps++ < MAX_TURN_STEPS) {
    await requestAllStates(clients, roomId);
    const gs = host.state.gameState;
    if (!gs?.players?.length) throw new Error("missing game state");

    if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) break;

    if (!allTradesComplete(gs)) break;

    const current = gs.players[gs.currentPlayerIndex];
    const actor = clientForPlayer(clients, current.id);
    if (!actor) throw new Error(`no client for ${current.name}`);

    actor.socket.emit("requestGameState", { roomId });
    await wait(120);
    const action = planAction(actor.state.gameState, current.id);
    if (!action) throw new Error(`${current.name} stuck`);
    await emitAction(actor, roomId, action);
  }

  if (steps >= MAX_TURN_STEPS) throw new Error("round 1 exceeded turn budget");

  await wait(300);
  if (!host.state.roundEnded) {
    await once(host.socket, "roundEnded", 8000).catch(() => null);
  }

  for (const c of clients) {
    c.socket.emit("playerReadyForNextRound", { roomId });
  }

  await Promise.race(
    clients.map((c) =>
      once(c.socket, "nextRoundStarting", 20000).catch(() => null),
    ),
  );
  await wait(500);
  await requestAllStates(clients, roomId);
}

function matchesProductionRepro(gs) {
  const roles = gs.roles || {};
  const hands = gs.playerHands || {};
  const presId = rolePlayerId(roles, "president");
  const assId = rolePlayerId(roles, "asshole");
  const midId = middlePlayerId(gs.players, roles);
  if (!presId || !assId || !midId) return null;

  const presHand = hands[presId] ?? [];
  const midHand = hands[midId] ?? [];
  const assHand = hands[assId] ?? [];

  if (!hasCard(presHand, "hearts", 3)) return null;
  if (!hasCard(midHand, "clubs", 3)) return null;
  if (hasCard(assHand, "clubs", 3)) return null;

  return { presId, assId, midId, presHand, midHand, assHand };
}

function verifyOpener(gs, hostId) {
  const playerHands = gs.playerHands || {};
  const threeClubsOwner = findThreeClubsOwner(playerHands, gs.players);
  const idx = gs.currentPlayerIndex;
  const opener = gs.players[idx];
  const expectedIdx = resolveOpenerAfterRoleTrades(gs.players, {
    hostId,
    lastRoundOrder: gs.lastRoundOrder ?? [],
  });

  return {
    threeClubsOwner,
    openerId: opener?.id ?? null,
    openerName: opener?.name ?? null,
    currentPlayerIndex: idx,
    expectedIndex: expectedIdx,
    expectedOpenerId: gs.players[expectedIdx]?.id ?? null,
    pass:
      threeClubsOwner != null &&
      opener?.id === threeClubsOwner &&
      idx === expectedIdx,
  };
}

async function runAttempt(attemptNum) {
  const roomId =
    "O" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 6);
  const suffix = `live-opener-${attemptNum}-${Date.now()}`;

  const host = await connectClient("Host", `host-${suffix}`);
  host.socket.emit("createRoom", {
    roomId,
    name: "Host",
    profileId: `host-${suffix}`,
    isPublic: false,
  });
  await once(host.socket, "connected");

  async function joinPlayer(name, profileId) {
    const client = await connectClient(name, profileId);
    client.socket.emit("joinRoom", {
      roomId,
      name,
      profileId,
      clientBuildId: "live-opener-verify",
    });
    await once(client.socket, "connected");
    return client;
  }

  const guest = await joinPlayer("Guest", `guest-${suffix}`);
  const third = await joinPlayer("Third", `third-${suffix}`);
  const clients = [host, guest, third];

  for (const c of [guest, third]) {
    c.socket.emit("toggleReady", { roomId, ready: true });
  }
  await wait(200);

  host.socket.emit("startGame", { roomId });
  await Promise.all(clients.map((c) => once(c.socket, "startGame", 15000)));
  await wait(400);

  const round1Seed = host.state.dealSeed;
  await playRoundOne(clients, host, roomId);

  await requestAllStates(clients, roomId);
  const gs = host.state.gameState;
  const match = matchesProductionRepro(gs);
  if (!match) {
    for (const c of clients) c.socket.disconnect();
    return { hit: false, roomId, round1Seed };
  }

  const beforeHands = JSON.parse(JSON.stringify(gs.playerHands || {}));
  const beforeRoles = { ...(gs.roles || {}) };

  const presClient = clientForPlayer(clients, match.presId);
  presClient.socket.emit("playerTradeSelection", {
    roomId,
    selectedCardObjects: [{ suit: "hearts", value: 3 }],
  });

  const tradesComplete = await once(host.socket, "tradesComplete", 10000);
  await wait(400);
  await requestAllStates(clients, roomId);
  await wait(300);
  await requestAllStates(clients, roomId);

  const afterHands = host.state.gameState?.playerHands ?? tradesComplete.playerHands;
  const hostVerify = verifyOpener(host.state.gameState, host.state.id);
  const guestVerify = verifyOpener(guest.state.gameState, host.state.id);
  const thirdVerify = verifyOpener(third.state.gameState, host.state.id);

  const syncStable =
    host.state.gameState?.currentPlayerIndex ===
      guest.state.gameState?.currentPlayerIndex &&
    guest.state.gameState?.currentPlayerIndex ===
      third.state.gameState?.currentPlayerIndex;

  const result = {
    hit: true,
    roomId,
    round1Seed,
    round2DealSeed: host.state.gameState?.dealSeed ?? null,
    lastRoundOrder: gs.lastRoundOrder ?? [],
    roles: beforeRoles,
    beforeTradeHands: beforeHands,
    afterTradeHands: afterHands,
    trade: { presidentReturn: "3♥", assholeReceives: "3♥" },
    expectedOpenerId: match.midId,
    expectedOpenerName:
      gs.players.find((p) => p.id === match.midId)?.name ?? match.midId,
    host: hostVerify,
    guest: guestVerify,
    third: thirdVerify,
    syncStable,
    hostSyncCount: host.state.syncLog.length,
    guestSyncCount: guest.state.syncLog.length,
    pass:
      hostVerify.pass &&
      guestVerify.pass &&
      thirdVerify.pass &&
      syncStable &&
      hostVerify.openerId === match.midId &&
      hostVerify.openerId !== match.assId,
  };

  for (const c of clients) c.socket.disconnect();
  return result;
}

async function main() {
  const { spawned, child, unreachable } = await ensureServer(SERVER);
  if (unreachable) {
    console.error(
      "Server unreachable. Start with `npm run server` or RELEASE_GATE_SPAWN_SERVER=1",
    );
    process.exit(2);
  }

  let lastMiss = null;
  try {
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      console.log(`Attempt ${i}/${MAX_ATTEMPTS}...`);
      const result = await runAttempt(i);
      if (!result.hit) {
        lastMiss = result;
        continue;
      }
      console.log(JSON.stringify({ verdict: result.pass ? "PASS" : "FAIL", ...result }, null, 2));
      process.exit(result.pass ? 0 : 1);
    }
    console.log(
      JSON.stringify(
        {
          verdict: "NO_REPRO",
          attempts: MAX_ATTEMPTS,
          lastMiss,
          message:
            "Could not naturally deal into production repro layout in attempt budget",
        },
        null,
        2,
      ),
    );
    process.exit(3);
  } finally {
    if (spawned) stopSpawnedServer(child);
  }
}

main().catch((err) => {
  console.error("FAIL", err.stack ?? err.message ?? err);
  process.exit(1);
});
