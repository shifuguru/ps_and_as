import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { io } from "socket.io-client";

const require = createRequire(import.meta.url);
const botHosted = require("../server/botHostedRooms.js");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function once(socket, event, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    function handler(value) {
      clearTimeout(timer);
      resolve(value);
    }
    socket.once(event, handler);
  });
}

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function main() {
  const room = {
    onDemand: true,
    isBotHosted: true,
    players: [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `human-${i}`, name: `Human ${i}` })),
      { id: "cpu-1", isBot: true },
      { id: "cpu-2", isBot: true },
      { id: "new-1", name: "New 1", isSpectator: true },
      { id: "new-2", name: "New 2", isSpectator: true },
    ],
    gameState: { readyForNextRound: { "new-1": true, "new-2": true } },
  };
  assert.equal(botHosted.promoteReadySpectators(room).length, 2);
  assert.equal(room.players.filter((p) => !p.isSpectator).length, 8);
  assert.equal(room.players.filter(botHosted.isBotMember).length, 0);
  room.players = room.players.filter((p) => !["new-1", "new-2"].includes(p.id));
  botHosted.refillBotSeats(room);
  assert.equal(room.players.filter(botHosted.isBotMember).length, 2);
  room.inGame = true;
  room.gameState = {
    players: [{ id: "human-0", hand: [{ value: 3 }] }],
    currentPlayerIndex: 0,
    finishedOrder: [],
  };
  room._botLastProgressAt = Date.now() - 120000;
  assert.equal(botHosted.isBotRoomStalled(room), false, "waiting for a human is not a bot stall");

  const port = await freePort();
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "psandas-bot-test-"));
  const child = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      SERVER_DATA_DIR: dataDir,
      ENABLE_OPEN_BOT_TABLE: "0",
      ENABLE_ON_DEMAND_BOT_TABLE: "1",
      PS_QA_LEAGUE: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  const sockets = [];
  const url = `http://127.0.0.1:${port}`;

  async function connect() {
    const socket = io(url, { transports: ["websocket"], reconnection: false });
    sockets.push(socket);
    await once(socket, "connect");
    return socket;
  }

  async function discover(socket) {
    const result = once(socket, "availableRooms");
    socket.emit("discoverRooms");
    return (await result).find((room) => room.roomId === "BOTOPN");
  }

  async function join(socket, name, profileId, reconnectSecret) {
    const connected = once(socket, "connected");
    const sync = once(socket, "gameStateSync");
    socket.emit("joinRoom", {
      roomId: "BOTOPN",
      name,
      profileId,
      ...(reconnectSecret ? { reconnectSecret } : {}),
    });
    return { connected: await connected, sync: await sync };
  }

  try {
    const deadline = Date.now() + 20000;
    while (!logs.includes("Server listening on") && Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
      await delay(100);
    }
    assert.ok(logs.includes("Server listening on"), `Server did not start: ${logs}`);
    const observer = await connect();
    let listing = await discover(observer);
    assert.equal(listing?.onDemandBotTable, true);
    assert.equal(listing.inGame, false, "discovery must not start an empty game");
    await delay(1500);
    assert.equal((await discover(observer)).inGame, false);

    const player = await connect();
    const first = await join(player, "Alice", "on-demand-alice");
    assert.equal(first.connected.isSpectator, false);
    assert.ok(first.sync.gameState.players.some((p) => p.id === first.connected.id));
    assert.equal(first.sync.gameState.players.filter((p) => /^cpu-\d+$/.test(p.id)).length, 2);

    const watcher = await connect();
    const second = await join(watcher, "Bob", "on-demand-bob");
    assert.equal(second.connected.isSpectator, true);
    assert.equal((await discover(observer)).inGame, true);

    const disconnected = once(watcher, "playerDisconnected");
    player.disconnect();
    await disconnected;
    const skipError = once(watcher, "error");
    watcher.emit("skipBotTable", { roomId: "BOTOPN" });
    assert.match((await skipError).message, /reconnect/i);
    const paused = once(watcher, "gameStateSync");
    watcher.emit("requestGameState", { roomId: "BOTOPN" });
    const before = (await paused).gameState;
    await delay(2200);
    const again = once(watcher, "gameStateSync");
    watcher.emit("requestGameState", { roomId: "BOTOPN" });
    const after = (await again).gameState;
    delete before.stateVersion;
    delete after.stateVersion;
    assert.deepEqual(after, before, "game must pause during reconnect grace");

    const reconnected = await connect();
    const restored = await join(reconnected, "Alice", "on-demand-alice", first.connected.reconnectSecret);
    assert.equal(restored.connected.id, first.connected.id);
    assert.equal(restored.connected.isSpectator, false);

    const roundEnded = once(watcher, "roundEnded");
    watcher.emit("skipBotTable", { roomId: "BOTOPN" });
    await roundEnded;
    const nextRound = once(watcher, "nextRoundStarting");
    watcher.emit("playerReadyForNextRound", { roomId: "BOTOPN" });
    reconnected.emit("playerReadyForNextRound", { roomId: "BOTOPN" });
    const promotion = await nextRound;
    assert.ok(promotion.promotedPlayerIds.includes(second.connected.id));
    const promotedSync = once(watcher, "gameStateSync");
    watcher.emit("requestGameState", { roomId: "BOTOPN" });
    const promoted = (await promotedSync).gameState;
    assert.ok(promoted.players.some((p) => p.id === second.connected.id));
    assert.equal(promoted.players.filter((p) => /^cpu-\d+$/.test(p.id)).length, 2);

    watcher.emit("leaveRoom", { roomId: "BOTOPN" });
    await delay(200);
    reconnected.emit("leaveRoom", { roomId: "BOTOPN" });
    await delay(500);
    listing = await discover(observer);
    assert.equal(listing.inGame, false, "last explicit leave should reset to idle");
    assert.equal(listing.playerCount, 2, "idle table should restore its bots");

    const next = await connect();
    const nextJoin = await join(next, "Carol", "on-demand-carol");
    assert.equal(nextJoin.connected.isSpectator, false);
    assert.ok(nextJoin.sync.gameState.players.some((p) => p.id === nextJoin.connected.id));
    next.disconnect();
    await delay(16000);
    assert.equal((await discover(observer)).inGame, false, "expired reconnect grace must reset the table");
    console.log("PASS on-demand bot table discovery, promotion, pause, reconnect and reset");
  } catch (error) {
    console.error(logs);
    throw error;
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
