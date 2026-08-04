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

const APPEARANCE_VALUES = new Set(["system", "light", "dark"]);
const CONTRAST_VALUES = new Set(["auto", "light", "dark"]);

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

function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  if (typeof raw.displayName === "string") {
    const name = raw.displayName.trim().slice(0, 20);
    if (name) out.displayName = name;
  }
  if (APPEARANCE_VALUES.has(raw.appearance)) {
    out.appearance = raw.appearance;
  }
  if (CONTRAST_VALUES.has(raw.textContrast)) {
    out.textContrast = raw.textContrast;
  }
  if (typeof raw.feltTint === "string") {
    const tint = raw.feltTint.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(tint)) out.feltTint = tint;
  }
  // Entitlement: only trust true from server-side setters; clients strip this.
  if (raw.adsRemoved === true) out.adsRemoved = true;
  return Object.keys(out).length ? out : null;
}

/** Strip purchase entitlements from client-supplied profile bodies. */
function stripClientEntitlements(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const { adsRemoved: _ignored, ...rest } = raw;
  return rest;
}

/** Incoming fields override existing; omit empty incoming. Never clears adsRemoved. */
function mergeProfile(existing, incoming) {
  const left = normalizeProfile(existing) || {};
  const right = normalizeProfile(incoming) || {};
  const merged = { ...left, ...right };
  // Once granted, adsRemoved sticks even if incoming omitted it.
  if (left.adsRemoved === true) merged.adsRemoved = true;
  return Object.keys(merged).length ? merged : null;
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

/** @type {Record<string, { stats: object, profile?: object, updatedAt: string }>} */
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
  if (!entry?.stats && !entry?.profile) return null;
  return {
    stats: entry.stats ? normalizeStats(entry.stats) : normalizeStats({}),
    profile: normalizeProfile(entry.profile),
    updatedAt: entry.updatedAt || null,
  };
}

function upsertPlayerStats(playerId, stats, profile) {
  if (!isValidPlayerId(playerId)) return null;
  const id = playerId.trim();
  const existing = cache[id] || {};
  const hasStats = stats && typeof stats === "object";
  // Client PUTs must not set adsRemoved — strip before normalize/merge.
  const incomingProfile = normalizeProfile(stripClientEntitlements(profile));

  if (!hasStats && !incomingProfile && !existing.stats && !existing.profile) {
    return null;
  }

  const mergedStats = hasStats
    ? existing.stats
      ? mergeStats(existing.stats, stats)
      : normalizeStats(stats)
    : existing.stats
      ? normalizeStats(existing.stats)
      : normalizeStats({});

  const mergedProfile = incomingProfile
    ? mergeProfile(existing.profile, incomingProfile)
    : normalizeProfile(existing.profile);

  const entry = {
    stats: mergedStats,
    ...(mergedProfile ? { profile: mergedProfile } : {}),
    updatedAt: new Date().toISOString(),
  };
  cache[id] = entry;
  try {
    saveStore(cache);
  } catch (err) {
    console.warn("[playerStatsStore] save failed:", err?.message || err);
  }
  return {
    stats: entry.stats,
    profile: entry.profile || null,
    updatedAt: entry.updatedAt,
  };
}

/** Server-only entitlement grant (Stripe webhook). */
function setAdsRemoved(playerId, removed) {
  if (!isValidPlayerId(playerId)) return null;
  const id = playerId.trim();
  const existing = cache[id] || {};
  const profile = normalizeProfile(existing.profile) || {};
  if (removed) profile.adsRemoved = true;
  else delete profile.adsRemoved;

  const entry = {
    stats: existing.stats
      ? normalizeStats(existing.stats)
      : normalizeStats({}),
    profile,
    updatedAt: new Date().toISOString(),
  };
  cache[id] = entry;
  try {
    saveStore(cache);
  } catch (err) {
    console.warn("[playerStatsStore] save failed:", err?.message || err);
  }
  return {
    stats: entry.stats,
    profile: entry.profile || null,
    updatedAt: entry.updatedAt,
  };
}

module.exports = {
  STAT_FIELDS,
  isValidPlayerId,
  getPlayerStats,
  upsertPlayerStats,
  setAdsRemoved,
  mergeStats,
  normalizeStats,
  normalizeProfile,
  mergeProfile,
  stripClientEntitlements,
};
