/**
 * P0-1 Regression test: hand confidentiality for tradesComplete / playerHandsUpdate.
 *
 * Verifies that each player receives ONLY their own hand in these events,
 * and that spectators receive no hands at all.
 *
 * Must FAIL against the unpatched server (room-wide broadcast).
 * Must PASS after the per-recipient fix.
 *
 * Requires a running server:
 *   npm run server
 *   node scripts/test-hand-confidentiality.mjs
 */

import { io } from "socket.io-client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  applyCpuTurn,
  findCPUPlay,
  isRoundCompleteForLiving,
  pickLowestCards,
  playCards,
  passTurn,
  setTenRuleDirection,
} = require("../server/gameBridge.js");

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function roomCode() {
  // Must match server rule: [A-Z0-9]{4,8}
  return "CF" + String(Math.floor(Math.random() * 9000 + 1000));
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

/**
 * Connect a socket, emit createRoom or joinRoom, wait for server 'connected' response.
 * Registers all persistent event listeners before any emit to avoid missed events.
 */
async function connectAndJoin(roomId, name, profileId, { create = false } = {}) {
  const state = {
    id: null,
    name,
    profileId,
    gameState: null,
    isSpectator: false,
    tradesCompletePayloads: [],
    playerHandsUpdatePayloads: [],
  };

  const socket = io(SERVER, { transports: ["websocket"], timeout: 8000 });

  // Register all persistent listeners BEFORE connecting so none are missed
  socket.on("connected", (data) => {
    state.id = data.profileId ?? data.id;
    state.isSpectator = !!data.isSpectator;
  });
  socket.on("gameStateSync", (data) => {
    state.gameState = data.gameState;
    if (typeof data.spectator === "boolean") state.isSpectator = data.spectator;
  });
  socket.on("startGame", (data) => {
    if (typeof data.spectator === "boolean") state.isSpectator = data.spectator;
  });
  socket.on("nextRoundStarting", () => {});
  socket.on("roundEnded", () => {});
  socket.on("playerReadyUpdate", () => {});
  socket.on("tradesComplete", (data) => state.tradesCompletePayloads.push(data));
  socket.on("playerHandsUpdate", (data) => state.playerHandsUpdatePayloads.push(data));

  // Wait for TCP connect, then emit room join/create
  await new Promise((resolve, reject) => {
    socket.on("connect_error", reject);
    socket.on("connect", resolve);
  });

  const serverConnected = once(socket, "connected");
  if (create) {
    socket.emit("createRoom", { roomId, name, profileId, isPublic: false });
  } else {
    socket.emit("joinRoom", { roomId, name, profileId, clientBuildId: "test" });
  }
  await serverConnected;

  return { socket, state, name, profileId };
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
  await wait(300);
}

function clientForPlayer(clients, playerId) {
  return clients.find((c) => c.state.id === playerId) ?? null;
}

async function resolvePendingTrades(clients, roomId) {
  await requestAllStates(clients, roomId);
  // Use first non-spectator client's game state to inspect trades
  const host = clients.find((c) => !c.state.isSpectator);
  const gs = host?.state.gameState;
  if (!gs || allTradesComplete(gs)) return false;

  const pending = gs.pendingTrades || {};
  const roles = gs.roles || {};
  let anyResolved = false;

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
    await wait(200);
    const hand =
      winnerClient.state.gameState?.players.find((p) => p.id === winnerId)?.hand ?? [];
    const need = trade.count || 1;
    const selected = pickLowestCards(hand, need);
    if (selected.length < need) continue;

    winnerClient.socket.emit("playerTradeSelection", {
      roomId,
      selectedCardObjects: selected,
    });
    await wait(400);
    anyResolved = true;
  }

  await requestAllStates(clients, roomId);
  return anyResolved;
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
    (c) => !(playerAfter?.hand ?? []).some((h) => h.suit === c.suit && h.value === c.value),
  );
  if (played.length) return { type: "play", cards: played };
  if (afterCpu.currentPlayerIndex !== before.currentPlayerIndex) return { type: "pass" };
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

function isDeadHand(p) {
  return !!p?.isDeadHand || p?.id === "__dead_hand__";
}

/**
 * Drive a round to completion using CPU play logic.
 */
async function playOneRound(clients, roomId, maxSteps = 800) {
  const seatedClients = clients.filter((c) => !c.state.isSpectator);
  for (let step = 0; step < maxSteps; step++) {
    await requestAllStates(seatedClients, roomId);
    const gs = seatedClients[0]?.state.gameState;
    if (!gs) throw new Error("No game state");

    if (isRoundCompleteForLiving(gs) && !gs.tenRulePending) return;

    if (!allTradesComplete(gs)) {
      await resolvePendingTrades(clients, roomId);
      continue;
    }

    const currentId = gs.players[gs.currentPlayerIndex]?.id;
    if (!currentId) { await wait(200); continue; }
    if (isDeadHand(gs.players[gs.currentPlayerIndex])) { await wait(200); continue; }

    const actor = clientForPlayer(clients, currentId);
    if (!actor) { await wait(200); continue; }

    const action = planAction(gs, currentId);
    if (!action) { await wait(200); continue; }

    await emitAction(actor, roomId, action);
  }
  throw new Error("playOneRound: exceeded maxSteps — round did not complete");
}

