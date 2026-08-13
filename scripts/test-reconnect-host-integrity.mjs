/**
 * Stale reconnectSecret after seat removal must not hard-block rejoin.
 * Host migration must not orphan the lobby when only away players remain.
 *
 *   SERVER_URL=http://localhost:4020 node scripts/test-reconnect-host-integrity.mjs
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
      hostMigrated: null,
    };
    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", reject);
    socket.on("error", (data) => {
      state.errors.push(data?.message ?? String(data));
    });
    socket.on("connected", (data) => {
      state.id = data.id;
      state.reconnectSecret = data.reconnectSecret ?? null;
    });
    socket.on("lobbyUpdate", (data) => {
      state.lobby = data;
    });
    socket.on("hostMigrated", (data) => {
      state.hostMigrated = data;
    });
    socket.on("playerRemoved", () => {});
  });
}

function roomCode(prefix) {
  return (
    prefix + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 5)
  ).slice(0, 8);
}

async function testStaleSecretAllowsFreshJoin() {
  const code = roomCode("STALE");
  const host = await connectClient("HostA", "prof-host-a");
  host.socket.emit("createRoom", {
    roomId: code,
    name: "HostA",
    profileId: "prof-host-a",
    isPublic: false,
    roomName: "Stale Secret",
  });
  await once(host.socket, "connected");
  const secret = host.state.reconnectSecret;
  if (!secret) throw new Error("expected reconnectSecret");

  const guest = await connectClient("GuestB", "prof-guest-b");
  guest.socket.emit("joinRoom", {
    roomId: code,
    name: "GuestB",
    profileId: "prof-guest-b",
  });
  await once(guest.socket, "connected");

  // Host leaves lobby → removed; guest becomes host. Host keeps stale secret client-side.
  host.socket.emit("leaveRoom", { roomId: code });
  await wait(300);

  // Rejoin with the stale secret — must NOT hard-error.
  host.state.errors = [];
  host.socket.emit("joinRoom", {
    roomId: code,
    name: "HostA",
    profileId: "prof-host-a",
    reconnectSecret: secret,
  });
  const connected = await once(host.socket, "connected");
  if (host.state.errors.some((e) => /Reconnect failed/i.test(e))) {
    throw new Error(`stale secret hard-blocked: ${host.state.errors.join("; ")}`);
  }
  if (!connected?.id) throw new Error("expected fresh connected payload");
  console.log("  stale reconnectSecret → fresh join: OK");
  host.socket.disconnect();
  guest.socket.disconnect();
}

async function testMigrateHostWhenOnlyAwayRemain() {
  const code = roomCode("HOSTX");
  const host = await connectClient("HostC", "prof-host-c");
  host.socket.emit("createRoom", {
    roomId: code,
    name: "HostC",
    profileId: "prof-host-c",
    isPublic: false,
    roomName: "Host Orphan",
  });
  await once(host.socket, "connected");

  const guest = await connectClient("GuestD", "prof-guest-d");
  guest.socket.emit("joinRoom", {
    roomId: code,
    name: "GuestD",
    profileId: "prof-guest-d",
  });
  await once(guest.socket, "connected");
  const guestSecret = guest.state.reconnectSecret;

  // Guest drops (away) — still in room with disconnectedAt.
  guest.socket.disconnect();
  await wait(400);

  // Host leaves while only away guest remains.
  host.socket.emit("leaveRoom", { roomId: code });
  await wait(400);

  // Guest reconnects — must be able to act as host (ensureLivingHost / migrate).
  const guest2 = await connectClient("GuestD", "prof-guest-d");
  guest2.socket.emit("joinRoom", {
    roomId: code,
    name: "GuestD",
    profileId: "prof-guest-d",
    reconnectSecret: guestSecret,
  });
  await once(guest2.socket, "connected");
  await wait(300);
  const lobby = guest2.state.lobby;
  if (!lobby) throw new Error("expected lobbyUpdate after reclaim");
  if (lobby.host !== guest2.state.id) {
    throw new Error(
      `expected guest to become host, host=${lobby.host} guest=${guest2.state.id}`,
    );
  }
  console.log("  migrateHost / ensureLivingHost after away-only lobby: OK");
  guest2.socket.disconnect();
  host.socket.disconnect();
}

async function main() {
  console.log("test-reconnect-host-integrity against", SERVER);
  await testStaleSecretAllowsFreshJoin();
  await testMigrateHostWhenOnlyAwayRemain();
  console.log("test-reconnect-host-integrity: PASS");
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
