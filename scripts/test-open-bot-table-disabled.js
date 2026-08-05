/**
 * Open Bot Table off-by-default.
 * Run: node ./scripts/test-open-bot-table-disabled.js
 */
const assert = require("assert");

delete process.env.ENABLE_OPEN_BOT_TABLE;
// Fresh require after env change — module reads env at call time, not load time.
const botHosted = require("../server/botHostedRooms");

assert.strictEqual(botHosted.isOpenBotTableEnabled(), false);

const rooms = {
  BOTOPN: {
    isBotHosted: true,
    isPublic: true,
    inGame: true,
    gameState: { players: [] },
    players: [{ id: "cpu-1", isBot: true }],
    _botTurnTimer: setTimeout(() => {}, 60_000),
  },
};
const emitted = [];
const ctx = {
  rooms,
  io: {
    to: () => ({
      emit: (event, payload) => emitted.push({ event, payload }),
    }),
  },
  broadcastAvailableRooms: () => emitted.push({ event: "broadcastAvailableRooms" }),
  isRoomListedPublic: () => true,
};

assert.strictEqual(botHosted.ensureBotHostedRooms(ctx), null);
assert.strictEqual(rooms.BOTOPN, undefined, "BOTOPN room must be removed");
assert.ok(
  emitted.some((e) => e.event === "gameAborted"),
  "should notify occupants",
);

process.env.ENABLE_OPEN_BOT_TABLE = "1";
assert.strictEqual(botHosted.isOpenBotTableEnabled(), true);
delete process.env.ENABLE_OPEN_BOT_TABLE;

console.log("test-open-bot-table-disabled: all assertions passed");
