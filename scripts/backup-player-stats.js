#!/usr/bin/env node
/**
 * Copy player-stats.json to a timestamped backup file.
 *
 *   node scripts/backup-player-stats.js
 *   node scripts/backup-player-stats.js --file server/data/player-stats.json --out-dir ./backups
 */
const fs = require("fs");
const path = require("path");

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const filePath =
  argValue("--file") ||
  path.join(__dirname, "..", "server", "data", "player-stats.json");
const outDir =
  argValue("--out-dir") ||
  path.join(path.dirname(filePath), "backups");

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(outDir, `player-stats-${stamp}.json`);
fs.copyFileSync(filePath, dest);

const bytes = fs.statSync(dest).size;
console.log(`Backup written: ${dest} (${bytes} bytes)`);
