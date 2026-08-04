/**
 * First-party product analytics — daily counters + recent event ring buffer.
 * Persists under server/data/analytics.json (gitignored).
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "analytics.json");
const MAX_RECENT = 100;
const MAX_PROP_KEYS = 8;
const MAX_PROP_STRING = 64;

/** Client beacons — keep allowlist tight; no free-form event names. */
const CLIENT_EVENTS = new Set([
  "hub_viewed",
  "cta_quick_game",
  "cta_local_game",
  "cta_online_game",
  "quick_game_started",
  "name_setup_completed",
  "install_coach_continued",
]);

/** Server-emitted events (also accepted if posted with source=server in tests). */
const SERVER_EVENTS = new Set([
  "room_created",
  "match_started",
  "round_completed",
  "match_aborted",
  "player_left_in_game",
  "player_disconnected_in_game",
  "player_reconnected",
  "bot_player_demoted",
]);

const ALL_EVENTS = new Set([...CLIENT_EVENTS, ...SERVER_EVENTS]);

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function emptyState() {
  return { days: {}, recent: [] };
}

function loadStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return emptyState();
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!raw || typeof raw !== "object") return emptyState();
    return {
      days: raw.days && typeof raw.days === "object" ? raw.days : {},
      recent: Array.isArray(raw.recent) ? raw.recent : [],
    };
  } catch (err) {
    console.warn("[analyticsStore] load failed:", err?.message || err);
    return emptyState();
  }
}

function saveStore(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DATA_FILE);
}

/** @type {{ days: Record<string, Record<string, number>>, recent: object[] }} */
let cache = loadStore();
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      saveStore(cache);
    } catch (err) {
      console.warn("[analyticsStore] save failed:", err?.message || err);
    }
  }, 250);
}

function sanitizeProps(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  let n = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (n >= MAX_PROP_KEYS) break;
    if (typeof key !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]{0,31}$/.test(key)) {
      continue;
    }
    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      out[key] = value;
      n += 1;
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.trim().slice(0, MAX_PROP_STRING);
      n += 1;
    }
  }
  return out;
}

function isAllowedEvent(name, source) {
  if (typeof name !== "string" || !ALL_EVENTS.has(name)) return false;
  if (source === "client") return CLIENT_EVENTS.has(name);
  return true;
}

/**
 * Record an analytics event.
 * @param {string} name
 * @param {object} [props]
 * @param {{ source?: 'server'|'client', at?: Date }} [opts]
 */
function track(name, props = {}, opts = {}) {
  const source = opts.source === "client" ? "client" : "server";
  if (!isAllowedEvent(name, source)) return false;

  const at = opts.at instanceof Date ? opts.at : new Date();
  const day = utcDayKey(at);
  if (!cache.days[day]) cache.days[day] = {};
  cache.days[day][name] = (cache.days[day][name] || 0) + 1;

  const entry = {
    t: at.toISOString(),
    name,
    source,
    props: sanitizeProps(props),
  };
  cache.recent.unshift(entry);
  if (cache.recent.length > MAX_RECENT) {
    cache.recent.length = MAX_RECENT;
  }
  scheduleSave();
  return true;
}

function sumDay(dayCounters) {
  const out = {};
  if (!dayCounters || typeof dayCounters !== "object") return out;
  for (const [k, v] of Object.entries(dayCounters)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

function listDayKeysDescending(limit = 14) {
  return Object.keys(cache.days)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, limit);
}

/** Snapshot for the live dashboard / API. */
function getSummary({ days = 14 } = {}) {
  const dayKeys = listDayKeysDescending(Math.min(Math.max(Number(days) || 14, 1), 90));
  const today = utcDayKey();
  const todayCounts = sumDay(cache.days[today]);
  const history = dayKeys.map((day) => ({
    day,
    counts: sumDay(cache.days[day]),
  }));

  let totals = {};
  for (const row of history) {
    for (const [k, v] of Object.entries(row.counts)) {
      totals[k] = (totals[k] || 0) + v;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    today,
    todayCounts,
    totals,
    history,
    recent: cache.recent.slice(0, 40),
    eventCatalog: {
      client: [...CLIENT_EVENTS].sort(),
      server: [...SERVER_EVENTS].sort(),
    },
  };
}

/** Test helper — replace in-memory state (does not touch disk until next track). */
function _resetForTests(state = emptyState()) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  cache = {
    days: state.days && typeof state.days === "object" ? { ...state.days } : {},
    recent: Array.isArray(state.recent) ? [...state.recent] : [],
  };
}

function _flushForTests() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveStore(cache);
}

module.exports = {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  track,
  getSummary,
  sanitizeProps,
  isAllowedEvent,
  utcDayKey,
  _resetForTests,
  _flushForTests,
};
