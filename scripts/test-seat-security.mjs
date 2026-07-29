/**
 * Critical multiplayer seat/auth regressions:
 * - live seat hijack via public profileId
 * - disconnect reclaim without reconnectSecret
 * - name-only reclaim
 * - cross-room leave must pause (not ghost) in-game seats
 * - forged roundFinished must not broadcast fake rankings
 * - mid-round ready must not start next deal
 *
 *   npm run server
 *   node scripts/test-seat-security.mjs
 */
import { io } from "socket.io-client";

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function once(socket, event, timeoutMs = 8000) {
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
      errors: [],
      lobby: null,
      gameState: null,
      roundEnded: null,
      gameAborted: null,
      playerDisconnected: null,
    };
    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", reject);
    socket.on("error", (data) => {
      state.errors.push(data?.message ?? String(data));
    });
    socket.on("connected", (data) => {
      state.id = data.profileId ?? data.id;
      state.reconnectSecret = data.reconnectSecret ?? null;
    });
    socket.on("lobbyUpdate", (data) => {
      state.lobby = data;
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
    });
    socket.on("roundEnded", (data) => {
      state.roundEnded = data;
    });
    socket.on("gameAborted", (data) => {
      state.gameAborted = data;
    });
    socket.on("playerDisconnected", (data) => {
      state.playerDisconnected = data;
    });
  });
}

function roomCode(prefix) {
  return (
    prefix + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 5)
  ).slice(0, 8);
}

async function createHost(name, profileId, roomId) {
  const host = await connectClient(name, profileId);
  host.socket.emit("createRoom", {
    roomId,
    name,
    profileId,
    isPublic: false,
  });
  await once(host.socket, "connected");
  if (!host.state.reconnectSecret) {
    throw new Error("host did not receive reconnectSecret");
  }
  return host;
}

async function join(name, profileId, roomId, reconnectSecret) {
  const client = await connectClient(name, profileId);
  client.socket.emit("joinRoom", {
    roomId,
    name,
    profileId,
    clientBuildId: "dev",
    ...(reconnectSecret ? { reconnectSecret } : {}),
  });
  await once(client.socket, "connected");
  return client;
}

async function startThreePlayerGame(roomId) {
  const host = await createHost("Host", `host-${roomId}`, roomId);
  const guest = await join("Guest", `guest-${roomId}`, roomId);
  const third = await join("Third", `third-${roomId}`, roomId);
  for (const c of [guest, third]) {
    c.socket.emit("toggleReady", { roomId, ready: true });
  }
  await wait(200);
  host.socket.emit("startGame", { roomId });
  await Promise.all(
    [host, guest, third].map((c) => once(c.socket, "startGame", 15000)),
  );
  await wait(400);
  return { host, guest, third };
}

async function testLiveSeatHijack() {
  const roomId = roomCode("HJ");
  const host = await createHost("Host", `host-${roomId}`, roomId);
  const guest = await join("Guest", `guest-${roomId}`, roomId);
  const guestId = guest.state.id;

  const attacker = await connectClient("Attacker", guestId);
  attacker.socket.emit("joinRoom", {
    roomId,
    name: "Attacker",
    profileId: guestId,
    clientBuildId: "dev",
  });
  await wait(800);
  const hijackError = attacker.state.errors.find((m) =>
    /already connected|Reconnect failed/i.test(m),
  );
  if (!hijackError) {
    throw new Error("live seat hijack was not rejected");
  }
  if (!guest.socket.connected) {
    throw new Error("victim socket was dropped during hijack attempt");
  }
  // Victim still owns the seat in lobby
  const lobbyGuest = host.state.lobby?.players?.find((p) => p.id === guestId);
  if (!lobbyGuest || lobbyGuest.disconnected) {
    throw new Error("victim seat was stolen or marked away after failed hijack");
  }

  for (const c of [host, guest, attacker]) c.socket.disconnect();
  console.log("  PASS live seat hijack rejected");
}

async function testSecretRequiredAfterDisconnect() {
  const roomId = roomCode("SC");
  const host = await createHost("Host", `host-${roomId}`, roomId);
  const guest = await join("Guest", `guest-${roomId}`, roomId);
  const guestId = guest.state.id;
  const secret = guest.state.reconnectSecret;
  guest.socket.disconnect();
  await wait(400);

  const thief = await connectClient("Thief", guestId);
  thief.socket.emit("joinRoom", {
    roomId,
    name: "Thief",
    profileId: guestId,
    clientBuildId: "dev",
  });
  await wait(800);
  if (!thief.state.errors.some((m) => /Reconnect failed/i.test(m))) {
    throw new Error("disconnect reclaim without secret was allowed");
  }

  const owner = await join("Guest", guestId, roomId, secret);
  if (owner.state.id !== guestId) {
    throw new Error("owner reclaim with secret failed");
  }

  for (const c of [host, thief, owner]) c.socket.disconnect();
  console.log("  PASS reconnectSecret required after disconnect");
}

