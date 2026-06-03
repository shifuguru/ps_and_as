/**
 * Bot table lifecycle — bots finish rounds without humans, and mid-round joins.
 * Requires: npm run server  →  node scripts/test-bot-table-lifecycle.mjs
 */
import { io } from "socket.io-client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { isRoundCompleteForLiving } = require("../server/gameBridge.js");
const { BOT_ROOM_CODE } = require("../server/botHostedRooms.js");

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const CPU_ID_RE = /^cpu-\d+$/i;

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

function connectObserver(name, profileId) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER, { transports: ["websocket"], timeout: 8000 });
    const state = {
      id: null,
      gameState: null,
      roundEnded: null,
      isSpectator: false,
      nextRoundSeen: false,
    };
    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", reject);
    socket.on("connected", (data) => {
      state.id = data.profileId ?? data.id;
      state.isSpectator = !!data.isSpectator;
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
      if (typeof data.spectator === "boolean") state.isSpectator = data.spectator;
    });
    socket.on("roundEnded", (data) => {
      state.roundEnded = data;
    });
    socket.on("nextRoundStarting", () => {
      state.nextRoundSeen = true;
    });
  });
}

async function joinBotTable(name, profileId) {
  const client = await connectObserver(name, profileId);
  client.socket.emit("joinRoom", {
    roomId: BOT_ROOM_CODE,
    name,
    profileId,
    clientBuildId: "dev",
  });
  await once(client.socket, "connected");
  return client;
}

function stateFingerprint(gs) {
  if (!gs) return "";
  const fo = (gs.finishedOrder ?? []).join(",");
  const cur = gs.players?.[gs.currentPlayerIndex]?.id ?? "?";
  const pile = gs.pile?.length ?? 0;
  const trick = gs.currentTrick?.actions?.length ?? 0;
  return `${fo}|${cur}|${pile}|${trick}`;
}

function livingCount(gs) {
  return (gs?.players ?? []).filter(
    (p) => !p.isDeadHand && p.id !== "__dead_hand__",
  ).length;
}

/** Bots play through at least one full round and start another without human Ready. */
async function testBotSoloCycle() {
  const label = "bot solo: round end + auto next deal";
  const prefix = `solo${Date.now()}`;
  const client = await joinBotTable("Watcher", `${prefix}-watch`);
  const roomId = BOT_ROOM_CODE;

  await wait(1200);
  client.socket.emit("requestGameState", { roomId });
  await wait(400);

  let gs = client.state.gameState;
  if (!gs?.players?.length) {
    throw new Error(`${label}: no game state after join`);
  }

  const bots = gs.players.filter((p) => CPU_ID_RE.test(p.id));
  if (bots.length < 2) {
    throw new Error(`${label}: expected bots in game, got ${bots.length}`);
  }

  let sawProgress = false;
  let lastFp = stateFingerprint(gs);
  const progressDeadline = Date.now() + 120_000;
  while (Date.now() < progressDeadline) {
    client.socket.emit("requestGameState", { roomId });
    await wait(500);
    gs = client.state.gameState;
    if (!gs) {
      await wait(400);
      continue;
    }
    const fp = stateFingerprint(gs);
    if (fp !== lastFp) {
      sawProgress = true;
      lastFp = fp;
    }
    if (client.state.roundEnded || (isRoundCompleteForLiving(gs) && !gs.tenRulePending)) {
      break;
    }
  }

  if (!sawProgress) {
    throw new Error(`${label}: no game progress within 120s`);
  }
  if (!client.state.roundEnded && !(isRoundCompleteForLiving(gs) && !gs.tenRulePending)) {
    throw new Error(`${label}: round did not complete within 120s`);
  }

  const roundEndDeadline = Date.now() + 60_000;
  while (Date.now() < roundEndDeadline) {
    client.socket.emit("requestGameState", { roomId });
    await wait(500);
    gs = client.state.gameState;
    if (
      client.state.nextRoundSeen ||
      (gs && !isRoundCompleteForLiving(gs) && livingCount(gs) > 0)
    ) {
      client.socket.disconnect();
      console.log(`  PASS ${label}`);
      return;
    }
  }

  client.socket.disconnect();
  throw new Error(`${label}: next round did not start within 60s after round end`);
}

