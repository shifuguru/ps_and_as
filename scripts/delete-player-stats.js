#!/usr/bin/env node
/**
 * Delete one player-stats record from server/data/player-stats.json.
 *
 * Usage (on a machine with access to the data file, e.g. Railway shell):
 *   node scripts/delete-player-stats.js --id 'google:123...'
 *   node scripts/delete-player-stats.js --id 'device-...' --file /path/to/player-stats.json
 *
 * Confirm the requester owns the id before running (see SECURITY.md).
 */
const fs = require("fs");
const path = require("path");

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const playerId = (argValue("--id") || "").trim();
const filePath =
  argValue("--file") ||
  path.join(__dirname, "..", "server", "data", "player-stats.json");

if (!playerId) {
  console.error("Usage: node scripts/delete-player-stats.js --id <playerId> [--file path]");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
  console.error("player-stats.json is not an object map");
  process.exit(1);
}

if (!Object.prototype.hasOwnProperty.call(raw, playerId)) {
  console.error(`No entry for id: ${playerId}`);
  process.exit(2);
}

delete raw[playerId];
const tmp = `${filePath}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(raw, null, 2));
fs.renameSync(tmp, filePath);
console.log(`Deleted entry for ${playerId} from ${filePath}`);
