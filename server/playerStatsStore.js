const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "player-stats.json");

const STAT_FIELDS = [
  "roundsPlayed",
  "timesPresident",
  "timesVicePresident",
  "timesViceAsshole",
  "timesAsshole",
  "presidentStreak",
  "bestPresidentStreak",
  "xp",
  "tricksWon",
];

function normalizeStats(raw) {
  const out = {};
  for (const key of STAT_FIELDS) {
    const n = Number(raw?.[key]);
    out[key] = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  return out;
}

function mergeStats(a, b) {
  const left = normalizeStats(a);
  const right = normalizeStats(b);
  const merged = {};
  for (const key of STAT_FIELDS) {
    merged[key] = Math.max(left[key], right[key]);
  }
  return merged;
}

function loadStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch (err) {
    console.warn("[playerStatsStore] load failed:", err?.message || err);
    return {};
  }
}

function saveStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

/** @type {Record<string, { stats: object, updatedAt: string }>} */
let cache = loadStore();

function isValidPlayerId(playerId) {
  if (typeof playerId !== "string") return false;
  const id = playerId.trim();
  if (id.length < 4 || id.length > 128) return false;
  return /^[A-Za-z0-9._:-]+$/.test(id);
}

function getPlayerStats(playerId) {
  if (!isValidPlayerId(playerId)) return null;
  const entry = cache[playerId.trim()];
  if (!entry?.stats) return null;
  return {
    stats: normalizeStats(entry.stats),
    updatedAt: entry.updatedAt || null,
  };
}

function upsertPlayerStats(playerId, stats) {
  if (!isValidPlayerId(playerId)) return null;
  const id = playerId.trim();
  const incoming = normalizeStats(stats);
  const existing = cache[id]?.stats ? normalizeStats(cache[id].stats) : null;
  const merged = existing ? mergeStats(existing, incoming) : incoming;
  const entry = {
    stats: merged,
    updatedAt: new Date().toISOString(),
  };
  cache[id] = entry;
  try {
    saveStore(cache);
  } catch (err) {
    console.warn("[playerStatsStore] save failed:", err?.message || err);
  }
  return entry;
}

module.exports = {
  STAT_FIELDS,
  isValidPlayerId,
  getPlayerStats,
  upsertPlayerStats,
  mergeStats,
  normalizeStats,
};
