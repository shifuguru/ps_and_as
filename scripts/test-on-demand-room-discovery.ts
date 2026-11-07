import assert from "node:assert/strict";
import { filterPublicRooms, type AvailableRoom } from "../src/services/availableRooms";

const room = (roomId: string, extra: Partial<AvailableRoom> = {}): AvailableRoom => ({
  roomId,
  hostName: "Host",
  playerCount: 2,
  maxPlayers: 8,
  createdAt: 0,
  ...extra,
});

const rooms = [
  room("HUMAN"),
  room("BOTOPN", { isBotHosted: true }),
  room("QALEG", { isBotHosted: true }),
  room("BOTOPN", { isBotHosted: true, onDemandBotTable: true }),
];
assert.deepEqual(filterPublicRooms(rooms), [rooms[0], rooms[3]]);
console.log("PASS on-demand discovery preserves the legacy bot-table filter");
