import { MockAdapter } from "../src/game/network";

async function run() {
  const m = new MockAdapter();
  m.on("message", (ev) => console.log("EVENT:", JSON.stringify(ev)));
  m.createRoom("demo", "Host");
  m.joinRoom("demo", "Alice");
  m.joinRoom("demo", "Bob");
  // assume connected events assign ids; wait a bit
  await new Promise((r) => setTimeout(r, 50));
  // simulate toggles: pick first id from internal rooms (we can't access private rooms), so use emitLobby hack
  // Instead directly call toggleReady using observed ids from connected events is complex here; instead just call startGame
  m.startGame("demo");
  await new Promise((r) => setTimeout(r, 50));
}

run().catch((e) => console.error(e));