// ────────────────────────────────────────────────────────────────
// Assertions
// ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

/**
 * Assert the confidentiality of a single tradesComplete/playerHandsUpdate payload.
 * - If the recipient is a seated player: payload.playerHands must contain only their own ID.
 * - If the recipient is a spectator: payload.playerHands must be empty or absent.
 */
function assertHandConfidentiality(payload, recipientId, isSpectator, eventName) {
  if (!payload || !payload.playerHands) {
    // No playerHands in payload — acceptable only for spectators (or event without hands)
    if (isSpectator) {
      assert(true, `${eventName}: spectator received no playerHands (absent)`);
    } else {
      assert(false, `${eventName}: seated player ${recipientId} received no playerHands at all`);
    }
    return;
  }

  const handsInPayload = Object.keys(payload.playerHands);

  if (isSpectator) {
    assert(
      handsInPayload.length === 0,
      `${eventName}: spectator receives empty playerHands (got keys: [${handsInPayload.join(", ")}])`,
    );
    return;
  }

  // Seated player: must contain own ID
  assert(
    handsInPayload.includes(recipientId),
    `${eventName}: player ${recipientId} receives their own hand`,
  );

  // Must NOT contain any other player's ID
  const foreignIds = handsInPayload.filter((id) => id !== recipientId);
  assert(
    foreignIds.length === 0,
    `${eventName}: player ${recipientId} does NOT receive opponent hands (found foreign ids: [${foreignIds.join(", ")}])`,
  );
}

// ────────────────────────────────────────────────────────────────
// Main test
// ────────────────────────────────────────────────────────────────

