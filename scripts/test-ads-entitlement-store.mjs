/**
 * Server-side store: client cannot grant adsRemoved; setAdsRemoved can.
 * Run: node ./scripts/test-ads-entitlement-store.mjs
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Isolate store file
const dataDir = path.join(__dirname, "..", "server", "data");
const dataFile = path.join(dataDir, "player-stats.json");
const backup = fs.existsSync(dataFile)
  ? fs.readFileSync(dataFile, "utf8")
  : null;

try {
  if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
  // Clear require cache for fresh store
  const storePath = require.resolve("../server/playerStatsStore.js");
  delete require.cache[storePath];
  const store = require("../server/playerStatsStore.js");

  const id = "google:test-ads-user";

  // Client PUT trying to set adsRemoved must be stripped
  let entry = store.upsertPlayerStats(id, { xp: 10, roundsPlayed: 1 }, {
    displayName: "Tester",
    adsRemoved: true,
  });
  assert.ok(entry);
  assert.notStrictEqual(entry.profile?.adsRemoved, true);

  // Server grant
  entry = store.setAdsRemoved(id, true);
  assert.strictEqual(entry.profile?.adsRemoved, true);

  // Later client profile update must not clear entitlement
  entry = store.upsertPlayerStats(id, null, { displayName: "Tester2" });
  assert.strictEqual(entry.profile?.adsRemoved, true);
  assert.strictEqual(entry.profile?.displayName, "Tester2");

  // Client cannot unset via false
  entry = store.upsertPlayerStats(id, null, { adsRemoved: false });
  assert.strictEqual(entry.profile?.adsRemoved, true);

  console.log("test-ads-entitlement-store: ok");
} finally {
  if (backup != null) fs.writeFileSync(dataFile, backup);
  else if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
}
