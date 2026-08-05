/**
 * Persistent server data directory.
 *
 * Prefer (in order):
 * 1. SERVER_DATA_DIR — explicit override
 * 2. RAILWAY_VOLUME_MOUNT_PATH — set automatically when a Railway volume is attached
 * 3. server/data — local / ephemeral fallback (wiped on Railway redeploy without a volume)
 */
const fs = require("fs");
const path = require("path");

function resolveServerDataDir() {
  const fromEnv =
    process.env.SERVER_DATA_DIR?.trim() ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(__dirname, "data");
}

function ensureServerDataDir(dir = resolveServerDataDir()) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function serverDataFile(filename) {
  return path.join(resolveServerDataDir(), filename);
}

module.exports = {
  resolveServerDataDir,
  ensureServerDataDir,
  serverDataFile,
};