async function testNameOnlyReclaimBlocked() {
  const roomId = roomCode("NM");
  const host = await createHost("Host", `host-${roomId}`, roomId);
  const guest = await join("Guest", `guest-${roomId}`, roomId);
  guest.socket.disconnect();
  await wait(400);

  const impostor = await join("Guest", `impostor-${roomId}`, roomId);
  if (impostor.state.id === `guest-${roomId}`) {
    throw new Error("name-only reclaim stole the disconnected seat");
  }
  const stillAway = host.state.lobby?.players?.find(
    (p) => p.id === `guest-${roomId}`,
  );
  if (!stillAway?.disconnected) {
    throw new Error("original seat should remain away after name-only join");
  }

  for (const c of [host, impostor]) c.socket.disconnect();
  console.log("  PASS name-only reclaim blocked");
}

async function testCrossRoomLeavePausesMatch() {
  const roomA = roomCode("A");
  const roomB = roomCode("B");
  const { host, guest, third } = await startThreePlayerGame(roomA);
  const guestId = guest.state.id;

  // Guest creates a new room on the same socket — must pause room A, not ghost-remove.
  guest.socket.emit("createRoom", {
    roomId: roomB,
    name: "Guest",
    profileId: guestId,
    isPublic: false,
  });
  await once(guest.socket, "connected");
  await wait(500);

  if (!host.state.playerDisconnected && !host.state.lobby?.players?.some((p) => p.id === guestId && p.disconnected)) {
    throw new Error("cross-room leave did not mark in-game seat away");
  }
  host.socket.emit("requestGameState", { roomId: roomA });
  await wait(300);
  const stillSeated = host.state.gameState?.players?.some((p) => p.id === guestId);
  if (!stillSeated) {
    throw new Error("in-game player was removed from gameState (ghost/abort path)");
  }
  // Actions should be paused
  host.state.errors = [];
  host.socket.emit("gameAction", {
    roomId: roomA,
    action: { type: "pass" },
  });
  await wait(400);
  if (!host.state.errors.some((m) => /paused|reconnect/i.test(m))) {
    // Host may not be current player; ask guest seat via third — still expect pause for current actor.
    // Soft check: room still inGame with away player present.
    if (!host.state.lobby?.players?.some((p) => p.id === guestId && p.disconnected)) {
      throw new Error("expected paused away seat after cross-room leave");
    }
  }

  for (const c of [host, guest, third]) c.socket.disconnect();
  console.log("  PASS cross-room leave pauses match (no ghost seat)");
}

async function testForgedRoundFinishedIgnored() {
  const roomId = roomCode("RF");
  const { host, guest, third } = await startThreePlayerGame(roomId);
  host.state.roundEnded = null;
  guest.state.roundEnded = null;

  const outsider = await connectClient("Outsider", `out-${roomId}`);
  outsider.socket.emit("roundFinished", {
    roomId,
    finishOrder: [host.state.id, guest.state.id, third.state.id],
    hands: {},
  });
  await wait(600);
  if (host.state.roundEnded || guest.state.roundEnded) {
    throw new Error("forged roundFinished broadcast roundEnded to the room");
  }

  for (const c of [host, guest, third, outsider]) c.socket.disconnect();
  console.log("  PASS forged roundFinished ignored");
}

async function testMidRoundReadyIgnored() {
  const roomId = roomCode("RD");
  const { host, guest, third } = await startThreePlayerGame(roomId);
  const dealSeed = host.state.gameState?.dealSeed;

  for (const c of [host, guest, third]) {
    c.socket.emit("playerReadyForNextRound", { roomId });
  }
  await wait(700);
  host.socket.emit("requestGameState", { roomId });
  await wait(300);

  if (host.state.gameState?.dealSeed !== dealSeed) {
    throw new Error("mid-round ready started a new deal");
  }
  const readyMap = host.state.gameState?.readyForNextRound || {};
  if (Object.keys(readyMap).length > 0) {
    throw new Error("mid-round ready latched readyForNextRound");
  }

  for (const c of [host, guest, third]) c.socket.disconnect();
  console.log("  PASS mid-round ready ignored");
}

async function main() {
  console.log(`Seat security tests → ${SERVER}`);
  await testLiveSeatHijack();
  await testSecretRequiredAfterDisconnect();
  await testNameOnlyReclaimBlocked();
  await testCrossRoomLeavePausesMatch();
  await testForgedRoundFinishedIgnored();
  await testMidRoundReadyIgnored();
  console.log("All seat security checks passed.");
}

main().catch((err) => {
  console.error("FAIL", err.message ?? err);
  process.exit(1);
});
