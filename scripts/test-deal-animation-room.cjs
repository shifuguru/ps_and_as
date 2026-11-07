const assert = require("node:assert/strict");
const Module = require("node:module");

global.__DEV__ = true;
require("ts-node").register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "Node", esModuleInterop: true },
});
require.extensions[".webp"] = (module) => { module.exports = "felt"; };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "react-native") return { Platform: { OS: "web" } };
  return originalLoad.call(this, request, parent, isMain);
};
const { SocketAdapter } = require("../src/game/socketAdapter");
const {
  resolveSkipDealAnimations,
  resolveCeremonyLaunchMode,
} = require("../src/game/dealCeremonyAnimation");
Module._load = originalLoad;

function createClient() {
  const callbacks = new Map();
  const sent = [];
  const socket = {
    connected: true,
    on(name, callback) { callbacks.set(name, callback); },
    emit(name, payload) { sent.push({ name, payload }); },
  };
  const adapter = new SocketAdapter("http://localhost:4000", "", "Player", "p");
  adapter.socket = socket;
  adapter.registerEventHandlers();
  const observed = [];
  adapter.on("message", (event) => {
    if (event.type === "state") {
      observed.push({ event: event.state, skip: adapter.getSkipDealAnimations() });
    }
  });
  return { adapter, callbacks, observed, sent };
}

function launchMode(adapter, localSkip) {
  const skipDealAnimations = resolveSkipDealAnimations({
    onlineMultiplayer: true,
    roomSkipDealAnimations: adapter.getSkipDealAnimations(),
    localSkipDealAnimations: localSkip,
  });
  return resolveCeremonyLaunchMode({
    trades: [],
    skipDealAnimations,
    shouldFinalizeEarly: false,
  });
}

const host = createClient();
const guest = createClient();
function broadcast(event, payload) {
  for (const client of [host, guest]) {
    client.callbacks.get(event)(payload);
  }
}
function assertMode(expected) {
  assert.equal(launchMode(host.adapter, false), expected);
  assert.equal(launchMode(guest.adapter, true), expected);
}

broadcast("gameStateSync", { gameState: {}, skipDealAnimations: false });
assertMode("animated");
broadcast("lobbyUpdate", { players: [], skipDealAnimations: true });
assertMode("tradeNow");
broadcast("gameStateSync", { gameState: {}, skipDealAnimations: true });
assertMode("tradeNow");
broadcast("lobbyUpdate", { players: [], skipDealAnimations: false });
assertMode("animated");
broadcast("startGame", { players: [], skipDealAnimations: true });
assertMode("tradeNow");
broadcast("lobbyUpdate", { players: [] });
assertMode("tradeNow");
assert.equal(guest.observed.at(-1).event.skipDealAnimations, undefined);
assert.equal(guest.observed.at(-1).skip, true);
broadcast("hostMigrated", { newHost: "p", newHostName: "Player" });
assert.equal(guest.adapter.getHostId(), "p");

host.adapter.startGame("ROOM");
assert.deepEqual(host.sent.at(-1), { name: "startGame", payload: { roomId: "ROOM" } });
host.adapter.startGame("ROOM", false);
assert.deepEqual(host.sent.at(-1), {
  name: "startGame",
  payload: { roomId: "ROOM", skipDealAnimations: false },
});

console.log("Deal animation room option regression passed");

function waitFor(adapter, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      adapter.off("message", onMessage);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 10000);
    function onMessage(event) {
      if (event.type !== "state" || event.state?.type !== type || !predicate(event.state)) return;
      clearTimeout(timer);
      adapter.off("message", onMessage);
      resolve(event.state);
    }
    adapter.on("message", onMessage);
  });
}

async function runLive() {
  const { ensureServer, stopSpawnedServer } = await import("./release-gate/lib/server.mjs");
  const url = process.env.SERVER_URL ?? "http://localhost:4000";
  const server = await ensureServer(url);
  if (server.unreachable) {
    throw new Error("Server unavailable; set RELEASE_GATE_SPAWN_SERVER=1 to spawn it");
  }
  const room = `A${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const hostClient = new SocketAdapter(url, "", "Host", `host-${room}`, false);
  const guestClient = new SocketAdapter(url, "", "Guest", `guest-${room}`, false);
  try {
    await Promise.all([hostClient.connect(), guestClient.connect()]);
    const hostConnected = waitFor(hostClient, "connected");
    hostClient.createRoom(room, "Host");
    await hostConnected;
    const guestConnected = waitFor(guestClient, "connected");
    const guestInLobby = waitFor(hostClient, "lobby", (event) => event.players.length === 2);
    guestClient.joinRoom(room, "Guest");
    await Promise.all([guestConnected, guestInLobby]);

    const guestReady = waitFor(hostClient, "lobby", (event) =>
      event.players.some((player) => player.id === guestClient.getProfileId() && player.ready),
    );
    guestClient.toggleReady(room, guestClient.getProfileId(), true);
    await guestReady;

    const started = [hostClient, guestClient].map((client) =>
      waitFor(client, "startGame", (event) => event.skipDealAnimations === true),
    );
    hostClient.startGame(room, true);
    await Promise.all(started);
    assert.equal(launchMode(hostClient, false), "tradeNow");
    assert.equal(launchMode(guestClient, false), "tradeNow");

    for (const skip of [false, true]) {
      const updates = [hostClient, guestClient].map((client) =>
        waitFor(client, "lobby", (event) => event.skipDealAnimations === skip),
      );
      hostClient.updateRoomOptions(room, { skipDealAnimations: skip });
      await Promise.all(updates);
      const expected = skip ? "tradeNow" : "animated";
      assert.equal(launchMode(hostClient, !skip), expected);
      assert.equal(launchMode(guestClient, !skip), expected);
      const sync = waitFor(guestClient, "gameStateSync");
      guestClient.requestGameState(room);
      assert.equal((await sync).skipDealAnimations, skip);
    }

    guestClient.updateRoomOptions(room, { skipDealAnimations: false });
    const sync = waitFor(guestClient, "gameStateSync");
    guestClient.requestGameState(room);
    assert.equal((await sync).skipDealAnimations, true, "guest cannot override host");
    console.log("Live host/guest deal animation synchronization passed");
  } finally {
    hostClient.dismissRoom(room);
    await Promise.all([hostClient.disconnect(), guestClient.disconnect()]);
    stopSpawnedServer(server.child);
  }
}

if (process.argv.includes("--live")) {
  runLive().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
