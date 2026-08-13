/**
 * Online smoke test — host starts with skipDealAnimations.
 * Verifies gameStateSync carries the room flag and play state stays aligned.
 *
 *   npm run server
 *   node scripts/test-multiplayer-skip-deal-animations.mjs
 */
import { io } from "socket.io-client";

const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";
const ROOM = "S" + String(Math.floor(Math.random() * 900000 + 100000)).slice(0, 6);

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function once(socket, event, timeoutMs = 12000) {
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
      skipDealAnimations: null,
      startGameSkip: null,
      lobbySkip: null,
      errors: [],
      syncCount: 0,
    };

    socket.on("connect", () => resolve({ socket, state, name, profileId }));
    socket.on("connect_error", (err) => reject(err));
    socket.on("error", (data) => state.errors.push(data?.message ?? String(data)));
    socket.on("connected", (data) => {
      state.id = data.profileId ?? data.id;
    });
    socket.on("lobbyUpdate", (data) => {
      if (typeof data?.skipDealAnimations === "boolean") {
        state.lobbySkip = data.skipDealAnimations;
      }
    });
    socket.on("gameStateSync", (data) => {
      state.gameState = data.gameState;
      state.syncCount += 1;
      if (typeof data?.skipDealAnimations === "boolean") {
        state.skipDealAnimations = data.skipDealAnimations;
      }
    });
    socket.on("startGame", (data) => {
      if (typeof data?.skipDealAnimations === "boolean") {
        state.startGameSkip = data.skipDealAnimations;
      }
    });
  });
}

function pickOpeningPlay(hand) {
  const threes = hand.filter((c) => c.value === 3);
  if (!threes.length) return null;
  const clubs = threes.find((c) => c.suit === "clubs");
  return clubs ? [clubs] : [threes[0]];
}

function pileSignature(gs) {
  return JSON.stringify(gs?.pile ?? []);
}

function trickActionCount(gs) {
  return gs?.currentTrick?.actions?.length ?? 0;
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

async function main() {
  console.log(`Skip-deal-animations online test — room ${ROOM}`);

  const host = await connectClient("Host", "profile-skip-host");
  host.socket.emit("createRoom", {
    roomId: ROOM,
    name: "Host",
    profileId: "profile-skip-host",
    isPublic: false,
  });
  await once(host.socket, "connected");

  host.socket.emit("updateRoomOptions", {
    roomId: ROOM,
    skipDealAnimations: true,
  });
  await wait(150);

  const guest = await joinPlayer(ROOM, "Guest", "profile-skip-guest");
  guest.socket.emit("toggleReady", { roomId: ROOM, ready: true });
  await wait(150);

  host.socket.emit("startGame", {
    roomId: ROOM,
    skipDealAnimations: true,
  });

  const [hostStart, guestStart] = await Promise.all([
    once(host.socket, "startGame"),
    once(guest.socket, "startGame"),
  ]);

  if (!hostStart.skipDealAnimations || !guestStart.skipDealAnimations) {
    throw new Error(
      `startGame skip flag missing — host=${hostStart.skipDealAnimations} guest=${guestStart.skipDealAnimations}`,
    );
  }
  console.log("PASS startGame broadcasts skipDealAnimations=true");

  await wait(600);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const h = host.state.gameState;
    const g = guest.state.gameState;
    if (
      h &&
      g &&
      h.currentPlayerIndex === g.currentPlayerIndex &&
      host.state.skipDealAnimations === true &&
      guest.state.skipDealAnimations === true
    ) {
      break;
    }
    await wait(100);
  }

  for (const c of [host, guest]) {
    if (c.state.skipDealAnimations !== true) {
      throw new Error(
        `${c.name} gameStateSync skipDealAnimations=${c.state.skipDealAnimations} (expected true)`,
      );
    }
    if (!c.state.gameState?.players?.length) {
      throw new Error(`${c.name} missing gameState after start`);
    }
  }
  console.log("PASS gameStateSync includes skipDealAnimations=true on both clients");

  const hState = host.state.gameState;
  const gState = guest.state.gameState;
  if (hState.currentPlayerIndex !== gState.currentPlayerIndex) {
    throw new Error(
      `currentPlayerIndex mismatch host=${hState.currentPlayerIndex} guest=${gState.currentPlayerIndex}`,
    );
  }

  const currentId = hState.players[hState.currentPlayerIndex]?.id;
  const actor = [host, guest].find((c) => c.state.id === currentId);
  if (!actor) {
    throw new Error(`No client matches opener ${currentId}`);
  }

  const actorHand =
    actor.state.gameState.players.find((p) => p.id === actor.state.id)?.hand ??
    [];
  const openingCards = pickOpeningPlay(actorHand);
  if (!openingCards) {
    throw new Error(`${actor.name} has no 3 to open — re-run test`);
  }

  actor.socket.emit("gameAction", {
    roomId: ROOM,
    action: { type: "play", cards: openingCards },
  });
  await wait(600);

  if (actor.state.errors.length) {
    throw new Error(`Play rejected: ${actor.state.errors.join("; ")}`);
  }

  host.socket.emit("requestGameState", { roomId: ROOM });
  guest.socket.emit("requestGameState", { roomId: ROOM });
  await wait(300);

  const hostPile = pileSignature(host.state.gameState);
  const guestPile = pileSignature(guest.state.gameState);
  if (hostPile !== guestPile) {
    throw new Error(`Pile desync after play\n  host=${hostPile}\n  guest=${guestPile}`);
  }

  const hostTrick = trickActionCount(host.state.gameState);
  const guestTrick = trickActionCount(guest.state.gameState);
  if (hostTrick !== guestTrick || hostTrick < 1) {
    throw new Error(
      `Trick action desync host=${hostTrick} guest=${guestTrick}`,
    );
  }

  console.log("PASS play state aligned after opener card");
  console.log(
    `  opener=${actor.name} cards=${openingCards.map((c) => `${c.value}${c.suit[0]}`).join(",")}`,
  );
  console.log(`  pileLen=${host.state.gameState.pile?.length ?? 0}`);

  for (const c of [host, guest]) c.socket.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL", err.message ?? err);
  process.exit(1);
});
