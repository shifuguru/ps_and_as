/**
 * Headless multiplayer smoke test — run with server up:
 *   npm run server
 *   node scripts/test-multiplayer.mjs
 */
import { io } from "socket.io-client";

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const ROOM = "T" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 6);

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function connectClient(name, profileId) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER, { transports: ["websocket"], timeout: 8000 });
    const state = { id: null, gameState: null, dealSeed: null, errors: [] };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", (err) => reject(err));
    socket.on("error", (data) => state.errors.push(data?.message ?? String(data)));
    socket.on("connected", (data) => {
      state.id = data.profileId ?? data.id;
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
    });
    socket.on("startGame", (data) => {
      state.dealSeed = data.dealSeed ?? null;
    });
  });
}

function pickOpeningPlay(hand) {
  const threes = hand.filter((c) => c.value === 3);
  if (!threes.length) return null;
  const clubs = threes.find((c) => c.suit === "clubs");
  return clubs ? [clubs] : [threes[0]];
}

function once(socket, event, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

async function joinPlayer(name, profileId) {
  const client = await connectClient(name, profileId);
  client.socket.emit("joinRoom", {
    roomId: ROOM,
    name,
    profileId,
    clientBuildId: "dev",
  });
  await once(client.socket, "connected");
  return client;
}

async function main() {
  console.log(`Connecting to ${SERVER}, room ${ROOM}`);

  const host = await connectClient("Host", "profile-host");
  host.socket.emit("createRoom", {
    roomId: ROOM,
    name: "Host",
    profileId: "profile-host",
    isPublic: false,
  });
  await once(host.socket, "connected");

  const guest = await joinPlayer("Guest", "profile-guest");
  const third = await joinPlayer("Third", "profile-third");
  const fourth = await joinPlayer("Fourth", "profile-fourth");
  if (fourth.state.errors.length) {
    throw new Error(`Fourth join failed: ${fourth.state.errors.join("; ")}`);
  }
  console.log("PASS lobby accepts 4th player pre-game");
  fourth.socket.disconnect();
  await wait(100);

  for (const c of [guest, third]) {
    c.socket.emit("toggleReady", { roomId: ROOM, ready: true });
  }
  await wait(200);

  host.socket.emit("startGame", { roomId: ROOM });
  await Promise.all([
    once(host.socket, "startGame"),
    once(guest.socket, "startGame"),
    once(third.socket, "startGame"),
  ]);

  await wait(500);

  const clients = [host, guest, third];
  for (const c of clients) {
    if (c.state.dealSeed == null) {
      throw new Error(`${c.name} startGame missing dealSeed`);
    }
    c.socket.emit("requestGameState", { roomId: ROOM });
  }
  await wait(400);

  const seeds = new Set(clients.map((c) => c.state.dealSeed));
  if (seeds.size !== 1) {
    throw new Error("dealSeed mismatch between clients");
  }

  const hState = host.state.gameState;
  if (!hState?.players?.length) {
    throw new Error("Missing gameState after start");
  }
  if (hState.players.length !== 3) {
    throw new Error(`Expected 3 living players, got ${hState.players.length}`);
  }

  const currentId = hState.players[hState.currentPlayerIndex]?.id;
  const actor = clients.find((c) => c.state.id === currentId);
  if (!actor) {
    throw new Error(`No client matches current player ${currentId}`);
  }

  const actorHand =
    actor.state.gameState.players.find((p) => p.id === actor.state.id)?.hand ?? [];
  const openingCards = pickOpeningPlay(actorHand);
  if (!openingCards) {
    throw new Error(`Current player ${actor.name} has no 3 to open — re-run test`);
  }

  actor.socket.emit("gameAction", {
    roomId: ROOM,
    action: { type: "play", cards: openingCards },
  });
  await wait(800);

  if (actor.state.errors.length) {
    throw new Error(`Play rejected: ${actor.state.errors.join("; ")}`);
  }

  for (const c of clients) {
    c.socket.emit("requestGameState", { roomId: ROOM });
  }
  await wait(300);

  for (const c of clients) {
    const pileLen = c.state.gameState?.pile?.length ?? 0;
    if (pileLen !== openingCards.length) {
      throw new Error(
        `${c.name} pile=${pileLen}, expected ${openingCards.length}`,
      );
    }
  }

  console.log("PASS multiplayer smoke test (3 players)");
  console.log(`  dealSeed=${host.state.dealSeed}`);
  console.log(
    `  opener=${actor.name} played ${openingCards.map((c) => `${c.value}${c.suit[0]}`).join(",")}`,
  );

  for (const c of clients) c.socket.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL", err.message ?? err);
  process.exit(1);
});
