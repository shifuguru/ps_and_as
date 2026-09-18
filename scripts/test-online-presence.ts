/**
 * Pure-unit tests for online presence payload parsing.
 * Run: npx tsx ./scripts/test-online-presence.ts
 */
import assert from "assert";
import {
  EMPTY_ONLINE_PRESENCE,
  mergeOnlinePresence,
  parseOnlinePlayerCount,
  parseOnlinePlayers,
  parseOnlinePresencePayload,
  withLocalPresenceFallback,
} from "../src/services/onlinePresence";

function run() {
  assert.strictEqual(parseOnlinePlayerCount({ activePlayers: 3 }), 3);
  assert.strictEqual(parseOnlinePlayerCount({ activePlayers: 3.9 }), 3);
  assert.strictEqual(parseOnlinePlayerCount({ activePlayers: -2 }), 0);
  assert.strictEqual(parseOnlinePlayerCount({ activePlayers: "4" }), null);
  assert.strictEqual(parseOnlinePlayerCount({}), null);

  assert.deepStrictEqual(parseOnlinePlayers(undefined), []);
  assert.deepStrictEqual(parseOnlinePlayers([]), []);
  assert.deepStrictEqual(
    parseOnlinePlayers([
      { displayName: "Zed" },
      { displayName: "  Amy  " },
      { displayName: "" },
      { displayName: 42 },
      null,
    ]),
    [
      { id: "name:amy", displayName: "Amy" },
      { id: "name:zed", displayName: "Zed" },
    ],
  );

  assert.deepStrictEqual(parseOnlinePresencePayload({ activePlayers: 2 }), {
    count: 2,
    players: [],
    playersProvided: false,
  });
  assert.deepStrictEqual(
    parseOnlinePresencePayload({
      activePlayers: 1,
      players: [{ id: "casey-1", displayName: "Casey" }],
    }),
    {
      count: 1,
      players: [{ id: "casey-1", displayName: "Casey" }],
      playersProvided: true,
    },
  );
  assert.deepStrictEqual(
    parseOnlinePresencePayload({
      activePlayers: 1,
      players: [
        {
          id: "casey-1",
          displayName: "Casey",
          level: 12.8,
          title: "  Table Royalty  ",
          presidents: 7.4,
          roundsPlayed: 31.9,
          lobbyName: "  Friday Table ",
        },
      ],
    }),
    {
      count: 1,
      players: [
        {
          id: "casey-1",
          displayName: "Casey",
          level: 12,
          title: "Table Royalty",
          presidents: 7,
          roundsPlayed: 31,
          lobbyName: "Friday Table",
        },
      ],
      playersProvided: true,
    },
  );
  assert.strictEqual(parseOnlinePresencePayload({ activePlayers: NaN }), null);

  // Count-only production payloads must not wipe known names.
  const withNames = {
    count: 1,
    players: [{ id: "casey-1", displayName: "Casey" }],
    playersProvided: true,
  };
  assert.deepStrictEqual(
    mergeOnlinePresence(withNames, {
      count: 2,
      players: [],
      playersProvided: false,
    }),
    {
      count: 2,
      players: [{ id: "casey-1", displayName: "Casey" }],
      playersProvided: true,
    },
  );
  assert.deepStrictEqual(
    mergeOnlinePresence(withNames, {
      count: 1,
      players: [{ id: "drew-1", displayName: "Drew" }],
      playersProvided: true,
    }),
    {
      count: 1,
      players: [{ id: "drew-1", displayName: "Drew" }],
      playersProvided: true,
    },
  );

  assert.deepStrictEqual(
    withLocalPresenceFallback(
      { count: 1, players: [], playersProvided: false },
      "Mike",
    ),
    {
      count: 1,
      players: [{ id: "local", displayName: "Mike" }],
      playersProvided: false,
    },
  );
  assert.deepStrictEqual(
    withLocalPresenceFallback(EMPTY_ONLINE_PRESENCE, "Mike"),
    EMPTY_ONLINE_PRESENCE,
  );
  assert.deepStrictEqual(
    withLocalPresenceFallback(
      {
        count: 1,
        players: [{ id: "casey-1", displayName: "Casey" }],
        playersProvided: true,
      },
      "Mike",
    ),
    {
      count: 1,
        players: [{ id: "casey-1", displayName: "Casey" }],
      playersProvided: true,
    },
  );

  console.log("test-online-presence: ok");
}

run();
