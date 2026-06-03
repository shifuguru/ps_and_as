/**
 * Table roster + game sync unit checks (no server required).
 * node scripts/test-table-roster.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const tableRoster = require("../server/tableRoster.js");
const gameSync = require("../server/gameSync.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function mkRoom(overrides = {}) {
  return {
    isBotHosted: true,
    deadHand: true,
    players: [
      { id: "cpu-1", isBot: true, isSpectator: false, disconnectedAt: null, name: "Amy" },
      { id: "cpu-2", isBot: true, isSpectator: false, disconnectedAt: null, name: "Ben" },
      { id: "spec-1", isSpectator: true, disconnectedAt: null, name: "Player" },
    ],
    gameState: {
      players: [
        { id: "cpu-1", hand: [] },
        { id: "cpu-2", hand: [] },
        { id: "__dead_hand__", isDeadHand: true, hand: [] },
      ],
      finishedOrder: [],
      readyForNextRound: { "spec-1": true },
    },
    ...overrides,
  };
}

const room = mkRoom();
const promoted = require("../server/botHostedRooms.js").promoteReadySpectators(room);
assert(promoted.length === 1, "promote one spectator");
assert(promoted[0].id === "spec-1", "spectator promoted");
assert(room.players.some((p) => p.id === "cpu-2"), "cpu-2 still at table");
assert(!room.players.some((p) => p.id === "cpu-2" && p.isSpectator), "cpu-2 seated");

const dealLobby = tableRoster.buildLobbyPlayersForAuthoritativeRound({
  ...room,
  players: room.players.map((p) =>
    p.id === "spec-1" ? { ...p, isSpectator: false } : p,
  ),
});
assert(
  dealLobby.map((p) => p.id).join(",") === "cpu-1,cpu-2,spec-1",
  `ring order ${dealLobby.map((p) => p.id).join(",")}`,
);
assert(
  !tableRoster.shouldUseDeadHandForDeal({
    ...room,
    players: room.players.map((p) =>
      p.id === "spec-1" ? { ...p, isSpectator: false } : p,
    ),
  }),
  "no dead hand when human seated",
);

const r2 = mkRoom({ deadHand: false, gameState: { players: [{ id: "cpu-1" }, { id: "cpu-2" }, { id: "human-old" }], readyForNextRound: { "spec-1": true } } });
require("../server/botHostedRooms.js").promoteReadySpectators(r2);
assert(r2.players.filter((p) => p.id.startsWith("cpu")).length === 2, "bots kept without dead-hand flag");

const roomPhase = {
  inGame: true,
  gameState: {
    players: [{ id: "a", hand: [1] }, { id: "b", hand: [] }],
    finishedOrder: [],
    pendingTrades: {},
  },
};
assert(gameSync.resolveGamePhase(roomPhase) === "PLAYING", "playing phase");
roomPhase.gameState.finishedOrder = ["a", "b"];
assert(gameSync.resolveGamePhase(roomPhase) === "ROUND_COMPLETE", "round complete phase");

roomPhase.stateVersion = 0;
gameSync.bumpStateVersion(roomPhase);
assert(roomPhase.stateVersion === 1, "version bump");
const attached = gameSync.attachSyncMeta(roomPhase, roomPhase.gameState);
assert(attached.stateVersion === 1 && attached.phase === "ROUND_COMPLETE", "attach meta");

console.log("PASS table roster + game sync");
