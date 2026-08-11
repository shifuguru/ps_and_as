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
  "no dead hand when human seated with bots (3 seats)",
);

assert(
  tableRoster.shouldUseDeadHandForDeal({
    isBotHosted: true,
    players: [
      { id: "cpu-1", isSpectator: false, disconnectedAt: null },
      { id: "cpu-2", isSpectator: false, disconnectedAt: null },
    ],
  }),
  "dead hand for bot-only autopilot (2 seats)",
);

assert(
  tableRoster.shouldUseDeadHandForDeal({
    isBotHosted: true,
    players: [
      { id: "h1", isSpectator: false, disconnectedAt: null },
      { id: "h2", isSpectator: false, disconnectedAt: null },
    ],
  }),
  "dead hand after 2 humans purge bots on bot-hosted room",
);

// After 2-human purge, demoting one human must restore CPUs before next deal.
{
  const botHosted = require("../server/botHostedRooms.js");
  const {
    createGameFromLobby,
    syncFinishedFromEmptyHands,
  } = require("../server/gameBridge.js");

  const understaffed = {
    isBotHosted: true,
    deadHand: true,
    host: "h1",
    hostName: "Alice",
    players: [
      { id: "h1", name: "Alice", isSpectator: false, disconnectedAt: null },
      { id: "h2", name: "Bob", isSpectator: true, disconnectedAt: null },
    ],
    gameState: createGameFromLobby(
      [
        { id: "h1", name: "Alice" },
        { id: "h2", name: "Bob" },
      ],
      4242,
      { deadHand: true, hostId: "h1" },
    ),
  };
  // Simulate mid-round demote of h2 already applied to gameState.
  understaffed.gameState.players = understaffed.gameState.players.filter(
    (p) => p.id !== "h2",
  );
  syncFinishedFromEmptyHands(understaffed.gameState);

  assert(
    botHosted.countHumansSeated(understaffed) === 1,
    "one human seated after demote",
  );
  assert(
    botHosted.seatedBotCount(understaffed) === 0,
    "bots were purged before demote",
  );

  const restored = botHosted.restoreBotsWhenUnderstaffed(understaffed);
  assert(restored === true, "restoreBotsWhenUnderstaffed adds missing CPUs");
  assert(
    botHosted.seatedBotCount(understaffed) === 2,
    "two CPU seats restored",
  );
  assert(
    botHosted.countHumansSeated(understaffed) === 1,
    "remaining human stays seated",
  );

  const lobby =
    tableRoster.buildLobbyPlayersForAuthoritativeRound(understaffed);
  assert(lobby.length >= 2, `lobby has 2+ after restore (${lobby.length})`);
  assert(
    !tableRoster.shouldUseDeadHandForDeal(understaffed),
    "1 human + 2 bots = 3 seats, no dead hand",
  );
  const next = createGameFromLobby(lobby, 7777, {
    deadHand: tableRoster.shouldUseDeadHandForDeal(understaffed),
    hostId: understaffed.host,
  });
  const livingHands = next.players
    .filter((p) => !p.isDeadHand && p.id !== "__dead_hand__")
    .map((p) => p.hand.length);
  assert(
    livingHands.length >= 2,
    `next deal has 2+ living players (${livingHands.length})`,
  );
  assert(
    livingHands.every((n) => n < 54),
    `no 54-card solo deal: ${livingHands.join(",")}`,
  );

  // Idempotent when already staffed.
  assert(
    botHosted.restoreBotsWhenUnderstaffed(understaffed) === false,
    "second restore is a no-op when bots present",
  );

  // Still at MAX_SEATED humans → do not re-add bots.
  const twoHumans = {
    isBotHosted: true,
    players: [
      { id: "h1", isSpectator: false, disconnectedAt: null },
      { id: "h2", isSpectator: false, disconnectedAt: null },
    ],
  };
  assert(
    botHosted.restoreBotsWhenUnderstaffed(twoHumans) === false,
    "do not restore bots while 2 humans seated",
  );
}

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

const tradesBlocking = {
  inGame: true,
  gameState: {
    players: [{ id: "a", hand: [1] }, { id: "b", hand: [] }],
    finishedOrder: ["a", "b"],
    pendingTrades: {
      president: {
        fromId: "b",
        count: 1,
        incoming: [{ suit: "spades", value: 14 }],
        selected: null,
      },
    },
  },
};
assert(
  gameSync.resolveGamePhase(tradesBlocking) === "TRADES",
  "incomplete trades beat round complete in phase",
);

roomPhase.stateVersion = 0;
gameSync.bumpStateVersion(roomPhase);
assert(roomPhase.stateVersion === 1, "version bump");
const attached = gameSync.attachSyncMeta(roomPhase, roomPhase.gameState);
assert(attached.stateVersion === 1 && attached.phase === "ROUND_COMPLETE", "attach meta");

console.log("PASS table roster + game sync");
