/**
 * Pure-unit tests for online presence payload parsing.
 * Run: npx tsx ./scripts/test-online-presence.ts
 */
import assert from "assert";
import {
  parseOnlinePlayerCount,
  parseOnlinePlayers,
  parseOnlinePresencePayload,
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
    [{ displayName: "Amy" }, { displayName: "Zed" }],
  );

  assert.deepStrictEqual(parseOnlinePresencePayload({ activePlayers: 2 }), {
    count: 2,
    players: [],
  });
  assert.deepStrictEqual(
    parseOnlinePresencePayload({
      activePlayers: 1,
      players: [{ displayName: "Casey" }],
    }),
    { count: 1, players: [{ displayName: "Casey" }] },
  );
  assert.strictEqual(parseOnlinePresencePayload({ activePlayers: NaN }), null);

  console.log("test-online-presence: ok");
}

run();
