/**
 * Join vs Spectate policy for live tables.
 *   npx ts-node --transpile-only ./scripts/test-online-join-policy.ts
 */
import * as assert from "assert";
import {
  listedRoomShowsSpectate,
  shouldHoldSpectatorStartGameInLobby,
} from "../src/services/availableRooms";

const twoPlayerLive = {
  inGame: true,
  roundInProgress: true,
  deadHandSeatOpen: true,
  playerCount: 2,
};

assert.strictEqual(
  listedRoomShowsSpectate(twoPlayerLive),
  true,
  "2p in-play with dead-hand seat must offer Spectate",
);

assert.strictEqual(
  listedRoomShowsSpectate({
    ...twoPlayerLive,
    roundInProgress: false,
  }),
  true,
  "2p between rounds with dead-hand seat must offer Spectate (not Join)",
);

assert.strictEqual(
  listedRoomShowsSpectate({
    inGame: false,
    deadHandSeatOpen: true,
    playerCount: 2,
  }),
  false,
  "lobby tables stay Join",
);

assert.strictEqual(
  listedRoomShowsSpectate({
    inGame: true,
    deadHandSeatOpen: false,
    playerCount: 3,
  }),
  false,
  "full 3p in-game tables do not offer Spectate",
);

assert.strictEqual(
  shouldHoldSpectatorStartGameInLobby("BOTOPN"),
  true,
  "bot-open spectators stay in lobby",
);
assert.strictEqual(
  shouldHoldSpectatorStartGameInLobby("botopn"),
  true,
  "bot-open code is case-insensitive",
);
assert.strictEqual(
  shouldHoldSpectatorStartGameInLobby("AB3K9Q"),
  false,
  "standard in-game spectators must enter GameScreen",
);
assert.strictEqual(
  shouldHoldSpectatorStartGameInLobby(null),
  false,
  "missing room id is not a bot table",
);

console.log("test-online-join-policy: all assertions passed");