async function run() {
  const code = roomCode();
  console.log(`\n=== P0-1 Hand Confidentiality Test (room ${code}) ===`);
  console.log(`Server: ${SERVER}\n`);

  // Connect player A as room host
  const playerA = await connectAndJoin(code, "Alice", `alice-${code}`, { create: true });
  await wait(200);

  // Connect player B as guest
  const playerB = await connectAndJoin(code, "Bob", `bob-${code}`);
  await wait(200);

  // Ready both and start game
  const startGameA = once(playerA.socket, "startGame", 10000);
  const startGameB = once(playerB.socket, "startGame", 10000);
  playerA.socket.emit("toggleReady", { roomId: code, ready: true });
  playerB.socket.emit("toggleReady", { roomId: code, ready: true });
  await wait(200);
  playerA.socket.emit("startGame", { roomId: code });
  await Promise.all([startGameA, startGameB]);
  await wait(500);

  // Join spectator AFTER game started — server auto-assigns spectator role
  const spectator = await connectAndJoin(code, "Spectator", `spec-${code}`);
  await wait(300);
  if (!spectator.state.isSpectator) {
    throw new Error("Third joiner should be spectator but was not");
  }

  const allClients = [playerA, playerB, spectator];
  const seatedClients = [playerA, playerB];

  console.log(`Players: A=${playerA.state.id} B=${playerB.state.id} Spec=${spectator.state.id}`);
  console.log(`\n--- Round 1 (establishes roles for trades in round 2) ---`);

  // Play round 1 — no trades in round 1
  try {
    await playOneRound(seatedClients, code);
  } catch (e) {
    console.error("Round 1 failed:", e.message);
    process.exit(1);
  }

  console.log("Round 1 complete. Waiting for ready-up...");

  // Ready both players for round 2
  playerA.socket.emit("playerReadyForNextRound", { roomId: code });
  await wait(200);
  playerB.socket.emit("playerReadyForNextRound", { roomId: code });
  await wait(600);

  console.log(`\n--- Round 2 (role trades apply) ---`);
  await requestAllStates(seatedClients, code);

  // Clear any payloads captured during round 1 (shouldn't be any trades, but be clean)
  playerA.state.tradesCompletePayloads = [];
  playerA.state.playerHandsUpdatePayloads = [];
  playerB.state.tradesCompletePayloads = [];
  playerB.state.playerHandsUpdatePayloads = [];
  spectator.state.tradesCompletePayloads = [];
  spectator.state.playerHandsUpdatePayloads = [];

  // Drive round 2 far enough to trigger trades (they fire at round start)
  // Just need to resolve trades — don't need to complete the round
  let tradesTriggered = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    await requestAllStates(seatedClients, code);
    const gs = playerA.state.gameState;
    if (!gs) { await wait(300); continue; }

    // If tradesComplete has fired we're done
    if (playerA.state.tradesCompletePayloads.length > 0 ||
        playerB.state.tradesCompletePayloads.length > 0) {
      tradesTriggered = true;
      break;
    }

    if (!allTradesComplete(gs)) {
      const resolved = await resolvePendingTrades(seatedClients, code);
      if (resolved) {
        await wait(500);
        tradesTriggered =
          playerA.state.tradesCompletePayloads.length > 0 ||
          playerB.state.tradesCompletePayloads.length > 0;
        if (tradesTriggered) break;
      }
    } else {
      // Round 1 may have had no role assignments — tradesComplete fires for round 1 too
      // but with empty pendingTrades. Either way, check if tradesComplete was received.
      await wait(400);
      if (playerA.state.tradesCompletePayloads.length > 0) {
        tradesTriggered = true;
        break;
      }
    }
    await wait(300);
  }

  if (!tradesTriggered) {
    // tradesComplete fires even when there are no actual trades (round 1)
    // so let's also check if we got it from the game start flow
    await wait(1000);
    tradesTriggered =
      playerA.state.tradesCompletePayloads.length > 0 ||
      playerB.state.tradesCompletePayloads.length > 0;
  }

  console.log(`\ntradesComplete received: A=${playerA.state.tradesCompletePayloads.length} B=${playerB.state.tradesCompletePayloads.length} Spec=${spectator.state.tradesCompletePayloads.length}`);
  console.log(`playerHandsUpdate received: A=${playerA.state.playerHandsUpdatePayloads.length} B=${playerB.state.playerHandsUpdatePayloads.length} Spec=${spectator.state.playerHandsUpdatePayloads.length}`);

  // ── Assert tradesComplete confidentiality ──
  console.log("\n[tradesComplete assertions]");

  if (playerA.state.tradesCompletePayloads.length === 0) {
    assert(false, "Player A received at least one tradesComplete event");
  } else {
    for (const payload of playerA.state.tradesCompletePayloads) {
      assertHandConfidentiality(payload, playerA.state.id, false, "tradesComplete@A");
    }
  }

  if (playerB.state.tradesCompletePayloads.length === 0) {
    assert(false, "Player B received at least one tradesComplete event");
  } else {
    for (const payload of playerB.state.tradesCompletePayloads) {
      assertHandConfidentiality(payload, playerB.state.id, false, "tradesComplete@B");
    }
  }

  for (const payload of spectator.state.tradesCompletePayloads) {
    assertHandConfidentiality(payload, spectator.state.id, true, "tradesComplete@Spectator");
  }
  if (spectator.state.tradesCompletePayloads.length === 0) {
    // Spectator may not receive tradesComplete at all — that is acceptable
    assert(true, "tradesComplete@Spectator: no event received (acceptable)");
  }

  // ── Assert playerHandsUpdate confidentiality ──
  console.log("\n[playerHandsUpdate assertions]");

  if (playerA.state.playerHandsUpdatePayloads.length > 0) {
    for (const payload of playerA.state.playerHandsUpdatePayloads) {
      assertHandConfidentiality(payload, playerA.state.id, false, "playerHandsUpdate@A");
    }
  } else {
    assert(true, "playerHandsUpdate@A: no events received (no manual trade selection made)");
  }

  if (playerB.state.playerHandsUpdatePayloads.length > 0) {
    for (const payload of playerB.state.playerHandsUpdatePayloads) {
      assertHandConfidentiality(payload, playerB.state.id, false, "playerHandsUpdate@B");
    }
  } else {
    assert(true, "playerHandsUpdate@B: no events received (no manual trade selection made)");
  }

  for (const payload of spectator.state.playerHandsUpdatePayloads) {
    assertHandConfidentiality(payload, spectator.state.id, true, "playerHandsUpdate@Spectator");
  }

  // ── Assert gameStateSync still hides opponent hands ──
  console.log("\n[gameStateSync hand-masking sanity check]");
  await requestAllStates(seatedClients, code);
  const gsA = playerA.state.gameState;
  const gsB = playerB.state.gameState;

  if (gsA) {
    const opponentsInA = gsA.players.filter(
      (p) => p.id !== playerA.state.id && !p.isDeadHand && p.id !== "__dead_hand__",
    );
    for (const opp of opponentsInA) {
      const allHidden = opp.hand.every((c) => c.hidden === true);
      assert(
        allHidden,
        `gameStateSync@A: opponent ${opp.id} hand is hidden (${opp.hand.length} cards, all hidden=${allHidden})`,
      );
    }
  }

  if (gsB) {
    const opponentsInB = gsB.players.filter(
      (p) => p.id !== playerB.state.id && !p.isDeadHand && p.id !== "__dead_hand__",
    );
    for (const opp of opponentsInB) {
      const allHidden = opp.hand.every((c) => c.hidden === true);
      assert(
        allHidden,
        `gameStateSync@B: opponent ${opp.id} hand is hidden (${opp.hand.length} cards, all hidden=${allHidden})`,
      );
    }
  }

  // Cleanup
  for (const c of allClients) c.socket.disconnect();

  // ── Summary ──
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("FAIL — hand confidentiality violation(s) detected");
    process.exit(1);
  } else {
    console.log("PASS — hand confidentiality verified");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
