/**
 * Multiplayer matrix — player counts, dead hand, bot table, spectators.
 * Requires server: npm run server
 *   node scripts/test-multiplayer-matrix.mjs
 *
 * Env: SERVER_URL, ROUNDS (default 2), SKIP_SLOW=1 skips 7–8 player cases
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
const { BOT_ROOM_CODE } = require("../server/botHostedRooms.js");

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const ROUNDS = Number(process.env.ROUNDS ?? 2);
const SKIP_SLOW = process.env.SKIP_SLOW === "1";
const DEAD_HAND_ID = "__dead_hand__";
const CPU_ID_RE = /^cpu-\d+$/i;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function roomCode(prefix) {
  return prefix + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 5);
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
      isSpectator: false,
      connectedPayload: null,
    };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", (err) => reject(err));
    socket.on("error", (data) => state.errors.push(data?.message ?? String(data)));
    socket.on("connected", (data) => {
      state.connectedPayload = data;
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
    socket.on("nextRoundStarting", () => {});
  });
}

async function joinPlayer(roomId, name, profileId) {
  const client = await connectClient(name, profileId);
  client.socket.emit("joinRoom", {
    roomId,
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

async function requestAllStates(clients, roomId) {
  for (const c of clients) {
    c.socket.emit("requestGameState", { roomId });
  }
  await wait(250);
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
      roomId,
      selectedCardObjects: selected,
    });
    await wait(400);
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

function isBotId(id) {
  return !!(id && CPU_ID_RE.test(String(id)));
}

function isDeadHand(p) {
  return !!p?.isDeadHand || p?.id === DEAD_HAND_ID;
}

function livingInState(gs) {
  return (gs?.players ?? []).filter((p) => !isDeadHand(p));
}

async function playRounds({
  label,
  roomId,
  clients,
  host,
  roundCount,
  allowBotWait = false,
}) {
  const humanClients = clients.filter((c) => !isBotId(c.state.id));

  for (let round = 1; round <= roundCount; round++) {
    host.state.roundEnded = null;
    let steps = 0;
    const maxSteps = 800;

    while (steps++ < maxSteps) {
      await requestAllStates(clients, roomId);
      const gs = host.state.gameState;
      if (!gs?.players?.length) {
        throw new Error(`${label} round ${round}: missing game state`);
      }

      if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) break;

      if (!allTradesComplete(gs)) {
        await resolvePendingTrades(clients, host, roomId);
        continue;
      }

      const current = gs.players[gs.currentPlayerIndex];
      if (!current) throw new Error(`${label} round ${round}: no current player`);

      if (isDeadHand(current) || isBotId(current.id)) {
        if (!allowBotWait) {
          throw new Error(
            `${label} round ${round}: unexpected inactive seat ${current.id}`,
          );
        }
        await wait(350);
        continue;
      }

      const actor = clientForPlayer(humanClients, current.id);
      if (!actor) {
        if (allowBotWait) {
          await wait(350);
          continue;
        }
        throw new Error(
          `${label} round ${round}: no client for ${current.name} (${current.id})`,
        );
      }

      actor.socket.emit("requestGameState", { roomId });
      await wait(100);
      const action = planAction(actor.state.gameState, current.id);
      if (!action) {
        throw new Error(
          `${label} round ${round}: ${current.name} stuck — no valid play or pass`,
        );
      }

      await emitAction(actor, roomId, action);
      if (actor.state.errors.length) {
        throw new Error(
          `${label} round ${round} ${actor.name}: ${actor.state.errors.pop()}`,
        );
      }
    }

    if (steps >= maxSteps) {
      throw new Error(`${label} round ${round}: exceeded ${maxSteps} steps`);
    }

    await wait(300);
    if (!host.state.roundEnded) {
      await once(host.socket, "roundEnded", 12000).catch(() => null);
    }

    for (const c of humanClients) {
      c.socket.emit("playerReadyForNextRound", { roomId });
    }

    if (round < roundCount) {
      await Promise.race(
        clients.map((c) =>
          once(c.socket, "nextRoundStarting", 25000).catch(() => null),
        ),
      );
      await wait(500);
    }
  }
}

function assertDeadHand(gs, expect) {
  const has = (gs?.players ?? []).some(isDeadHand);
  if (expect && !has) throw new Error("Expected dead hand seat in game state");
  if (!expect && has) throw new Error("Unexpected dead hand seat in game state");
}

async function runHumanCountScenario(humanCount, { deadHand, withSpectator }) {
  const label = withSpectator
    ? `${humanCount} humans + spectator`
    : `${humanCount} humans${deadHand ? " (dead hand)" : ""}`;
  const roomId = roomCode("M");
  const prefix = `m${humanCount}${withSpectator ? "s" : ""}${Date.now()}`;

  const host = await connectClient("Host", `${prefix}-host`);
  host.socket.emit("createRoom", {
    roomId,
    name: "Host",
    profileId: `${prefix}-host`,
    isPublic: false,
  });
  await once(host.socket, "connected");

  const guests = [];
  for (let i = 1; i < humanCount; i++) {
    guests.push(
      await joinPlayer(roomId, `P${i + 1}`, `${prefix}-p${i + 1}`),
    );
  }

  let spectator = null;
  if (withSpectator) {
    for (const c of guests) {
      c.socket.emit("toggleReady", { roomId, ready: true });
    }
    await wait(200);
    host.socket.emit("startGame", { roomId });
    await Promise.all(
      [host, ...guests].map((c) => once(c.socket, "startGame", 15000)),
    );
    await wait(600);
    await requestAllStates([host, ...guests], roomId);

    const expectDead = humanCount === 2;
    assertDeadHand(host.state.gameState, expectDead);

    spectator = await joinPlayer(
      roomId,
      "Spectator",
      `${prefix}-spectator`,
    );
    if (!spectator.state.isSpectator) {
      throw new Error(`${label}: joiner should be spectator`);
    }
    await wait(300);
  } else {
    for (const c of guests) {
      c.socket.emit("toggleReady", { roomId, ready: true });
    }
    await wait(200);
    host.socket.emit("startGame", { roomId });
    const seated = [host, ...guests];
    await Promise.all(seated.map((c) => once(c.socket, "startGame", 15000)));
    await wait(500);
    await requestAllStates(seated, roomId);
  }

  const seated = [host, ...guests];
  const seeds = new Set(seated.map((c) => c.state.dealSeed));
  if (seeds.size !== 1) throw new Error(`${label}: dealSeed mismatch`);

  const gs = host.state.gameState;
  const living = livingInState(gs);
  const expectDead = humanCount === 2 && !withSpectator;
  assertDeadHand(gs, expectDead || (withSpectator && humanCount === 2));

  if (!withSpectator) {
    if (living.length !== humanCount) {
      throw new Error(
        `${label}: expected ${humanCount} living players, got ${living.length}`,
      );
    }
  }

  const allClients = spectator ? [...seated, spectator] : seated;
  await playRounds({
    label,
    roomId,
    clients: allClients,
    host,
    roundCount: ROUNDS,
    allowBotWait: expectDead || withSpectator,
  });

  if (spectator && ROUNDS >= 1) {
    spectator.socket.emit("playerReadyForNextRound", { roomId });
    await wait(800);
    if (spectator.state.isSpectator) {
      throw new Error(`${label}: spectator should promote after ready`);
    }
  }

  for (const c of allClients) c.socket.disconnect();
  console.log(`  PASS ${label}`);
}

async function runBotTableScenario() {
  const label = "2 humans join bot table (dead hand + bots)";
  const roomId = BOT_ROOM_CODE;
  const prefix = `bot${Date.now()}`;

  const h1 = await joinPlayer(roomId, "HumanA", `${prefix}-a`);
  const h2 = await joinPlayer(roomId, "HumanB", `${prefix}-b`);

  await wait(800);
  await requestAllStates([h1, h2], roomId);

  if (!h1.state.gameState?.players?.length) {
    throw new Error(`${label}: no game state after join`);
  }

  assertDeadHand(h1.state.gameState, true);
  const bots = h1.state.gameState.players.filter((p) => isBotId(p.id));
  if (bots.length < 2) {
    throw new Error(`${label}: expected 2 bots in game, got ${bots.length}`);
  }

  if (!h1.state.isSpectator || !h2.state.isSpectator) {
    throw new Error(`${label}: humans should join as spectators while bots play`);
  }

  await playRounds({
    label,
    roomId,
    clients: [h1, h2],
    host: h1,
    roundCount: ROUNDS,
    allowBotWait: true,
  });

  h1.socket.emit("playerReadyForNextRound", { roomId });
  h2.socket.emit("playerReadyForNextRound", { roomId });
  await wait(1000);
  await requestAllStates([h1, h2], roomId);

  const livingHumans = livingInState(h1.state.gameState).filter(
    (p) => !isBotId(p.id),
  );
  if (livingHumans.length < 2) {
    throw new Error(
      `${label}: expected humans promoted into game (${livingHumans.length} living humans)`,
    );
  }

  for (const c of [h1, h2]) c.socket.disconnect();
  console.log(`  PASS ${label}`);
}

async function main() {
  console.log(`Multiplayer matrix — ${SERVER}, ${ROUNDS} round(s) per scenario\n`);

  try {
    const probe = await connectClient("probe", "probe-connect");
    probe.socket.disconnect();
  } catch (e) {
    console.error("FAIL: server not reachable at", SERVER);
    console.error("  Start with: npm run server");
    process.exit(1);
  }

  await runHumanCountScenario(2, { deadHand: true, withSpectator: false });
  await runHumanCountScenario(2, { deadHand: true, withSpectator: true });
  await runBotTableScenario();

  for (let n = 3; n <= 8; n++) {
    if (SKIP_SLOW && n >= 7) {
      console.log(`  SKIP ${n} humans (SKIP_SLOW=1)`);
      continue;
    }
    await runHumanCountScenario(n, { deadHand: false, withSpectator: false });
  }

  console.log("\nPASS multiplayer matrix — all scenarios completed");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nFAIL", err.message ?? err);
  process.exit(1);
});
