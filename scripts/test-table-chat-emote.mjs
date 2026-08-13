#!/usr/bin/env node
/** Smoke test: tableEmote relays to room members. */
import { io } from "socket.io-client";

const URL = process.env.SERVER_URL || "http://localhost:4000";
const roomId = `TC${Date.now().toString().slice(-6)}`;

function connect(name, profileId) {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { transports: ["websocket"], forceNew: true });
    const timer = setTimeout(() => reject(new Error(`${name} connect timeout`)), 8000);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

const host = await connect("host", "tc-host");
const guest = await connect("guest", "tc-guest");

await new Promise((resolve, reject) => {
  host.once("connected", resolve);
  host.emit("createRoom", {
    roomId,
    name: "Host",
    profileId: "tc-host",
    isPublic: false,
  });
  setTimeout(() => reject(new Error("createRoom timeout")), 5000);
});

await new Promise((resolve, reject) => {
  guest.once("connected", resolve);
  guest.emit("joinRoom", {
    roomId,
    name: "Guest",
    profileId: "tc-guest",
  });
  setTimeout(() => reject(new Error("joinRoom timeout")), 5000);
});

const seen = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("tableEmote not received")), 5000);
  guest.on("tableEmote", (payload) => {
    clearTimeout(timer);
    resolve(payload);
  });
  host.emit("tableEmote", { roomId, emoteId: "gg" });
});

if (seen.playerId == null || seen.text !== "GG") {
  throw new Error(`unexpected payload: ${JSON.stringify(seen)}`);
}

host.close();
guest.close();
console.log("test-table-chat-emote: ok");