/** Human joins mid-trick as spectator; bots keep playing; round can still finish. */
async function testMidRoundSpectatorJoin() {
  const label = "mid-round spectator join";
  const prefix = `mid${Date.now()}`;

  let gs = null;
  const probe = await connectObserver("Probe", `${prefix}-probe`);
  probe.socket.emit("joinRoom", {
    roomId: BOT_ROOM_CODE,
    name: "Probe",
    profileId: `${prefix}-probe`,
    clientBuildId: "dev",
  });
  await once(probe.socket, "connected");
  await wait(800);
  probe.socket.emit("requestGameState", { roomId: BOT_ROOM_CODE });
  await wait(400);
  gs = probe.state.gameState;
  probe.socket.disconnect();

  if (!gs?.players?.length) {
    throw new Error(`${label}: bot table not in game`);
  }
  if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) {
    await wait(5000);
  }

  const human = await joinBotTable("MidJoin", `${prefix}-human`);
  const roomId = BOT_ROOM_CODE;
  await wait(500);

  if (!human.state.isSpectator) {
    human.socket.disconnect();
    throw new Error(`${label}: mid-round join should be spectator`);
  }

  const joinFp = stateFingerprint(human.state.gameState);
  if (!joinFp) {
    human.socket.disconnect();
    throw new Error(`${label}: no game state after mid-round join`);
  }

  let changes = 0;
  let lastFp = joinFp;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    human.socket.emit("requestGameState", { roomId });
    await wait(450);
    gs = human.state.gameState;
    const fp = stateFingerprint(gs);
    if (fp && fp !== lastFp) {
      changes++;
      lastFp = fp;
    }
    if (human.state.roundEnded || (isRoundCompleteForLiving(gs) && !gs.tenRulePending)) {
      break;
    }
  }

  human.socket.disconnect();

  if (changes < 3) {
    throw new Error(
      `${label}: expected bots to keep playing (saw ${changes} state changes, need 3+)`,
    );
  }
  if (!human.state.roundEnded && !(isRoundCompleteForLiving(gs) && !gs.tenRulePending)) {
    throw new Error(`${label}: round did not complete within 90s after mid-round join`);
  }

  console.log(`  PASS ${label}`);
}

/** Human claims dead-hand seat, plays one card, then a bot must take the next turn. */
async function testHumanSeatThenBotTurn() {
  const label = "human seated: play then bot continues";
  const prefix = `seat${Date.now()}`;
  const human = await joinBotTable("Player", `${prefix}-human`);
  const roomId = BOT_ROOM_CODE;

  let gs = null;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    human.socket.emit("requestGameState", { roomId });
    await wait(400);
    gs = human.state.gameState;
    if (human.state.roundEnded || (isRoundCompleteForLiving(gs) && !gs.tenRulePending)) {
      break;
    }
    await wait(800);
  }

  if (!gs || !(isRoundCompleteForLiving(gs) && !gs.tenRulePending)) {
    human.socket.disconnect();
    throw new Error(`${label}: round did not reach scoreboard`);
  }

  human.socket.emit("playerReadyForNextRound", { roomId });
  await wait(6000);

  let seated = false;
  let humanTurnPlayed = false;
  const playDeadline = Date.now() + 90_000;
  while (Date.now() < playDeadline) {
    human.socket.emit("requestGameState", { roomId });
    await wait(350);
    gs = human.state.gameState;
    if (!gs?.players?.length) {
      await wait(500);
      continue;
    }

    const me = gs.players.find((p) => p.id === human.state.id);
    if (me && !me.isDeadHand && me.id !== "__dead_hand__") {
      seated = true;
    }

    const cur = gs.players[gs.currentPlayerIndex];
    if (
      seated &&
      cur?.id === human.state.id &&
      me?.hand?.length > 0 &&
      !humanTurnPlayed
    ) {
      const card = me.hand.find((c) => c.value !== 10) ?? me.hand[0];
      human.socket.emit("gameAction", {
        roomId,
        action: {
          type: "play",
          playerId: human.state.id,
          cards: [card],
        },
      });
      humanTurnPlayed = true;
      await wait(1200);
      continue;
    }

    if (humanTurnPlayed && cur && CPU_ID_RE.test(cur.id)) {
      human.socket.disconnect();
      console.log(`  PASS ${label}`);
      return;
    }

    await wait(400);
  }

  human.socket.disconnect();
  throw new Error(
    `${label}: after human play, expected bot turn (seated=${seated}, played=${humanTurnPlayed})`,
  );
}

async function main() {
  console.log(`Bot table lifecycle — ${SERVER}\n`);
  try {
    const probe = await connectObserver("ping", "ping");
    probe.socket.disconnect();
  } catch {
    console.error("FAIL: server not reachable. Start with: npm run server");
    process.exit(1);
  }

  await testBotSoloCycle();
  await testMidRoundSpectatorJoin();
  await testHumanSeatThenBotTurn();
  console.log("\nPASS bot table lifecycle");
}

main().catch((err) => {
  console.error("\nFAIL", err.message ?? err);
  process.exit(1);
});
