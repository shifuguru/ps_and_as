/**
 * Socket.io client for QA League bots (same surface as human players).
 */
import { io } from "socket.io-client";

/**
 * @param {object} opts
 * @param {string} opts.serverUrl
 * @param {string} opts.roomId
 * @param {string} opts.displayName
 * @param {string} opts.profileId
 * @param {(event: string, data: unknown) => void} [opts.onEvent]
 */
export function createQABotClient(opts) {
  const {
    serverUrl,
    roomId,
    displayName,
    profileId,
    onEvent = () => {},
  } = opts;

  const socket = io(serverUrl, { transports: ["websocket"], timeout: 12_000 });

  const client = {
    socket,
    roomId,
    displayName,
    profileId,
    gameState: /** @type {object | null} */ (null),
    stateVersion: /** @type {number | null} */ (null),
    isSpectator: false,
    errors: /** @type {string[]} */ ([]),
    roundEnded: /** @type {object | null} */ (null),
    nextRoundSeen: false,
    connected: false,
  };

  socket.on("connect", () => onEvent("connect", null));
  socket.on("connect_error", (err) => onEvent("connect_error", err));
  socket.on("connected", (data) => {
    client.connected = true;
    client.isSpectator = !!data?.isSpectator;
    onEvent("connected", data);
  });
  socket.on("error", (data) => {
    const msg = data?.message ?? String(data);
    client.errors.push(msg);
    onEvent("error", data);
  });
  socket.on("gameStateSync", (data) => {
    const gs = data?.gameState ?? null;
    client.gameState = gs;
    client.stateVersion =
      typeof gs?.stateVersion === "number"
        ? gs.stateVersion
        : typeof data?.stateVersion === "number"
          ? data.stateVersion
          : client.stateVersion;
    if (typeof data?.spectator === "boolean") {
      client.isSpectator = data.spectator;
    }
    onEvent("gameStateSync", data);
  });
  socket.on("roundEnded", (data) => {
    client.roundEnded = data;
    onEvent("roundEnded", data);
  });
  socket.on("nextRoundStarting", (data) => {
    client.nextRoundSeen = true;
    onEvent("nextRoundStarting", data);
  });
  socket.on("playerReadyUpdate", (data) => onEvent("playerReadyUpdate", data));

  return client;
}

/**
 * @param {ReturnType<typeof createQABotClient>} client
 */
export function waitForConnect(client, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    if (client.socket.connected && client.connected) {
      resolve(client);
      return;
    }
    const t = setTimeout(
      () => reject(new Error("Timeout waiting for socket connect")),
      timeoutMs,
    );
    const onConnect = () => {
      clearTimeout(t);
      client.socket.off("connect_error", onErr);
      resolve(client);
    };
    const onErr = (err) => {
      clearTimeout(t);
      client.socket.off("connect", onConnect);
      reject(err);
    };
    client.socket.once("connect", onConnect);
    client.socket.once("connect_error", onErr);
  });
}

/**
 * @param {import('socket.io-client').Socket} socket
 * @param {string} event
 * @param {number} [timeoutMs]
 */
export function once(socket, event, timeoutMs = 15_000) {
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
 * @param {ReturnType<typeof createQABotClient>} client
 */
export async function joinRoom(client, clientBuildId = "dev") {
  await waitForConnect(client);
  client.socket.emit("joinRoom", {
    roomId: client.roomId,
    name: client.displayName,
    profileId: client.profileId,
    clientBuildId,
  });
  await once(client.socket, "connected");
  return client;
}

/**
 * @param {ReturnType<typeof createQABotClient>} client
 */
export function requestGameState(client) {
  client.socket.emit("requestGameState", { roomId: client.roomId });
}

/**
 * @param {ReturnType<typeof createQABotClient>} client
 * @param {object} action
 */
export function emitGameAction(client, action) {
  client.socket.emit("gameAction", { roomId: client.roomId, action });
}

/**
 * @param {ReturnType<typeof createQABotClient>} client
 */
export function emitReadyForNextRound(client) {
  client.socket.emit("playerReadyForNextRound", { roomId: client.roomId });
}

/**
 * @param {ReturnType<typeof createQABotClient>} client
 */
export function disconnectClient(client) {
  client.socket.disconnect();
}
