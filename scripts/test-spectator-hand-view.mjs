/**
 * Offline unit: spectators must not receive any real hand faces via viewForMember.
 * Seated sync must not leak full playerHands or dealSeed.
 *   node scripts/test-spectator-hand-view.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { viewForMember } = require("../server/gameStateView.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const state = {
  dealSeed: 123456,
  playerHands: {
    "host-1": [
      { suit: "spades", value: 3 },
      { suit: "hearts", value: 14 },
    ],
    "guest-1": [{ suit: "clubs", value: 10 }],
  },
  players: [
    {
      id: "host-1",
      name: "Host",
      hand: [
        { suit: "spades", value: 3 },
        { suit: "hearts", value: 14 },
      ],
    },
    {
      id: "guest-1",
      name: "Guest",
      hand: [{ suit: "clubs", value: 10 }],
    },
  ],
};

const seated = viewForMember(state, {
  id: "host-1",
  isSpectator: false,
});
assert(seated.spectator === false, "seated member is not a spectator");
assert(
  seated.gameState.players[0].hand[0].value === 3,
  "seated member sees own cards",
);
assert(
  seated.gameState.players[1].hand[0].hidden === true,
  "seated member sees opponent placeholders",
);
assert(
  seated.gameState.dealSeed === undefined,
  "seated sync must not include dealSeed",
);
assert(
  seated.gameState.playerHands &&
    Object.keys(seated.gameState.playerHands).length === 1 &&
    seated.gameState.playerHands["host-1"],
  "seated sync must only include own playerHands entry",
);
assert(
  !seated.gameState.playerHands["guest-1"],
  "seated sync must not include opponent playerHands",
);

const spectator = viewForMember(state, {
  id: "spec-1",
  isSpectator: true,
});
assert(spectator.spectator === true, "spectator flagged");
for (const p of spectator.gameState.players) {
  assert(
    p.hand.every((c) => c.hidden === true && c.value === 0),
    `spectator must not see faces for ${p.id}`,
  );
}
assert(
  spectator.gameState.dealSeed === undefined,
  "spectator sync must not include dealSeed",
);
assert(
  !spectator.gameState.playerHands ||
    Object.keys(spectator.gameState.playerHands).length === 0,
  "spectator sync must not include playerHands",
);

console.log("PASS spectator hand view masked");
