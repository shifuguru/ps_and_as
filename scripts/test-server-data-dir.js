/**
 * server/dataDir resolution.
 * Run: node ./scripts/test-server-data-dir.js
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const prevServer = process.env.SERVER_DATA_DIR;
const prevRailway = process.env.RAILWAY_VOLUME_MOUNT_PATH;

function restoreEnv() {
  if (prevServer === undefined) delete process.env.SERVER_DATA_DIR;
  else process.env.SERVER_DATA_DIR = prevServer;
  if (prevRailway === undefined) delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
  else process.env.RAILWAY_VOLUME_MOUNT_PATH = prevRailway;
}

try {
  delete process.env.SERVER_DATA_DIR;
  delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
  // Fresh require each assertion so env is read again.
  delete require.cache[require.resolve("../server/dataDir")];
  let dataDir = require("../server/dataDir");
  assert.strictEqual(
    dataDir.resolveServerDataDir(),
    path.join(__dirname, "..", "server", "data"),
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ps-data-dir-"));
  process.env.RAILWAY_VOLUME_MOUNT_PATH = tmp;
  delete require.cache[require.resolve("../server/dataDir")];
  dataDir = require("../server/dataDir");
  assert.strictEqual(dataDir.resolveServerDataDir(), path.resolve(tmp));
  assert.strictEqual(
    dataDir.serverDataFile("player-stats.json"),
    path.join(path.resolve(tmp), "player-stats.json"),
  );

  const override = path.join(tmp, "override");
  process.env.SERVER_DATA_DIR = override;
  delete require.cache[require.resolve("../server/dataDir")];
  dataDir = require("../server/dataDir");
  assert.strictEqual(dataDir.resolveServerDataDir(), path.resolve(override));
  const ensured = dataDir.ensureServerDataDir();
  assert.strictEqual(ensured, path.resolve(override));
  assert.ok(fs.existsSync(override));

  console.log("test-server-data-dir: all assertions passed");
} finally {
  restoreEnv();
}
