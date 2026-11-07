import assert from "node:assert/strict";
import Module from "node:module";
import { gameTerminology } from "../src/utils/gameTerminology";
import {
  getKingsNameSync,
  preloadGamePreferences,
  setKingsName,
  subscribeGamePreferences,
} from "../src/services/gamePreferences";

async function main() {
  const original = "P's & A's: Presidents, Vice President, PRESIDENT, president's";
  assert.equal(gameTerminology(original, false), original);
  assert.equal(
    gameTerminology(original, true),
    "K's & A's: Kings, Vice King, KING, king's",
  );
  assert.equal(gameTerminology("P’s & A’s; Vice Pres.", true), "K’s & A’s; Vice King");
  assert.equal(gameTerminology("presidential Presidentship", true), "presidential Presidentship");

  const key = "@ps_and_as_kings_name";
  const values = new Map<string, string>([[key, "1"]]);
  let failWrite = false;
  const storagePath = require.resolve("@react-native-async-storage/async-storage");
  const storageModule = new Module(storagePath);
  storageModule.exports = {
    default: {
      getItem: async (name: string) => values.get(name) ?? null,
      setItem: async (name: string, value: string) => {
        if (failWrite) throw new Error("storage failed");
        values.set(name, value);
      },
    },
  };
  require.cache[storagePath] = storageModule;
  assert.equal(getKingsNameSync(), false);
  await preloadGamePreferences();
  assert.equal(getKingsNameSync(), true, "saved choice is restored");
  let notifications = 0;
  const unsubscribe = subscribeGamePreferences(() => { notifications += 1; });
  await setKingsName(false);
  assert.equal(getKingsNameSync(), false);
  assert.equal(values.get(key), "0");
  await setKingsName(true);
  assert.equal(values.get(key), "1");
  assert.equal(notifications, 2);
  failWrite = true;
  await assert.rejects(setKingsName(false), /storage failed/);
  assert.equal(getKingsNameSync(), true, "failed writes leave the previous choice active");
  unsubscribe();
  console.log("test-game-terminology: ok");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
