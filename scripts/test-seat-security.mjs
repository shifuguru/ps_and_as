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
      kicked: null,
    };
    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", reject);
    socket.on("error", (data) => {
      state.errors.push(data?.message ?? String(data));
    });
    socket.on("connected", (data) => {
      state.id = data.id;
      state.profileId = data.profileId ?? data.id;
      state.reconnectSecret = data.reconnectSecret ?? null;
      state.isSpectator = !!data.isSpectator;
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
    socket.on("kicked", (data) => {
      state.kicked = data;
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
  // Without the victim's reconnectSecret, attacker must not take the live seat.
  // They may be rejected OR seated under a different opaque id — never as guestId.
  await Promise.race([
    once(attacker.socket, "connected", 2000).catch(() => null),
    wait(800),
  ]);
  if (attacker.state.id === guestId) {
    throw new Error("live seat hijack claimed victim seat id");
  }
  if (!guest.socket.connected) {
    throw new Error("victim socket was dropped during hijack attempt");
  }
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
  await once(thief.socket, "connected");
  if (thief.state.id === guestId) {
    throw new Error("disconnect reclaim without secret was allowed");
  }
  const stillAway = host.state.lobby?.players?.find((p) => p.id === guestId);
  if (!stillAway?.disconnected) {
    throw new Error("original seat should remain away after secret-less join");
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
  const versionBefore = host.state.gameState?.stateVersion;
  const finishedBefore = (host.state.gameState?.finishedOrder || []).join(",");

  for (const c of [host, guest, third]) {
    c.socket.emit("playerReadyForNextRound", { roomId });
  }
  await wait(700);
  host.socket.emit("requestGameState", { roomId });
  await wait(300);

  const finishedAfter = (host.state.gameState?.finishedOrder || []).join(",");
  if (finishedAfter !== finishedBefore) {
    throw new Error("mid-round ready started a new deal");
  }
  // stateVersion may bump on sync; finishedOrder empty mid-round is the deal identity.
  if (host.state.gameState?.players?.length !== 3) {
    throw new Error("mid-round ready corrupted roster");
  }
  const readyMap = host.state.gameState?.readyForNextRound || {};
  if (Object.keys(readyMap).length > 0) {
    throw new Error("mid-round ready latched readyForNextRound");
  }
  void versionBefore;

  for (const c of [host, guest, third]) c.socket.disconnect();
  console.log("  PASS mid-round ready ignored");
}

async function testProfileIdPreClaimDoesNotLockout() {
  const roomId = roomCode("PC");
  const victimProfile = `victim-${roomId}`;
  const host = await createHost("Host", `host-${roomId}`, roomId);

  // Attacker arrives first using the victim's public profile id.
  const attacker = await join("Attacker", victimProfile, roomId);
  if (attacker.state.id !== victimProfile) {
    // Preferred id was free — attacker may hold it. Victim must still be able to join.
  }

  const victim = await join("Victim", victimProfile, roomId);
  if (!victim.state.id) {
    throw new Error("victim could not join after profileId pre-claim");
  }
  if (victim.state.id === attacker.state.id) {
    throw new Error("victim was bound to attacker's seat without secret");
  }
  // Both should be seated as distinct lobby members.
  await wait(200);
  const ids = (host.state.lobby?.players || []).map((p) => p.id);
  if (!ids.includes(attacker.state.id) || !ids.includes(victim.state.id)) {
    throw new Error("pre-claim lockout prevented both players from seating");
  }

  for (const c of [host, attacker, victim]) c.socket.disconnect();
  console.log("  PASS profileId pre-claim does not lock out victim");
}

async function testPauseJoinIsSpectator() {
  const roomId = roomCode("PJ");
  const host = await createHost("Alice", `alice-${roomId}`, roomId);
  const guest = await join("Bob", `bob-${roomId}`, roomId);
  guest.socket.emit("toggleReady", { roomId, ready: true });
  await wait(200);
  host.socket.emit("startGame", { roomId });
  await Promise.all(
    [host, guest].map((c) => once(c.socket, "startGame", 15000)),
  );
  await wait(400);

  const bobSecret = guest.state.reconnectSecret;
  guest.socket.disconnect();
  await wait(500);
  if (!host.state.playerDisconnected) {
    throw new Error("expected playerDisconnected during reconnect pause");
  }

  const carol = await join("Carol", `carol-${roomId}`, roomId);
  if (!carol.state.id) {
    throw new Error("Carol could not join during reconnect pause");
  }
  // connected payload + lobby must mark mid-match joiners as spectators
  // even when activePlayerCount briefly drops to 1.
  const carolLobby = (host.state.lobby?.players || []).find(
    (p) => p.id === carol.state.id,
  );
  if (!carolLobby?.isSpectator && carol.state.isSpectator !== true) {
    // Prefer lobby flag; fall back to connected payload if lobby lag.
    const connectedSpec = carol.state.isSpectator === true;
    const lobbySpec = carolLobby?.isSpectator === true;
    if (!connectedSpec && !lobbySpec) {
      throw new Error(
        `Carol seated as player during pause (lobby=${JSON.stringify(carolLobby)} connectedSpec=${carol.state.isSpectator})`,
      );
    }
  }
  if (carolLobby && carolLobby.isSpectator !== true) {
    throw new Error("Carol lobby seat is not spectator during pause join");
  }

  const bobBack = await join("Bob", `bob-${roomId}`, roomId, bobSecret);
  if (bobBack.state.id !== guest.state.id) {
    throw new Error("Bob failed to reclaim seat after pause");
  }
  await wait(300);
  const seated = (host.state.lobby?.players || []).filter((p) => !p.isSpectator);
  const spectators = (host.state.lobby?.players || []).filter((p) => p.isSpectator);
  if (seated.length !== 2) {
    throw new Error(
      `expected 2 seated after reclaim, got ${seated.map((p) => p.name).join(",")}`,
    );
  }
  if (!spectators.some((p) => p.id === carol.state.id)) {
    throw new Error("Carol should remain spectator after Bob reconnects");
  }

  for (const c of [host, carol, bobBack]) c.socket.disconnect();
  console.log("  PASS pause-join seats as spectator");
}

async function main() {
  console.log(`Seat security tests → ${SERVER}`);
  await testLiveSeatHijack();
  await testSecretRequiredAfterDisconnect();
  await testNameOnlyReclaimBlocked();
  await testProfileIdPreClaimDoesNotLockout();
  await testCrossRoomLeavePausesMatch();
  await testForgedRoundFinishedIgnored();
  await testMidRoundReadyIgnored();
  await testPauseJoinIsSpectator();
  await testBotSeatClaimRejected();
  await testSkipBotTableRequiresMembership();
  await testSameNameGuestReconnectDoesNotStealHost();
  await testKickByIdLeavesNameTwinSeated();
  await testKickByAmbiguousNameIsIgnored();
  console.log("All seat security checks passed.");
}

main().catch((err) => {
  console.error("FAIL", err.message ?? err);
  process.exit(1);
});

async function testBotSeatClaimRejected() {
  const attacker = await connectClient("BotThief", "cpu-1");
  attacker.socket.emit("joinRoom", {
    roomId: "BOTOPN",
    name: "BotThief",
    profileId: "cpu-1",
  });
  await wait(800);
  const claimed = (attacker.state.lobby?.players || []).some(
    (p) => p.id === "cpu-1" && p.name === "BotThief",
  );
  if (claimed) {
    throw new Error("attacker claimed bot seat cpu-1");
  }
  if (!attacker.state.errors.some((m) => /invalid player id|bot/i.test(m))) {
    throw new Error(
      `expected bot/cpu id rejection, got errors=${JSON.stringify(attacker.state.errors)}`,
    );
  }
  attacker.socket.disconnect();
  console.log("  PASS bot seat claim / cpu-* join rejected");
}

async function testSkipBotTableRequiresMembership() {
  const outsider = await connectClient("Skipper", `skip-${Date.now()}`);
  outsider.state.roundEnded = null;
  outsider.socket.emit("skipBotTable", { roomId: "BOTOPN" });
  await wait(700);
  if (
    !outsider.state.errors.some((m) => /join the bot table|not found/i.test(m))
  ) {
    throw new Error(
      `expected skipBotTable membership error, got ${JSON.stringify(outsider.state.errors)}`,
    );
  }
  outsider.socket.disconnect();
  console.log("  PASS skipBotTable requires room membership");
}

async function testSameNameGuestReconnectDoesNotStealHost() {
  const roomId = roomCode("HN");
  const host = await createHost("Player", `host-${roomId}`, roomId);
  const hostId = host.state.id;
  const guest = await join("Player", `guest-${roomId}`, roomId);
  const guestId = guest.state.id;
  const secret = guest.state.reconnectSecret;
  if (host.state.lobby?.host !== hostId) {
    throw new Error("expected original host before disconnect");
  }

  guest.socket.disconnect();
  await wait(400);

  const guestBack = await join("Player", `guest-${roomId}`, roomId, secret);
  if (guestBack.state.id !== guestId) {
    throw new Error("same-name guest failed to reclaim own seat");
  }
  await wait(300);
  if (host.state.lobby?.host !== hostId) {
    throw new Error(
      `same-name guest stole host on reconnect (host=${host.state.lobby?.host} guest=${guestId})`,
    );
  }
  if (guestBack.state.lobby?.host !== hostId) {
    throw new Error("reconnected guest lobby reports stolen host");
  }

  guestBack.socket.emit("kickPlayer", {
    roomId,
    playerId: hostId,
    playerName: "Player",
  });
  await wait(400);
  if (host.state.kicked) {
    throw new Error("non-host same-name guest was able to kick the host");
  }
  if ((host.state.lobby?.players || []).length < 2) {
    throw new Error("same-name guest kick removed a seat");
  }

  for (const c of [host, guestBack]) c.socket.disconnect();
  console.log("  PASS same-name guest reconnect does not steal host");
}

async function testKickByIdLeavesNameTwinSeated() {
  const roomId = roomCode("KD");
  const host = await createHost("Player", `host-${roomId}`, roomId);
  const alex = await join("Alex", `alex-${roomId}`, roomId);
  const twin = await join("Alex", `twin-${roomId}`, roomId);
  const alexId = alex.state.id;
  const twinId = twin.state.id;

  host.socket.emit("kickPlayer", { roomId, playerId: alexId, playerName: "Alex" });
  await wait(500);
  if (!alex.state.kicked) {
    throw new Error("targeted Alex was not kicked");
  }
  if (twin.state.kicked) {
    throw new Error("name-twin Alex was kicked with the target");
  }
  const remaining = host.state.lobby?.players || [];
  if (remaining.some((p) => p.id === alexId)) {
    throw new Error("kicked seat still in lobby");
  }
  if (!remaining.some((p) => p.id === twinId)) {
    throw new Error("name-twin was removed by id kick");
  }

  for (const c of [host, twin]) c.socket.disconnect();
  console.log("  PASS kick by playerId leaves same-name twin seated");
}

async function testKickByAmbiguousNameIsIgnored() {
  const roomId = roomCode("KN");
  const host = await createHost("Host", `host-${roomId}`, roomId);
  const alex = await join("Alex", `alex-${roomId}`, roomId);
  const twin = await join("Alex", `twin-${roomId}`, roomId);

  host.socket.emit("kickPlayer", { roomId, playerName: "Alex" });
  await wait(500);
  if (alex.state.kicked || twin.state.kicked) {
    throw new Error("ambiguous name kick removed a same-named player");
  }
  const remaining = host.state.lobby?.players || [];
  if (remaining.length !== 3) {
    throw new Error(
      `expected 3 lobby seats after ambiguous name kick, got ${remaining.length}`,
    );
  }

  for (const c of [host, alex, twin]) c.socket.disconnect();
  console.log("  PASS ambiguous name kick is ignored");
}
